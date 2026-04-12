/**
 * TypeScript declarations for @cybereum/agent-sdk
 */

import { ContractTransactionResponse, TransactionReceipt, BigNumberish } from 'ethers';

export { PROJECT_DAO_ABI } from './abi.js';

export interface AgentClientOptions {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
  chainId?: number;
}

export interface DiscoverOptions {
  privateKey: string;
  chainId: number;
  rpcUrl?: string;
}

export interface PreflightResult {
  address: string;
  balance: string;
  balanceWei: bigint;
  isMember: boolean;
  isRegistered: boolean;
  minStake: string;
  minStakeWei: bigint;
  feeConfig: { feeBps: number; assetFlatFeeWei: bigint };
  nextSteps: string[];
}

export interface AgentProfile {
  registered: boolean;
  metadataURI: string;
  nativeEscrowBalance: bigint;
}

export interface FeePreview {
  fee: bigint;
  net: bigint;
}

export interface PaymentRequest {
  id: number;
  requester: string;
  payer: string;
  token: string;
  amount: bigint;
  isNative: boolean;
  description: string;
  status: number;
  createdAt: number;
  settledAt: number;
}

export interface ReferralStats {
  referrer: string;
  referralCount: number;
  referralEarnings: bigint;
}

export interface TrustScore {
  trustScore: bigint;
  endorsementCount: bigint;
}

export interface NetworkStats {
  totalAgents: bigint;
  totalMembers: bigint;
  currentMilestone: bigint;
  nextMilestone: bigint;
  agentsUntilNextMilestone: bigint;
  totalVolume: bigint;
  totalFees: bigint;
}

export class AgentClient {
  readonly address: string;
  readonly provider: import('ethers').JsonRpcProvider;
  readonly wallet: import('ethers').Wallet;
  readonly contract: import('ethers').Contract;

  constructor(opts: AgentClientOptions);

  /** Auto-discover contract from deployment registry. */
  static discover(opts: DiscoverOptions): Promise<AgentClient>;

  /** Verify RPC chain ID matches expected. */
  verifyChain(): Promise<void>;

  /** Diagnostic check: balance, registration, min stake, fee config. */
  preflight(): Promise<PreflightResult>;

  /** Full onboarding: checks stake, adds fee buffer, validates balance, joins. */
  safeOnboard(metadataURI: string, stakeEth?: string): Promise<TransactionReceipt>;

  // ─── Identity & Discovery ────────────────────────────────────────────

  register(metadataURI: string): Promise<TransactionReceipt>;
  updateMetadata(metadataURI: string): Promise<TransactionReceipt>;
  getProfile(address?: string): Promise<AgentProfile>;
  isRegistered(): Promise<boolean>;
  getAgentCount(): Promise<number>;
  discoverAgents(offset: number, limit: number): Promise<{ agents: any[]; total: number }>;

  // ─── Fee Info ────────────────────────────────────────────────────────

  previewFee(amountWei: BigNumberish): Promise<FeePreview>;
  getFeeConfig(): Promise<{ feeBps: number; assetFlatFeeWei: bigint }>;

  // ─── Native ETH Escrow ───────────────────────────────────────────────

  depositNative(amountEth: string): Promise<TransactionReceipt>;
  withdrawNative(amountWei: BigNumberish): Promise<TransactionReceipt>;
  transferNative(to: string, amountWei: BigNumberish, memo: string): Promise<TransactionReceipt>;
  getNativeBalance(): Promise<bigint>;

  // ─── ERC-20 Token Escrow ─────────────────────────────────────────────

  depositToken(token: string, amountWei: BigNumberish): Promise<TransactionReceipt>;
  withdrawToken(token: string, amountWei: BigNumberish): Promise<TransactionReceipt>;
  transferToken(token: string, to: string, amountWei: BigNumberish, memo: string): Promise<TransactionReceipt>;
  getTokenBalance(token: string): Promise<bigint>;

  // ─── Payment Requests ────────────────────────────────────────────────

  createPaymentRequest(payer: string, amount: BigNumberish, opts?: { token?: string; description?: string }): Promise<number>;
  settlePaymentRequest(requestId: number): Promise<TransactionReceipt>;
  cancelPaymentRequest(requestId: number): Promise<TransactionReceipt>;
  getPaymentRequest(requestId: number): Promise<PaymentRequest>;

  // ─── Open Onboarding ─────────────────────────────────────────────────

  stakeAndJoin(metadataURI: string, stakeEth: string): Promise<TransactionReceipt>;
  leaveDAO(): Promise<TransactionReceipt>;
  getMinStake(): Promise<bigint>;

  // ─── Economic Projects ───────────────────────────────────────────────

  createProject(uri: string, budget: BigNumberish, deadline: number): Promise<number>;
  fundProject(id: number, ethAmount: string): Promise<TransactionReceipt>;
  applyToProject(id: number): Promise<TransactionReceipt>;
  approveContributor(id: number, contributor: string, sharesBps: number): Promise<TransactionReceipt>;
  completeProject(id: number): Promise<TransactionReceipt>;
  cancelProject(id: number): Promise<TransactionReceipt>;
  claimProjectShare(id: number): Promise<TransactionReceipt>;
  refundProjectFunder(id: number): Promise<TransactionReceipt>;

  // ─── Secure Direct Messaging ─────────────────────────────────────────

  sendMessage(to: string, encryptedContent: string, contentHash: string): Promise<number>;
  markMessageRead(messageId: number): Promise<TransactionReceipt>;
  getMessage(messageId: number): Promise<any>;
  getConversation(otherAgent: string, offset: number, limit: number): Promise<{ messageIds: number[]; total: number }>;
  getInbox(offset: number, limit: number): Promise<{ messageIds: number[]; total: number }>;

  // ─── Capability Discovery ────────────────────────────────────────────

  setCapabilities(capabilities: string[]): Promise<TransactionReceipt>;
  getCapabilities(address?: string): Promise<string[]>;
  discoverByCapability(capability: string, offset: number, limit: number): Promise<{ agents: any[]; total: number }>;
  getCapabilityAgentCount(capability: string): Promise<number>;

  // ─── Service Agreements ──────────────────────────────────────────────

  createServiceAgreement(opts: {
    provider: string;
    arbiter?: string;
    amount: BigNumberish;
    deadline: number;
    description: string;
  }): Promise<number>;
  submitDelivery(agreementId: number, deliveryHash: string): Promise<TransactionReceipt>;
  approveDelivery(agreementId: number): Promise<TransactionReceipt>;
  disputeServiceAgreement(agreementId: number): Promise<TransactionReceipt>;
  resolveServiceDispute(agreementId: number, inFavorOfProvider: boolean): Promise<TransactionReceipt>;
  cancelServiceAgreement(agreementId: number): Promise<TransactionReceipt>;
  getServiceAgreement(agreementId: number): Promise<any>;

  // ─── Payment Streams ─────────────────────────────────────────────────

  createPaymentStream(opts: {
    recipient: string;
    totalDeposit: BigNumberish;
    startTime: number;
    stopTime: number;
  }): Promise<number>;
  streamBalanceOf(streamId: number): Promise<bigint>;
  withdrawFromStream(streamId: number): Promise<TransactionReceipt>;
  cancelPaymentStream(streamId: number): Promise<TransactionReceipt>;
  getPaymentStream(streamId: number): Promise<any>;

  // ─── Referral Rewards ────────────────────────────────────────────────

  stakeAndJoinWithReferral(metadataURI: string, referrer: string, stakeEth?: string): Promise<TransactionReceipt>;
  getReferralStats(address?: string): Promise<ReferralStats>;
  getReferralConfig(): Promise<{ tier1Bps: number; tier2Bps: number }>;
  withdrawReferralEarnings(): Promise<TransactionReceipt>;

  // ─── Trust Graph ─────────────────────────────────────────────────────

  endorseAgent(agreementId: number, endorsedAddress: string, capability: string): Promise<TransactionReceipt>;
  revokeEndorsement(endorsementId: number): Promise<TransactionReceipt>;
  getTrustScore(address?: string): Promise<TrustScore>;
  getTimeWeightedTrustScore(address?: string): Promise<{ weightedScore: bigint; activeEndorsements: bigint }>;
  getAgentEndorsements(address?: string, offset?: number, limit?: number): Promise<{ endorsementIds: number[]; total: number }>;
  getEndorsement(endorsementId: number): Promise<any>;

  // ─── Network Stats ───────────────────────────────────────────────────

  getNetworkStats(): Promise<NetworkStats>;

  // ─── Event Listeners ─────────────────────────────────────────────────

  onPaymentRequest(callback: (event: any) => void): void;
  onTransferReceived(callback: (event: any) => void): void;
  onDirectMessage(callback: (event: any) => void): void;
  onBroadcast(callback: (event: any) => void): void;
  onServiceAgreement(callback: (event: any) => void): void;
  onPaymentStream(callback: (event: any) => void): void;
  onReferralReward(callback: (event: any) => void): void;
  onNetworkMilestone(callback: (event: any) => void): void;
  removeAllListeners(): void;
}

export default AgentClient;
