// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";
import {Script, console} from "forge-std/Script.sol";
import {Fund} from "./fund.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();
        MockV3Aggregator mockPriceFeed = new MockV3Aggregator(8, 2000e8);

        Fund fund = new Fund(address(mockPriceFeed));
        console.log("Counter deployed at:", address(fund));

        vm.stopBroadcast();
    }
}
