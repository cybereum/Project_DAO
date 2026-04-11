// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title FeatureKitLib — Feature request pipeline
 * @notice External library holding the feature-kit submission / upvote
 *         pipeline for Project_DAO. The main contract enforces
 *         authorization (onlyMember / onlyRegisteredAgent / onlyOwner)
 *         and forwards into this library for validation, mutation, and
 *         event emission.
 */
library FeatureKitLib {
    struct FeatureKit {
        uint256 id;
        address submitter;
        uint8   priority;    // 0=low, 1=medium, 2=high, 3=critical
        uint8   status;      // 0=pending, 1=validated, 2=queued, 3=rejected, 4=implemented
        string  metadataURI;
        uint256 voteCount;
        uint256 submittedAt;
    }

    struct Store {
        uint256 currentFeatureKitId;
        mapping(uint256 => FeatureKit) featureKits;
        mapping(uint256 => mapping(address => bool)) featureKitVoted;
    }

    event FeatureKitSubmitted(
        uint256 indexed kitId,
        address indexed submitter,
        uint8 priority,
        string metadataURI,
        uint256 timestamp
    );
    event FeatureKitUpvoted(uint256 indexed kitId, address indexed voter, uint256 newVoteCount);
    event FeatureKitStatusChanged(uint256 indexed kitId, uint8 newStatus, string reason);

    /**
     * @notice Submit a new feature kit.
     * @param submitter   Address of the submitter (typically msg.sender).
     * @param metadataURI IPFS URI pointing to structured feature-kit JSON.
     * @param priority    0=low, 1=medium, 2=high, 3=critical.
     * @return id         Assigned kit ID.
     */
    function submit(
        Store storage self,
        address submitter,
        string calldata metadataURI,
        uint8 priority
    ) external returns (uint256 id) {
        require(bytes(metadataURI).length > 0, "metadataURI required.");
        require(priority <= 3, "Invalid priority.");

        if (self.currentFeatureKitId == 0) {
            self.currentFeatureKitId = 1;
        }
        id = self.currentFeatureKitId++;
        self.featureKits[id] = FeatureKit({
            id:          id,
            submitter:   submitter,
            priority:    priority,
            status:      0,
            metadataURI: metadataURI,
            voteCount:   0,
            submittedAt: block.timestamp
        });

        emit FeatureKitSubmitted(id, submitter, priority, metadataURI, block.timestamp);
    }

    /**
     * @notice Upvote an open feature kit. Each address votes at most once.
     * @param kitId  The kit to upvote.
     * @param voter  The address casting the upvote (typically msg.sender).
     */
    function upvote(
        Store storage self,
        uint256 kitId,
        address voter
    ) external {
        require(kitId > 0 && kitId < self.currentFeatureKitId, "Invalid kit ID.");
        require(!self.featureKitVoted[kitId][voter], "Already voted.");
        FeatureKit storage kit = self.featureKits[kitId];
        require(kit.status == 0 || kit.status == 1, "Kit not open for voting.");

        self.featureKitVoted[kitId][voter] = true;
        kit.voteCount++;

        emit FeatureKitUpvoted(kitId, voter, kit.voteCount);
    }

    /**
     * @notice Change the status of a feature kit (owner / governance).
     */
    function setStatus(
        Store storage self,
        uint256 kitId,
        uint8 newStatus,
        string calldata reason
    ) external {
        require(kitId > 0 && kitId < self.currentFeatureKitId, "Invalid kit ID.");
        require(newStatus <= 4, "Invalid status.");
        self.featureKits[kitId].status = newStatus;
        emit FeatureKitStatusChanged(kitId, newStatus, reason);
    }

    /**
     * @notice Return paginated feature kits (ascending by id).
     */
    function getPage(
        Store storage self,
        uint256 offset,
        uint256 limit
    ) external view returns (FeatureKit[] memory page, uint256 total) {
        uint256 cur = self.currentFeatureKitId;
        total = cur == 0 ? 0 : cur - 1;
        if (offset >= total) return (new FeatureKit[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new FeatureKit[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = self.featureKits[offset + i + 1];
        }
    }
}
