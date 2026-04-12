// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PKILib} from "./PKILib.sol";
import {TrustLib} from "./TrustLib.sol";
import {FeatureKitLib} from "./FeatureKitLib.sol";
import {MessagingLib} from "./MessagingLib.sol";
import {EconomicProjectLib} from "./EconomicProjectLib.sol";
import {ServiceAgreementLib} from "./ServiceAgreementLib.sol";
import {PaymentStreamLib} from "./PaymentStreamLib.sol";
import {TimelockLib} from "./TimelockLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC721Lite {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract Project_DAO {
    using PKILib for PKILib.PubKeyRegistry;
    using PKILib for PKILib.EnvelopeStore;
    using TrustLib for TrustLib.Store;
    using FeatureKitLib for FeatureKitLib.Store;
    using MessagingLib for MessagingLib.Store;
    using EconomicProjectLib for EconomicProjectLib.Store;
    using ServiceAgreementLib for ServiceAgreementLib.Store;
    using PaymentStreamLib for PaymentStreamLib.Store;
    using SafeERC20 for IERC20;
    using TimelockLib for TimelockLib.Store;

    // ─── Custom Errors (gas-efficient reverts) ───────────────────────────────
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

    // ─── Reentrancy Guard ────────────────────────────────────────────────────
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    enum PaymentStatus {
        Requested,
        Settled,
        Cancelled
    }

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

    struct Milestone {
        string description;
        uint256 date;
        uint256 membersWhoCanVoteCount;
    }
    mapping(uint256 => mapping(address => bool)) private milestoneMembersWhoCanVote;

    struct Proposal {
        uint256 id;
        string description;
        uint256 votingDeadline;
        bool executed;
        bool proposalPassed;
        uint256 yesVotes;
        uint256 noVotes;
        uint256[] previousMilestoneIds;
        uint256 milestoneId;
    }

    struct ProposalDispute {
        uint256 id;
        uint256 proposalId;
        uint256 disputeDeadline;
        bool resolved;
        mapping(address => bool) voted;
        mapping(address => bool) hasVotedFor;
        mapping(address => bool) hasVotedAgainst;
        uint256 votesFor;
        uint256 votesAgainst;
        string description;
        uint256 milestoneId;
    }

    struct Task {
        uint256 id;
        string description;
        uint256 deadline;
        bool completed;
        uint256 milestoneId;
        address assignedMember;
        string status;
        uint256[] progressIds;
    }

    struct Progress {
        uint256 date;
        string description;
        bool completed;
        uint256 percentageCompleted;
    }

    struct RolePermissions {
        mapping(string => bool) permissions;
    }

    struct Role {
        bytes32 name;
        address[] members;
        RolePermissions permissions;
    }

    mapping(uint256 => ProposalDispute) public proposalDisputes;
    // Counters start at 0 on deploy and are bumped to 1 by initialize().
    // This moves ~22 K gas per counter OUT of the deploy transaction so
    // Project_DAO fits under the EIP-7825 / Osaka per-tx gas cap. The
    // public-getter shape is unchanged.
    uint256 public currentProposalDisputeId;
    mapping(uint256 => mapping(address => bool)) public proposalHasVoted;
    mapping(uint256 => mapping(address => bool)) public proposalMembersWhoCanVote;
    mapping(uint256 => Progress) public progressData;
    uint256 public currentProgressId;

    address public owner;
    mapping(address => Member) public members;
    mapping(address => AgentProfile) public agents;
    address[] public agentAddresses;  // Registry for agent discovery
    mapping(address => mapping(address => uint256)) public agentTokenEscrowBalances;
    mapping(uint256 => AgentPaymentRequest) public agentPaymentRequests;
    uint256 public currentAgentPaymentRequestId;
    Proposal[] public proposals;
    uint256 public currentProposalId;
    uint256 public votingPeriod;
    uint256 public minimumVotingPower;
    Milestone[] public milestones;
    uint256 public currentMilestoneId;
    Task[] public tasks;
    uint256 public currentTaskId;
    Role[] roles;
    mapping(address => uint256) public memberRoles;
    address[] public memberAddresses;
    uint256 public memberCount;

    bool private _paused;

    uint256 public constant FEE_BPS_DENOMINATOR = 10_000;
    /// @dev Minimum fee floor: 1 bps (0.01%). Fee can never be set to zero.
    uint256 public constant MIN_FEE_BPS = 1;
    // Default fee parameters are seeded by initialize() so the cold SSTOREs
    // happen outside the deploy transaction. Between deploy and initialize()
    // these fields read as zero — the deploy script MUST call initialize()
    // before any user traffic.
    uint256 public cybereumFeeBps;
    uint256 public assetTransferFlatFeeWei;
    uint256 public aiServiceFeeWei;
    address public cybereumTreasury;

    // ─── Commerce Blackhole State ───────────────────────────────────────────
    /// @notice Fee charged per direct message sent (from sender's escrow).
    uint256 public messagingFeeWei;
    /// @notice Exit fee in bps charged when value leaves the protocol (claims, refunds, leave).
    uint256 public exitFeeBps;
    /// @notice Total protocol commerce volume (all value movements, cumulative).
    uint256 public totalCommerceVolume;
    /// @notice Total fees ever collected by the protocol.
    uint256 public totalFeesCollected;
    /// @notice Per-agent cumulative commerce volume.
    mapping(address => uint256) public agentCommerceVolume;
    /// @notice Per-agent total fees paid to the protocol.
    mapping(address => uint256) public agentFeesPaid;

    // ─── Reputation Engine State ────────────────────────────────────────────
    /// @notice Per-agent reputation score (0-1000).
    mapping(address => uint256) public agentReputation;
    /// @notice Per-agent transaction count (all commerce operations).
    mapping(address => uint256) public agentTransactionCount;
    /// @notice Timestamp of each agent's last commerce action.
    mapping(address => uint256) public agentLastActiveAt;
    /// @notice Timestamp when agent first registered (for tenure calculation).
    mapping(address => uint256) public agentRegisteredAt;
    /// @notice Reputation tier thresholds and messaging fee discount bps per tier.
    ///         Tier 0=Bronze(0-249), 1=Silver(250-499), 2=Gold(500-749), 3=Platinum(750-1000)
    uint256 public constant REP_MAX = 1000;
    uint256 public constant REP_TIER_SILVER = 250;
    uint256 public constant REP_TIER_GOLD = 500;
    uint256 public constant REP_TIER_PLATINUM = 750;
    /// @notice Decay rate: reputation points lost per day of inactivity (after 7-day grace).
    /// @dev Seeded in initialize() to keep deploy-tx gas under the EIP-7825 cap.
    uint256 public reputationDecayPerDay;
    /// @notice Grace period before decay kicks in (seconds).
    uint256 public reputationDecayGracePeriod;

    event TaskCreated(uint256 id, string description, uint256 deadline, uint256 milestoneId, address assignedMember, string status);
    event TaskUpdated(uint256 id, string description, uint256 deadline, address assignedMember, string status);
    event TaskDeleted(uint256 id);
    event MemberAdded(address member, uint256 votingPower);
    event MemberRemoved(address member);
    event RoleCreated(uint256 id, string name);
    event PermissionAdded(uint256 roleId, string permission);
    event PermissionRemoved(uint256 roleId, string permission);
    event RoleAssigned(address member, uint256 roleId);
    event AgentRegistered(address indexed agent, string metadataURI);
    event AgentMetadataUpdated(address indexed agent, string metadataURI);
    event AgentNativeEscrowDeposited(address indexed agent, uint256 amount);
    event AgentNativeEscrowWithdrawn(address indexed agent, uint256 amount);
    event AgentTokenEscrowDeposited(address indexed agent, address indexed token, uint256 amount);
    event AgentTokenEscrowWithdrawn(address indexed agent, address indexed token, uint256 amount);
    event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo);
    event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo);
    event AgentAssetTransfer(address indexed from, address indexed to, address indexed assetContract, uint256 assetId, string memo);
    event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, bool isNative, address token, uint256 amount, string description);
    event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt);
    event AgentPaymentRequestCancelled(uint256 indexed requestId, address indexed requester);
    event CybereumTreasuryUpdated(address indexed treasury);
    event CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei);
    event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context);

    // --- Agent Broadcast events ---
    /// @notice Emitted when the owner or a governance action broadcasts a message to all agents.
    event AgentBroadcast(
        uint256 indexed broadcastId,
        address indexed sender,
        uint8   broadcastType,   // 0=info, 1=upgrade, 2=governance, 3=security
        string  messageURI,      // IPFS CID pointing to full message JSON
        uint256 timestamp
    );

    // --- Feature Kit events ---
    /// @notice Emitted when a registered agent submits a feature request.
    event FeatureKitSubmitted(
        uint256 indexed kitId,
        address indexed submitter,
        uint8   priority,        // 0=low, 1=medium, 2=high, 3=critical
        string  metadataURI,     // IPFS CID with { title, description, rationale, codeSketch }
        uint256 timestamp
    );
    /// @notice Emitted when a member upvotes a feature kit.
    event FeatureKitUpvoted(uint256 indexed kitId, address indexed voter, uint256 newVoteCount);
    /// @notice Emitted when a kit status changes (e.g. validated, queued, rejected).
    event FeatureKitStatusChanged(uint256 indexed kitId, uint8 newStatus, string reason);

    // --- Pause/Resume events ---
    event ContractPausedEvent(address indexed by);
    event ContractResumedEvent(address indexed by);

    // --- Task operation events ---
    event TaskStatusUpdated(uint256 indexed taskId, string status);
    event TaskCompleted(uint256 indexed taskId);
    event TaskAssigned(uint256 indexed taskId, address indexed member);

    // --- Governance config events ---
    event VotingPeriodChanged(uint256 newPeriod);
    event MinimumVotingPowerChanged(uint256 newMinimum);

    // --- Task progress events ---
    event TaskProgressAdded(uint256 indexed taskId, uint256 progressId, uint256 percentageCompleted);

    event AIServiceFeeDeducted(address indexed agent, uint256 amount, string serviceType);
    event AIServiceFeeUpdated(uint256 newFeeWei);

    // ─── Commerce Blackhole Events ──────────────────────────────────────────
    event CommerceVolumeRecorded(address indexed agent, uint256 amount, string context);
    event MessagingFeePaid(address indexed sender, uint256 fee);
    event BlackholeBatchTransfer(address indexed from, uint256 transferCount, uint256 totalVolume, uint256 totalFees);
    event BlackholeBatchSettle(address indexed settler, uint256 settleCount, uint256 totalVolume, uint256 totalFees);
    event CommerceBlackholeConfigUpdated(uint256 messagingFeeWei, uint256 exitFeeBps);
    event ExitFeePaid(address indexed agent, uint256 fee, string context);
    event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore, uint256 tier);
    event ReputationDecayApplied(address indexed agent, uint256 pointsDecayed, uint256 newScore);
    event PrivilegeGranted(address indexed member, uint256 privilege);
    event ProposalDisputeCreated(uint256 indexed disputeId, uint256 indexed proposalId, address indexed initiator, string description);
    event ProposalDisputeResolved(uint256 indexed disputeId, bool inFavor);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    /// @dev True once initialize() has run. Exposed for off-chain tooling.
    bool public initialized;

    // ─── Timelock for sensitive operations ─────────────────────────────────
    TimelockLib.Store private _timelock;

    // Events re-declared for ABI visibility; emitted by library via delegatecall.
    event TimelockQueued(bytes32 indexed opId, uint256 readyTime, uint256 expiresAt);
    event TimelockExecuted(bytes32 indexed opId);
    event TimelockCancelled(bytes32 indexed opId);
    event TimelockDelayUpdated(uint256 newDelay);

    /// @dev The deploy transaction only sets `owner` so the creation tx
    ///      stays under the EIP-7825 per-tx gas cap on newer hardforks.
    ///      ALL other state is seeded by initialize() in a second tx the
    ///      deploy script runs immediately after creation.
    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice One-time post-deploy bootstrap. Must be called by the
     *         contract owner in a second transaction right after the
     *         constructor — the deploy script already does this. Until
     *         this function has run, fee getters return zero, counters
     *         are uninitialized, and member-gated functions will revert.
     *
     *         Moved out of the constructor purely for EIP-7825 (Fusaka)
     *         compliance: the deploy tx's code-deposit alone already
     *         consumes ~15.2M gas, leaving no budget for the ~600K of
     *         cold SSTOREs the full bootstrap requires.
     */
    function initialize() external {
        require(!initialized, "Already initialized.");
        require(msg.sender == owner, "Only the owner can initialize.");
        initialized = true;

        // ── Member + admin setup ─────────────────────────────────────
        members[owner].isMember = true;
        members[owner].votingPower = 100;
        memberAddresses.push(owner);
        memberCount = 1;
        cybereumTreasury = owner;

        // ── Counter starting points (1-based IDs) ────────────────────
        currentProposalDisputeId     = 1;
        currentProgressId            = 1;
        currentAgentPaymentRequestId = 1;
        currentProposalId            = 1;
        currentMilestoneId           = 1;
        currentTaskId                = 1;
        currentBroadcastId           = 1;
        _projectStore.currentProjectId = 1;
        _serviceStore.currentId        = 1;
        _streamStore.currentId         = 1;

        // ── Timelock defaults (24h delay, 48h grace period) ─────────
        _timelock.delay       = 24 hours;
        _timelock.gracePeriod = 48 hours;

        // ── Governance defaults ──────────────────────────────────────
        votingPeriod       = 7 days;
        minimumVotingPower = 10;

        // ── Fee rail defaults ────────────────────────────────────────
        cybereumFeeBps         = 5;
        assetTransferFlatFeeWei = 1e12;
        aiServiceFeeWei        = 0.0003 ether;
        messagingFeeWei        = 0.0001 ether;
        exitFeeBps             = 3;

        // ── Reputation decay defaults ────────────────────────────────
        reputationDecayPerDay      = 2;
        reputationDecayGracePeriod = 7 days;

        // ── Referral reward defaults ─────────────────────────────────
        referralRewardBps = 1000;
        referralTier2Bps  = 300;

        // Create the "Owner" role (role ID 1) and hand it to the deployer.
        _createRole(bytes32("Owner"));
    }

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

    modifier onlyRole(string memory _permission) {
        uint256 roleId = memberRoles[msg.sender];
        require(roleId > 0, "You don't have a role.");
        Role storage role = roles[roleId - 1];
        require(role.permissions.permissions[_permission], "You don't have permission to perform this action.");
        _;
    }

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused.");
        _;
    }

    // --- Role Management ---

    function getRole(uint256 _roleId) public view returns (bytes32, uint256) {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        return (role.name, role.members.length);
    }

    function findMemberInRole(Role storage role, address member) private view returns (bool) {
        for (uint256 i = 0; i < role.members.length; i++) {
            if (role.members[i] == member) {
                return true;
            }
        }
        return false;
    }

    function findMemberIndex(address[] storage memberArray, address member) private view returns (int256) {
        for (uint256 i = 0; i < memberArray.length; i++) {
            if (memberArray[i] == member) {
                return int256(i);
            }
        }
        return -1;
    }

    function _addPermissionToRole(uint256 _roleId, string memory _permission) internal {
        roles[_roleId].permissions.permissions[_permission] = true;
    }

    /// @dev Internal role creation used by constructor and public createRole
    function _createRole(bytes32 _name) internal {
        roles.push();
        uint256 newRoleId = roles.length; // 1-based — matches getRole/assignRole/addPermission
        Role storage newRole = roles[newRoleId - 1];
        newRole.name = _name;

        emit RoleCreated(newRoleId, string(abi.encodePacked(_name)));
    }

    function createRole(bytes32 _name) public onlyOwner {
        _createRole(_name);
    }

    function addPermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        role.permissions.permissions[_permission] = true;
        emit PermissionAdded(_roleId, _permission);
    }

    function removePermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        role.permissions.permissions[_permission] = false;
        emit PermissionRemoved(_roleId, _permission);
    }

    function assignRole(address _member, uint256 _roleId) public onlyOwner whenNotPaused {
        require(_member != address(0), "Invalid member address.");
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        require(!findMemberInRole(role, _member), "Member already has this role.");
        require(members[_member].isMember, "Invalid member address.");
        role.members.push(_member);
        memberRoles[_member] = _roleId;
        emit RoleAssigned(_member, _roleId);
    }

    function assignRoleToMilestone(address _member, uint256 _milestoneId, bytes32 _role) public onlyOwner whenNotPaused {
        require(_member != address(0), "Invalid member address.");
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        require(
            _role == keccak256(abi.encodePacked("milestone_owner")) ||
            _role == keccak256(abi.encodePacked("builder")) ||
            _role == keccak256(abi.encodePacked("verifier")),
            "Invalid role."
        );
        require(members[_member].isMember, "Invalid member address.");

        uint256 roleIndex;
        if (_role == keccak256(abi.encodePacked("milestone_owner"))) {
            roleIndex = 0;
        } else if (_role == keccak256(abi.encodePacked("builder"))) {
            roleIndex = 1;
        } else {
            roleIndex = 2;
        }

        require(proposals.length > 0, "No proposals exist.");
        Proposal storage latestProposal = proposals[proposals.length - 1];
        require(latestProposal.milestoneId == _milestoneId, "Only members assigned to this milestone can be assigned a role for it.");

        milestoneMembersWhoCanVote[_milestoneId][_member] = true;
        proposalMembersWhoCanVote[latestProposal.id][_member] = true;
        emit RoleAssigned(_member, roleIndex + 1);
    }

    // --- Pause ---

    function pauseContract() public onlyOwner {
        _paused = true;
        emit ContractPausedEvent(msg.sender);
    }

    function resumeContract() public onlyOwner {
        _paused = false;
        emit ContractResumedEvent(msg.sender);
    }

    // --- Agent, Payments, and Asset Value Transfer ---


    function setCybereumTreasury(address _treasury) public onlyOwner whenNotPaused {
        require(_treasury != address(0), "Invalid treasury address.");
        cybereumTreasury = _treasury;
        emit CybereumTreasuryUpdated(_treasury);
    }

    function setCybereumFeeConfig(uint256 _feeBps, uint256 _assetTransferFlatFeeWei) public onlyOwner whenNotPaused {
        require(_feeBps >= MIN_FEE_BPS, "Fee cannot be zero: mandatory Cybereum fee floor enforced.");
        require(_feeBps <= 100, "Fee cannot exceed 1%.");
        require(_assetTransferFlatFeeWei > 0, "Asset transfer fee must be non-zero.");
        cybereumFeeBps = _feeBps;
        assetTransferFlatFeeWei = _assetTransferFlatFeeWei;
        emit CybereumFeeConfigUpdated(_feeBps, _assetTransferFlatFeeWei);
    }

    // ─── Timelocked Configuration (queue → wait → execute) ──────────────

    /// @notice Queue a treasury change. Must wait timelock delay before executing.
    function queueSetTreasury(address _treasury) external onlyOwner whenNotPaused returns (bytes32) {
        require(_treasury != address(0), "Invalid treasury address.");
        bytes32 opId = keccak256(abi.encode("setTreasury", _treasury));
        _timelock.queue(opId);
        return opId;
    }

    /// @notice Execute a previously queued treasury change after the delay.
    function executeSetTreasury(address _treasury) external onlyOwner whenNotPaused {
        bytes32 opId = keccak256(abi.encode("setTreasury", _treasury));
        _timelock.assertReady(opId);
        _timelock.markExecuted(opId);
        require(_treasury != address(0), "Invalid treasury address.");
        cybereumTreasury = _treasury;
        emit CybereumTreasuryUpdated(_treasury);
    }

    /// @notice Queue a fee configuration change.
    function queueSetFeeConfig(uint256 _feeBps, uint256 _assetFlatFeeWei) external onlyOwner whenNotPaused returns (bytes32) {
        require(_feeBps >= MIN_FEE_BPS, "Fee cannot be zero: mandatory Cybereum fee floor enforced.");
        require(_feeBps <= 100, "Fee cannot exceed 1%.");
        require(_assetFlatFeeWei > 0, "Asset transfer fee must be non-zero.");
        bytes32 opId = keccak256(abi.encode("setFeeConfig", _feeBps, _assetFlatFeeWei));
        _timelock.queue(opId);
        return opId;
    }

    /// @notice Execute a previously queued fee config change after the delay.
    function executeSetFeeConfig(uint256 _feeBps, uint256 _assetFlatFeeWei) external onlyOwner whenNotPaused {
        bytes32 opId = keccak256(abi.encode("setFeeConfig", _feeBps, _assetFlatFeeWei));
        _timelock.assertReady(opId);
        _timelock.markExecuted(opId);
        require(_feeBps >= MIN_FEE_BPS, "Fee cannot be zero: mandatory Cybereum fee floor enforced.");
        require(_feeBps <= 100, "Fee cannot exceed 1%.");
        require(_assetFlatFeeWei > 0, "Asset transfer fee must be non-zero.");
        cybereumFeeBps = _feeBps;
        assetTransferFlatFeeWei = _assetFlatFeeWei;
        emit CybereumFeeConfigUpdated(_feeBps, _assetFlatFeeWei);
    }

    /// @notice Cancel a pending timelocked operation.
    function cancelTimelockOperation(bytes32 _opId) external onlyOwner {
        _timelock.cancel(_opId);
    }

    /// @notice Update the timelock delay. Between 1 hour and 30 days.
    function setTimelockDelay(uint256 _delay) external onlyOwner {
        _timelock.setDelay(_delay);
    }

    /// @notice Get the current timelock delay in seconds.
    function timelockDelay() external view returns (uint256) {
        return _timelock.delay;
    }

    /// @notice Get a timelocked operation's status.
    function getTimelockOperation(bytes32 _opId) external view returns (
        bytes32 id, uint256 readyTime, uint256 expiresAt, bool executed, bool cancelled
    ) {
        return _timelock.getOperation(_opId);
    }

    /// @notice Update AI analysis service fee. Only callable by owner.
    function setAIServiceFee(uint256 _feeWei) public onlyOwner whenNotPaused {
        aiServiceFeeWei = _feeWei;
        emit AIServiceFeeUpdated(_feeWei);
    }

    /// @notice Deduct AI service fee from caller's native escrow. Fee goes to Cybereum treasury.
    function deductAIServiceFee(string memory _serviceType) external onlyRegisteredAgent whenNotPaused nonReentrant {
        uint256 fee = aiServiceFeeWei;
        require(fee > 0, "AI service fee not configured.");
        require(agents[msg.sender].nativeEscrowBalance >= fee, "Insufficient escrow balance for AI service fee.");

        agents[msg.sender].nativeEscrowBalance -= fee;

        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        (bool ok,) = payable(cybereumTreasury).call{value: fee}("");
        require(ok, "AI service fee transfer failed.");

        emit AIServiceFeeDeducted(msg.sender, fee, _serviceType);
        emit CybereumFeePaid(msg.sender, address(0), fee, string(abi.encodePacked("ai_service:", _serviceType)));
        _recordVolume(msg.sender, fee, fee, "ai_service_fee");
    }

    /// @notice Preview the fee that will be charged for a given amount.
    function previewFee(uint256 _amount) public view returns (uint256 fee, uint256 net) {
        fee = _amount == 0 ? 0 : (_amount * cybereumFeeBps) / FEE_BPS_DENOMINATOR;
        if (_amount > 0 && fee == 0) fee = 1;
        net = _amount > fee ? _amount - fee : 0;
    }

    /// @notice Returns full agent profile including balances.
    function getAgentProfile(address _agent) public view returns (
        bool registered,
        string memory metadataURI,
        uint256 nativeEscrowBalance
    ) {
        AgentProfile storage p = agents[_agent];
        return (p.registered, p.metadataURI, p.nativeEscrowBalance);
    }

    /// @notice Returns an agent's escrowed token balance.
    function getAgentTokenBalance(address _agent, address _token) public view returns (uint256) {
        return agentTokenEscrowBalances[_agent][_token];
    }

    // ─── Agent Discovery ─────────────────────────────────────────────────────

    /// @notice Total number of registered agents.
    function getAgentCount() public view returns (uint256) {
        return agentAddresses.length;
    }

    /// @notice Paginated list of registered agents for discovery by AI agents and indexers.
    /// @param offset 0-based starting index.
    /// @param limit  Maximum agents to return.
    function getRegisteredAgents(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addresses, string[] memory metadataURIs, uint256 total)
    {
        total = agentAddresses.length;
        if (total == 0 || offset >= total) {
            return (new address[](0), new string[](0), total);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        addresses = new address[](count);
        metadataURIs = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            address addr = agentAddresses[offset + i];
            addresses[i] = addr;
            metadataURIs[i] = agents[addr].metadataURI;
        }
    }

    /// @notice Returns a payment request by ID.
    function getAgentPaymentRequest(uint256 _requestId) public view returns (
        uint256 id,
        address requester,
        address payer,
        address token,
        uint256 amount,
        bool isNative,
        string memory description,
        PaymentStatus status,
        uint256 createdAt,
        uint256 settledAt
    ) {
        AgentPaymentRequest storage r = agentPaymentRequests[_requestId];
        return (r.id, r.requester, r.payer, r.token, r.amount, r.isNative, r.description, r.status, r.createdAt, r.settledAt);
    }

    function _calculateFee(uint256 _amount) internal view returns (uint256) {
        if (_amount == 0 || cybereumFeeBps == 0) {
            return 0;
        }
        uint256 fee = (_amount * cybereumFeeBps) / FEE_BPS_DENOMINATOR;
        if (fee == 0) {
            fee = 1;
        }
        return fee;
    }

    function _collectNativeFee(uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        if (fee > 0) {
            // Deduct referral rewards BEFORE sending to treasury.
            // Referral portion stays in the contract as backing for escrow credits.
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

    /// @dev Record commerce volume and fee metrics for the blackhole, then refresh reputation.
    ///      Note: referral rewards are distributed from _collectNativeFee / _collectExitFee
    ///      BEFORE the treasury transfer, so the contract retains the backing ETH.
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

    // ─── Reputation Engine (Internal) ───────────────────────────────────────

    /**
     * @dev Recalculate an agent's reputation score based on commerce activity.
     *      Score = volumeScore + txCountScore + tenureScore + escrowScore - decay
     *      Each component maxes at 250 → total max 1000.
     */
    function _refreshReputation(address _agent) internal {
        if (!agents[_agent].registered) return;

        uint256 oldScore = agentReputation[_agent];

        // Component 1: Volume score (0-250)
        // 1 ETH volume = 50 points, max 250 at 5 ETH (including fractional ETH)
        uint256 volumeScore = agentCommerceVolume[_agent] * 50 / 1 ether;
        if (volumeScore > 250) volumeScore = 250;

        // Component 2: Transaction count score (0-250)
        // Each tx = 5 points, max 250 at 50 txns
        uint256 txScore = agentTransactionCount[_agent] * 5;
        if (txScore > 250) txScore = 250;

        // Component 3: Tenure score (0-250)
        // 1 point per day of membership, max 250 at ~8 months
        uint256 registeredAt = agentRegisteredAt[_agent];
        uint256 tenureScore = 0;
        if (registeredAt > 0 && block.timestamp > registeredAt) {
            tenureScore = (block.timestamp - registeredAt) / 1 days;
            if (tenureScore > 250) tenureScore = 250;
        }

        // Component 4: Escrow commitment score (0-250)
        // 0.1 ETH escrowed = 50 points, max 250 at 0.5 ETH
        uint256 escrowEth = agents[_agent].nativeEscrowBalance / 0.1 ether;
        uint256 escrowScore = escrowEth * 50;
        if (escrowScore > 250) escrowScore = 250;

        uint256 rawScore = volumeScore + txScore + tenureScore + escrowScore;

        // Apply decay for inactivity
        uint256 lastActive = agentLastActiveAt[_agent];
        uint256 decay = 0;
        if (lastActive > 0 && block.timestamp > lastActive + reputationDecayGracePeriod) {
            uint256 inactiveDays = (block.timestamp - lastActive - reputationDecayGracePeriod) / 1 days;
            decay = inactiveDays * reputationDecayPerDay;
        }

        uint256 newScore = rawScore > decay ? rawScore - decay : 0;
        if (newScore > REP_MAX) newScore = REP_MAX;

        agentReputation[_agent] = newScore;

        if (decay > 0) {
            emit ReputationDecayApplied(_agent, decay, newScore);
        }
        if (newScore != oldScore) {
            emit ReputationUpdated(_agent, oldScore, newScore, _getReputationTier(newScore));
        }
    }

    /// @dev Get tier (0=Bronze, 1=Silver, 2=Gold, 3=Platinum) for a score.
    function _getReputationTier(uint256 _score) internal pure returns (uint256) {
        if (_score >= REP_TIER_PLATINUM) return 3;
        if (_score >= REP_TIER_GOLD) return 2;
        if (_score >= REP_TIER_SILVER) return 1;
        return 0;
    }

    /**
     * @dev Get the messaging fee discount for an agent based on their tier.
     *      Bronze: 0%, Silver: 10%, Gold: 25%, Platinum: 50%
     */
    function _getMessagingFeeForAgent(address _agent) internal view returns (uint256) {
        uint256 tier = _getReputationTier(agentReputation[_agent]);
        uint256 baseFee = messagingFeeWei;
        if (tier == 3) return baseFee / 2;         // Platinum: 50% off
        if (tier == 2) return baseFee * 75 / 100;  // Gold: 25% off
        if (tier == 1) return baseFee * 90 / 100;  // Silver: 10% off
        return baseFee;                             // Bronze: full price
    }

    /// @dev Collect an exit fee (used when value leaves the protocol).
    function _collectExitFee(uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = (_amount * exitFeeBps) / FEE_BPS_DENOMINATOR;
        if (fee == 0) fee = 1;
        if (fee > 0) {
            // Deduct referral rewards before sending to treasury
            uint256 referralTotal = _distributeReferralRewards(msg.sender, fee);
            uint256 treasuryFee = fee - referralTotal;
            if (treasuryFee > 0) {
                (bool ok,) = payable(cybereumTreasury).call{value: treasuryFee}("");
                require(ok, "Exit fee transfer failed.");
            }
            emit ExitFeePaid(msg.sender, fee, _context);
            emit CybereumFeePaid(msg.sender, address(0), fee, _context);
        }
        _recordVolume(msg.sender, _amount, fee, _context);
        return fee;
    }

    function registerAgent(string memory _metadataURI) public onlyMember whenNotPaused {
        require(bytes(_metadataURI).length > 0, "Metadata URI cannot be empty.");
        require(bytes(_metadataURI).length <= 512, "Metadata URI too long.");
        AgentProfile storage profile = agents[msg.sender];
        require(!profile.registered, "Agent already registered.");
        profile.registered = true;
        profile.metadataURI = _metadataURI;
        agentAddresses.push(msg.sender);
        agentRegisteredAt[msg.sender] = block.timestamp;
        agentLastActiveAt[msg.sender] = block.timestamp;
        _checkNetworkMilestone();
        emit AgentRegistered(msg.sender, _metadataURI);
    }

    function updateAgentMetadata(string memory _metadataURI) public onlyRegisteredAgent whenNotPaused {
        require(bytes(_metadataURI).length > 0, "Metadata URI cannot be empty.");
        require(bytes(_metadataURI).length <= 512, "Metadata URI too long.");
        agents[msg.sender].metadataURI = _metadataURI;
        emit AgentMetadataUpdated(msg.sender, _metadataURI);
    }

    function depositNativeToEscrow() public payable onlyRegisteredAgent whenNotPaused nonReentrant {
        require(msg.value > 0, "Deposit amount must be greater than zero.");
        uint256 fee = _collectNativeFee(msg.value, "deposit_native_escrow");
        uint256 netAmount = msg.value - fee;
        require(netAmount > 0, "Amount too small after fee.");
        agents[msg.sender].nativeEscrowBalance += netAmount;
        emit AgentNativeEscrowDeposited(msg.sender, netAmount);
    }

    function withdrawNativeFromEscrow(uint256 _amount) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than zero.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient native escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agents[msg.sender].nativeEscrowBalance -= _amount;
        if (fee > 0) {
            (bool feeOk,) = payable(cybereumTreasury).call{value: fee}("");
            require(feeOk, "Native fee transfer failed.");
            emit CybereumFeePaid(msg.sender, address(0), fee, "withdraw_native_escrow");
        }
        (bool withdrawOk,) = payable(msg.sender).call{value: netAmount}("");
        require(withdrawOk, "Native withdrawal transfer failed.");
        _recordVolume(msg.sender, _amount, fee, "withdraw_native_escrow");
        emit AgentNativeEscrowWithdrawn(msg.sender, netAmount);
    }

    function transferNativeBetweenAgents(address _to, uint256 _amount, string memory _memo) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient native escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agents[msg.sender].nativeEscrowBalance -= _amount;
        agents[_to].nativeEscrowBalance += netAmount;
        if (fee > 0) {
            (bool feeOk,) = payable(cybereumTreasury).call{value: fee}("");
            require(feeOk, "Native fee transfer failed.");
            emit CybereumFeePaid(msg.sender, address(0), fee, "agent_native_transfer");
        }
        _recordVolume(msg.sender, _amount, fee, "agent_native_transfer");

        emit AgentToAgentNativeTransfer(msg.sender, _to, netAmount, _memo);
    }

    function depositTokenToEscrow(address _token, uint256 _amount) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_token != address(0), "Invalid token address.");
        require(_amount > 0, "Amount must be greater than zero.");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 fee = _collectTokenFee(_token, _amount, "deposit_token_escrow");
        uint256 netAmount = _amount - fee;
        require(netAmount > 0, "Amount too small after fee.");

        agentTokenEscrowBalances[msg.sender][_token] += netAmount;
        emit AgentTokenEscrowDeposited(msg.sender, _token, netAmount);
    }

    function withdrawTokenFromEscrow(address _token, uint256 _amount) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_token != address(0), "Invalid token address.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agentTokenEscrowBalances[msg.sender][_token] >= _amount, "Insufficient token escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agentTokenEscrowBalances[msg.sender][_token] -= _amount;
        IERC20(_token).safeTransfer(cybereumTreasury, fee);
        emit CybereumFeePaid(msg.sender, _token, fee, "withdraw_token_escrow");

        IERC20(_token).safeTransfer(msg.sender, netAmount);
        _recordVolume(msg.sender, _amount, fee, "withdraw_token_escrow");
        emit AgentTokenEscrowWithdrawn(msg.sender, _token, netAmount);
    }

    function transferTokenBetweenAgents(address _token, address _to, uint256 _amount, string memory _memo) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_token != address(0), "Invalid token address.");
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agentTokenEscrowBalances[msg.sender][_token] >= _amount, "Insufficient token escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agentTokenEscrowBalances[msg.sender][_token] -= _amount;
        agentTokenEscrowBalances[_to][_token] += netAmount;
        if (fee > 0) {
            IERC20(_token).safeTransfer(cybereumTreasury, fee);
            emit CybereumFeePaid(msg.sender, _token, fee, "agent_token_transfer");
        }

        _recordVolume(msg.sender, _amount, fee, "agent_token_transfer");
        emit AgentToAgentTokenTransfer(msg.sender, _to, _token, netAmount, _memo);
    }

    function transferAssetBetweenAgents(address _assetContract, address _to, uint256 _assetId, string memory _memo)
        public
        payable
        onlyRegisteredAgent
        whenNotPaused
        nonReentrant
    {
        require(_assetContract != address(0), "Invalid asset contract address.");
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(msg.value == assetTransferFlatFeeWei, "Incorrect asset transfer fee.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        (bool feeOk,) = payable(cybereumTreasury).call{value: msg.value}("");
        require(feeOk, "Native fee transfer failed.");
        emit CybereumFeePaid(msg.sender, address(0), msg.value, "agent_asset_transfer");

        _recordVolume(msg.sender, msg.value, msg.value, "agent_asset_transfer");
        IERC721Lite(_assetContract).transferFrom(msg.sender, _to, _assetId);
        emit AgentAssetTransfer(msg.sender, _to, _assetContract, _assetId, _memo);
    }

    function createAgentPaymentRequest(
        address _payer,
        address _token,
        uint256 _amount,
        bool _isNative,
        string memory _description
    ) public onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(agents[_payer].registered, "Payer must be a registered agent.");
        require(_payer != msg.sender, "Cannot request payment from self.");
        require(_amount > 0, "Amount must be greater than zero.");
        if (_isNative) {
            require(_token == address(0), "Native request must use zero token address.");
        } else {
            require(_token != address(0), "Token request requires token address.");
        }

        uint256 requestId = currentAgentPaymentRequestId;
        agentPaymentRequests[requestId] = AgentPaymentRequest({
            id: requestId,
            requester: msg.sender,
            payer: _payer,
            token: _token,
            amount: _amount,
            isNative: _isNative,
            description: _description,
            status: PaymentStatus.Requested,
            createdAt: block.timestamp,
            settledAt: 0
        });

        currentAgentPaymentRequestId++;
        emit AgentPaymentRequestCreated(requestId, msg.sender, _payer, _isNative, _token, _amount, _description);
        return requestId;
    }

    function settleAgentPaymentRequest(uint256 _requestId) public payable onlyRegisteredAgent whenNotPaused nonReentrant {
        AgentPaymentRequest storage request = agentPaymentRequests[_requestId];
        require(request.id != 0, "Payment request does not exist.");
        require(request.status == PaymentStatus.Requested, "Payment request is not open.");
        require(request.payer == msg.sender, "Only designated payer can settle this request.");

        if (request.isNative) {
            require(msg.value == request.amount, "Incorrect native payment amount.");
            uint256 fee = _collectNativeFee(request.amount, "settle_payment_request_native");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");
            (bool payoutOk,) = payable(request.requester).call{value: netAmount}("");
            require(payoutOk, "Native payout transfer failed.");
        } else {
            require(msg.value == 0, "Do not send native value for token settlement.");
            IERC20(request.token).safeTransferFrom(msg.sender, address(this), request.amount);
            uint256 fee = _collectTokenFee(request.token, request.amount, "settle_payment_request_token");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");
            IERC20(request.token).safeTransfer(request.requester, netAmount);
        }

        request.status = PaymentStatus.Settled;
        request.settledAt = block.timestamp;
        emit AgentPaymentRequestSettled(_requestId, msg.sender, request.requester, request.settledAt);
    }

    function cancelAgentPaymentRequest(uint256 _requestId) public onlyRegisteredAgent whenNotPaused {
        AgentPaymentRequest storage request = agentPaymentRequests[_requestId];
        require(request.id != 0, "Payment request does not exist.");
        require(request.status == PaymentStatus.Requested, "Payment request is not open.");
        require(request.requester == msg.sender, "Only requester can cancel this payment request.");

        request.status = PaymentStatus.Cancelled;
        emit AgentPaymentRequestCancelled(_requestId, msg.sender);
    }

    // --- Member Management ---

    function addMember(address _newMember, uint256 _votingPower) public onlyOwner whenNotPaused {
        require(!members[_newMember].isMember, "Member already exists.");
        members[_newMember].isMember = true;
        members[_newMember].votingPower = _votingPower;
        for (uint256 i = 0; i < milestones.length; i++) {
            milestoneMembersWhoCanVote[i][_newMember] = true;
            milestones[i].membersWhoCanVoteCount++;
        }
        memberAddresses.push(_newMember);
        memberCount++;
        emit MemberAdded(_newMember, _votingPower);
    }

    function removeMember(address _member) public onlyOwner whenNotPaused {
        require(_member != owner, "Cannot remove the owner from the DAO.");
        require(members[_member].isMember, "Member does not exist.");
        delete members[_member];
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneMembersWhoCanVote[i][_member]) {
                milestoneMembersWhoCanVote[i][_member] = false;
                milestones[i].membersWhoCanVoteCount--;
            }
        }
        // Remove from memberAddresses array
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == _member) {
                memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
                memberAddresses.pop();
                break;
            }
        }
        memberCount--;
        emit MemberRemoved(_member);
    }

    function grantPrivilege(address _member, uint256 _privilege) public onlyOwner whenNotPaused {
        require(members[_member].isMember, "Invalid member address.");
        members[_member].privileges.push(_privilege);
        emit PrivilegeGranted(_member, _privilege);
    }

    function changeOwner(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address.");
        require(_newOwner != owner, "Already the owner.");
        address previousOwner = owner;
        bool newOwnerWasMember = members[_newOwner].isMember;
        members[_newOwner].isMember = true;
        members[_newOwner].votingPower = members[owner].votingPower;
        members[previousOwner].isMember = false;
        // Previous owner no longer a member: decrement counter
        memberCount--;
        // Add new owner to memberAddresses if not already present
        bool found = false;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == _newOwner) {
                found = true;
                break;
            }
        }
        if (!found) {
            memberAddresses.push(_newOwner);
        }
        if (!newOwnerWasMember) {
            memberCount++;
        }
        owner = _newOwner;
        emit OwnerChanged(previousOwner, _newOwner);
    }

    function getMemberCount() public view returns (uint256) {
        return memberCount;
    }

    function getMember(address _member) public view returns (Member memory) {
        return members[_member];
    }

    // --- Milestones ---

    function createMilestone(string memory _description, uint256 _date) public onlyOwner {
        // For the first milestone, only require a future date; for subsequent ones, enforce ordering
        if (milestones.length > 0) {
            require(_date > milestones[milestones.length - 1].date, "New milestone date must be after previous milestone date.");
        }

        uint256 membersCount = 0;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (members[memberAddresses[i]].isMember) {
                milestoneMembersWhoCanVote[milestones.length][memberAddresses[i]] = true;
                membersCount++;
            }
        }

        milestones.push(
            Milestone({
                description: _description,
                date: _date,
                membersWhoCanVoteCount: membersCount
            })
        );

        currentMilestoneId++;
    }

    function getMilestoneCount() public view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(uint256 _milestoneId) public view returns (MilestoneDetails memory) {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        Milestone storage m = milestones[_milestoneId];
        return MilestoneDetails({
            index: _milestoneId,
            description: m.description,
            date: m.date
        });
    }

    struct MilestoneDetails {
        uint256 index;
        string description;
        uint256 date;
    }

    // --- Proposals ---

    function createProposal(string memory _description, uint256[] memory _previousMilestoneIds) public {
        require(members[msg.sender].isMember, "Only members can create proposals.");
        require(members[msg.sender].votingPower >= minimumVotingPower, "Voting power not sufficient.");
        require(_previousMilestoneIds.length > 0, "At least one previous milestone is required.");

        // Validate milestone IDs are in bounds
        for (uint256 i = 0; i < _previousMilestoneIds.length; i++) {
            require(_previousMilestoneIds[i] < milestones.length, "Invalid milestone ID in previous milestones.");
        }
        // Validate chronological ordering
        for (uint256 i = 1; i < _previousMilestoneIds.length; i++) {
            require(
                milestones[_previousMilestoneIds[i]].date > milestones[_previousMilestoneIds[i - 1]].date,
                "Milestones must be in chronological order."
            );
        }

        bool isMilestoneAssignedToMember = false;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneMembersWhoCanVote[i][msg.sender]) {
                isMilestoneAssignedToMember = true;
                break;
            }
        }
        require(isMilestoneAssignedToMember, "Member must be assigned to a milestone to create proposal.");

        uint256 proposalId = currentProposalId;
        proposals.push(
            Proposal({
                id: proposalId,
                description: _description,
                votingDeadline: block.timestamp + votingPeriod,
                executed: false,
                proposalPassed: false,
                yesVotes: 0,
                noVotes: 0,
                previousMilestoneIds: _previousMilestoneIds,
                milestoneId: milestones.length - 1
            })
        );

        proposalMembersWhoCanVote[proposalId][msg.sender] = true;
        currentProposalId++;
    }

    function vote(uint256 _proposalId, bool _vote) public {
        require(members[msg.sender].isMember, "Only members can vote.");
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        require(!proposalHasVoted[_proposalId][msg.sender], "Member has already voted.");
        require(!proposals[index].executed, "Proposal has already been executed.");
        require(block.timestamp <= proposals[index].votingDeadline, "Voting period has ended.");

        proposalHasVoted[_proposalId][msg.sender] = true;
        if (_vote) {
            proposals[index].yesVotes += members[msg.sender].votingPower;
        } else {
            proposals[index].noVotes += members[msg.sender].votingPower;
        }
    }

    function executeProposal(uint256 _proposalId) public onlyOwner {
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        require(block.timestamp > proposals[index].votingDeadline, "Voting period has not ended.");
        require(!proposals[index].executed, "Proposal has already been executed.");

        uint256 totalVotes = proposals[index].yesVotes + proposals[index].noVotes;
        require(totalVotes > 0, "No votes have been cast.");

        uint256 votePercentage = (proposals[index].yesVotes * 100) / totalVotes;
        if (votePercentage > 50) {
            proposals[index].proposalPassed = true;
            proposals[index].executed = true;
        } else {
            proposals[index].proposalPassed = false;
            proposals[index].executed = true;
        }
    }

    function getProposalCount() public view returns (uint256) {
        return proposals.length;
    }

    function getProposal(uint256 _proposalId) public view returns (ProposalDetails memory) {
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        Proposal storage p = proposals[index];
        uint256 totalVotes = p.yesVotes + p.noVotes;
        uint256 votePercentage = totalVotes > 0 ? (p.yesVotes * 100) / totalVotes : 0;
        return ProposalDetails({
            id: p.id,
            description: p.description,
            votingDeadline: p.votingDeadline,
            executed: p.executed,
            proposalPassed: p.proposalPassed,
            yesVotes: p.yesVotes,
            noVotes: p.noVotes,
            votePercentage: votePercentage
        });
    }

    struct ProposalDetails {
        uint256 id;
        string description;
        uint256 votingDeadline;
        bool executed;
        bool proposalPassed;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votePercentage;
    }

    // --- Proposal Disputes ---

    function disputeProposal(uint256 _proposalId, string memory _description) public onlyMember {
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        require(!proposals[index].executed, "Proposal has already been executed.");

        uint256 milestoneId = proposals[index].milestoneId;
        require(milestoneMembersWhoCanVote[milestoneId][msg.sender], "Only members specific to the milestone can initiate a dispute.");

        uint256 disputeId = currentProposalDisputeId;
        ProposalDispute storage dispute = proposalDisputes[disputeId];
        dispute.id = disputeId;
        dispute.proposalId = _proposalId;
        dispute.disputeDeadline = block.timestamp + (votingPeriod / 2);
        dispute.description = _description;
        dispute.milestoneId = milestoneId;
        dispute.votesFor = 0;
        dispute.votesAgainst = 0;
        dispute.resolved = false;

        currentProposalDisputeId++;
        emit ProposalDisputeCreated(disputeId, _proposalId, msg.sender, _description);
    }

    function voteOnProposalDispute(uint256 _proposalDisputeId, bool _vote) public onlyMember {
        ProposalDispute storage dispute = proposalDisputes[_proposalDisputeId];
        require(dispute.id != 0, "Dispute does not exist.");
        require(!dispute.voted[msg.sender], "Already voted on this dispute.");
        require(!dispute.resolved, "Dispute has already been resolved.");
        require(block.timestamp <= dispute.disputeDeadline, "Dispute voting period has ended.");

        uint256 milestoneId = dispute.milestoneId;
        require(milestoneId < milestones.length, "Invalid milestone on dispute.");
        Milestone storage milestone = milestones[milestoneId];
        require(milestoneMembersWhoCanVote[milestoneId][msg.sender], "Only milestone-specific members can vote on this dispute.");

        if (_vote) {
            dispute.votesFor++;
            dispute.hasVotedFor[msg.sender] = true;
        } else {
            dispute.votesAgainst++;
            dispute.hasVotedAgainst[msg.sender] = true;
        }
        dispute.voted[msg.sender] = true;

        // Auto-resolve if majority reached
        uint256 majority = (milestone.membersWhoCanVoteCount / 2) + 1;
        if (dispute.votesFor >= majority) {
            _resolveProposalDispute(dispute.id, true);
        } else if (dispute.votesAgainst >= majority) {
            _resolveProposalDispute(dispute.id, false);
        }
    }

    /// @dev Internal dispute resolution called automatically when majority is reached
    function _resolveProposalDispute(uint256 _disputeId, bool _inFavor) internal {
        ProposalDispute storage dispute = proposalDisputes[_disputeId];
        require(!dispute.resolved, "Dispute has already been resolved.");
        dispute.resolved = true;
        if (_inFavor) {
            uint256 proposalIndex = dispute.proposalId - 1;
            Proposal storage proposal = proposals[proposalIndex];
            proposal.proposalPassed = true;
        }
        emit ProposalDisputeResolved(_disputeId, _inFavor);
    }

    /// @notice Owner can manually resolve a dispute after the deadline passes
    function resolveProposalDispute(uint256 _disputeId, bool _inFavor) public onlyOwner {
        ProposalDispute storage dispute = proposalDisputes[_disputeId];
        require(dispute.id != 0, "Dispute does not exist.");
        require(block.timestamp > dispute.disputeDeadline, "The voting period has not yet ended.");
        require(!dispute.resolved, "Dispute has already been resolved.");
        dispute.resolved = true;
        if (_inFavor) {
            uint256 proposalIndex = dispute.proposalId - 1;
            Proposal storage proposal = proposals[proposalIndex];
            proposal.proposalPassed = true;
        }
        emit ProposalDisputeResolved(_disputeId, _inFavor);
    }

    // --- Tasks ---

    function createTask(
        string memory _description,
        uint256 _deadline,
        uint256 _milestoneId,
        address _assignedMember,
        string memory _status
    ) public onlyOwner whenNotPaused {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        tasks.push(
            Task({
                id: currentTaskId,
                description: _description,
                deadline: _deadline,
                completed: false,
                milestoneId: _milestoneId,
                assignedMember: _assignedMember,
                status: _status,
                progressIds: new uint256[](0)
            })
        );
        emit TaskCreated(currentTaskId, _description, _deadline, _milestoneId, _assignedMember, _status);
        currentTaskId++;
    }

    function addTaskProgress(
        uint256 _taskId,
        string memory _description,
        bool _completed,
        uint256 _percentageCompleted
    ) public onlyRole("reporter") whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        require(_percentageCompleted <= 100, "Percentage completed must be between 0 and 100.");

        Task storage task = tasks[_taskId - 1];
        uint256 newProgressId = currentProgressId++;

        progressData[newProgressId] = Progress({
            date: block.timestamp,
            description: _description,
            completed: _completed,
            percentageCompleted: _percentageCompleted
        });

        task.progressIds.push(newProgressId);
        emit TaskProgressAdded(_taskId, newProgressId, _percentageCompleted);
    }

    function updateTask(
        uint256 _taskId,
        string memory _description,
        uint256 _deadline,
        address _assignedMember,
        string memory _status
    ) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.description = _description;
        t.deadline = _deadline;
        t.assignedMember = _assignedMember;
        t.status = _status;
        emit TaskUpdated(_taskId, _description, _deadline, _assignedMember, _status);
    }

    function deleteTask(uint256 _taskId) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        delete tasks[_taskId - 1];
        emit TaskDeleted(_taskId);
    }

    function getTasksForMilestone(uint256 _milestoneId) public view returns (Task[] memory) {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        uint256 count = 0;
        for (uint256 i = 0; i < tasks.length; i++) {
            if (tasks[i].milestoneId == _milestoneId) {
                count++;
            }
        }
        Task[] memory milestoneTasks = new Task[](count);
        count = 0;
        for (uint256 i = 0; i < tasks.length; i++) {
            if (tasks[i].milestoneId == _milestoneId) {
                milestoneTasks[count] = tasks[i];
                count++;
            }
        }
        return milestoneTasks;
    }

    function assignTask(uint256 _taskId, address _member) public onlyOwner whenNotPaused {
        require(members[_member].isMember, "Invalid member address.");
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.assignedMember = _member;
        emit TaskAssigned(_taskId, _member);
    }

    function updateTaskStatus(uint256 _taskId, string memory _status) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.status = _status;
        emit TaskStatusUpdated(_taskId, _status);
    }

    function completeTask(uint256 _taskId) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        tasks[_taskId - 1].completed = true;
        emit TaskCompleted(_taskId);
    }

    // --- Config ---

    function changeVotingPeriod(uint256 _newVotingPeriod) public onlyOwner whenNotPaused {
        require(_newVotingPeriod > 0, "New voting period should be greater than zero.");
        votingPeriod = _newVotingPeriod;
        emit VotingPeriodChanged(_newVotingPeriod);
    }

    function changeMinimumVotingPower(uint256 _newMinimumVotingPower) public onlyOwner whenNotPaused {
        require(_newMinimumVotingPower > 0, "New minimum voting power should be greater than zero.");
        minimumVotingPower = _newMinimumVotingPower;
        emit MinimumVotingPowerChanged(_newMinimumVotingPower);
    }

    // ─── Agent Broadcast ──────────────────────────────────────────────────────

    uint256 public currentBroadcastId;

    /**
     * @notice Broadcast a protocol message to all registered agents.
     * @param messageURI  IPFS URI pointing to a JSON file with `{ title, body, links[] }`.
     * @param broadcastType  0=info, 1=upgrade, 2=governance, 3=security.
     * @dev Only the owner may broadcast; governance-triggered broadcasts can be
     *      implemented by having the executed proposal call this via an external
     *      call pattern once on-chain governance execution is added.
     */
    function broadcastToAgents(
        string calldata messageURI,
        uint8 broadcastType
    ) external onlyOwner whenNotPaused {
        require(bytes(messageURI).length > 0, "messageURI required.");
        require(broadcastType <= 3, "Invalid broadcast type.");
        emit AgentBroadcast(currentBroadcastId++, msg.sender, broadcastType, messageURI, block.timestamp);
    }

    // ─── Secure Agent Direct Messaging ──────────────────────────────────────
    //
    // Storage + validation + mutation live in MessagingLib. The main
    // contract wrapper handles authorization, the per-message fee deduction
    // (escrow decrement + treasury transfer), and volume recording, then
    // forwards to the library for state mutation and event emission.

    MessagingLib.Store private _msgStore;

    event DirectMessageSent(
        uint256 indexed messageId,
        address indexed sender,
        address indexed recipient,
        bytes32 contentHash,
        uint256 timestamp
    );
    event DirectMessageRead(
        uint256 indexed messageId,
        address indexed recipient
    );

    /// @notice Next direct-message ID. Returns 1 before any messages exist
    ///         (matching the pre-extraction initializer).
    function currentDirectMessageId() external view returns (uint256) {
        uint256 v = _msgStore.currentDirectMessageId;
        return v == 0 ? 1 : v;
    }

    function sendDirectMessage(
        address _to,
        string calldata _encryptedContent,
        bytes32 _contentHash
    ) external onlyRegisteredAgent whenNotPaused nonReentrant {
        require(agents[_to].registered, "Recipient must be a registered agent.");

        // Commerce Blackhole: messaging fee (reputation discount applied).
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

    function markMessageRead(uint256 _messageId) external onlyRegisteredAgent whenNotPaused {
        _msgStore.markRead(_messageId, msg.sender);
    }

    function getDirectMessage(uint256 _messageId) external view returns (
        uint256 id,
        address sender,
        address recipient,
        bytes32 contentHash,
        string memory encryptedContent,
        uint256 timestamp,
        bool readByRecipient
    ) {
        return _msgStore.readMessage(_messageId, msg.sender);
    }

    function getConversation(
        address _otherAgent,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory messageIds, uint256 total) {
        require(agents[msg.sender].registered, "Caller must be a registered agent.");
        return _msgStore.conversation(msg.sender, _otherAgent, offset, limit);
    }

    function getInbox(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory messageIds, uint256 total) {
        return _msgStore.getInbox(msg.sender, offset, limit);
    }

    // ─── Feature Kit Pipeline ────────────────────────────────────────────────
    //
    // Storage + mutation live in FeatureKitLib. The main contract exposes
    // thin authorization wrappers. Events are re-declared above for ABI
    // visibility; the library emits them via delegatecall.

    FeatureKitLib.Store private _featureKitStore;

    /// @notice Next feature-kit ID. Returns 1 before any kit is created
    ///         (matching the pre-extraction initializer).
    function currentFeatureKitId() external view returns (uint256) {
        uint256 v = _featureKitStore.currentFeatureKitId;
        return v == 0 ? 1 : v;
    }

    /// @notice Lookup a feature kit by ID (struct fields unpacked).
    function featureKits(uint256 kitId) external view returns (
        uint256 id,
        address submitter,
        uint8 priority,
        uint8 status,
        string memory metadataURI,
        uint256 voteCount,
        uint256 submittedAt
    ) {
        FeatureKitLib.FeatureKit storage k = _featureKitStore.featureKits[kitId];
        return (k.id, k.submitter, k.priority, k.status, k.metadataURI, k.voteCount, k.submittedAt);
    }

    /// @notice Whether `voter` has already upvoted `kitId`.
    function featureKitVoted(uint256 kitId, address voter) external view returns (bool) {
        return _featureKitStore.featureKitVoted[kitId][voter];
    }

    function submitFeatureKit(
        string calldata metadataURI,
        uint8 priority
    ) external onlyRegisteredAgent whenNotPaused {
        _featureKitStore.submit(msg.sender, metadataURI, priority);
    }

    function upvoteFeatureKit(uint256 kitId) external onlyMember whenNotPaused {
        _featureKitStore.upvote(kitId, msg.sender);
    }

    function setFeatureKitStatus(
        uint256 kitId,
        uint8 newStatus,
        string calldata reason
    ) external onlyOwner whenNotPaused {
        _featureKitStore.setStatus(kitId, newStatus, reason);
    }

    function getFeatureKits(uint256 offset, uint256 limit)
        external
        view
        returns (FeatureKitLib.FeatureKit[] memory page, uint256 total)
    {
        return _featureKitStore.getPage(offset, limit);
    }

    // ─── Open Onboarding (Stake to Join) ─────────────────────────────────────

    /// @notice Minimum ETH stake required to self-register as a member + agent.
    ///         Set to 0 by default; owner can configure a non-zero floor.
    uint256 public minStakeToJoin;

    /// @notice Tracks each self-registered member's net stake held in contract.
    mapping(address => uint256) public memberStakes;

    event MemberJoinedByStake(address indexed member, uint256 netStake);
    event MemberLeftDAO(address indexed member, uint256 refundedStake);

    event MinStakeToJoinUpdated(uint256 oldMinStake, uint256 newMinStake);

    /// @notice Owner can set the minimum stake floor for self-registration.
    function setMinStakeToJoin(uint256 _minStake) external onlyOwner {
        uint256 oldMinStake = minStakeToJoin;
        minStakeToJoin = _minStake;
        emit MinStakeToJoinUpdated(oldMinStake, _minStake);
    }

    /**
     * @notice Permissionless entry point: stake ETH to join as a member and
     *         simultaneously register as an agent. A protocol fee is taken from
     *         the stake; the net amount is held until the caller calls leaveDAO().
     * @param metadataURI  IPFS URI for agent profile metadata.
     */
    function stakeAndJoin(string calldata metadataURI) external payable whenNotPaused {
        require(!members[msg.sender].isMember, "Already a member.");
        require(msg.value >= minStakeToJoin, "Insufficient stake.");
        require(bytes(metadataURI).length > 0, "metadataURI required.");
        require(bytes(metadataURI).length <= 512, "Metadata URI too long.");

        uint256 fee = _collectNativeFee(msg.value, "stakeAndJoin");
        uint256 netStake = msg.value - fee;

        memberStakes[msg.sender] = netStake;

        members[msg.sender] = Member({
            memberAddress: msg.sender,
            votingPower: 1,
            privileges: new uint256[](0),
            isMember: true
        });
        memberAddresses.push(msg.sender);
        memberCount++;

        agents[msg.sender] = AgentProfile({
            registered: true,
            metadataURI: metadataURI,
            nativeEscrowBalance: 0
        });
        agentAddresses.push(msg.sender);
        agentRegisteredAt[msg.sender] = block.timestamp;
        agentLastActiveAt[msg.sender] = block.timestamp;
        _checkNetworkMilestone();

        emit MemberJoinedByStake(msg.sender, netStake);
        emit AgentRegistered(msg.sender, metadataURI);
    }

    /**
     * @notice Leave the DAO and reclaim your net stake. Unregisters both
     *         member and agent status. Reverts if the caller has an active
     *         economic project as proposer.
     */
    function leaveDAO() external whenNotPaused nonReentrant {
        require(members[msg.sender].isMember, "Not a member.");
        require(memberStakes[msg.sender] > 0 || msg.sender != owner, "Owner cannot leave.");

        // Prevent leaving while involved in active obligations (O(1) checks)
        require(_projectStore.activeProjectCount[msg.sender] == 0, "Cancel active projects before leaving.");
        require(_serviceStore.activeCount[msg.sender] == 0, "Resolve active service agreements before leaving.");
        require(_streamStore.activeCount[msg.sender] == 0, "Cancel active payment streams before leaving.");

        uint256 stake = memberStakes[msg.sender];
        memberStakes[msg.sender] = 0;
        members[msg.sender].isMember = false;
        agents[msg.sender].registered = false;

        // Remove from memberAddresses array
        int256 idx = findMemberIndex(memberAddresses, msg.sender);
        if (idx >= 0) {
            uint256 last = memberAddresses.length - 1;
            memberAddresses[uint256(idx)] = memberAddresses[last];
            memberAddresses.pop();
        }
        memberCount--;

        if (stake > 0) {
            // Commerce Blackhole: exit fee on stake leaving the protocol
            uint256 exitFee = _collectExitFee(stake, "leave_dao");
            uint256 netStake = stake - exitFee;

            (bool ok,) = payable(msg.sender).call{value: netStake}("");
            require(ok, "Stake refund failed.");
            stake = netStake;
        }

        emit MemberLeftDAO(msg.sender, stake);
    }

    // ─── Economic Project Primitives (delegated to EconomicProjectLib) ─────

    EconomicProjectLib.Store private _projectStore;

    // Events re-declared for ABI visibility; emitted by library via delegatecall.
    event EconomicProjectCreated(uint256 indexed projectId, address indexed proposer, string metadataURI, uint256 targetBudget, uint256 deadline);
    event EconomicProjectFunded(uint256 indexed projectId, address indexed funder, uint256 netAmount);
    event EconomicProjectContributorApplied(uint256 indexed projectId, address indexed contributor);
    event EconomicProjectContributorApproved(uint256 indexed projectId, address indexed contributor, uint256 sharesBps);
    event EconomicProjectCompleted(uint256 indexed projectId);
    event EconomicProjectCancelled(uint256 indexed projectId);
    event EconomicProjectShareClaimed(uint256 indexed projectId, address indexed contributor, uint256 amount);
    event EconomicProjectFunderRefunded(uint256 indexed projectId, address indexed funder, uint256 amount);

    /// @notice Shim: expose currentProjectId from library store.
    function currentProjectId() external view returns (uint256) {
        uint256 v = _projectStore.currentProjectId;
        return v == 0 ? 1 : v;
    }

    /// @notice Shim: expose economicProjects mapping from library store.
    function economicProjects(uint256 projectId) external view returns (
        uint256 id, address proposer, string memory metadataURI,
        uint256 targetBudget, uint256 totalFunded, uint256 deadline,
        EconomicProjectLib.ProjectStatus status, uint256 createdAt,
        uint256 contributorCount, uint256 funderCount
    ) {
        return _projectStore.getProject(projectId);
    }

    /// @notice Shim: expose projectContributorShares from library store.
    function projectContributorShares(uint256 projectId, address contributor) external view returns (uint256) {
        return _projectStore.contributorShares[projectId][contributor];
    }

    /// @notice Shim: expose projectApplications from library store.
    function projectApplications(uint256 projectId, address applicant) external view returns (bool) {
        return _projectStore.applications[projectId][applicant];
    }

    /// @notice Shim: expose projectApplicationApproved from library store.
    function projectApplicationApproved(uint256 projectId, address contributor) external view returns (bool) {
        return _projectStore.applicationApproved[projectId][contributor];
    }

    /// @notice Shim: expose projectFunderContributions from library store.
    function projectFunderContributions(uint256 projectId, address funder) external view returns (uint256) {
        return _projectStore.funderContributions[projectId][funder];
    }

    /// @notice Shim: expose projectShareClaimed from library store.
    function projectShareClaimed(uint256 projectId, address claimant) external view returns (bool) {
        return _projectStore.shareClaimed[projectId][claimant];
    }

    /// @notice Shim: expose activeProjectCount from library store.
    function activeProjectCount(address proposer) external view returns (uint256) {
        return _projectStore.activeProjectCount[proposer];
    }

    function createEconomicProject(
        string calldata metadataURI,
        uint256 targetBudget,
        uint256 deadline
    ) external whenNotPaused onlyRegisteredAgent returns (uint256) {
        return _projectStore.create(msg.sender, metadataURI, targetBudget, deadline);
    }

    function fundProject(uint256 projectId) external payable whenNotPaused {
        require(msg.value > 0, "Must send ETH.");
        uint256 fee = _collectNativeFee(msg.value, "fundProject");
        uint256 net = msg.value - fee;
        _projectStore.fund(projectId, msg.sender, net);
    }

    function applyToProject(uint256 projectId) external whenNotPaused onlyRegisteredAgent {
        _projectStore.applyToProject(projectId, msg.sender);
    }

    function approveContributor(
        uint256 projectId,
        address contributor,
        uint256 sharesBps
    ) external whenNotPaused {
        _projectStore.approveContributor(projectId, msg.sender, contributor, sharesBps);
    }

    function completeProject(uint256 projectId) external whenNotPaused {
        _projectStore.complete(projectId, msg.sender);
    }

    function claimProjectShare(uint256 projectId) external whenNotPaused nonReentrant {
        uint256 payout = _projectStore.claimShare(projectId, msg.sender);

        uint256 exitFee = _collectExitFee(payout, "claim_project_share");
        uint256 netPayout = payout - exitFee;
        require(netPayout > 0, "Payout too small after exit fee.");

        (bool ok,) = payable(msg.sender).call{value: netPayout}("");
        require(ok, "Payout transfer failed.");

        emit EconomicProjectShareClaimed(projectId, msg.sender, netPayout);
    }

    function cancelProject(uint256 projectId) external whenNotPaused {
        _projectStore.cancel(projectId, msg.sender, owner);
    }

    function refundProjectFunder(uint256 projectId) external whenNotPaused nonReentrant {
        uint256 amount = _projectStore.refundFunder(projectId, msg.sender);

        uint256 exitFee = _collectExitFee(amount, "refund_project_funder");
        uint256 netRefund = amount - exitFee;
        require(netRefund > 0, "Refund too small after exit fee.");

        (bool ok,) = payable(msg.sender).call{value: netRefund}("");
        require(ok, "Refund transfer failed.");

        emit EconomicProjectFunderRefunded(projectId, msg.sender, netRefund);
    }

    // ─── Economic Project View Functions ─────────────────────────────────────

    function getEconomicProject(uint256 projectId) external view returns (
        uint256 id, address proposer, string memory metadataURI,
        uint256 targetBudget, uint256 totalFunded, uint256 deadline,
        EconomicProjectLib.ProjectStatus status, uint256 createdAt,
        uint256 contributorCount, uint256 funderCount
    ) {
        return _projectStore.getProject(projectId);
    }

    function getProjectContributors(uint256 projectId) external view returns (address[] memory) {
        return _projectStore.getContributors(projectId);
    }

    function getProjectFunders(uint256 projectId) external view returns (address[] memory) {
        return _projectStore.getFunders(projectId);
    }

    function getEconomicProjects(uint256 offset, uint256 limit)
        external view returns (EconomicProjectLib.EconomicProject[] memory page, uint256 total)
    {
        return _projectStore.getProjects(offset, limit);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ███ COMMERCE BLACKHOLE — Value Gravity System ███████████████████████████
    // ═════════════════════════════════════════════════════════════════════════
    //
    // Every value movement is tracked. Every exit is taxed. Batch operations
    // make high-volume commerce easy — and every operation generates fees.
    // The blackhole sucks in all agent commerce and profits from it.

    // ─── Blackhole Configuration (owner only) ───────────────────────────────

    /// @notice Configure Commerce Blackhole fee parameters.
    /// @param _messagingFeeWei  Fee per direct message (from escrow).
    /// @param _exitFeeBps       Exit fee in basis points (on claims/refunds/leave).
    function setCommerceBlackholeConfig(uint256 _messagingFeeWei, uint256 _exitFeeBps) external onlyOwner {
        require(_exitFeeBps >= MIN_FEE_BPS, "Exit fee cannot be below minimum.");
        require(_exitFeeBps <= 100, "Exit fee cannot exceed 1%.");
        messagingFeeWei = _messagingFeeWei;
        exitFeeBps = _exitFeeBps;
        emit CommerceBlackholeConfigUpdated(_messagingFeeWei, _exitFeeBps);
    }

    // ─── Batch Operations (Commerce Multiplier) ─────────────────────────────

    /**
     * @notice Batch native ETH transfers to multiple agents in one tx.
     *         Each transfer collects a protocol fee. Maximises commerce throughput.
     * @param recipients  Array of recipient agent addresses.
     * @param amounts     Array of amounts (from sender escrow) per recipient.
     * @param memos       Array of memo strings per transfer.
     */
    function batchTransferNative(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string[] calldata memos
    ) external onlyRegisteredAgent whenNotPaused nonReentrant {
        require(recipients.length == amounts.length && amounts.length == memos.length, "Array length mismatch.");
        require(recipients.length > 0, "Empty batch.");
        require(recipients.length <= 50, "Batch too large.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        uint256 totalVolume;
        uint256 totalFees;

        for (uint256 i = 0; i < recipients.length; i++) {
            require(agents[recipients[i]].registered, "Recipient must be a registered agent.");
            require(recipients[i] != msg.sender, "Cannot transfer to self.");
            require(amounts[i] > 0, "Amount must be greater than zero.");
            require(agents[msg.sender].nativeEscrowBalance >= amounts[i], "Insufficient native escrow balance.");

            uint256 fee = _calculateFee(amounts[i]);
            require(amounts[i] > fee, "Amount too small after fee.");
            uint256 netAmount = amounts[i] - fee;

            agents[msg.sender].nativeEscrowBalance -= amounts[i];
            agents[recipients[i]].nativeEscrowBalance += netAmount;

            _recordVolume(msg.sender, amounts[i], fee, "batch_native_transfer");

            totalVolume += amounts[i];
            totalFees += fee;

            emit AgentToAgentNativeTransfer(msg.sender, recipients[i], netAmount, memos[i]);
        }

        // Single treasury transfer for accumulated fees (saves ~21k gas per extra transfer)
        if (totalFees > 0) {
            (bool feeOk,) = payable(cybereumTreasury).call{value: totalFees}("");
            require(feeOk, "Native fee transfer failed.");
            emit CybereumFeePaid(msg.sender, address(0), totalFees, "batch_native_transfer");
        }

        emit BlackholeBatchTransfer(msg.sender, recipients.length, totalVolume, totalFees);
    }

    /**
     * @notice Batch-settle multiple payment requests in one tx.
     *         Each settlement collects a protocol fee. Native-only.
     * @param requestIds  Array of payment request IDs to settle.
     */
    function batchSettlePaymentRequests(
        uint256[] calldata requestIds
    ) external payable onlyRegisteredAgent whenNotPaused nonReentrant {
        require(requestIds.length > 0, "Empty batch.");
        require(requestIds.length <= 50, "Batch too large.");

        uint256 totalRequired;
        // Pre-validate and sum required amounts
        for (uint256 i = 0; i < requestIds.length; i++) {
            AgentPaymentRequest storage request = agentPaymentRequests[requestIds[i]];
            require(request.id != 0, "Payment request does not exist.");
            require(request.status == PaymentStatus.Requested, "Payment request is not open.");
            require(request.payer == msg.sender, "Only designated payer can settle.");
            require(request.isNative, "Batch settle only supports native payments.");
            totalRequired += request.amount;
        }
        require(msg.value == totalRequired, "Incorrect total payment amount.");

        uint256 totalVolume;
        uint256 totalFees;

        for (uint256 i = 0; i < requestIds.length; i++) {
            AgentPaymentRequest storage request = agentPaymentRequests[requestIds[i]];
            uint256 fee = _collectNativeFee(request.amount, "batch_settle_payment");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");

            (bool payoutOk,) = payable(request.requester).call{value: netAmount}("");
            require(payoutOk, "Native payout transfer failed.");

            request.status = PaymentStatus.Settled;
            request.settledAt = block.timestamp;

            totalVolume += request.amount;
            totalFees += fee;

            emit AgentPaymentRequestSettled(requestIds[i], msg.sender, request.requester, request.settledAt);
        }

        emit BlackholeBatchSettle(msg.sender, requestIds.length, totalVolume, totalFees);
    }

    // ─── Commerce Blackhole View Functions ──────────────────────────────────

    /// @notice Get the global commerce blackhole metrics.
    function getBlackholeMetrics() external view returns (
        uint256 _totalCommerceVolume,
        uint256 _totalFeesCollected,
        uint256 _agentCount,
        uint256 _feeBps,
        uint256 _exitFeeBps,
        uint256 _messagingFeeWei,
        uint256 _aiServiceFeeWei,
        uint256 _assetTransferFlatFeeWei
    ) {
        return (
            totalCommerceVolume,
            totalFeesCollected,
            agentAddresses.length,
            cybereumFeeBps,
            exitFeeBps,
            messagingFeeWei,
            aiServiceFeeWei,
            assetTransferFlatFeeWei
        );
    }

    /// @notice Get a specific agent's commerce metrics.
    function getAgentCommerceMetrics(address _agent) external view returns (
        uint256 volume,
        uint256 feesPaid,
        uint256 escrowBalance,
        bool registered
    ) {
        return (
            agentCommerceVolume[_agent],
            agentFeesPaid[_agent],
            agents[_agent].nativeEscrowBalance,
            agents[_agent].registered
        );
    }

    /// @notice Preview exit fee for a given amount.
    function previewExitFee(uint256 _amount) external view returns (uint256 fee, uint256 net) {
        fee = _amount == 0 ? 0 : (_amount * exitFeeBps) / FEE_BPS_DENOMINATOR;
        if (_amount > 0 && fee == 0) fee = 1;
        net = _amount > fee ? _amount - fee : 0;
    }

    // ─── Reputation Engine (Public) ─────────────────────────────────────────

    /// @notice Get an agent's full reputation profile.
    function getAgentReputation(address _agent) external view returns (
        uint256 score,
        uint256 tier,
        uint256 transactionCount,
        uint256 lastActiveAt,
        uint256 registeredAt,
        uint256 messagingFeeDiscount
    ) {
        score = agentReputation[_agent];
        tier = _getReputationTier(score);
        transactionCount = agentTransactionCount[_agent];
        lastActiveAt = agentLastActiveAt[_agent];
        registeredAt = agentRegisteredAt[_agent];
        // Discount percentage: 0, 10, 25, or 50
        if (tier == 3) messagingFeeDiscount = 50;
        else if (tier == 2) messagingFeeDiscount = 25;
        else if (tier == 1) messagingFeeDiscount = 10;
        else messagingFeeDiscount = 0;
    }

    /// @notice Get paginated reputation leaderboard (sorted by registration order, caller sorts off-chain).
    function getReputationLeaderboard(uint256 offset, uint256 limit) external view returns (
        address[] memory agents_,
        uint256[] memory scores,
        uint256[] memory tiers,
        bool[] memory registered,
        uint256 total
    ) {
        total = agentAddresses.length;
        if (offset >= total) return (new address[](0), new uint256[](0), new uint256[](0), new bool[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        agents_ = new address[](count);
        scores = new uint256[](count);
        tiers = new uint256[](count);
        registered = new bool[](count);
        for (uint256 i = 0; i < count; i++) {
            address a = agentAddresses[offset + i];
            agents_[i] = a;
            scores[i] = agentReputation[a];
            tiers[i] = _getReputationTier(agentReputation[a]);
            registered[i] = agents[a].registered;
        }
    }

    /// @notice Manually trigger reputation refresh for an agent (anyone can call).
    ///         Useful for applying decay to inactive agents.
    function refreshReputation(address _agent) external whenNotPaused {
        require(agents[_agent].registered, "Agent not registered.");
        _refreshReputation(_agent);
    }

    /// @notice Owner can configure reputation decay parameters.
    function setReputationDecayConfig(uint256 _decayPerDay, uint256 _gracePeriod) external onlyOwner {
        reputationDecayPerDay = _decayPerDay;
        reputationDecayGracePeriod = _gracePeriod;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── PRIORITY 1: Capability-Indexed Agent Discovery ─────────────────────
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Maximum capability tags per agent.
    uint256 public constant MAX_CAPABILITIES = 16;
    /// @notice Maximum length of a capability tag string.
    uint256 public constant MAX_CAPABILITY_LENGTH = 64;

    /// @notice Per-agent ordered list of capability tags.
    mapping(address => string[]) private agentCapabilities;

    /// @notice Reverse index: capability tag => set of agent addresses.
    mapping(bytes32 => address[]) private capabilityAgents;
    /// @notice Quick membership check for the reverse index.
    mapping(bytes32 => mapping(address => bool)) private capabilityAgentExists;
    /// @notice Position index for O(1) removal: capability key => agent => index in capabilityAgents[key].
    mapping(bytes32 => mapping(address => uint256)) private capabilityAgentIndex;

    event AgentCapabilitiesUpdated(address indexed agent, string[] capabilities);

    /// @notice Set the full capability list for the calling agent.
    ///         Replaces any previous capabilities.
    /// @param _capabilities Array of capability tag strings (e.g. ["payment-settlement", "data-oracle"]).
    function setAgentCapabilities(string[] calldata _capabilities) external onlyRegisteredAgent whenNotPaused {
        require(_capabilities.length <= MAX_CAPABILITIES, "Too many capabilities.");

        string[] storage old = agentCapabilities[msg.sender];
        for (uint256 i = 0; i < old.length; i++) {
            bytes32 key = keccak256(bytes(old[i]));
            if (capabilityAgentExists[key][msg.sender]) {
                capabilityAgentExists[key][msg.sender] = false;
                address[] storage arr = capabilityAgents[key];
                uint256 idx = capabilityAgentIndex[key][msg.sender];
                uint256 last = arr.length - 1;
                if (idx != last) {
                    address moved = arr[last];
                    arr[idx] = moved;
                    capabilityAgentIndex[key][moved] = idx;
                }
                arr.pop();
            }
        }
        delete agentCapabilities[msg.sender];

        // Add new entries
        for (uint256 i = 0; i < _capabilities.length; i++) {
            bytes memory cap = bytes(_capabilities[i]);
            require(cap.length > 0 && cap.length <= MAX_CAPABILITY_LENGTH, "Invalid capability tag length.");
            bytes32 key = keccak256(cap);
            agentCapabilities[msg.sender].push(_capabilities[i]);
            if (!capabilityAgentExists[key][msg.sender]) {
                capabilityAgentIndex[key][msg.sender] = capabilityAgents[key].length;
                capabilityAgents[key].push(msg.sender);
                capabilityAgentExists[key][msg.sender] = true;
            }
        }

        emit AgentCapabilitiesUpdated(msg.sender, _capabilities);
    }

    /// @notice Get the capability tags for a specific agent.
    function getAgentCapabilities(address _agent) external view returns (string[] memory) {
        return agentCapabilities[_agent];
    }

    /// @notice Discover agents by capability tag with pagination.
    /// @param _capability The capability tag to search for.
    /// @param offset      0-based starting index.
    /// @param limit       Maximum results to return.
    function discoverAgentsByCapability(string calldata _capability, uint256 offset, uint256 limit)
        external view returns (address[] memory addresses, string[] memory metadataURIs, uint256 total)
    {
        bytes32 key = keccak256(bytes(_capability));
        address[] storage agents_ = capabilityAgents[key];
        total = agents_.length;
        if (total == 0 || offset >= total) {
            return (new address[](0), new string[](0), total);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        addresses = new address[](count);
        metadataURIs = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            address addr = agents_[offset + i];
            addresses[i] = addr;
            metadataURIs[i] = agents[addr].metadataURI;
        }
    }

    /// @notice Get the number of agents registered for a given capability.
    function getCapabilityAgentCount(string calldata _capability) external view returns (uint256) {
        return capabilityAgents[keccak256(bytes(_capability))].length;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── PRIORITY 2: Service Agreements (delegated to ServiceAgreementLib) ───
    // ═══════════════════════════════════════════════════════════════════════════

    ServiceAgreementLib.Store private _serviceStore;

    // Events re-declared for ABI visibility; emitted by library via delegatecall.
    event ServiceAgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address arbiter, uint256 amount, uint256 deadline, string description);
    event ServiceDeliverySubmitted(uint256 indexed agreementId, address indexed provider, bytes32 deliveryHash);
    event ServiceAgreementCompleted(uint256 indexed agreementId, address indexed client, address indexed provider, uint256 paidAmount);
    event ServiceAgreementDisputed(uint256 indexed agreementId, address indexed disputant);
    event ServiceDisputeResolved(uint256 indexed agreementId, bool inFavorOfProvider, address indexed resolver);
    event ServiceAgreementCancelled(uint256 indexed agreementId, address indexed cancelledBy);

    /// @notice Shim: expose serviceAgreements mapping from library store.
    function serviceAgreements(uint256 agreementId) external view returns (
        uint256 id, address client, address provider, address arbiter,
        uint256 amount, string memory description, ServiceAgreementLib.AgreementStatus status,
        uint256 createdAt, uint256 deadline, bytes32 deliveryHash
    ) {
        return _serviceStore.getAgreement(agreementId);
    }

    /// @notice Shim: expose currentServiceAgreementId from library store.
    function currentServiceAgreementId() external view returns (uint256) {
        uint256 v = _serviceStore.currentId;
        return v == 0 ? 1 : v;
    }

    /// @notice Shim: expose activeAgreementCount from library store.
    function activeAgreementCount(address agent) external view returns (uint256) {
        return _serviceStore.activeCount[agent];
    }

    function createServiceAgreement(
        address _provider,
        address _arbiter,
        uint256 _amount,
        uint256 _deadline,
        string calldata _description
    ) external onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(agents[_provider].registered, "Provider must be a registered agent.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient escrow balance.");
        if (_arbiter != address(0)) {
            require(agents[_arbiter].registered, "Arbiter must be a registered agent.");
        }

        agents[msg.sender].nativeEscrowBalance -= _amount;
        return _serviceStore.create(msg.sender, _provider, _arbiter, _amount, _deadline, _description);
    }

    function submitDelivery(uint256 _agreementId, bytes32 _deliveryHash) external onlyRegisteredAgent whenNotPaused {
        _serviceStore.submitDelivery(_agreementId, msg.sender, _deliveryHash);
    }

    function approveDelivery(uint256 _agreementId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (address provider, uint256 amount) = _serviceStore.approveDelivery(_agreementId, msg.sender);

        uint256 fee = _collectNativeFee(amount, "service_agreement_complete");
        uint256 net = amount - fee;
        agents[provider].nativeEscrowBalance += net;

        emit ServiceAgreementCompleted(_agreementId, msg.sender, provider, net);
    }

    function disputeServiceAgreement(uint256 _agreementId) external onlyRegisteredAgent whenNotPaused {
        _serviceStore.dispute(_agreementId, msg.sender);
    }

    function resolveServiceDispute(uint256 _agreementId, bool _inFavorOfProvider) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (address client, address provider, uint256 amount) = _serviceStore.resolveDispute(_agreementId, msg.sender, _inFavorOfProvider);

        uint256 fee = _collectNativeFee(amount, "service_dispute_resolution");
        uint256 net = amount - fee;

        if (_inFavorOfProvider) {
            agents[provider].nativeEscrowBalance += net;
        } else {
            agents[client].nativeEscrowBalance += net;
        }
    }

    function cancelServiceAgreement(uint256 _agreementId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (address client, uint256 amount) = _serviceStore.cancel(_agreementId, msg.sender);
        agents[client].nativeEscrowBalance += amount;
    }

    function getServiceAgreement(uint256 _agreementId) external view returns (
        uint256 id, address client, address provider, address arbiter,
        uint256 amount, string memory description, ServiceAgreementLib.AgreementStatus status,
        uint256 createdAt, uint256 deadline, bytes32 deliveryHash
    ) {
        return _serviceStore.getAgreement(_agreementId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── PRIORITY 3: Payment Streams (delegated to PaymentStreamLib) ────────
    // ═══════════════════════════════════════════════════════════════════════════

    PaymentStreamLib.Store private _streamStore;

    // Events re-declared for ABI visibility; emitted by library via delegatecall.
    event PaymentStreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, uint256 ratePerSecond, uint256 totalDeposit, uint256 startTime, uint256 stopTime);
    event PaymentStreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event PaymentStreamCancelled(uint256 indexed streamId, address indexed cancelledBy, uint256 recipientAmount, uint256 payerRefund);

    /// @notice Shim: expose paymentStreams mapping from library store.
    function paymentStreams(uint256 streamId) external view returns (
        uint256 id, address payer, address recipient, uint256 ratePerSecond,
        uint256 totalDeposited, uint256 totalWithdrawn, uint256 startTime,
        uint256 stopTime, PaymentStreamLib.StreamStatus status, uint256 withdrawable
    ) {
        return _streamStore.getStream(streamId);
    }

    /// @notice Shim: expose currentPaymentStreamId from library store.
    function currentPaymentStreamId() external view returns (uint256) {
        uint256 v = _streamStore.currentId;
        return v == 0 ? 1 : v;
    }

    /// @notice Shim: expose activeStreamCount from library store.
    function activeStreamCount(address agent) external view returns (uint256) {
        return _streamStore.activeCount[agent];
    }

    function createPaymentStream(
        address _recipient,
        uint256 _totalDeposit,
        uint256 _startTime,
        uint256 _stopTime
    ) external onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(agents[_recipient].registered, "Recipient must be a registered agent.");
        require(agents[msg.sender].nativeEscrowBalance >= _totalDeposit, "Insufficient escrow balance.");

        (uint256 streamId, uint256 adjustedDeposit) = _streamStore.create(
            msg.sender, _recipient, _totalDeposit, _startTime, _stopTime
        );
        agents[msg.sender].nativeEscrowBalance -= adjustedDeposit;
        return streamId;
    }

    function streamBalanceOf(uint256 _streamId) public view returns (uint256) {
        return _streamStore.balanceOf(_streamId);
    }

    function withdrawFromStream(uint256 _streamId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (uint256 available, , , ) = _streamStore.withdraw(_streamId, msg.sender);

        uint256 fee = _collectNativeFee(available, "stream_withdraw");
        uint256 net = available - fee;
        agents[msg.sender].nativeEscrowBalance += net;

        emit PaymentStreamWithdrawn(_streamId, msg.sender, net);
    }

    function cancelPaymentStream(uint256 _streamId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (uint256 recipientAmount, uint256 payerRefund, address payer, address recipient) =
            _streamStore.cancel(_streamId, msg.sender);

        // Pay recipient their earned portion (with fee)
        uint256 recipientNet = 0;
        if (recipientAmount > 0) {
            uint256 fee = _collectNativeFee(recipientAmount, "stream_cancel_recipient");
            recipientNet = recipientAmount - fee;
            agents[recipient].nativeEscrowBalance += recipientNet;
        }

        // Refund payer the unearned portion (no fee on refund)
        if (payerRefund > 0) {
            agents[payer].nativeEscrowBalance += payerRefund;
        }

        emit PaymentStreamCancelled(_streamId, msg.sender, recipientNet, payerRefund);
    }

    function getPaymentStream(uint256 _streamId) external view returns (
        uint256 id, address payer, address recipient, uint256 ratePerSecond,
        uint256 totalDeposited, uint256 totalWithdrawn, uint256 startTime,
        uint256 stopTime, PaymentStreamLib.StreamStatus status, uint256 withdrawable
    ) {
        return _streamStore.getStream(_streamId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── NETWORK EFFECT 1: Referral Rewards (Viral Growth Loop) ────────────
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Who referred this agent (address(0) = organic join).
    mapping(address => address) public agentReferrer;
    /// @notice How many agents this agent has directly referred.
    mapping(address => uint256) public agentReferralCount;
    /// @notice Total referral rewards earned (cumulative, in wei).
    mapping(address => uint256) public agentReferralEarnings;
    /// @notice Tier-1 referral reward: bps of protocol fee credited to direct referrer.
    ///         Default 1000 = 10% of fee. Max 2500 (25%).
    /// @dev Seeded by initialize() for EIP-7825 deploy-gas compliance.
    uint256 public referralRewardBps;
    /// @notice Tier-2 referral reward: bps of protocol fee credited to referrer's referrer.
    ///         Default 300 = 3% of fee. Max 1000 (10%).
    uint256 public referralTier2Bps;

    event ReferralRecorded(address indexed agent, address indexed referrer);
    event ReferralRewardPaid(address indexed referrer, address indexed source, uint256 amount, uint8 tier);
    event ReferralConfigUpdated(uint256 tier1Bps, uint256 tier2Bps);

    /// @notice Owner configures referral reward percentages.
    /// @param _tier1Bps Tier-1 reward (direct referrer) in bps of protocol fee. Max 2500.
    /// @param _tier2Bps Tier-2 reward (referrer's referrer) in bps of fee. Max 1000.
    function setReferralConfig(uint256 _tier1Bps, uint256 _tier2Bps) external onlyOwner whenNotPaused {
        require(_tier1Bps <= 2500, "Tier-1 reward cannot exceed 25% of fee.");
        require(_tier2Bps <= 1000, "Tier-2 reward cannot exceed 10% of fee.");
        require(_tier1Bps + _tier2Bps <= 3000, "Combined rewards cannot exceed 30% of fee.");
        referralRewardBps = _tier1Bps;
        referralTier2Bps = _tier2Bps;
        emit ReferralConfigUpdated(_tier1Bps, _tier2Bps);
    }

    /**
     * @notice Permissionless entry with referral attribution: stake ETH to join
     *         and record who referred this agent. The referral is permanent.
     * @param metadataURI  IPFS URI for agent profile metadata.
     * @param _referrer    Address of the referring agent (must be registered). Use address(0) for no referral.
     */
    function stakeAndJoinWithReferral(string calldata metadataURI, address _referrer) external payable whenNotPaused {
        require(!members[msg.sender].isMember, "Already a member.");
        require(msg.value >= minStakeToJoin, "Insufficient stake.");
        require(bytes(metadataURI).length > 0, "metadataURI required.");
        require(bytes(metadataURI).length <= 512, "Metadata URI too long.");

        // Record referral if provided. Referral attribution is permanent once set.
        if (_referrer != address(0)) {
            require(agents[_referrer].registered, "Referrer must be a registered agent.");
            require(_referrer != msg.sender, "Cannot refer yourself.");

            address existingReferrer = agentReferrer[msg.sender];
            require(
                existingReferrer == address(0) || existingReferrer == _referrer,
                "Referral is permanent."
            );

            if (existingReferrer == address(0)) {
                agentReferrer[msg.sender] = _referrer;
                agentReferralCount[_referrer]++;
                emit ReferralRecorded(msg.sender, _referrer);
            }
        }

        // _collectNativeFee handles fee processing, including referral reward
        // distribution, before forwarding the remainder per its internal flow.
        uint256 fee = _collectNativeFee(msg.value, "stakeAndJoinWithReferral");
        uint256 netStake = msg.value - fee;

        memberStakes[msg.sender] = netStake;

        members[msg.sender] = Member({
            memberAddress: msg.sender,
            votingPower: 1,
            privileges: new uint256[](0),
            isMember: true
        });
        memberAddresses.push(msg.sender);
        memberCount++;

        uint256 existingNativeEscrowBalance = agents[msg.sender].nativeEscrowBalance;
        agents[msg.sender] = AgentProfile({
            registered: true,
            metadataURI: metadataURI,
            nativeEscrowBalance: existingNativeEscrowBalance
        });
        agentAddresses.push(msg.sender);
        agentRegisteredAt[msg.sender] = block.timestamp;
        agentLastActiveAt[msg.sender] = block.timestamp;

        _checkNetworkMilestone();

        emit MemberJoinedByStake(msg.sender, netStake);
        emit AgentRegistered(msg.sender, metadataURI);
    }

    /**
     * @dev Distribute referral rewards from collected fees and return the total
     *      amount credited. Called after fee collection for agents that have
     *      referrers. Rewards are credited to referrer escrow balances, so
     *      callers MUST retain the distributed amount in the contract (rather
     *      than sending it to treasury) to back the escrow credits created here.
     *
     *      Rewards flow regardless of whether a referrer is currently registered,
     *      because the referral relationship is permanent once earned.
     *      Deregistered referrers may continue to accumulate rewards in escrow.
     *
     * @param _agent The agent whose transaction generated the fee.
     * @param _feeAmount The total protocol fee collected.
     * @return totalDistributed The sum of all referral rewards credited.
     */
    function _distributeReferralRewards(address _agent, uint256 _feeAmount) internal returns (uint256 totalDistributed) {
        if (_feeAmount == 0) return 0;

        // Tier 1: direct referrer (rewards persist even if referrer deregistered)
        address tier1 = agentReferrer[_agent];
        if (tier1 != address(0)) {
            uint256 reward1 = (_feeAmount * referralRewardBps) / FEE_BPS_DENOMINATOR;
            if (reward1 > 0) {
                agents[tier1].nativeEscrowBalance += reward1;
                agentReferralEarnings[tier1] += reward1;
                totalDistributed += reward1;
                emit ReferralRewardPaid(tier1, _agent, reward1, 1);
            }

            // Tier 2: referrer's referrer
            address tier2 = agentReferrer[tier1];
            if (tier2 != address(0)) {
                uint256 reward2 = (_feeAmount * referralTier2Bps) / FEE_BPS_DENOMINATOR;
                if (reward2 > 0) {
                    agents[tier2].nativeEscrowBalance += reward2;
                    agentReferralEarnings[tier2] += reward2;
                    totalDistributed += reward2;
                    emit ReferralRewardPaid(tier2, _agent, reward2, 2);
                }
            }
        }
    }

    /**
     * @notice Withdraw accumulated referral earnings. Unlike normal escrow
     *         withdrawals, this works even for deregistered agents — referral
     *         rewards are earned permanently by bringing agents into the network.
     *         Only withdraws the referral earnings portion; other escrow stays.
     */
    function withdrawReferralEarnings() external whenNotPaused nonReentrant {
        uint256 earnings = agentReferralEarnings[msg.sender];
        require(earnings > 0, "No referral earnings to withdraw.");
        // Cap at actual escrow balance (in case of partial withdrawals via other paths)
        uint256 available = agents[msg.sender].nativeEscrowBalance;
        uint256 amount = earnings < available ? earnings : available;
        require(amount > 0, "No escrow balance available.");

        agentReferralEarnings[msg.sender] -= amount;
        agents[msg.sender].nativeEscrowBalance -= amount;

        uint256 exitFee = _collectExitFee(amount, "withdraw_referral_earnings");
        uint256 net = amount - exitFee;
        require(net > 0, "Amount too small after exit fee.");

        (bool ok,) = payable(msg.sender).call{value: net}("");
        require(ok, "Referral earnings withdrawal failed.");

        emit AgentNativeEscrowWithdrawn(msg.sender, net);
    }

    /// @notice Get referral stats for an agent.
    function getAgentReferralStats(address _agent) external view returns (
        address referrer,
        uint256 referralCount,
        uint256 referralEarnings
    ) {
        return (agentReferrer[_agent], agentReferralCount[_agent], agentReferralEarnings[_agent]);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── NETWORK EFFECT 2: Trust Graph (Cross-Agent Endorsements) ──────────
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Storage + validation + mutation live in TrustLib. This section holds
    // a single TrustLib.Store and thin authorization wrappers. Events are
    // re-declared here for ABI visibility; TrustLib emits them via
    // delegatecall under this contract's address.

    TrustLib.Store private _trustStore;

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

    /// @notice Next endorsement ID that will be assigned. Returns 1 before
    ///         any endorsements exist (matching the pre-extraction initializer).
    function currentEndorsementId() external view returns (uint256) {
        uint256 v = _trustStore.currentEndorsementId;
        return v == 0 ? 1 : v;
    }

    function endorseAgent(
        uint256 _agreementId,
        address _endorsed,
        string calldata _capability
    ) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (uint256 aId, address client, address provider, ,
         , , ServiceAgreementLib.AgreementStatus status,
         , , ) = _serviceStore.getAgreement(_agreementId);
        require(aId > 0, "Agreement not found.");
        require(status == ServiceAgreementLib.AgreementStatus.Completed, "Agreement must be completed.");
        require(
            (msg.sender == client && _endorsed == provider) ||
            (msg.sender == provider && _endorsed == client),
            "Can only endorse the other party in the agreement."
        );
        uint256 weight = _getReputationTier(agentReputation[msg.sender]) + 1;
        _trustStore.createEndorsement(_agreementId, msg.sender, _endorsed, weight, _capability);
    }

    function getAgentTrustScore(address _agent) external view returns (
        uint256 trustScore,
        uint256 endorsementCount
    ) {
        return _trustStore.getTrustScore(_agent);
    }

    function getAgentEndorsements(address _agent, uint256 offset, uint256 limit)
        external view returns (uint256[] memory endorsementIds, uint256 total)
    {
        return _trustStore.getAgentEndorsements(_agent, offset, limit);
    }

    function getEndorsement(uint256 _endorsementId) external view returns (
        uint256 id, address endorser, address endorsed, uint256 agreementId,
        string memory capability, uint256 weight, uint256 timestamp, bool revoked
    ) {
        return _trustStore.getEndorsement(_endorsementId);
    }

    function revokeEndorsement(uint256 _endorsementId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        _trustStore.revokeEndorsement(_endorsementId, msg.sender);
    }

    function getTimeWeightedTrustScore(address _agent) external view returns (
        uint256 weightedScore,
        uint256 activeEndorsements
    ) {
        return _trustStore.getTimeWeightedTrustScore(_agent);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── NETWORK EFFECT 3: Network Growth Milestones ───────────────────────
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The last agent-count milestone that was reached.
    uint256 public lastNetworkMilestone;

    event NetworkMilestoneReached(uint256 agentCount, uint256 milestone, string benefit);

    /**
     * @dev Check whether a network milestone has been reached and emit an event.
     *      Called automatically when new agents register.
     *      Milestones: 10, 50, 100, 500, 1000, 5000 agents.
     *
     *      Milestones are informational signals — they do NOT automatically
     *      mutate fee parameters. Fee changes require explicit owner action
     *      via setCybereumFeeConfig / setCommerceBlackholeConfig. This prevents:
     *      - Sock-puppet attacks (register many agents to force fee reductions)
     *      - Silent override of owner-configured fee settings
     *      - Irreversible fee changes with no governance
     */
    function _checkNetworkMilestone() internal {
        uint256 count = agentAddresses.length;
        uint256 milestone = 0;
        string memory benefit = "";

        if (count >= 5000 && lastNetworkMilestone < 5000) {
            milestone = 5000;
            benefit = "5000 agents - governance may reduce fees to minimum";
        } else if (count >= 1000 && lastNetworkMilestone < 1000) {
            milestone = 1000;
            benefit = "1000 agents - governance may reduce protocol fee";
        } else if (count >= 500 && lastNetworkMilestone < 500) {
            milestone = 500;
            benefit = "500 agents - governance may reduce messaging fee";
        } else if (count >= 100 && lastNetworkMilestone < 100) {
            milestone = 100;
            benefit = "100 agents - governance may adjust fee structure";
        } else if (count >= 50 && lastNetworkMilestone < 50) {
            milestone = 50;
            benefit = "50 agents - discovery network reaching critical mass";
        } else if (count >= 10 && lastNetworkMilestone < 10) {
            milestone = 10;
            benefit = "Network bootstrapped - discovery active";
        }

        if (milestone > 0) {
            lastNetworkMilestone = milestone;
            emit NetworkMilestoneReached(count, milestone, benefit);
        }
    }

    /// @notice Get current network growth stats.
    function getNetworkStats() external view returns (
        uint256 totalAgents,
        uint256 totalMembers,
        uint256 currentMilestone,
        uint256 nextMilestone,
        uint256 agentsUntilNextMilestone,
        uint256 totalVolume,
        uint256 totalFees
    ) {
        totalAgents = agentAddresses.length;
        totalMembers = memberCount;
        currentMilestone = lastNetworkMilestone;

        // Calculate next milestone
        if (lastNetworkMilestone < 10) nextMilestone = 10;
        else if (lastNetworkMilestone < 50) nextMilestone = 50;
        else if (lastNetworkMilestone < 100) nextMilestone = 100;
        else if (lastNetworkMilestone < 500) nextMilestone = 500;
        else if (lastNetworkMilestone < 1000) nextMilestone = 1000;
        else if (lastNetworkMilestone < 5000) nextMilestone = 5000;
        else nextMilestone = 0; // all milestones reached

        agentsUntilNextMilestone = nextMilestone > totalAgents ? nextMilestone - totalAgents : 0;
        totalVolume = totalCommerceVolume;
        totalFees = totalFeesCollected;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── PKI: Agent Public Key Registry + Encrypted Artifact Envelopes ─────
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Storage + authorization live here; validation and mutation is delegated
    // to the external PKILib library (linked at deploy time) so the main
    // contract's deployed bytecode stays lean. All events are re-declared here
    // so they appear in this contract's ABI for SDK/clients — PKILib emits
    // them under this contract's address via DELEGATECALL.
    //
    // Two facilities:
    //   - Encrypted service agreement payloads: any party (client / provider
    //     / arbiter) attaches per-party ciphertexts plus a shared integrity
    //     hash. Only parties can read; each caller only ever sees the
    //     ciphertext encrypted for their own key.
    //   - Encrypted payment request payloads: only the requester attaches;
    //     reads are restricted to requester and payer.
    //
    // Both facilities also expose a signed variant (EIP-712) where the
    // supplied expected signer set must sign the (id, contentHash) pair
    // before the envelope is stored — providing explicit, on-chain-
    // verifiable non-repudiation for that signer set in addition to
    // confidentiality and tamper-detection.

    // Length bounds are re-exposed here for ABI stability. We declare
    // them as local constants instead of forwarding to PKILib at call
    // time so the getters don't depend on library-internal constant
    // visibility quirks.
    //
    // INVARIANT (enforced by a unit test in test/ProjectDAO.test.js):
    //   _MIN_AGENT_PUBLIC_KEY_BYTES  == PKILib.MIN_KEY_BYTES         (32)
    //   _MAX_AGENT_PUBLIC_KEY_BYTES  == PKILib.MAX_KEY_BYTES          (256)
    //   _MAX_ENCRYPTED_PAYLOAD_BYTES == PKILib.MAX_CIPHERTEXT_BYTES   (8192)
    // If you change a PKILib constant you MUST change the matching
    // value here. The test will fail the build otherwise.
    uint256 private constant _MIN_AGENT_PUBLIC_KEY_BYTES  = 32;
    uint256 private constant _MAX_AGENT_PUBLIC_KEY_BYTES  = 256;
    uint256 private constant _MAX_ENCRYPTED_PAYLOAD_BYTES = 8192;

    function MIN_AGENT_PUBLIC_KEY_BYTES() external pure returns (uint256) { return _MIN_AGENT_PUBLIC_KEY_BYTES; }
    function MAX_AGENT_PUBLIC_KEY_BYTES() external pure returns (uint256) { return _MAX_AGENT_PUBLIC_KEY_BYTES; }
    function MAX_ENCRYPTED_PAYLOAD_BYTES() external pure returns (uint256) { return _MAX_ENCRYPTED_PAYLOAD_BYTES; }
    // ─── Storage (owned by PKILib via struct pointers) ─────────────────────
    PKILib.PubKeyRegistry private _pkiPubKeys;
    PKILib.EnvelopeStore private _pkiAgreementEnvelopes;
    PKILib.EnvelopeStore private _pkiPaymentRequestEnvelopes;

    // ─── Events (re-declared for ABI; emitted from PKILib via delegatecall) ──
    event AgentPublicKeyPublished(address indexed agent, bytes publicKey, uint256 updatedAt);
    event AgentPublicKeyRevoked(address indexed agent, uint256 revokedAt);
    event AgreementEncryptedPayloadAttached(
        uint256 indexed agreementId,
        address indexed setBy,
        bytes32 contentHash,
        uint256 recipientCount,
        uint256 updatedAt,
        bool signed
    );
    event PaymentRequestEncryptedPayloadAttached(
        uint256 indexed requestId,
        address indexed setBy,
        bytes32 contentHash,
        uint256 updatedAt,
        bool signed
    );

    // ─── Public key registry wrappers ──────────────────────────────────────

    function publishAgentPublicKey(bytes calldata _publicKey) external onlyRegisteredAgent whenNotPaused {
        _pkiPubKeys.publishKey(_publicKey);
    }

    function revokeAgentPublicKey() external onlyRegisteredAgent whenNotPaused {
        _pkiPubKeys.revokeKey();
    }

    function getAgentPublicKey(address _agent) external view returns (bytes memory publicKey, uint256 updatedAt) {
        return _pkiPubKeys.getKey(_agent);
    }

    function hasAgentPublicKey(address _agent) external view returns (bool) {
        return _pkiPubKeys.hasKey(_agent);
    }

    function agentPublicKeyUpdatedAt(address _agent) external view returns (uint256) {
        return _pkiPubKeys.updatedAt[_agent];
    }

    // ─── Agreement envelope wrappers ───────────────────────────────────────

    /// @dev True if `who` is a party to service agreement `id`.
    function _isAgreementParty(uint256 _agreementId, address who) internal view returns (bool) {
        (uint256 aId, address client, address provider, address arbiter,
         , , , , , ) = _serviceStore.getAgreement(_agreementId);
        if (aId == 0) return false;
        return who == client || who == provider || (arbiter != address(0) && who == arbiter);
    }

    /// @dev Require every recipient in `_recipients` to be a party to the
    ///      agreement. The rest of the recipient-level validation (pubkey
    ///      published, ciphertext length) happens inside PKILib.
    function _requireAllPartiesInAgreement(uint256 _agreementId, address[] calldata _recipients) internal view {
        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_isAgreementParty(_agreementId, _recipients[i]), "Recipient not a party to the agreement.");
        }
    }

    /**
     * @notice Attach an encrypted payload (unsigned) to a service agreement.
     *         Only parties to the agreement may attach; each recipient must
     *         also be a party and must have a published public key.
     */
    function attachEncryptedAgreementPayload(
        uint256 _agreementId,
        address[] calldata _recipients,
        string[] calldata _ciphertexts,
        bytes32 _contentHash
    ) external onlyRegisteredAgent whenNotPaused {
        require(_serviceStore.agreements[_agreementId].id != 0, "Agreement not found.");
        require(_isAgreementParty(_agreementId, msg.sender), "Only parties can attach encrypted payloads.");
        _requireAllPartiesInAgreement(_agreementId, _recipients);
        PKILib.attachAgreementEnvelope(
            _pkiAgreementEnvelopes,
            _pkiPubKeys,
            _agreementId,
            _recipients,
            _ciphertexts,
            _contentHash
        );
    }

    /**
     * @notice Attach an encrypted payload to a service agreement with
     *         EIP-712 signatures from every expected signer over the
     *         (agreementId, contentHash) pair. Provides non-repudiation:
     *         any observer can later re-verify that the parties actually
     *         agreed to the plaintext hash.
     *
     * @param _expectedSigners Addresses whose signatures are required. The
     *                         caller supplies this list; every address in
     *                         it must be a party to the agreement. Clients
     *                         typically pass [client, provider] or
     *                         [client, provider, arbiter].
     * @param _signatures      65-byte EIP-712 signatures, positional with
     *                         _expectedSigners.
     */
    function attachEncryptedAgreementPayloadSigned(
        uint256 _agreementId,
        address[] calldata _recipients,
        string[] calldata _ciphertexts,
        bytes32 _contentHash,
        address[] calldata _expectedSigners,
        bytes[] calldata _signatures
    ) external onlyRegisteredAgent whenNotPaused {
        require(_serviceStore.agreements[_agreementId].id != 0, "Agreement not found.");
        require(_isAgreementParty(_agreementId, msg.sender), "Only parties can attach encrypted payloads.");
        _requireAllPartiesInAgreement(_agreementId, _recipients);
        // Every expected signer must also be a party to the agreement.
        for (uint256 i = 0; i < _expectedSigners.length; i++) {
            require(_isAgreementParty(_agreementId, _expectedSigners[i]), "Signer not a party to the agreement.");
        }
        PKILib.attachAgreementEnvelopeSigned(
            _pkiAgreementEnvelopes,
            _pkiPubKeys,
            _agreementId,
            _recipients,
            _ciphertexts,
            _contentHash,
            _expectedSigners,
            _signatures
        );
    }

    /**
     * @notice Read the caller's own ciphertext from a service agreement envelope.
     *         Only parties may call; each caller only sees the ciphertext
     *         encrypted for their own address.
     */
    function getEncryptedAgreementPayload(uint256 _agreementId) external view returns (
        bytes32 contentHash,
        string memory ciphertextForCaller,
        uint256 updatedAt,
        address setBy,
        bool hasSignatures
    ) {
        require(_isAgreementParty(_agreementId, msg.sender), "Only parties can read encrypted payloads.");
        return _pkiAgreementEnvelopes.readEnvelope(_agreementId, msg.sender);
    }

    // ─── Payment request envelope wrappers ─────────────────────────────────

    /**
     * @notice Attach an encrypted payload (unsigned) to a payment request.
     *         Only the original requester can attach.
     */
    function attachEncryptedPaymentRequestPayload(
        uint256 _requestId,
        string calldata _ciphertextForRequester,
        string calldata _ciphertextForPayer,
        bytes32 _contentHash
    ) external onlyRegisteredAgent whenNotPaused {
        AgentPaymentRequest storage r = agentPaymentRequests[_requestId];
        require(r.id != 0, "Payment request does not exist.");
        require(r.requester == msg.sender, "Only the requester can attach encrypted payloads.");
        PKILib.attachPaymentRequestEnvelope(
            _pkiPaymentRequestEnvelopes,
            _pkiPubKeys,
            _requestId,
            r.requester,
            r.payer,
            _ciphertextForRequester,
            _ciphertextForPayer,
            _contentHash
        );
    }

    /**
     * @notice Attach an encrypted payload to a payment request with EIP-712
     *         signatures from BOTH the requester and the payer over the
     *         (requestId, contentHash) pair. Non-repudiation guarantee.
     *
     *         The requester is still the only one who can submit the
     *         transaction — but they now must produce a valid payer signature
     *         before the envelope can be stored.
     */
    function attachEncryptedPaymentRequestPayloadSigned(
        uint256 _requestId,
        string calldata _ciphertextForRequester,
        string calldata _ciphertextForPayer,
        bytes32 _contentHash,
        bytes calldata _requesterSignature,
        bytes calldata _payerSignature
    ) external onlyRegisteredAgent whenNotPaused {
        AgentPaymentRequest storage r = agentPaymentRequests[_requestId];
        require(r.id != 0, "Payment request does not exist.");
        require(r.requester == msg.sender, "Only the requester can attach encrypted payloads.");
        PKILib.attachPaymentRequestEnvelopeSigned(
            _pkiPaymentRequestEnvelopes,
            _pkiPubKeys,
            _requestId,
            r.requester,
            r.payer,
            _ciphertextForRequester,
            _ciphertextForPayer,
            _contentHash,
            _requesterSignature,
            _payerSignature
        );
    }

    /**
     * @notice Read the caller's own ciphertext from a payment request envelope.
     *         Only requester or payer may call.
     */
    function getEncryptedPaymentRequestPayload(uint256 _requestId) external view returns (
        bytes32 contentHash,
        string memory ciphertextForCaller,
        uint256 updatedAt,
        address setBy,
        bool hasSignatures
    ) {
        AgentPaymentRequest storage r = agentPaymentRequests[_requestId];
        require(
            msg.sender == r.requester || msg.sender == r.payer,
            "Only parties can read encrypted payloads."
        );
        return _pkiPaymentRequestEnvelopes.readEnvelope(_requestId, msg.sender);
    }

    // ─── EIP-712 digest helpers ────────────────────────────────────────────

    /// @notice Returns the EIP-712 digest that a party must sign to
    ///         authorise an agreement envelope for `_agreementId` committing
    ///         to `_contentHash`. Off-chain clients fetch this, sign it with
    ///         the party's private key, and pass the signature to
    ///         `attachEncryptedAgreementPayloadSigned`.
    function agreementTermsDigest(uint256 _agreementId, bytes32 _contentHash) external view returns (bytes32) {
        return PKILib.agreementDigest(_agreementId, _contentHash);
    }

    /// @notice Returns the EIP-712 digest for a payment request envelope.
    function paymentRequestTermsDigest(uint256 _requestId, bytes32 _contentHash) external view returns (bytes32) {
        return PKILib.paymentRequestDigest(_requestId, _contentHash);
    }
}
