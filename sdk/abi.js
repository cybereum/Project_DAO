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

  // ─── Events ────────────────────────────────────────────────────────────
  'event AgentRegistered(address indexed agent, string metadataURI)',
  'event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo)',
  'event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo)',
  'event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, bool isNative, address token, uint256 amount, string description)',
  'event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt)',
  'event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context)',
  'event AgentBroadcast(uint256 indexed broadcastId, address indexed sender, uint8 broadcastType, string messageURI, uint256 timestamp)',
];
