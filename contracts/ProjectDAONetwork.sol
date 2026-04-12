// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProjectDAOStorage} from "./ProjectDAOStorage.sol";
import {TrustLib} from "./TrustLib.sol";
import {FeatureKitLib} from "./FeatureKitLib.sol";
import {MessagingLib} from "./MessagingLib.sol";
import {PKILib} from "./PKILib.sol";

/**
 * @title ProjectDAONetwork — Network sub-contract: capabilities, trust, messaging, PKI
 * @notice Delegated via the Router proxy. Shares storage layout with Core,
 *         Governance, and Commerce through ProjectDAOStorage inheritance.
 */
contract ProjectDAONetwork is ProjectDAOStorage {
    using TrustLib for TrustLib.Store;
    using FeatureKitLib for FeatureKitLib.Store;
    using MessagingLib for MessagingLib.Store;
    using PKILib for PKILib.PubKeyRegistry;
    using PKILib for PKILib.EnvelopeStore;

    // ─── Storage slot placeholders (must match Core + Commerce layout) ──
    uint256[53] private __corePlaceholder;   // Core's TimelockLib.Store (53 slots)
    uint256[180] private __commercePlaceholder; // Commerce's 3 library stores + extras

    // ─── Network-only state ─────────────────────────────────────────────
    TrustLib.Store private _trustStore;
    FeatureKitLib.Store private _featureKitStore;
    MessagingLib.Store private _msgStore;

    // Capabilities
    uint256 public constant MAX_CAPABILITIES = 16;
    uint256 public constant MAX_CAPABILITY_LENGTH = 64;
    mapping(address => string[]) private agentCapabilities;
    mapping(bytes32 => address[]) private capabilityAgents;
    mapping(bytes32 => mapping(address => bool)) private capabilityAgentExists;
    mapping(bytes32 => mapping(address => uint256)) private capabilityAgentIndex;

    // Broadcasts
    uint256 public currentBroadcastId;

    // PKI
    PKILib.PubKeyRegistry private _pkiPubKeys;

    bool private _networkInitialized;

    // ─── Events ─────────────────────────────────────────────────────────
    event AgentCapabilitiesUpdated(address indexed agent, string[] capabilities);
    event EndorsementCreated(uint256 indexed endorsementId, address indexed endorser, address indexed endorsed, uint256 agreementId, string capability, uint256 weight);
    event EndorsementRevoked(uint256 indexed endorsementId, address indexed endorser, address indexed endorsed);
    event DirectMessageSent(uint256 indexed messageId, address indexed sender, address indexed recipient, bytes32 contentHash, uint256 timestamp);
    event DirectMessageRead(uint256 indexed messageId, address indexed recipient);
    event FeatureKitSubmitted(uint256 indexed kitId, address indexed submitter, uint8 priority, string metadataURI, uint256 timestamp);
    event FeatureKitUpvoted(uint256 indexed kitId, address indexed voter, uint256 newVoteCount);
    event FeatureKitStatusChanged(uint256 indexed kitId, uint8 newStatus, string reason);
    event AgentBroadcast(uint256 indexed broadcastId, address indexed sender, uint8 broadcastType, string messageURI, uint256 timestamp);
    event MessagingFeePaid(address indexed agent, uint256 feeAmount);
    event AgentPublicKeyPublished(address indexed agent, bytes publicKey, uint256 timestamp);

    // ─── Initialization ─────────────────────────────────────────────────

    function initializeNetwork() external onlyOwner {
        require(!_networkInitialized, "Network already initialized.");
        _networkInitialized = true;
        currentBroadcastId = 1;
    }

    // ─── Capability-Indexed Discovery ───────────────────────────────────

    function setAgentCapabilities(string[] calldata _capabilities) external onlyRegisteredAgent whenNotPaused {
        require(_capabilities.length <= MAX_CAPABILITIES, "Too many capabilities.");
        // Remove old capabilities
        string[] storage old = agentCapabilities[msg.sender];
        for (uint256 i = 0; i < old.length; i++) {
            bytes32 key = keccak256(bytes(old[i]));
            if (capabilityAgentExists[key][msg.sender]) {
                uint256 idx = capabilityAgentIndex[key][msg.sender];
                address[] storage arr = capabilityAgents[key];
                if (idx < arr.length - 1) {
                    address last = arr[arr.length - 1];
                    arr[idx] = last;
                    capabilityAgentIndex[key][last] = idx;
                }
                arr.pop();
                capabilityAgentExists[key][msg.sender] = false;
            }
        }
        delete agentCapabilities[msg.sender];
        // Add new capabilities
        for (uint256 i = 0; i < _capabilities.length; i++) {
            require(bytes(_capabilities[i]).length > 0 && bytes(_capabilities[i]).length <= MAX_CAPABILITY_LENGTH, "Invalid capability string.");
            bytes32 key = keccak256(bytes(_capabilities[i]));
            if (!capabilityAgentExists[key][msg.sender]) {
                capabilityAgentIndex[key][msg.sender] = capabilityAgents[key].length;
                capabilityAgents[key].push(msg.sender);
                capabilityAgentExists[key][msg.sender] = true;
            }
            agentCapabilities[msg.sender].push(_capabilities[i]);
        }
        emit AgentCapabilitiesUpdated(msg.sender, _capabilities);
    }

    function getAgentCapabilities(address _agent) external view returns (string[] memory) { return agentCapabilities[_agent]; }

    function discoverAgentsByCapability(string calldata _capability, uint256 _offset, uint256 _limit) external view returns (address[] memory addrs, string[] memory uris, uint256 total) {
        bytes32 key = keccak256(bytes(_capability));
        address[] storage arr = capabilityAgents[key];
        total = arr.length;
        if (_offset >= total) return (new address[](0), new string[](0), total);
        uint256 end = _offset + _limit > total ? total : _offset + _limit;
        uint256 count = end - _offset;
        addrs = new address[](count);
        uris = new string[](count);
        for (uint256 i = 0; i < count; i++) { addrs[i] = arr[_offset + i]; uris[i] = agents[arr[_offset + i]].metadataURI; }
    }

    function getCapabilityAgentCount(string calldata _capability) external view returns (uint256) { return capabilityAgents[keccak256(bytes(_capability))].length; }

    // ─── Trust Graph (Endorsements) ─────────────────────────────────────

    function currentEndorsementId() external view returns (uint256) { uint256 v = _trustStore.currentEndorsementId; return v == 0 ? 1 : v; }

    function endorseAgent(uint256 _agreementId, address _endorsed, string calldata _capability) external onlyRegisteredAgent whenNotPaused nonReentrant {
        require(agents[_endorsed].registered, "Endorsed agent must be registered.");
        require(_endorsed != msg.sender, "Cannot endorse yourself.");
        require(bytes(_capability).length > 0, "Capability required.");
        uint256 weight = _getReputationTier(agentReputation[msg.sender]) + 1;
        _trustStore.createEndorsement(_agreementId, msg.sender, _endorsed, weight, _capability);
    }

    function revokeEndorsement(uint256 _endorsementId) external onlyRegisteredAgent whenNotPaused { _trustStore.revokeEndorsement(_endorsementId, msg.sender); }
    function getAgentTrustScore(address _agent) external view returns (uint256 trustScore, uint256 endorsementCount) { return _trustStore.getTrustScore(_agent); }
    function getTimeWeightedTrustScore(address _agent) external view returns (uint256 weightedScore, uint256 activeEndorsements) { return _trustStore.getTimeWeightedTrustScore(_agent); }
    function getAgentEndorsements(address _agent, uint256 offset, uint256 limit) external view returns (uint256[] memory endorsementIds, uint256 total) { return _trustStore.getAgentEndorsements(_agent, offset, limit); }
    function getEndorsement(uint256 _endorsementId) external view returns (uint256 id, address endorser, address endorsed, uint256 agreementId, string memory capability, uint256 weight, uint256 timestamp, bool revoked) { return _trustStore.getEndorsement(_endorsementId); }

    // ─── Feature Kit Pipeline ───────────────────────────────────────────

    function currentFeatureKitId() external view returns (uint256) { uint256 v = _featureKitStore.currentFeatureKitId; return v == 0 ? 1 : v; }
    function featureKits(uint256 kitId) external view returns (uint256 id, address submitter, uint8 priority, uint8 status, string memory metadataURI, uint256 voteCount, uint256 submittedAt) { FeatureKitLib.FeatureKit storage k = _featureKitStore.featureKits[kitId]; return (k.id, k.submitter, k.priority, k.status, k.metadataURI, k.voteCount, k.submittedAt); }
    function featureKitVoted(uint256 kitId, address voter) external view returns (bool) { return _featureKitStore.featureKitVoted[kitId][voter]; }
    function submitFeatureKit(string calldata metadataURI, uint8 priority) external onlyRegisteredAgent whenNotPaused { _featureKitStore.submit(msg.sender, metadataURI, priority); }
    function upvoteFeatureKit(uint256 kitId) external onlyMember whenNotPaused { _featureKitStore.upvote(kitId, msg.sender); }
    function setFeatureKitStatus(uint256 kitId, uint8 newStatus, string calldata reason) external onlyOwner whenNotPaused { _featureKitStore.setStatus(kitId, newStatus, reason); }
    function getFeatureKits(uint256 offset, uint256 limit) external view returns (FeatureKitLib.FeatureKit[] memory page, uint256 total) { return _featureKitStore.getPage(offset, limit); }

    // ─── Secure Direct Messaging ────────────────────────────────────────

    function currentDirectMessageId() external view returns (uint256) { uint256 v = _msgStore.currentDirectMessageId; return v == 0 ? 1 : v; }

    function sendDirectMessage(address _to, string calldata _encryptedContent, bytes32 _contentHash) external onlyRegisteredAgent whenNotPaused nonReentrant {
        require(agents[_to].registered, "Recipient must be a registered agent.");
        if (messagingFeeWei > 0) {
            uint256 actualMsgFee = _getMessagingFeeForAgent(msg.sender);
            require(agents[msg.sender].nativeEscrowBalance >= actualMsgFee, "Insufficient escrow for messaging fee.");
            agents[msg.sender].nativeEscrowBalance -= actualMsgFee;
            require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
            (bool feeOk,) = payable(cybereumTreasury).call{value: actualMsgFee}("");
            require(feeOk, "Messaging fee transfer failed.");
            _recordVolume(msg.sender, actualMsgFee, actualMsgFee, "messaging_fee");
            emit MessagingFeePaid(msg.sender, actualMsgFee);
            emit CybereumFeePaid(msg.sender, address(0), actualMsgFee, "messaging_fee");
        }
        _msgStore.sendMessage(msg.sender, _to, _encryptedContent, _contentHash);
    }

    function markMessageRead(uint256 _messageId) external onlyRegisteredAgent whenNotPaused { _msgStore.markRead(_messageId, msg.sender); }

    function getDirectMessage(uint256 _messageId) external view returns (uint256 id, address sender, address recipient, bytes32 contentHash, string memory encryptedContent, uint256 timestamp, bool readByRecipient) { return _msgStore.readMessage(_messageId, msg.sender); }

    function getConversation(address _otherAgent, uint256 offset, uint256 limit) external view returns (uint256[] memory messageIds, uint256 total) {
        require(agents[msg.sender].registered, "Caller must be a registered agent.");
        return _msgStore.conversation(msg.sender, _otherAgent, offset, limit);
    }

    function getInbox(uint256 offset, uint256 limit) external view returns (uint256[] memory messageIds, uint256 total) { return _msgStore.getInbox(msg.sender, offset, limit); }

    // ─── Broadcasts ─────────────────────────────────────────────────────

    function broadcastToAgents(uint8 _broadcastType, string calldata _messageURI) external onlyRegisteredAgent whenNotPaused {
        require(bytes(_messageURI).length > 0, "Broadcast message URI required.");
        uint256 id = currentBroadcastId++;
        emit AgentBroadcast(id, msg.sender, _broadcastType, _messageURI, block.timestamp);
    }

    // ─── Reputation Views ───────────────────────────────────────────────

    function getAgentReputation(address _agent) external view returns (uint256) { return agentReputation[_agent]; }
    function refreshReputation(address _agent) external { _refreshReputation(_agent); }
    function setReputationDecayConfig(uint256 _decayPerDay, uint256 _gracePeriod) external onlyOwner { reputationDecayPerDay = _decayPerDay; reputationDecayGracePeriod = _gracePeriod; }

    // ─── PKI: Agent Public Key Registry ─────────────────────────────────

    function MIN_AGENT_PUBLIC_KEY_BYTES() external pure returns (uint256) { return PKILib.MIN_KEY_BYTES; }
    function MAX_AGENT_PUBLIC_KEY_BYTES() external pure returns (uint256) { return PKILib.MAX_KEY_BYTES; }
    function MAX_ENCRYPTED_PAYLOAD_BYTES() external pure returns (uint256) { return PKILib.MAX_CIPHERTEXT_BYTES; }

    function publishAgentPublicKey(bytes calldata _publicKey) external onlyRegisteredAgent whenNotPaused {
        _pkiPubKeys.publishKey(_publicKey);
    }

    function getAgentPublicKey(address _agent) external view returns (bytes memory publicKey, uint256 publishedAt) {
        return _pkiPubKeys.getKey(_agent);
    }

    function agentPublicKeyUpdatedAt(address _agent) external view returns (uint256) {
        return _pkiPubKeys.updatedAt[_agent];
    }

    // NOTE: PKI encrypted envelope functions (attachEncryptedAgreementPayload,
    // attachEncryptedPaymentRequestPayload, etc.) require cross-contract access
    // to service agreement and payment request state. These are deferred to a
    // future PKI-specific sub-contract or will be implemented via the Router's
    // cross-contract call mechanism.
}
