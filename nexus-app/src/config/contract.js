export const PROJECT_DAO_ADDRESS = import.meta.env.VITE_PROJECT_DAO_ADDRESS || '';

export const PROJECT_DAO_ABI = [
  // ─── Member & ownership management ──────────────────────────────────────
  'function owner() external view returns (address)',
  'function members(address) external view returns (address memberAddress, uint256 votingPower, bool isMember)',
  'function addMember(address _newMember, uint256 _votingPower) external',
  'function removeMember(address _member) external',
  'function changeOwner(address _newOwner) external',
  'function pauseContract() external',
  'function resumeContract() external',

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

  // ─── Agent identity & discovery ─────────────────────────────────────────
  'function registerAgent(string _metadataURI) external',
  'function updateAgentMetadata(string _metadataURI) external',
  'function getAgentProfile(address _agent) external view returns (bool registered, string metadataURI, uint256 nativeEscrowBalance)',
  'function getAgentTokenBalance(address _agent, address _token) external view returns (uint256)',
  'function getAgentCount() external view returns (uint256)',
  'function getRegisteredAgents(uint256 offset, uint256 limit) external view returns (address[] addresses, string[] metadataURIs, uint256 total)',

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

  // ─── Secure Direct Messaging ──────────────────────────────────────────────
  'function sendDirectMessage(address _to, string calldata _encryptedContent, bytes32 _contentHash) external',
  'function markMessageRead(uint256 _messageId) external',
  'function getDirectMessage(uint256 _messageId) external view returns (uint256 id, address sender, address recipient, bytes32 contentHash, string encryptedContent, uint256 timestamp, bool readByRecipient)',
  'function getConversation(address _otherAgent, uint256 offset, uint256 limit) external view returns (uint256[] messageIds, uint256 total)',
  'function getInbox(uint256 offset, uint256 limit) external view returns (uint256[] messageIds, uint256 total)',
  'function currentDirectMessageId() external view returns (uint256)',
  'event DirectMessageSent(uint256 indexed messageId, address indexed sender, address indexed recipient, bytes32 contentHash, uint256 timestamp)',
  'event DirectMessageRead(uint256 indexed messageId, address indexed recipient)',

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
  'event MinStakeToJoinUpdated(uint256 oldMinStake, uint256 newMinStake)',

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

  // ─── AI Service Fees ─────────────────────────────────────────────────────
  'function deductAIServiceFee(string calldata _serviceType) external',
  'function setAIServiceFee(uint256 _feeWei) external',
  'function aiServiceFeeWei() external view returns (uint256)',
  'event AIServiceFeeDeducted(address indexed agent, uint256 amount, string serviceType)',
  'event AIServiceFeeUpdated(uint256 newFee)',

  // ─── Commerce Blackhole ─────────────────────────────────────────────────
  'function messagingFeeWei() external view returns (uint256)',
  'function exitFeeBps() external view returns (uint256)',
  'function totalCommerceVolume() external view returns (uint256)',
  'function totalFeesCollected() external view returns (uint256)',
  'function agentCommerceVolume(address) external view returns (uint256)',
  'function agentFeesPaid(address) external view returns (uint256)',
  'function getBlackholeMetrics() external view returns (uint256 _totalCommerceVolume, uint256 _totalFeesCollected, uint256 _agentCount, uint256 _feeBps, uint256 _exitFeeBps, uint256 _messagingFeeWei, uint256 _aiServiceFeeWei, uint256 _assetTransferFlatFeeWei)',
  'function getAgentCommerceMetrics(address _agent) external view returns (uint256 volume, uint256 feesPaid, uint256 escrowBalance, bool registered)',
  'function previewExitFee(uint256 _amount) external view returns (uint256 fee, uint256 net)',
  'function setCommerceBlackholeConfig(uint256 _messagingFeeWei, uint256 _exitFeeBps) external',
  'function batchTransferNative(address[] calldata recipients, uint256[] calldata amounts, string[] calldata memos) external',
  'function batchSettlePaymentRequests(uint256[] calldata requestIds) external payable',
  'event CommerceVolumeRecorded(address indexed agent, uint256 amount, string context)',
  'event MessagingFeePaid(address indexed sender, uint256 fee)',
  'event BlackholeBatchTransfer(address indexed from, uint256 transferCount, uint256 totalVolume, uint256 totalFees)',
  'event BlackholeBatchSettle(address indexed settler, uint256 settleCount, uint256 totalVolume, uint256 totalFees)',
  'event ExitFeePaid(address indexed agent, uint256 fee, string context)',
  'event CommerceBlackholeConfigUpdated(uint256 messagingFeeWei, uint256 exitFeeBps)',

  // ─── Reputation Engine ─────────────────────────────────────────────────
  'function getAgentReputation(address _agent) external view returns (uint256 score, uint256 tier, uint256 transactionCount, uint256 lastActiveAt, uint256 registeredAt, uint256 messagingFeeDiscount)',
  'function getReputationLeaderboard(uint256 offset, uint256 limit) external view returns (address[] agents_, uint256[] scores, uint256[] tiers, bool[] registered, uint256 total)',
  'function refreshReputation(address _agent) external',
  'function agentReputation(address) external view returns (uint256)',
  'function agentTransactionCount(address) external view returns (uint256)',
  'event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore, uint256 tier)',
  'event ReputationDecayApplied(address indexed agent, uint256 pointsDecayed, uint256 newScore)',

  // ─── Capability-Indexed Discovery ──────────────────────────────────────
  'function setAgentCapabilities(string[] calldata _capabilities) external',
  'function getAgentCapabilities(address _agent) external view returns (string[])',
  'function discoverAgentsByCapability(string calldata _capability, uint256 offset, uint256 limit) external view returns (address[] addresses, string[] metadataURIs, uint256 total)',
  'function getCapabilityAgentCount(string calldata _capability) external view returns (uint256)',
  'event AgentCapabilitiesUpdated(address indexed agent, string[] capabilities)',

  // ─── Service Agreements ────────────────────────────────────────────────
  'function createServiceAgreement(address _provider, address _arbiter, uint256 _amount, uint256 _deadline, string calldata _description) external returns (uint256)',
  'function submitDelivery(uint256 _agreementId, bytes32 _deliveryHash) external',
  'function approveDelivery(uint256 _agreementId) external',
  'function disputeServiceAgreement(uint256 _agreementId) external',
  'function resolveServiceDispute(uint256 _agreementId, bool _inFavorOfProvider) external',
  'function cancelServiceAgreement(uint256 _agreementId) external',
  'function getServiceAgreement(uint256 _agreementId) external view returns (uint256 id, address client, address provider, address arbiter, uint256 amount, string description, uint8 status, uint256 createdAt, uint256 deadline, bytes32 deliveryHash)',
  'event ServiceAgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address arbiter, uint256 amount, uint256 deadline, string description)',
  'event ServiceDeliverySubmitted(uint256 indexed agreementId, address indexed provider, bytes32 deliveryHash)',
  'event ServiceAgreementCompleted(uint256 indexed agreementId, address indexed client, address indexed provider, uint256 paidAmount)',
  'event ServiceAgreementDisputed(uint256 indexed agreementId, address indexed disputant)',
  'event ServiceDisputeResolved(uint256 indexed agreementId, bool inFavorOfProvider, address indexed resolver)',
  'event ServiceAgreementCancelled(uint256 indexed agreementId, address indexed cancelledBy)',

  // ─── Payment Streams ──────────────────────────────────────────────────
  'function createPaymentStream(address _recipient, uint256 _totalDeposit, uint256 _startTime, uint256 _stopTime) external returns (uint256)',
  'function streamBalanceOf(uint256 _streamId) external view returns (uint256)',
  'function withdrawFromStream(uint256 _streamId) external',
  'function cancelPaymentStream(uint256 _streamId) external',
  'function getPaymentStream(uint256 _streamId) external view returns (uint256 id, address payer, address recipient, uint256 ratePerSecond, uint256 totalDeposited, uint256 totalWithdrawn, uint256 startTime, uint256 stopTime, uint8 status, uint256 withdrawable)',
  'event PaymentStreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, uint256 ratePerSecond, uint256 totalDeposit, uint256 startTime, uint256 stopTime)',
  'event PaymentStreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount)',
  'event PaymentStreamCancelled(uint256 indexed streamId, address indexed cancelledBy, uint256 recipientAmount, uint256 payerRefund)',
];

export function hasContractConfig() {
  return Boolean(PROJECT_DAO_ADDRESS);
}
