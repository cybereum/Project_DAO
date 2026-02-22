// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IKleros {
    function createDispute(uint256 _milestoneId) external returns (uint256);
}
