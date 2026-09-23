// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {Test} from "forge-std/Test.sol";
import {MockV3Aggregator} from "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";
import {PolUsdAdapter} from "../src/script/pol-usd-adapter.sol";
import {Fund} from "../src/script/fund.sol";

/// @dev Tests del adaptador POL/USD y del piso de donación de `Fund`.
///      Los valores de la matemática son los REALES medidos en Amoy (2026-09-23):
///      LINK/USD = 12,27089800e8 y LINK/MATIC = 121,63022359234446194e18.
contract PolUsdAdapterTest is Test {
    // LINK / USD: 8 decimales (medido en el proxy de Amoy).
    uint8 internal constant LINK_USD_DECIMALS = 8;
    int256 internal constant LINK_USD_ANSWER = 1227089800; // 12,27089800
    // LINK / MATIC: 18 decimales (medido en el proxy de Amoy).
    uint8 internal constant LINK_MATIC_DECIMALS = 18;
    int256 internal constant LINK_MATIC_ANSWER = 121630223592344461940; // 121,630223592344461940

    /// @dev 1227089800 * 10**18 / 121630223592344461940 = 10088691, o sea $0,10088691
    ///      con los 8 decimales del resultado.
    int256 internal constant EXPECTED_POL_USD_ANSWER = 10088691;

    uint256 internal constant MAX_AGE = 7200;

    MockV3Aggregator internal linkUsdFeed;
    MockV3Aggregator internal linkMaticFeed;
    PolUsdAdapter internal adapter;

    function setUp() public {
        linkUsdFeed = new MockV3Aggregator(LINK_USD_DECIMALS, LINK_USD_ANSWER);
        linkMaticFeed = new MockV3Aggregator(LINK_MATIC_DECIMALS, LINK_MATIC_ANSWER);
        adapter = new PolUsdAdapter(address(linkUsdFeed), address(linkMaticFeed), MAX_AGE);
    }

    /// @dev Los decimales del resultado son los de la convención de USD, no los de una pata.
    function test_decimalsIsEight() public view {
        assertEq(adapter.decimals(), 8);
    }

    /// @dev La descripción se explica sola (nombra la fórmula).
    function test_descriptionNamesTheFormula() public view {
        assertEq(adapter.description(), "POL / USD (LINK/USD / LINK/MATIC)");
    }

    /// @dev La matemática: POL/USD = LINK/USD ÷ LINK/MATIC, escalado a 8 decimales.
    ///      Con las patas en 8 y 18 decimales el exponente es `18 + 8 - 8 = 18`, así que
    ///      el resultado es directamente `usd * 10**18 / matic`, con la división entera
    ///      al final.
    function test_math_derivesPolUsdFromBothLegs() public view {
        (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) =
            adapter.latestRoundData();

        assertEq(answer, EXPECTED_POL_USD_ANSWER, "POL/USD mal derivado");
        // Cruce de sanidad: el entero es $0,10088691 con 8 decimales.
        assertEq(uint256(answer), 10088691);
        // El compuesto no tiene ronda propia: la identidad es la de la pata de USD.
        assertEq(roundId, linkUsdFeed.latestRound());
        assertEq(answeredInRound, linkUsdFeed.latestRound());
        // Nace y se actualiza en el mismo instante.
        assertEq(startedAt, updatedAt);
        assertEq(updatedAt, block.timestamp);
    }

    /// @dev `updatedAt` es el MÍNIMO de las dos patas: con una pata vieja, el compuesto se
    ///      declara tan viejo como ella (no como la más nueva).
    function test_updatedAtIsTheOldestLeg() public {
        // La pata de USD se actualiza ahora; la de MATIC queda con la hora del setUp.
        vm.warp(block.timestamp + 60);
        linkUsdFeed.updateAnswer(LINK_USD_ANSWER);
        uint256 maticUpdatedAt = linkMaticFeed.latestTimestamp();

        (,, uint256 startedAt, uint256 updatedAt,) = adapter.latestRoundData();

        assertEq(updatedAt, maticUpdatedAt, "updatedAt deberia ser el de la pata mas vieja");
        assertLt(updatedAt, linkUsdFeed.latestTimestamp());
        assertEq(startedAt, maticUpdatedAt);
    }

    /// @dev Una pata más vieja que `maxAge` revierte con el error custom y el `updatedAt`
    ///      de la culpable. `MockV3Aggregator.updateAnswer` sella `block.timestamp`.
    function test_staleLegReverts() public {
        uint256 staleUpdatedAt = linkMaticFeed.latestTimestamp();

        // `vm.warp` mueve el reloj, pero NO el `updatedAt` de las patas: quedan viejas.
        vm.warp(block.timestamp + MAX_AGE + 1);

        vm.expectRevert(abi.encodeWithSelector(PolUsdAdapter.StalePrice.selector, staleUpdatedAt));
        adapter.latestRoundData();
    }

    /// @dev El borde: una pata con exactamente `maxAge` de antigüedad TODAVÍA sirve.
    function test_legAtExactlyMaxAgeStillServes() public {
        vm.warp(block.timestamp + MAX_AGE);

        (, int256 answer,,,) = adapter.latestRoundData();

        assertEq(answer, EXPECTED_POL_USD_ANSWER);
    }

    /// @dev Refrescar las patas viejas lo vuelve a habilitar (el adaptador no se queda
    ///      trabado): con las dos al día, la lectura vuelve a dar el precio.
    function test_refreshingBothLegsRecovers() public {
        vm.warp(block.timestamp + MAX_AGE + 1);
        vm.expectRevert();
        adapter.latestRoundData();

        linkUsdFeed.updateAnswer(LINK_USD_ANSWER);
        linkMaticFeed.updateAnswer(LINK_MATIC_ANSWER);

        (, int256 answer,,,) = adapter.latestRoundData();
        assertEq(answer, EXPECTED_POL_USD_ANSWER);
    }

    /// @dev answer 0 en cualquiera de las dos patas → InvalidPrice.
    function test_zeroAnswerReverts() public {
        linkUsdFeed.updateAnswer(0);
        vm.expectRevert(PolUsdAdapter.InvalidPrice.selector);
        adapter.latestRoundData();

        linkUsdFeed.updateAnswer(LINK_USD_ANSWER);
        linkMaticFeed.updateAnswer(0);
        vm.expectRevert(PolUsdAdapter.InvalidPrice.selector);
        adapter.latestRoundData();
    }

    /// @dev answer negativa en cualquiera de las dos patas → InvalidPrice.
    function test_negativeAnswerReverts() public {
        linkUsdFeed.updateAnswer(-1);
        vm.expectRevert(PolUsdAdapter.InvalidPrice.selector);
        adapter.latestRoundData();

        linkUsdFeed.updateAnswer(LINK_USD_ANSWER);
        linkMaticFeed.updateAnswer(-1e18);
        vm.expectRevert(PolUsdAdapter.InvalidPrice.selector);
        adapter.latestRoundData();
    }

    /// @dev No hay histórico que componer: `getRoundData` revierte explícito.
    function test_getRoundDataReverts() public {
        vm.expectRevert(PolUsdAdapter.NoHistoricalRounds.selector);
        adapter.getRoundData(1);
    }

    /// @dev `version()` es fijo y documentado.
    function test_versionIsFixed() public view {
        assertEq(adapter.version(), 1);
    }

    /// @dev Cuando el exponente `decMatic + 8 - decUsd` daría negativo no hay escala
    ///      posible sin dividir: el constructor rechaza la combinación en vez de redondear
    ///      en silencio. Acá la pata de USD declara MÁS decimales que los que la de MATIC
    ///      puede compensar (24 vs 8 → exponente -8).
    function test_unscalableDecimalsIsRejected() public {
        MockV3Aggregator twentyFourDecimalsFeed = new MockV3Aggregator(24, int256(uint256(LINK_USD_ANSWER) * 1e16));
        MockV3Aggregator eightDecimalsMaticFeed = new MockV3Aggregator(8, 12163022359);

        vm.expectRevert(PolUsdAdapter.UnscalableDecimals.selector);
        new PolUsdAdapter(address(twentyFourDecimalsFeed), address(eightDecimalsMaticFeed), MAX_AGE);
    }

    /// @dev La escala no está hardcodeada: sale de los decimales LEÍDOS de cada feed. Con
    ///      la pata de USD en 18 decimales el mismo precio real da el mismo resultado que
    ///      con 8 decimales (el exponente pasa de 18 a 8).
    function test_scaleFollowsBothFeedsDecimals() public {
        MockV3Aggregator eighteenDecimalsFeed = new MockV3Aggregator(18, int256(uint256(LINK_USD_ANSWER) * 1e10));
        PolUsdAdapter scaledAdapter = new PolUsdAdapter(address(eighteenDecimalsFeed), address(linkMaticFeed), MAX_AGE);

        (uint8 usdDecimals, uint8 maticDecimals) = scaledAdapter.legDecimals();
        assertEq(usdDecimals, 18);
        assertEq(maticDecimals, 18);

        (, int256 answer,,,) = scaledAdapter.latestRoundData();

        assertEq(answer, EXPECTED_POL_USD_ANSWER, "el escalado deberia depender de decimals() de cada feed");
    }

    /// @dev Control negativo del escalado: la escala sale de `decimals()`, así que dos
    ///      feeds que declaran decimales distintos no pueden dar el mismo entero — y el
    ///      mismo feed de USD tampoco da el mismo entero si se le cambia el exponente de
    ///      escala a mano (acá, dos adaptadores con los MISMOS values crudos y distinta
    ///      pata de MATIC). Prueba que el resultado no es "lo que devolvió la pata".
    function test_scaleTestCanFail_mixedDecimals() public {
        // Mismos precios crudos que el caso de la matemática...
        MockV3Aggregator eighteenDecimalsFeed = new MockV3Aggregator(18, int256(uint256(LINK_USD_ANSWER) * 1e10));
        MockV3Aggregator eightDecimalsMaticFeed = new MockV3Aggregator(8, 12163022359);

        // ...pero exponente 8+8-18 = -2 → el constructor lo rechaza, que ya es un fail
        // ruidoso si alguien asume decimales fijos en vez de leerlos.
        vm.expectRevert(PolUsdAdapter.UnscalableDecimals.selector);
        new PolUsdAdapter(address(eighteenDecimalsFeed), address(eightDecimalsMaticFeed), MAX_AGE);

        // Y con una combinación válida pero distinta (USD 6 dec, MATIC 18 dec), la misma
        // pata de MATIC da un entero distinto: la escala la manda el exponente.
        MockV3Aggregator sixDecimalsFeed = new MockV3Aggregator(6, 12270898);
        PolUsdAdapter otherAdapter = new PolUsdAdapter(address(sixDecimalsFeed), address(linkMaticFeed), MAX_AGE);
        (, int256 otherAnswer,,,) = otherAdapter.latestRoundData();

        assertTrue(otherAnswer != EXPECTED_POL_USD_ANSWER, "6 decimales no puede dar el mismo entero que 8");
    }
}

/// @dev El piso de donación de `Fund` vive en el contrato, no en la UI.
contract FundMinimumTest is Test {
    uint8 internal constant FEED_DECIMALS = 8;
    int256 internal constant ETH_USD_ANSWER = 2000e8; // mismo mock que el deploy local

    Fund internal fund;

    function setUp() public {
        MockV3Aggregator feed = new MockV3Aggregator(FEED_DECIMALS, ETH_USD_ANSWER);
        fund = new Fund(address(feed));
    }

    /// @dev 0.01 USD con 18 decimales (antes 50 * 1e16 = 0.5 USD).
    function test_minimumUsdIsOneCent() public view {
        assertEq(fund.MINIMUM_USD(), 1e16);
    }

    /// @dev 0.005 USD queda por debajo del piso: revierte.
    function test_fundBelowMinimumReverts() public {
        // Con ETH a 2000 USD, 0.005 USD son 2500 gwei.
        uint256 belowMinimum = 2500 gwei;
        assertLt(fund.getConversionRate(belowMinimum), fund.MINIMUM_USD());

        vm.deal(address(this), 1 ether);
        vm.expectRevert(Fund.InsufficientAmount.selector);
        fund.fund{value: belowMinimum}(address(0xBEEF));
    }

    /// @dev Justo en el piso (0.01 USD = 5000 gwei) pasa.
    function test_fundAtMinimumPasses() public {
        uint256 atMinimum = 5000 gwei;
        assertEq(fund.getConversionRate(atMinimum), fund.MINIMUM_USD());

        vm.deal(address(this), 1 ether);
        fund.fund{value: atMinimum}(address(0xBEEF));

        assertEq(fund.balances(address(0xBEEF)), atMinimum);
    }

    /// @dev Un valor por encima del piso pasa y acumula el saldo del beneficiario.
    function test_fundAboveMinimumPasses() public {
        uint256 aboveMinimum = 0.1 ether;
        assertGt(fund.getConversionRate(aboveMinimum), fund.MINIMUM_USD());

        vm.deal(address(this), 1 ether);
        fund.fund{value: aboveMinimum}(address(0xBEEF));

        assertEq(fund.balances(address(0xBEEF)), aboveMinimum);
    }
}
