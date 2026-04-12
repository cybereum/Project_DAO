// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IProjectDAOCore — Interface for sibling contracts to call Core
 * @notice Governance, Commerce, and Network sub-contracts use this interface
 *         to access shared state (agents, members, escrow, fees) held in
 *         ProjectDAOCore. Only authorized modules can call mutating functions.
 */
interface IProjectDAOCore {
    // ─── Read-only (no access control) ──────────────────────────────────

    function owner() external view returns (address);
    function isPaused() external view returns (bool);
    function isAgent(address _addr) external view returns (bool);
    function isMember(address _addr) external view returns (bool);
    function getMemberVotingPower(address _addr) external view returns (uint256);
    function getAgentEscrowBalance(address _addr) external view returns (uint256);
    function getAgentReputation(address _addr) external view returns (uint256);
    function getReputationTier(address _addr) external view returns (uint256);
    function getMessagingFeeForAgent(address _addr) external view returns (uint256);
    function cybereumTreasury() external view returns (address);
    function cybereumFeeBps() external view returns (uint256);

    // ─── Mutating (onlyAuthorizedModule) ────────────────────────────────

    /// @notice Deduct native ETH from an agent's escrow. Only callable by authorized modules.
    function deductEscrow(address _agent, uint256 _amount) external;

    /// @notice Credit native ETH to an agent's escrow. Only callable by authorized modules.
    function creditEscrow(address _agent, uint256 _amount) external;

    /// @notice Collect protocol fee on behalf of a module. Returns fee amount.
    function collectNativeFeeForModule(uint256 _amount, string calldata _context) external returns (uint256);

    /// @notice Collect exit fee on behalf of a module. Returns fee amount.
    function collectExitFeeForModule(uint256 _amount, string calldata _context) external returns (uint256);

    /// @notice Register a new member (for onboarding from Commerce sub-contract).
    function registerMemberForModule(address _member, uint256 _votingPower) external;

    /// @notice Register a new agent (for onboarding from Commerce sub-contract).
    function registerAgentForModule(address _agent, string calldata _metadataURI) external;

    /// @notice Record a member stake (for onboarding from Commerce sub-contract).
    function recordStakeForModule(address _member, uint256 _stake) external;

    /// @notice Remove a member (for leaveDAO from Commerce sub-contract).
    function removeMemberForModule(address _member) external;

    /// @notice Refund a member's stake (for leaveDAO from Commerce sub-contract).
    function refundStakeForModule(address _member) external returns (uint256);

    // ─── Payment request access (for PKI envelope validation in Network) ─

    function getPaymentRequestRequester(uint256 _requestId) external view returns (address);
    function getPaymentRequestPayer(uint256 _requestId) external view returns (address);
}
