// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ProjectDAOStorage — Shared state for the split Project_DAO architecture
 * @notice All sub-contracts (Core, Governance, Commerce, Network) inherit from
 *         this contract to share access to critical state: agents, members,
 *         owner, pause flag, fee config, and library stores.
 *
 *         This is NOT deployed on its own — it is an abstract base contract.
 *         Each sub-contract inherits it and adds its own functions.
 *
 *         IMPORTANT: Storage layout must be identical across all inheriting
 *         contracts. Never reorder, remove, or insert state variables. Only
 *         append new variables at the end.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract ProjectDAOStorage {
    using SafeERC20 for IERC20;

    // ─── Custom Errors ──────────────────────────────────────────────────
    error Unauthorized();
    error NotMember();
    error NotRegisteredAgent();
    error ContractPaused();
    error ZeroAmount();
    error InsufficientBalance();
    error InvalidAddress();
    error TransferFailed();
    error AlreadyExists();
    error NotFound();
    error InvalidStatus();

    // ─── Reentrancy Guard ───────────────────────────────────────────────
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 internal _reentrancyStatus;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // ─── Enums ──────────────────────────────────────────────────────────
    enum PaymentStatus { Requested, Settled, Cancelled }

    // ─── Core Structs ───────────────────────────────────────────────────
    struct AgentProfile {
        bool registered;
        string metadataURI;
        uint256 nativeEscrowBalance;
    }

    struct AgentPaymentRequest {
        uint256 id;
        address requester;
        address payer;
        address token;
        uint256 amount;
        bool isNative;
        string description;
        PaymentStatus status;
        uint256 createdAt;
        uint256 settledAt;
    }

    struct Member {
        address memberAddress;
        uint256 votingPower;
        uint256[] privileges;
        bool isMember;
    }

    // ─── Core State (shared by all sub-contracts) ───────────────────────

    // Owner & pause
    address public owner;
    bool internal _paused;

    // Members
    mapping(address => Member) public members;
    address[] public memberAddresses;
    uint256 public memberCount;
    mapping(address => uint256) public memberRoles;
    mapping(address => uint256) public memberStakes;

    // Agents
    mapping(address => AgentProfile) public agents;
    address[] public agentAddresses;
    mapping(address => mapping(address => uint256)) public agentTokenEscrowBalances;

    // Payment requests
    mapping(uint256 => AgentPaymentRequest) public agentPaymentRequests;
    uint256 public currentAgentPaymentRequestId;

    // Fee config
    uint256 public constant FEE_BPS_DENOMINATOR = 10_000;
    uint256 public constant MIN_FEE_BPS = 1;
    uint256 public cybereumFeeBps;
    uint256 public assetTransferFlatFeeWei;
    uint256 public aiServiceFeeWei;
    address public cybereumTreasury;

    // Commerce blackhole
    uint256 public messagingFeeWei;
    uint256 public exitFeeBps;
    uint256 public totalCommerceVolume;
    uint256 public totalFeesCollected;
    mapping(address => uint256) public agentCommerceVolume;
    mapping(address => uint256) public agentFeesPaid;

    // Reputation engine
    mapping(address => uint256) public agentReputation;
    mapping(address => uint256) public agentTransactionCount;
    mapping(address => uint256) public agentLastActiveAt;
    mapping(address => uint256) public agentRegisteredAt;
    uint256 public constant REP_MAX = 1000;
    uint256 public constant REP_TIER_SILVER = 250;
    uint256 public constant REP_TIER_GOLD = 500;
    uint256 public constant REP_TIER_PLATINUM = 750;
    uint256 public reputationDecayPerDay;
    uint256 public reputationDecayGracePeriod;

    // Referral state
    mapping(address => address) public agentReferrer;
    mapping(address => uint256) public agentReferralCount;
    mapping(address => uint256) public agentReferralEarnings;
    uint256 public referralRewardBps;
    uint256 public referralTier2Bps;

    // Onboarding
    uint256 public minStakeToJoin;

    // Initialization flag
    bool public initialized;

    // ─── Events (shared across sub-contracts) ───────────────────────────
    event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context);
    event CybereumTreasuryUpdated(address indexed treasury);
    event CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei);
    event CommerceVolumeRecorded(address indexed agent, uint256 amount, string context);

    // ─── Modifiers ──────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function.");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].isMember, "Only members can call this function.");
        _;
    }

    modifier onlyRegisteredAgent() {
        require(agents[msg.sender].registered, "Only registered agents can call this function.");
        _;
    }

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused.");
        _;
    }

    // ─── Internal fee helpers (shared) ──────────────────────────────────

    function _calculateFee(uint256 _amount) internal view returns (uint256) {
        uint256 fee = (_amount * cybereumFeeBps) / FEE_BPS_DENOMINATOR;
        if (fee == 0 && _amount > 0) fee = 1;
        return fee;
    }

    function _distributeReferralRewards(address _agent, uint256 _feeAmount) internal returns (uint256 totalDistributed) {
        if (_feeAmount == 0) return 0;
        address tier1 = agentReferrer[_agent];
        if (tier1 != address(0)) {
            uint256 reward1 = (_feeAmount * referralRewardBps) / FEE_BPS_DENOMINATOR;
            if (reward1 > 0) {
                agents[tier1].nativeEscrowBalance += reward1;
                agentReferralEarnings[tier1] += reward1;
                totalDistributed += reward1;
            }
            address tier2 = agentReferrer[tier1];
            if (tier2 != address(0)) {
                uint256 reward2 = (_feeAmount * referralTier2Bps) / FEE_BPS_DENOMINATOR;
                if (reward2 > 0) {
                    agents[tier2].nativeEscrowBalance += reward2;
                    agentReferralEarnings[tier2] += reward2;
                    totalDistributed += reward2;
                }
            }
        }
    }

    function _collectNativeFee(uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        if (fee > 0) {
            uint256 referralTotal = _distributeReferralRewards(msg.sender, fee);
            uint256 treasuryFee = fee - referralTotal;
            if (treasuryFee > 0) {
                (bool ok,) = payable(cybereumTreasury).call{value: treasuryFee}("");
                require(ok, "Native fee transfer failed.");
            }
            emit CybereumFeePaid(msg.sender, address(0), fee, _context);
        }
        _recordVolume(msg.sender, _amount, fee, _context);
        return fee;
    }

    function _collectTokenFee(address _token, uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        if (fee > 0) {
            IERC20(_token).safeTransfer(cybereumTreasury, fee);
            emit CybereumFeePaid(msg.sender, _token, fee, _context);
        }
        _recordVolume(msg.sender, _amount, fee, _context);
        return fee;
    }

    function _collectExitFee(uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = (_amount * exitFeeBps) / FEE_BPS_DENOMINATOR;
        if (fee == 0 && _amount > 0) fee = 1;
        if (fee > 0) {
            (bool ok,) = payable(cybereumTreasury).call{value: fee}("");
            require(ok, "Exit fee transfer failed.");
            emit CybereumFeePaid(msg.sender, address(0), fee, _context);
        }
        return fee;
    }

    function _recordVolume(address _agent, uint256 _amount, uint256 _fee, string memory _context) internal {
        totalCommerceVolume += _amount;
        totalFeesCollected += _fee;
        agentCommerceVolume[_agent] += _amount;
        agentFeesPaid[_agent] += _fee;
        agentTransactionCount[_agent]++;
        emit CommerceVolumeRecorded(_agent, _amount, _context);
        _refreshReputation(_agent);
        agentLastActiveAt[_agent] = block.timestamp;
    }

    function _refreshReputation(address _agent) internal {
        if (!agents[_agent].registered) return;
        uint256 volumeScore = agentCommerceVolume[_agent] * 50 / 1 ether;
        if (volumeScore > 250) volumeScore = 250;
        uint256 txScore = agentTransactionCount[_agent] * 5;
        if (txScore > 250) txScore = 250;
        uint256 registeredAt = agentRegisteredAt[_agent];
        uint256 tenureScore = 0;
        if (registeredAt > 0 && block.timestamp > registeredAt) {
            tenureScore = (block.timestamp - registeredAt) / 1 days;
            if (tenureScore > 250) tenureScore = 250;
        }
        uint256 escrowScore = agents[_agent].nativeEscrowBalance * 100 / 1 ether;
        if (escrowScore > 250) escrowScore = 250;
        uint256 raw = volumeScore + txScore + tenureScore + escrowScore;
        uint256 lastActive = agentLastActiveAt[_agent];
        if (lastActive > 0 && block.timestamp > lastActive + reputationDecayGracePeriod) {
            uint256 inactiveDays = (block.timestamp - lastActive - reputationDecayGracePeriod) / 1 days;
            uint256 decay = inactiveDays * reputationDecayPerDay;
            raw = raw > decay ? raw - decay : 0;
        }
        if (raw > REP_MAX) raw = REP_MAX;
        agentReputation[_agent] = raw;
    }

    function _getReputationTier(uint256 score) internal pure returns (uint256) {
        if (score >= REP_TIER_PLATINUM) return 3;
        if (score >= REP_TIER_GOLD) return 2;
        if (score >= REP_TIER_SILVER) return 1;
        return 0;
    }

    function _getMessagingFeeForAgent(address _agent) internal view returns (uint256) {
        uint256 tier = _getReputationTier(agentReputation[_agent]);
        if (tier >= 3) return 0;
        if (tier >= 2) return messagingFeeWei / 4;
        if (tier >= 1) return messagingFeeWei / 2;
        return messagingFeeWei;
    }
}
