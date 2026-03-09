export const PROJECT_DAO_ADDRESS = import.meta.env.VITE_PROJECT_DAO_ADDRESS || '';

export const PROJECT_DAO_ABI = [
  // ─── Governance: proposals ───────────────────────────────────────────────
  'function vote(uint256 _proposalId, bool _vote) external',
  'function getProposal(uint256 _proposalId) external view returns (tuple(uint256 id,string description,uint256 votingDeadline,bool executed,bool proposalPassed,uint256 yesVotes,uint256 noVotes,uint256 votePercentage))',
  'function getProposalCount() external view returns (uint256)',

  // ─── Fee config (owner) ──────────────────────────────────────────────────
  'function setCybereumTreasury(address _treasury) external',
  'function setCybereumFeeConfig(uint256 _feeBps, uint256 _assetTransferFlatFeeWei) external',

  // ─── Fee reads ───────────────────────────────────────────────────────────
  'function cybereumFeeBps() external view returns (uint256)',
  'function assetTransferFlatFeeWei() external view returns (uint256)',
  'function cybereumTreasury() external view returns (address)',
  'function MIN_FEE_BPS() external view returns (uint256)',
  'function previewFee(uint256 _amount) external view returns (uint256 fee, uint256 net)',

  // ─── Agent identity ──────────────────────────────────────────────────────
  'function registerAgent(string _metadataURI) external',
  'function updateAgentMetadata(string _metadataURI) external',
  'function getAgentProfile(address _agent) external view returns (bool registered, string metadataURI, uint256 nativeEscrowBalance)',
  'function getAgentTokenBalance(address _agent, address _token) external view returns (uint256)',

  // ─── Native ETH escrow ──────────────────────────────────────────────────
  'function depositNativeToEscrow() external payable',
  'function withdrawNativeFromEscrow(uint256 _amount) external',
  'function transferNativeBetweenAgents(address _to, uint256 _amount, string _memo) external',

  // ─── ERC-20 token escrow ─────────────────────────────────────────────────
  'function depositTokenToEscrow(address _token, uint256 _amount) external',
  'function withdrawTokenFromEscrow(address _token, uint256 _amount) external',
  'function transferTokenBetweenAgents(address _token, address _to, uint256 _amount, string _memo) external',

  // ─── Asset transfer (ERC-721) ────────────────────────────────────────────
  'function transferAssetBetweenAgents(address _assetContract, address _to, uint256 _assetId, string _memo) external payable',

  // ─── Payment requests ────────────────────────────────────────────────────
  'function createAgentPaymentRequest(address _payer, address _token, uint256 _amount, bool _isNative, string _description) external returns (uint256)',
  'function settleAgentPaymentRequest(uint256 _requestId) external payable',
  'function cancelAgentPaymentRequest(uint256 _requestId) external',
  'function getAgentPaymentRequest(uint256 _requestId) external view returns (uint256 id, address requester, address payer, address token, uint256 amount, bool isNative, string description, uint8 status, uint256 createdAt, uint256 settledAt)',
  'function currentAgentPaymentRequestId() external view returns (uint256)',

  // ─── Events (for ethers.js filtering) ───────────────────────────────────
  'event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context)',
  'event CybereumTreasuryUpdated(address indexed treasury)',
  'event CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei)',
  'event AgentRegistered(address indexed agent, string metadataURI)',
  'event AgentMetadataUpdated(address indexed agent, string metadataURI)',
  'event AgentNativeEscrowDeposited(address indexed agent, uint256 amount)',
  'event AgentNativeEscrowWithdrawn(address indexed agent, uint256 amount)',
  'event AgentTokenEscrowDeposited(address indexed agent, address indexed token, uint256 amount)',
  'event AgentTokenEscrowWithdrawn(address indexed agent, address indexed token, uint256 amount)',
  'event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo)',
  'event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo)',
  'event AgentAssetTransfer(address indexed from, address indexed to, address indexed assetContract, uint256 assetId, string memo)',
  'event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, bool isNative, address token, uint256 amount, string description)',
  'event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt)',
  'event AgentPaymentRequestCancelled(uint256 indexed requestId, address indexed requester)',

  // ─── Agent Broadcast ─────────────────────────────────────────────────────
  'function broadcastToAgents(string calldata messageURI, uint8 broadcastType) external',
  'event AgentBroadcast(uint256 indexed broadcastId, address indexed sender, uint8 broadcastType, string messageURI, uint256 timestamp)',
  'function currentBroadcastId() external view returns (uint256)',

  // ─── Feature Kit Pipeline ────────────────────────────────────────────────
  'function submitFeatureKit(string calldata metadataURI, uint8 priority) external',
  'function upvoteFeatureKit(uint256 kitId) external',
  'function setFeatureKitStatus(uint256 kitId, uint8 newStatus, string calldata reason) external',
  'function getFeatureKits(uint256 offset, uint256 limit) external view returns (tuple(uint256 id, address submitter, uint8 priority, uint8 status, string metadataURI, uint256 voteCount, uint256 submittedAt)[] page, uint256 total)',
  'function currentFeatureKitId() external view returns (uint256)',
  'function featureKits(uint256 kitId) external view returns (uint256 id, address submitter, uint8 priority, uint8 status, string metadataURI, uint256 voteCount, uint256 submittedAt)',
  'function featureKitVoted(uint256 kitId, address voter) external view returns (bool)',
  'event FeatureKitSubmitted(uint256 indexed kitId, address indexed submitter, uint8 priority, string metadataURI, uint256 timestamp)',
  'event FeatureKitUpvoted(uint256 indexed kitId, address indexed voter, uint256 newVoteCount)',
  'event FeatureKitStatusChanged(uint256 indexed kitId, uint8 newStatus, string reason)',

  // ─── Open Onboarding (Stake to Join) ─────────────────────────────────────
  'function stakeAndJoin(string calldata metadataURI) external payable',
  'function leaveDAO() external',
  'function setMinStakeToJoin(uint256 _minStake) external',
  'function minStakeToJoin() external view returns (uint256)',
  'function memberStakes(address member) external view returns (uint256)',
  'event MemberJoinedByStake(address indexed member, uint256 netStake)',
  'event MemberLeftDAO(address indexed member, uint256 refundedStake)',

  // ─── Economic Project Primitives ─────────────────────────────────────────
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
  'function projectContributorShares(uint256 projectId, address contributor) external view returns (uint256)',
  'function projectApplications(uint256 projectId, address applicant) external view returns (bool)',
  'function projectApplicationApproved(uint256 projectId, address contributor) external view returns (bool)',
  'function projectShareClaimed(uint256 projectId, address contributor) external view returns (bool)',
  'function projectFunderContributions(uint256 projectId, address funder) external view returns (uint256)',
  'function currentProjectId() external view returns (uint256)',
  'event EconomicProjectCreated(uint256 indexed projectId, address indexed proposer, string metadataURI, uint256 targetBudget, uint256 deadline)',
  'event EconomicProjectFunded(uint256 indexed projectId, address indexed funder, uint256 netAmount)',
  'event EconomicProjectContributorApplied(uint256 indexed projectId, address indexed contributor)',
  'event EconomicProjectContributorApproved(uint256 indexed projectId, address indexed contributor, uint256 sharesBps)',
  'event EconomicProjectCompleted(uint256 indexed projectId)',
  'event EconomicProjectCancelled(uint256 indexed projectId)',
  'event EconomicProjectShareClaimed(uint256 indexed projectId, address indexed contributor, uint256 amount)',
  'event EconomicProjectFunderRefunded(uint256 indexed projectId, address indexed funder, uint256 amount)',
];

export function hasContractConfig() {
  return Boolean(PROJECT_DAO_ADDRESS);
}
