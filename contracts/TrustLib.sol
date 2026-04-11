// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title TrustLib — Cross-agent endorsements + trust score
 * @notice External library holding the Trust Graph subsystem for
 *         Project_DAO. The main contract exposes thin wrappers that do
 *         pre-checks (read ServiceAgreement state, read reputation) and
 *         forward into this library for validation, mutation, and event
 *         emission. Because Solidity invokes external library functions
 *         via DELEGATECALL, events emitted here appear under the main
 *         contract's address and storage writes land in the main
 *         contract's storage via the `TrustLib.Store` pointer.
 */
library TrustLib {
    struct Endorsement {
        uint256 id;
        address endorser;
        address endorsed;
        uint256 agreementId;
        string  capability;
        uint256 weight;
        uint256 timestamp;
        bool    revoked;
    }

    /// @dev Aggregate storage for the trust graph. Lives in the main
    ///      contract as a private state variable.
    struct Store {
        uint256 currentEndorsementId;
        mapping(uint256 => Endorsement) endorsements;
        mapping(address => uint256) agentTrustScore;
        mapping(address => uint256) agentEndorsementCount;
        mapping(bytes32 => bool) endorsementExists;
        mapping(address => uint256[]) agentEndorsementIds;
        // Reserved for future fields so appending to this struct does not
        // shift the layout of unrelated state variables in Project_DAO.
        // See OpenZeppelin's storage-gap pattern for the rationale.
        uint256[50] __gap;
    }

    uint256 internal constant TRUST_FULL_WEIGHT_PERIOD = 180 days;
    uint256 internal constant TRUST_HALF_WEIGHT_PERIOD = 365 days;
    uint256 internal constant MAX_CAPABILITY_LEN = 64;

    event EndorsementCreated(
        uint256 indexed endorsementId,
        address indexed endorser,
        address indexed endorsed,
        uint256 agreementId,
        string capability,
        uint256 weight
    );
    event EndorsementRevoked(
        uint256 indexed endorsementId,
        address indexed endorser,
        address indexed endorsed
    );

    function createEndorsement(
        Store storage self,
        uint256 agreementId,
        address endorser,
        address endorsed,
        uint256 weightToUse,
        string calldata capability
    ) external returns (uint256 id) {
        uint256 cLen = bytes(capability).length;
        require(cLen > 0 && cLen <= MAX_CAPABILITY_LEN, "Invalid capability length.");

        bytes32 dedupKey = keccak256(abi.encodePacked(endorser, endorsed, agreementId));
        require(!self.endorsementExists[dedupKey], "Already endorsed for this agreement.");
        self.endorsementExists[dedupKey] = true;

        if (self.currentEndorsementId == 0) {
            self.currentEndorsementId = 1;
        }
        id = self.currentEndorsementId++;
        self.endorsements[id] = Endorsement({
            id:           id,
            endorser:     endorser,
            endorsed:     endorsed,
            agreementId:  agreementId,
            capability:   capability,
            weight:       weightToUse,
            timestamp:    block.timestamp,
            revoked:      false
        });

        self.agentTrustScore[endorsed] += weightToUse;
        self.agentEndorsementCount[endorsed]++;
        self.agentEndorsementIds[endorsed].push(id);

        emit EndorsementCreated(id, endorser, endorsed, agreementId, capability, weightToUse);
    }

    function revokeEndorsement(
        Store storage self,
        uint256 endorsementId,
        address caller
    ) external {
        Endorsement storage e = self.endorsements[endorsementId];
        require(e.id > 0, "Endorsement not found.");
        require(e.endorser == caller, "Only the endorser can revoke.");
        require(!e.revoked, "Endorsement already revoked.");

        e.revoked = true;

        if (self.agentTrustScore[e.endorsed] >= e.weight) {
            self.agentTrustScore[e.endorsed] -= e.weight;
        } else {
            self.agentTrustScore[e.endorsed] = 0;
        }
        if (self.agentEndorsementCount[e.endorsed] > 0) {
            self.agentEndorsementCount[e.endorsed]--;
        }

        emit EndorsementRevoked(endorsementId, caller, e.endorsed);
    }

    function getTrustScore(Store storage self, address agent) external view returns (
        uint256 trustScore,
        uint256 endorsementCount
    ) {
        return (self.agentTrustScore[agent], self.agentEndorsementCount[agent]);
    }

    function getAgentEndorsements(
        Store storage self,
        address agent,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory endorsementIds, uint256 total) {
        uint256[] storage allIds = self.agentEndorsementIds[agent];
        total = allIds.length;
        if (offset >= total) return (new uint256[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        endorsementIds = new uint256[](end - offset);
        for (uint256 i = 0; i < endorsementIds.length; i++) {
            endorsementIds[i] = allIds[offset + i];
        }
    }

    function getEndorsement(Store storage self, uint256 endorsementId) external view returns (
        uint256 id,
        address endorser,
        address endorsed,
        uint256 agreementId,
        string memory capability,
        uint256 weight,
        uint256 timestamp,
        bool revoked
    ) {
        Endorsement storage e = self.endorsements[endorsementId];
        require(e.id > 0, "Endorsement not found.");
        return (e.id, e.endorser, e.endorsed, e.agreementId, e.capability, e.weight, e.timestamp, e.revoked);
    }

    function getTimeWeightedTrustScore(Store storage self, address agent) external view returns (
        uint256 weightedScore,
        uint256 activeEndorsements
    ) {
        uint256[] storage ids = self.agentEndorsementIds[agent];
        for (uint256 i = 0; i < ids.length; i++) {
            Endorsement storage e = self.endorsements[ids[i]];
            if (e.revoked) continue;

            activeEndorsements++;
            uint256 age = block.timestamp - e.timestamp;

            if (age < TRUST_FULL_WEIGHT_PERIOD) {
                weightedScore += e.weight;
            } else if (age < TRUST_HALF_WEIGHT_PERIOD) {
                weightedScore += e.weight / 2;
            } else {
                weightedScore += e.weight / 4;
            }
        }
    }
}
