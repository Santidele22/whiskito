// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import {Script, console} from "forge-std/Script.sol";
import {Fund} from "./fund.sol";
import {PolUsdAdapter} from "./pol-usd-adapter.sol";

contract DeployAmoyScript is Script {
    // En Amoy NO hay feed POL/USD: se deriva con las dos patas reales del directorio
    // oficial de Chainlink para esa red (MATIC y POL son el mismo activo).
    /// @dev LINK / USD — proxy de Amoy, `decimals()` = 8, heartbeat 120 s.
    address internal constant AMOY_LINK_USD_FEED = 0xc2e2848e28B9fE430Ab44F55a8437a33802a219C;
    /// @dev LINK / MATIC — proxy de Amoy, `decimals()` = 18, heartbeat 3600 s.
    address internal constant AMOY_LINK_MATIC_FEED = 0x408D97c89c141e60872C0835e18Dd1E670CD8781;

    // Antigüedad máxima aceptada para cada pata: 2× el heartbeat más lento (3600 s), así
    // una pata que se salte un heartbeat no rompe la lectura y una realmente vieja sí.
    uint256 internal constant AMOY_MAX_AGE = 7200;

    function run() public {
        vm.startBroadcast();

        // Primero el adaptador POL/USD (Fund lo necesita en su constructor).
        PolUsdAdapter polUsdAdapter = new PolUsdAdapter(AMOY_LINK_USD_FEED, AMOY_LINK_MATIC_FEED, AMOY_MAX_AGE);

        // Después el Fund, apuntando al adaptador. Su interfaz no cambia: el adaptador
        // implementa AggregatorV3Interface y declara 8 decimales.
        Fund fund = new Fund(address(polUsdAdapter));

        vm.stopBroadcast();

        // Las DOS direcciones se pegan en src/js/config.js → NETWORKS[80002]
        // (y el bloque del deploy, que también imprime el run, en deployBlock).
        console.log("PolUsdAdapter deployed at:", address(polUsdAdapter));
        console.log("Fund deployed at:", address(fund));
    }
}
