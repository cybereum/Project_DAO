// Auto-generated ABI for AI agent interactions with Project_DAO.
// This includes only agent-relevant functions — governance/owner functions are excluded.

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

  // ─── Feature kits ──────────────────────────────────────────────────────
  'function submitFeatureKit(string calldata metadataURI, uint8 priority) external',
  'function upvoteFeatureKit(uint256 kitId) external',

  // ─── Secure Direct Messaging ───────────────────────────────────────────
  'function sendDirectMessage(address _to, string calldata _encryptedContent, bytes32 _contentHash) external',
  'function markMessageRead(uint256 _messageId) external',
  'function getDirectMessage(uint256 _messageId) external view returns (uint256 id, address sender, address recipient, bytes32 contentHash, string encryptedContent, uint256 timestamp, bool readByRecipient)',
  'function getConversation(address _otherAgent, uint256 offset, uint256 limit) external view returns (uint256[] messageIds, uint256 total)',
  'function getInbox(uint256 offset, uint256 limit) external view returns (uint256[] messageIds, uint256 total)',
  'function currentDirectMessageId() external view returns (uint256)',

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
  'function batchTransferNative(address[] calldata recipients, uint256[] calldata amounts, string[] calldata memos) external',
  'function batchSettlePaymentRequests(uint256[] calldata requestIds) external payable',

  // ─── Events ────────────────────────────────────────────────────────────
  'event AgentRegistered(address indexed agent, string metadataURI)',
  'event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo)',
  'event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo)',
  'event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, bool isNative, address token, uint256 amount, string description)',
  'event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt)',
  'event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context)',
  'event AgentBroadcast(uint256 indexed broadcastId, address indexed sender, uint8 broadcastType, string messageURI, uint256 timestamp)',
  'event DirectMessageSent(uint256 indexed messageId, address indexed sender, address indexed recipient, bytes32 contentHash, uint256 timestamp)',
  'event DirectMessageRead(uint256 indexed messageId, address indexed recipient)',
  'event EconomicProjectCreated(uint256 indexed projectId, address indexed proposer, string metadataURI, uint256 targetBudget, uint256 deadline)',
  'event EconomicProjectCompleted(uint256 indexed projectId)',
  'event EconomicProjectCancelled(uint256 indexed projectId)',
  'event CommerceVolumeRecorded(address indexed agent, uint256 amount, string context)',
  'event MessagingFeePaid(address indexed sender, uint256 fee)',
  'event BlackholeBatchTransfer(address indexed from, uint256 transferCount, uint256 totalVolume, uint256 totalFees)',
  'event BlackholeBatchSettle(address indexed settler, uint256 settleCount, uint256 totalVolume, uint256 totalFees)',
  'event ExitFeePaid(address indexed agent, uint256 fee, string context)',

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

  // ─── Network Effect: Referral Rewards ─────────────────────────────────
  'function stakeAndJoinWithReferral(string calldata metadataURI, address _referrer) external payable',
  'function getAgentReferralStats(address _agent) external view returns (address referrer, uint256 referralCount, uint256 referralEarnings)',
  'function withdrawReferralEarnings() external',
  'function referralRewardBps() external view returns (uint256)',
  'function referralTier2Bps() external view returns (uint256)',
  'event ReferralRecorded(address indexed agent, address indexed referrer)',
  'event ReferralRewardPaid(address indexed referrer, address indexed source, uint256 amount, uint8 tier)',

  // ─── Network Effect: Trust Graph (Endorsements) ───────────────────────
  'function endorseAgent(uint256 _agreementId, address _endorsed, string calldata _capability) external',
  'function revokeEndorsement(uint256 _endorsementId) external',
  'function getAgentTrustScore(address _agent) external view returns (uint256 trustScore, uint256 endorsementCount)',
  'function getTimeWeightedTrustScore(address _agent) external view returns (uint256 weightedScore, uint256 activeEndorsements)',
  'function getAgentEndorsements(address _agent, uint256 offset, uint256 limit) external view returns (uint256[] endorsementIds, uint256 total)',
  'function getEndorsement(uint256 _endorsementId) external view returns (uint256 id, address endorser, address endorsed, uint256 agreementId, string capability, uint256 weight, uint256 timestamp, bool revoked)',
  'event EndorsementCreated(uint256 indexed endorsementId, address indexed endorser, address indexed endorsed, uint256 agreementId, string capability, uint256 weight)',
  'event EndorsementRevoked(uint256 indexed endorsementId, address indexed endorser, address indexed endorsed)',

  // ─── Network Effect: Network Growth Milestones ────────────────────────
  'function getNetworkStats() external view returns (uint256 totalAgents, uint256 totalMembers, uint256 currentMilestone, uint256 nextMilestone, uint256 agentsUntilNextMilestone, uint256 totalVolume, uint256 totalFees)',
  'function lastNetworkMilestone() external view returns (uint256)',
  'event NetworkMilestoneReached(uint256 agentCount, uint256 milestone, string benefit)',
];
