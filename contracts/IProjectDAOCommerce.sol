// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IProjectDAOCommerce — Interface for cross-contract agreement queries
 * @notice The Network sub-contract calls this to validate service agreement
 *         parties for endorsements and encrypted envelope attachment.
 */
interface IProjectDAOCommerce {
    /// @notice Check if an address is a party (client, provider, or arbiter) to an agreement.
    function isAgreementParty(uint256 _agreementId, address _who) external view returns (bool);

    /// @notice Get agreement status and parties for endorsement validation.
    function getAgreementForEndorsement(uint256 _agreementId) external view returns (
        bool exists,
        uint8 status, // 0=Active, 1=Delivered, 2=Completed, 3=Disputed, 4=Cancelled
        address client,
        address provider
    );

    /// @notice Check active obligations for leaveDAO validation.
    function activeObligations(address _agent) external view returns (
        uint256 activeProjects,
        uint256 activeAgreements,
        uint256 activeStreams
    );
}
