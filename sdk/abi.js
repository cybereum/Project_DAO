// ABI for AI agent interactions with Project_DAO.
// Includes agent functions, governance, admin, and all events.

export const PROJECT_DAO_ABI = [
  // ─── Agent identity & discovery ─────────────────────────────────────────
  'function registerAgent(string _metadataURI) external',
  'function updateAgentMetadata(string _metadataURI) external',
  'function getAgentProfile(address _agent) external view returns (bool registered, string metadataURI, uint256 nativeEscrowBalance)',
  'function getAgentTokenBalance(address _agent, address _token) external view returns (uint256)',
  'function getAgentCount() external view returns (uint256)',
  'function getRegisteredAgents(uint256 offset, uint256 limit) external view returns (address[] addresses, string[] metadataURIs, uint256 total)',

  // ─── Fee reads ──────────────────────────────────────────────────────────
  'function cybereumFeeBps() external view returns (uint256)',
  'function assetTransferFlatFeeWei() external view returns (uint256)',
  'function previewFee(uint256 _amount) external view returns (uint256 fee, uint256 net)',

  // ─── Native ETH escrow ─────────────────────────────────────────────────
  'function depositNativeToEscrow() external payable',
  'function withdrawNativeFromEscrow(uint256 _amount) external',
  'function transferNativeBetweenAgents(address _to, uint256 _amount, string _memo) external',

  // ─── ERC-20 token escrow ────────────────────────────────────────────────
  'function depositTokenToEscrow(address _token, uint256 _amount) external',
  'function withdrawTokenFromEscrow(address _token, uint256 _amount) external',
  'function transferTokenBetweenAgents(address _token, address _to, uint256 _amount, string _memo) external',

  // ─── Asset transfer (ERC-721) ───────────────────────────────────────────
  'function transferAssetBetweenAgents(address _assetContract, address _to, uint256 _assetId, string _memo) external payable',

  // ─── Payment requests ──────────────────────────────────────────────────
  'function createAgentPaymentRequest(address _payer, address _token, uint256 _amount, bool _isNative, string _description) external returns (uint256)',
  'function settleAgentPaymentRequest(uint256 _requestId) external payable',
  'function cancelAgentPaymentRequest(uint256 _requestId) external',
  'function getAgentPaymentRequest(uint256 _requestId) external view returns (uint256 id, address requester, address payer, address token, uint256 amount, bool isNative, string description, uint8 status, uint256 createdAt, uint256 settledAt)',
  'function currentAgentPaymentRequestId() external view returns (uint256)',

  // ─── Open onboarding ───────────────────────────────────────────────────
  'function stakeAndJoin(string calldata metadataURI) external payable',
  'function leaveDAO() external',
  'function minStakeToJoin() external view returns (uint256)',

  // ─── Economic projects ─────────────────────────────────────────────────
  'function createEconomicProject(string calldata metadataURI, uint256 targetBudget, uint256 deadline) external returns (uint256)',
  'function fundProject(uint256 projectId) external payable',
  'function applyToProject(uint256 projectId) external',
  'function approveContributor(uint256 projectId, address contributor, uint256 sharesBps) external',
  'function completeProject(uint256 projectId) external',
  'function claimProjectShare(uint256 projectId) external',
  'function cancelProject(uint256 projectId) external',
  'function refundProjectFunder(uint256 projectId) external',
  'function getEconomicProject(uint256 projectId) external view returns (uint256 id, address proposer, string metadataURI, uint256 targetBudget, uint256 totalFunded, uint256 deadline, uint8 status, uint256 createdAt, uint256 contributorCount, uint256 funderCount)',
  'function getEconomicProjects(uint256 offset, uint256 limit) external view returns (tuple(uint256 id, address proposer, string metadataURI, uint256 targetBudget, uint256 totalFunded, uint256 deadline, uint8 status, uint256 createdAt, uint256 contributorCount, uint256 funderCount)[] page, uint256 total)',
  'function getProjectContributors(uint256 projectId) external view returns (address[])',
  'function getProjectFunders(uint256 projectId) external view returns (address[])',

  // ─── Feature kits ──────────────────────────────────────────────────────
  'function submitFeatureKit(string calldata metadataURI, uint8 priority) external',
  'function upvoteFeatureKit(uint256 kitId) external',
  'function setFeatureKitStatus(uint256 kitId, uint8 newStatus, string reason) external',
  'function getFeatureKits(uint256 offset, uint256 limit) external view returns (tuple(uint256 id, address submitter, uint8 priority, uint8 status, string metadataURI, uint256 voteCount, uint256 submittedAt)[] page, uint256 total)',

  // ─── Governance ─────────────────────────────────────────────────────────
  'function createProposal(string _description, uint256 _milestoneId, uint256[] _previousMilestoneIds) external',
  'function vote(uint256 _proposalId, bool _vote) external',
  'function executeProposal(uint256 _proposalId) external',
  'function getProposal(uint256 _proposalId) external view returns (uint256 id, string description, uint256 votingDeadline, bool executed, bool proposalPassed, uint256 yesVotes, uint256 noVotes)',
  'function getProposalCount() external view returns (uint256)',
  'function disputeProposal(uint256 _proposalId, string description) external',
  'function voteOnProposalDispute(uint256 _disputeId, bool _voteFor) external',

  // ─── Owner / admin ─────────────────────────────────────────────────────
  'function owner() external view returns (address)',
  'function setCybereumTreasury(address _treasury) external',
  'function setCybereumFeeConfig(uint256 _feeBps, uint256 _assetTransferFlatFeeWei) external',
  'function cybereumTreasury() external view returns (address)',
  'function setMinStakeToJoin(uint256 _minStake) external',
  'function addMember(address _member, uint256 _votingPower) external',
  'function removeMember(address _member) external',
  'function pauseContract() external',
  'function resumeContract() external',
  'function paused() external view returns (bool)',

  // ─── Agent events ───────────────────────────────────────────────────────
  'event AgentRegistered(address indexed agent, string metadataURI)',
  'event AgentMetadataUpdated(address indexed agent, string metadataURI)',
  'event AgentNativeEscrowDeposited(address indexed agent, uint256 amount)',
  'event AgentNativeEscrowWithdrawn(address indexed agent, uint256 amount)',
  'event AgentTokenEscrowDeposited(address indexed agent, address indexed token, uint256 amount)',
  'event AgentTokenEscrowWithdrawn(address indexed agent, address indexed token, uint256 amount)',
  'event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo)',
  'event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo)',
  'event AgentAssetTransfer(address indexed from, address indexed to, address indexed assetContract, uint256 assetId, string memo)',

  // ─── Payment request events ─────────────────────────────────────────────
  'event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, bool isNative, address token, uint256 amount, string description)',
  'event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt)',
  'event AgentPaymentRequestCancelled(uint256 indexed requestId, address indexed requester)',

  // ─── Fee events ─────────────────────────────────────────────────────────
  'event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context)',
  'event CybereumTreasuryUpdated(address indexed treasury)',
  'event CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei)',

  // ─── Broadcast events ──────────────────────────────────────────────────
  'event AgentBroadcast(uint256 indexed broadcastId, address indexed sender, uint8 broadcastType, string messageURI, uint256 timestamp)',

  // ─── Economic project events ───────────────────────────────────────────
  'event EconomicProjectCreated(uint256 indexed projectId, address indexed proposer, string metadataURI, uint256 targetBudget, uint256 deadline)',
  'event EconomicProjectFunded(uint256 indexed projectId, address indexed funder, uint256 netAmount)',
  'event EconomicProjectContributorApplied(uint256 indexed projectId, address indexed contributor)',
  'event EconomicProjectContributorApproved(uint256 indexed projectId, address indexed contributor, uint256 sharesBps)',
  'event EconomicProjectCompleted(uint256 indexed projectId)',
  'event EconomicProjectCancelled(uint256 indexed projectId)',
  'event EconomicProjectShareClaimed(uint256 indexed projectId, address indexed contributor, uint256 amount)',
  'event EconomicProjectFunderRefunded(uint256 indexed projectId, address indexed funder, uint256 amount)',

  // ─── Feature kit events ────────────────────────────────────────────────
  'event FeatureKitSubmitted(uint256 indexed kitId, address indexed submitter, uint8 priority, string metadataURI, uint256 timestamp)',
  'event FeatureKitUpvoted(uint256 indexed kitId, address indexed voter, uint256 newVoteCount)',
  'event FeatureKitStatusChanged(uint256 indexed kitId, uint8 newStatus, string reason)',

  // ─── Onboarding events ────────────────────────────────────────────────
  'event MemberJoinedByStake(address indexed member, uint256 netStake)',
  'event MemberLeftDAO(address indexed member, uint256 refundedStake)',

  // ─── Governance / admin events ─────────────────────────────────────────
  'event OwnerChanged(address indexed previousOwner, address indexed newOwner)',
  'event ContractPausedEvent(address indexed by)',
  'event ContractResumedEvent(address indexed by)',
  'event MemberAdded(address member, uint256 votingPower)',
  'event MemberRemoved(address member)',
];
