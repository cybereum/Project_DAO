export const PROJECT_DAO_ADDRESS = import.meta.env.VITE_PROJECT_DAO_ADDRESS || '';

export const PROJECT_DAO_ABI = [
  'function vote(uint256 _proposalId, bool _vote) external',
  'function getProposal(uint256 _proposalId) external view returns (tuple(uint256 id,string description,uint256 votingDeadline,bool executed,bool proposalPassed,uint256 yesVotes,uint256 noVotes,uint256 votePercentage))',
  'function getProposalCount() external view returns (uint256)',
  'function setCybereumTreasury(address _treasury) external',
  'function setCybereumFeeConfig(uint256 _feeBps, uint256 _assetTransferFlatFeeWei) external',
  'function registerAgent(string _metadataURI) external',
  'function updateAgentMetadata(string _metadataURI) external',
  'function depositNativeToEscrow() external payable',
  'function withdrawNativeFromEscrow(uint256 _amount) external',
  'function transferNativeBetweenAgents(address _to, uint256 _amount, string _memo) external',
  'function depositTokenToEscrow(address _token, uint256 _amount) external',
  'function withdrawTokenFromEscrow(address _token, uint256 _amount) external',
  'function transferTokenBetweenAgents(address _token, address _to, uint256 _amount, string _memo) external',
  'function transferAssetBetweenAgents(address _assetContract, address _to, uint256 _assetId, string _memo) external',
  'function createAgentPaymentRequest(address _payer, address _token, uint256 _amount, bool _isNative, string _description) external returns (uint256)',
  'function settleAgentPaymentRequest(uint256 _requestId) external payable',
  'function cancelAgentPaymentRequest(uint256 _requestId) external',
];

export function hasContractConfig() {
  return Boolean(PROJECT_DAO_ADDRESS);
}
