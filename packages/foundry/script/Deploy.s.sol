//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
//import {DeployMonadMatch} from "./DeployMonadMatch.s.sol";
import {DeployGameEscrow} from "./DeployGameEscrow.s.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Run this when you want to deploy multiple contracts at once
 *
 * Example: yarn deploy # runs this script(without`--file` flag)
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        // Deploys all your contracts sequentially
        // Add new deployments here when needed

        // DeployYourContract deployYourContract = new DeployYourContract();
        // deployYourContract.run();

        // DeployMonadMatch deployMonadMatch = new DeployMonadMatch();
        // deployMonadMatch.run();

        // Deploy another contract
        DeployGameEscrow deployGameEscrow = new DeployGameEscrow();
        deployGameEscrow.run();
    }
}
