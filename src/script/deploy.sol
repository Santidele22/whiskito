// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
//import "@chainlink/contracts/src/v0.8/shared/mocks/MockV3Aggregator.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Script, console} from "forge-std/Script.sol";
import {Fund} from "./fund.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();

        //MockV3Aggregator mockPriceFeed = new MockV3Aggregator(8, 2000e8);
        AggregatorV3Interface priceFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);

        Fund fund = new Fund(address(priceFeed));
        console.log("Counter deployed at:", address(fund));

        vm.stopBroadcast();
    }
}
