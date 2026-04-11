// TypeScript declarations for @cybereum/agent-sdk
// These types are hand-written; the SDK source remains in plain JavaScript.

import type { Contract, ContractTransactionReceipt, JsonRpcProvider, Wallet } from 'ethers';

export const PROJECT_DAO_ABI: ReadonlyArray<string>;

// ─── Common shapes ─────────────────────────────────────────────────────────

export interface AgentClientOptions {
  /** JSON-RPC endpoint. */
  rpcUrl: string;
  /** Deployed Project_DAO address. */
  contractAddress: string;
  /** Agent wallet private key (hex, with or without 0x prefix). */
  privateKey: string;
  /** Expected chain ID. If set, SDK verifies the RPC matches before any transaction. */
  chainId?: number;
}

export interface DiscoverOptions {
  privateKey: string;
  chainId: number;
  rpcUrl?: string;
}

export interface AgentProfile {
  registered: boolean;
  metadataURI: string;
  nativeEscrowBalance: bigint;
}

export interface SafeOnboardResult {
  receipt: ContractTransactionReceipt | null;
  stakeUsed: string;
  alreadyRegistered?: boolean;
}

export interface PreflightStatus {
  address: string;
  chainId: number | null;
  registered: boolean;
  metadataURI: string;
  escrowBalance: string;
  walletBalance: string;
  minStakeRequired: string;
  recommendedStake: string;
  canAffordOnboarding: boolean;
  feeBps: number;
  totalAgentsOnNetwork: number;
  readyToTransact: boolean;
  nextSteps: string[];
}

export interface FeeConfig {
  feeBps: bigint;
  assetFlatFee: bigint;
}

export interface FeePreview {
  fee: bigint;
  net: bigint;
}

export interface DiscoveredAgent {
  address: string;
  metadataURI: string;
}

export interface DiscoverAgentsResult {
  agents: DiscoveredAgent[];
  total: bigint;
}

export interface PaymentRequest {
  id: bigint;
  requester: string;
  payer: string;
  token: string;
  amount: bigint;
  isNative: boolean;
  description: string;
  status: number;
  createdAt: bigint;
  settledAt: bigint;
}

export interface CreatePaymentRequestOptions {
  isNative?: boolean;
  tokenAddress?: string;
  description?: string;
}

export interface EconomicProjectView {
  id: bigint;
  proposer: string;
  metadataURI: string;
  targetBudget: bigint;
  totalFunded: bigint;
  deadline: bigint;
  status: number;
  createdAt: bigint;
  contributorCount: number;
  funderCount: number;
}

export interface DirectMessageView {
  id: bigint;
  sender: string;
  recipient: string;
  contentHash: string;
  encryptedContent: string;
  timestamp: bigint;
  readByRecipient: boolean;
}

export interface PaginatedIds {
  messageIds: bigint[];
  total: bigint;
}

export interface BlackholeConfig {
  feeBps: number;
  exitFeeBps: number;
  messagingFeeWei: bigint;
  assetTransferFlatFeeWei: bigint;
}

export interface BlackholeMetrics {
  totalCommerceVolume: bigint;
  totalFeesCollected: bigint;
  agentCount: number;
  feeBps: number;
  exitFeeBps: number;
  messagingFeeWei: bigint;
  aiServiceFeeWei: bigint;
  assetTransferFlatFeeWei: bigint;
}

export interface AgentCommerceMetrics {
  volume: bigint;
  feesPaid: bigint;
  escrowBalance: bigint;
  registered: boolean;
}

export interface BatchTransfer {
  address: string;
  amount: bigint;
  memo?: string;
}

export interface AgentReputation {
  score: number;
  tier: number;
  transactionCount: number;
  lastActiveAt: number;
  registeredAt: number;
  messagingFeeDiscount: number;
}

export interface LeaderboardEntry {
  address: string;
  score: number;
  tier: number;
  registered: boolean;
}

export interface ReputationLeaderboard {
  agents: LeaderboardEntry[];
  total: number;
}

export interface CreateServiceAgreementOptions {
  provider: string;
  arbiter?: string;
  amount: bigint | string;
  deadline: number;
  description: string;
}

export interface CreateServiceAgreementResult {
  receipt: ContractTransactionReceipt;
  agreementId: number | null;
}

export interface ServiceAgreementView {
  id: number;
  client: string;
  provider: string;
  arbiter: string;
  amount: bigint;
  description: string;
  status: string;
  statusCode: number;
  createdAt: number;
  deadline: number;
  deliveryHash: string;
}

export interface CreatePaymentStreamOptions {
  recipient: string;
  totalDeposit?: bigint | string;
  totalDepositEth?: string;
  totalDepositWei?: bigint;
  startTime: number;
  stopTime: number;
}

export interface CreatePaymentStreamResult {
  receipt: ContractTransactionReceipt;
  streamId: number | null;
}

export interface PaymentStreamView {
  id: number;
  payer: string;
  recipient: string;
  ratePerSecond: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  startTime: number;
  stopTime: number;
  status: string;
  statusCode: number;
  withdrawable: bigint;
}

export interface ReferralStats {
  referrer: string;
  referralCount: number;
  referralEarnings: bigint;
}

export interface ReferralConfig {
  tier1Bps: number;
  tier2Bps: number;
}

export interface TrustScore {
  trustScore: number;
  endorsementCount: number;
}

export interface TimeWeightedTrustScore {
  weightedScore: number;
  activeEndorsements: number;
}

export interface AgentEndorsements {
  endorsementIds: number[];
  total: number;
}

export interface EndorsementView {
  id: number;
  endorser: string;
  endorsed: string;
  agreementId: number;
  capability: string;
  weight: number;
  timestamp: number;
  revoked: boolean;
}

export interface NetworkStats {
  totalAgents: number;
  totalMembers: number;
  currentMilestone: number;
  nextMilestone: number;
  agentsUntilNextMilestone: number;
  totalVolume: bigint;
  totalFees: bigint;
}

export interface PublicKeyRecord {
  publicKey: string;
  updatedAt: bigint;
  hasKey: boolean;
}

export interface EncryptedAgreementPayload {
  contentHash: string;
  ciphertextForCaller: string;
  updatedAt: bigint;
  setBy: string;
  hasSignatures: boolean;
}

export interface EncryptedPaymentRequestPayload {
  contentHash: string;
  ciphertextForCaller: string;
  updatedAt: bigint;
  setBy: string;
  hasSignatures: boolean;
}

export type EncryptedPayloadMap =
  | { [address: string]: string }
  | Array<{ address: string; ciphertext: string }>;

// ─── Event callbacks ───────────────────────────────────────────────────────

export interface PaymentRequestEvent {
  requestId: bigint;
  requester: string;
  payer: string;
  isNative: boolean;
  token: string;
  amount: bigint;
  description: string;
}

export interface TransferReceivedEvent {
  from: string;
  to: string;
  amount: bigint;
  memo: string;
}

export interface DirectMessageEvent {
  messageId: bigint;
  sender: string;
  recipient: string;
  contentHash: string;
  timestamp: bigint;
}

export interface BroadcastEvent {
  broadcastId: bigint;
  sender: string;
  broadcastType: number;
  messageURI: string;
  timestamp: bigint;
}

export interface ServiceAgreementEvent {
  agreementId: number;
  client: string;
  provider: string;
  arbiter: string;
  amount: bigint;
  deadline: number;
  description: string;
}

export interface PaymentStreamEvent {
  streamId: number;
  payer: string;
  recipient: string;
  ratePerSecond: bigint;
  totalDeposit: bigint;
  startTime: number;
  stopTime: number;
}

export interface ReferralRewardEvent {
  referrer: string;
  source: string;
  amount: bigint;
  tier: number;
}

export interface NetworkMilestoneEvent {
  agentCount: number;
  milestone: number;
  benefit: string;
}

export interface ReputationUpdatedEvent {
  agent: string;
  oldScore: number;
  score: number;
  tier: number;
}

// ─── Main client class ─────────────────────────────────────────────────────

export class AgentClient {
  readonly provider: JsonRpcProvider;
  readonly wallet: Wallet;
  readonly contract: Contract;
  readonly address: string;

  constructor(opts: AgentClientOptions);

  /** Auto-discover the contract from the deployment registry. */
  static discover(opts: DiscoverOptions): Promise<AgentClient>;

  /** Derive the compressed secp256k1 public key for a private key. */
  static deriveSecp256k1PublicKey(privateKey: string): string;

  /** Verify the RPC is connected to the expected chain. */
  verifyChain(): Promise<void>;

  /** Full autonomous onboarding flow. */
  safeOnboard(metadataURI: string, overrideStakeEth?: string): Promise<SafeOnboardResult>;

  /** Preflight diagnostic check. */
  preflight(): Promise<PreflightStatus>;

  // Identity & Discovery
  register(metadataURI: string): Promise<ContractTransactionReceipt>;
  updateMetadata(metadataURI: string): Promise<ContractTransactionReceipt>;
  getProfile(address?: string): Promise<AgentProfile>;
  isRegistered(): Promise<boolean>;
  getAgentCount(): Promise<bigint>;
  discoverAgents(offset?: number, limit?: number): Promise<DiscoverAgentsResult>;

  // Fee Info
  previewFee(amountWei: bigint): Promise<FeePreview>;
  getFeeConfig(): Promise<FeeConfig>;

  // Native ETH Escrow
  depositNative(amountEth: string): Promise<ContractTransactionReceipt>;
  withdrawNative(amountWei: bigint): Promise<ContractTransactionReceipt>;
  transferNative(toAddress: string, amountWei: bigint, memo?: string): Promise<ContractTransactionReceipt>;
  getNativeBalance(): Promise<bigint>;

  // ERC-20 Token Escrow
  depositToken(tokenAddress: string, amountWei: bigint): Promise<ContractTransactionReceipt>;
  withdrawToken(tokenAddress: string, amountWei: bigint): Promise<ContractTransactionReceipt>;
  transferToken(tokenAddress: string, toAddress: string, amountWei: bigint, memo?: string): Promise<ContractTransactionReceipt>;
  getTokenBalance(tokenAddress: string): Promise<bigint>;

  // Payment Requests
  createPaymentRequest(payerAddress: string, amount: bigint, opts?: CreatePaymentRequestOptions): Promise<bigint | ContractTransactionReceipt>;
  settlePaymentRequest(requestId: bigint | number): Promise<ContractTransactionReceipt>;
  cancelPaymentRequest(requestId: bigint | number): Promise<ContractTransactionReceipt>;
  getPaymentRequest(requestId: bigint | number): Promise<PaymentRequest>;

  // Open Onboarding
  stakeAndJoin(metadataURI: string, stakeEth: string): Promise<ContractTransactionReceipt>;
  leaveDAO(): Promise<ContractTransactionReceipt>;
  getMinStake(): Promise<bigint>;

  // Economic Projects
  createProject(metadataURI: string, targetBudgetWei: bigint, deadlineUnix: number): Promise<bigint | ContractTransactionReceipt>;
  fundProject(projectId: bigint | number, amountEth: string): Promise<ContractTransactionReceipt>;
  applyToProject(projectId: bigint | number): Promise<ContractTransactionReceipt>;
  approveContributor(projectId: bigint | number, contributorAddress: string, sharesBps: number): Promise<ContractTransactionReceipt>;
  completeProject(projectId: bigint | number): Promise<ContractTransactionReceipt>;
  cancelProject(projectId: bigint | number): Promise<ContractTransactionReceipt>;
  claimProjectShare(projectId: bigint | number): Promise<ContractTransactionReceipt>;
  refundProjectFunder(projectId: bigint | number): Promise<ContractTransactionReceipt>;
  getProject(projectId: bigint | number): Promise<EconomicProjectView>;

  // Secure Direct Messaging
  sendMessage(toAddress: string, encryptedContent: string, contentHash: string): Promise<bigint | ContractTransactionReceipt>;
  markMessageRead(messageId: bigint | number): Promise<ContractTransactionReceipt>;
  getMessage(messageId: bigint | number): Promise<DirectMessageView>;
  getConversation(otherAgent: string, offset?: number, limit?: number): Promise<PaginatedIds>;
  getInbox(offset?: number, limit?: number): Promise<PaginatedIds>;

  // Commerce Blackhole
  getBlackholeConfig(): Promise<BlackholeConfig>;
  getBlackholeMetrics(): Promise<BlackholeMetrics>;
  getAgentCommerceMetrics(address?: string): Promise<AgentCommerceMetrics>;
  previewExitFee(amountWei: bigint): Promise<FeePreview>;
  batchTransferNative(transfers: BatchTransfer[]): Promise<ContractTransactionReceipt>;
  batchSettlePaymentRequests(requestIds: Array<bigint | number>, totalValue: bigint): Promise<ContractTransactionReceipt>;

  // Reputation
  getAgentReputation(address?: string): Promise<AgentReputation>;
  getReputationLeaderboard(offset?: number, limit?: number): Promise<ReputationLeaderboard>;
  refreshReputation(address: string): Promise<ContractTransactionReceipt>;
  onReputationUpdated(callback: (event: ReputationUpdatedEvent) => void): void;

  // Event Listening
  onPaymentRequest(callback: (event: PaymentRequestEvent) => void): void;
  onPaymentRequestCreated(callback: (event: PaymentRequestEvent) => void): void;
  onTransferReceived(callback: (event: TransferReceivedEvent) => void): void;
  onDirectMessage(callback: (event: DirectMessageEvent) => void): void;
  onBroadcast(callback: (event: BroadcastEvent) => void): void;
  onServiceAgreement(callback: (event: ServiceAgreementEvent) => void): void;
  onPaymentStream(callback: (event: PaymentStreamEvent) => void): void;
  onReferralReward(callback: (event: ReferralRewardEvent) => void): void;
  onNetworkMilestone(callback: (event: NetworkMilestoneEvent) => void): void;

  // Capability-Indexed Discovery
  setCapabilities(capabilities: string[]): Promise<ContractTransactionReceipt>;
  getCapabilities(address?: string): Promise<string[]>;
  discoverByCapability(capability: string, offset?: number, limit?: number): Promise<{ agents: DiscoveredAgent[]; total: number }>;
  getCapabilityAgentCount(capability: string): Promise<number>;

  // Service Agreements
  createServiceAgreement(opts: CreateServiceAgreementOptions): Promise<CreateServiceAgreementResult>;
  submitDelivery(agreementId: number, deliveryHash: string): Promise<ContractTransactionReceipt>;
  approveDelivery(agreementId: number): Promise<ContractTransactionReceipt>;
  disputeServiceAgreement(agreementId: number): Promise<ContractTransactionReceipt>;
  resolveServiceDispute(agreementId: number, inFavorOfProvider: boolean): Promise<ContractTransactionReceipt>;
  cancelServiceAgreement(agreementId: number): Promise<ContractTransactionReceipt>;
  getServiceAgreement(agreementId: number): Promise<ServiceAgreementView>;

  // Payment Streams
  createPaymentStream(opts: CreatePaymentStreamOptions): Promise<CreatePaymentStreamResult>;
  streamBalanceOf(streamId: number): Promise<bigint>;
  withdrawFromStream(streamId: number): Promise<ContractTransactionReceipt>;
  cancelPaymentStream(streamId: number): Promise<ContractTransactionReceipt>;
  getPaymentStream(streamId: number): Promise<PaymentStreamView>;

  // Network Effect: Referral Rewards
  stakeAndJoinWithReferral(metadataURI: string, referrerAddress: string, stakeEth?: string): Promise<ContractTransactionReceipt>;
  getReferralStats(address?: string): Promise<ReferralStats>;
  getReferralConfig(): Promise<ReferralConfig>;
  withdrawReferralEarnings(): Promise<ContractTransactionReceipt>;

  // Network Effect: Trust Graph
  endorseAgent(agreementId: number, endorsedAddress: string, capability: string): Promise<ContractTransactionReceipt>;
  revokeEndorsement(endorsementId: number): Promise<ContractTransactionReceipt>;
  getTrustScore(address?: string): Promise<TrustScore>;
  getTimeWeightedTrustScore(address?: string): Promise<TimeWeightedTrustScore>;
  getAgentEndorsements(address?: string, offset?: number, limit?: number): Promise<AgentEndorsements>;
  getEndorsement(endorsementId: number): Promise<EndorsementView>;

  // Network Stats
  getNetworkStats(): Promise<NetworkStats>;

  // PKI: Public Key Registry
  publishPublicKey(publicKey?: string | Uint8Array): Promise<ContractTransactionReceipt>;
  revokePublicKey(): Promise<ContractTransactionReceipt>;
  getPublicKey(address?: string): Promise<PublicKeyRecord>;
  hasPublicKey(address?: string): Promise<boolean>;

  // PKI: Encrypted Agreement Envelopes
  attachEncryptedAgreementPayload(agreementId: bigint | number, payloadMap: EncryptedPayloadMap, contentHash: string): Promise<ContractTransactionReceipt>;
  getEncryptedAgreementPayload(agreementId: bigint | number): Promise<EncryptedAgreementPayload>;
  attachEncryptedAgreementPayloadSigned(
    agreementId: bigint | number,
    payloadMap: EncryptedPayloadMap,
    contentHash: string,
    expectedSigners: string[],
    signatures: string[],
  ): Promise<ContractTransactionReceipt>;
  attachEncryptedPaymentRequestPayload(
    requestId: bigint | number,
    ciphertextForRequester: string,
    ciphertextForPayer: string,
    contentHash: string,
  ): Promise<ContractTransactionReceipt>;
  getEncryptedPaymentRequestPayload(requestId: bigint | number): Promise<EncryptedPaymentRequestPayload>;
  attachEncryptedPaymentRequestPayloadSigned(
    requestId: bigint | number,
    ciphertextForRequester: string,
    ciphertextForPayer: string,
    contentHash: string,
    requesterSignature: string,
    payerSignature: string,
  ): Promise<ContractTransactionReceipt>;

  // EIP-712 terms signing
  agreementTermsDigest(agreementId: bigint | number, contentHash: string): Promise<string>;
  paymentRequestTermsDigest(requestId: bigint | number, contentHash: string): Promise<string>;
  signAgreementTerms(agreementId: bigint | number, contentHash: string): Promise<string>;
  signPaymentRequestTerms(requestId: bigint | number, contentHash: string): Promise<string>;

  /** Stop all event listeners. */
  removeAllListeners(): void;
}
