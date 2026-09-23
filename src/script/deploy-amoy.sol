// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import {Script, console} from "forge-std/Script.sol";
import {Fund} from "./fund.sol";

contract DeployAmoyScript is Script {
    address internal constant AMOY_ETH_USD_FEED = 0xF0d50568e3A7e8259E16663972b11910F89BD8e7;

    function run() public {
        vm.startBroadcast();

        Fund fund = new Fund(AMOY_ETH_USD_FEED);

        vm.stopBroadcast();

        console.log("Fund deployed at:", address(fund));
    }
}
