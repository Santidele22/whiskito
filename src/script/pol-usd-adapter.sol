// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title PolUsdAdapter — POL/USD derivado de dos feeds reales de Chainlink
/// @notice En Polygon Amoy **no existe** un feed POL/USD (el directorio oficial no lo
///         lista), pero sí existen las dos patas que lo componen:
///         `LINK / USD` (8 decimales) y `LINK / MATIC` (18 decimales). MATIC y POL son
///         el mismo activo (Polygon renombró MATIC a POL; los feeds conservan el nombre
///         viejo), así que:
///
///             POL/USD = (LINK/USD) / (LINK/MATIC)
///
///         El cociente sale con los decimales del feed de USD (8, la convención de los
///         feeds de USD), así que el resultado se escala a 8 decimales y es
///         intercambiable con cualquier otro aggregator de USD: `Fund` lo recibe por
///         constructor igual que recibía el feed ETH/USD y no cambia su interfaz.
/// @dev `updatedAt` que se devuelve es el **mínimo** de las dos patas: el precio
///      compuesto existe recién cuando la pata más vieja se actualizó. Devolver el
///      máximo diría "fresco" con una pata vieja adentro. El compuesto **no tiene ronda
///      propia**, así que `roundId` y `answeredInRound` se toman de la pata de USD: son
///      la identidad del feed que manda en la valuación, no la de una ronda compuesta.
contract PolUsdAdapter is AggregatorV3Interface {
    AggregatorV3Interface internal immutable linkUsdFeed;
    AggregatorV3Interface internal immutable linkMaticFeed;

    /// @dev Decimales de cada pata, leídos en el constructor (nunca asumidos), igual que
    ///      hace `Fund` con su propio feed. `priceScaleExponent` es el exponente de escala
    ///      que deja el cociente en los 8 decimales del resultado, y por eso depende de
    ///      los decimales de las DOS patas.
    uint8 internal immutable linkUsdDecimals;
    uint8 internal immutable linkMaticDecimals;
    uint256 internal immutable priceScaleExponent;

    /// @dev Antigüedad máxima aceptada para cada pata, en segundos. Se pasa por
    ///      constructor porque cada par tiene su heartbeat (medido en Amoy: 120 s para
    ///      LINK/USD y 3600 s para LINK/MATIC).
    uint256 public immutable maxAge;

    // Errores custom
    error StalePrice(uint256 legUpdatedAt);
    error InvalidPrice();
    error UnscalableDecimals();
    error NoHistoricalRounds();

    constructor(address linkUsdFeedAddress, address linkMaticFeedAddress, uint256 _maxAge) {
        linkUsdFeed = AggregatorV3Interface(linkUsdFeedAddress);
        linkMaticFeed = AggregatorV3Interface(linkMaticFeedAddress);
        maxAge = _maxAge;

        linkUsdDecimals = linkUsdFeed.decimals();
        linkMaticDecimals = linkMaticFeed.decimals();

        // El cociente sale con los decimales de las dos patas, y hay que dejarlo en los 8
        // del resultado:
        //   answer = (linkUsd / 10**decUsd) / (linkMatic / 10**decMatic) * 10**8
        //          = linkUsd * 10**(decMatic + 8 - decUsd) / linkMatic
        // Así que el único exponente es `decMatic + 8 - decUsd`, calculado con los
        // decimales leídos de cada feed. Si diera negativo no habría forma de escalar sin
        // perder precisión (dividir): se rechaza en el constructor en vez de redondear
        // en silencio.
        if (linkMaticDecimals + 8 < linkUsdDecimals) revert UnscalableDecimals();
        priceScaleExponent = uint256(linkMaticDecimals) + 8 - uint256(linkUsdDecimals);
    }

    /// @inheritdoc AggregatorV3Interface
    /// @dev Convención de los feeds de USD: 8 decimales, para que sea intercambiable con
    ///      el feed ETH/USD que `Fund` esperaba.
    function decimals() external pure override returns (uint8) {
        return 8;
    }

    /// @inheritdoc AggregatorV3Interface
    function description() external pure override returns (string memory) {
        return "POL / USD (LINK/USD / LINK/MATIC)";
    }

    /// @inheritdoc AggregatorV3Interface
    /// @dev Fijo y documentado: `1` = primera versión de este adaptador. No hay historia
    ///      que versionar porque el compuesto no tiene rondas propias.
    function version() external pure override returns (uint256) {
        return 1;
    }

    /// @dev Decimales de cada pata, tal como se leyeron en el constructor. Expuestos para
    ///      poder auditar contra qué feeds está configurado el adaptador.
    function legDecimals() external view returns (uint8 usdDecimals, uint8 maticDecimals) {
        return (linkUsdDecimals, linkMaticDecimals);
    }

    /// @inheritdoc AggregatorV3Interface
    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        (uint80 usdRoundId, uint256 usdPrice, uint256 usdUpdatedAt) = _readLeg(linkUsdFeed);
        (, uint256 maticPrice, uint256 maticUpdatedAt) = _readLeg(linkMaticFeed);

        // El compuesto es tan fresco como su pata más vieja.
        updatedAt = usdUpdatedAt < maticUpdatedAt ? usdUpdatedAt : maticUpdatedAt;

        // POL/USD = (LINK/USD) / (LINK/MATIC), dejado en 8 decimales:
        //   answer = usdPrice * 10**(linkMaticDecimals + 8 - linkUsdDecimals) / maticPrice
        // La división entera va al final, para no arrastrar el redondeo.
        answer = int256((usdPrice * (10 ** priceScaleExponent)) / maticPrice);

        // El compuesto no tiene ronda propia: la identidad es la de la pata de USD.
        roundId = usdRoundId;
        answeredInRound = usdRoundId;
        // `startedAt == updatedAt`: el valor compuesto existe recién cuando la pata más
        // vieja se actualizó, así que nace y se actualiza en el mismo instante.
        startedAt = updatedAt;
    }

    /// @inheritdoc AggregatorV3Interface
    /// @dev Un precio compuesto no tiene histórico: no hay rondas propias que consultar, y
    ///      componerlas a partir de las rondas de las dos patas inventaría un pasado que
    ///      nunca existió (las rondas no están alineadas). Se revierte explícito.
    function getRoundData(uint80) external pure override returns (uint80, int256, uint256, uint256, uint80) {
        revert NoHistoricalRounds();
    }

    /// @dev Lee una pata y valida que sirva: precio > 0, `updatedAt` distinto de 0 y no
    ///      futuro, y no más vieja que `maxAge`. Cualquier falla revierte con el error
    ///      custom correspondiente (`StalePrice` lleva el `updatedAt` de la pata culpable).
    function _readLeg(AggregatorV3Interface feed)
        private
        view
        returns (uint80 roundId, uint256 price, uint256 updatedAt)
    {
        int256 legAnswer;
        (roundId, legAnswer,, updatedAt,) = feed.latestRoundData();

        // `updatedAt` en 0, en el futuro, o fuera del heartbeat declarado.
        if (updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxAge) {
            revert StalePrice(updatedAt);
        }
        if (legAnswer <= 0) revert InvalidPrice();

        price = uint256(legAnswer);
    }
}
