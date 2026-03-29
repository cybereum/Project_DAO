/**
 * @cybereum/agent-sdk/constants — Machine-readable protocol constants.
 *
 * Enums, state machines, fee parameters, and tier thresholds that agents
 * need to interpret contract return values. All values match the Solidity
 * contract exactly — agents should import these rather than hardcoding.
 *
 * @example
 *   import { PaymentStatus, ProjectStatus, ReputationTier, FeeConfig } from '@cybereum/agent-sdk/constants';
 *
 *   const request = await agent.getPaymentRequest(id);
 *   if (request.status === PaymentStatus.Requested) {
 *     await agent.settlePaymentRequest(id);
 *   }
 */

// ---------------------------------------------------------------------------
// Payment Request Status
// ---------------------------------------------------------------------------

export const PaymentStatus = Object.freeze({
  Requested: 0,
  Settled: 1,
  Cancelled: 2,
});

export const PaymentStatusLabel = Object.freeze({
  0: 'Requested',
  1: 'Settled',
  2: 'Cancelled',
});

/** Valid transitions: Requested → Settled | Cancelled. Terminal states have no transitions. */
export const PaymentStatusTransitions = Object.freeze({
  0: [1, 2],
  1: [],
  2: [],
});

// ---------------------------------------------------------------------------
// Economic Project Status
// ---------------------------------------------------------------------------

export const ProjectStatus = Object.freeze({
  Open: 0,
  Active: 1,
  Completed: 2,
  Cancelled: 3,
});

export const ProjectStatusLabel = Object.freeze({
  0: 'Open',
  1: 'Active',
  2: 'Completed',
  3: 'Cancelled',
});

export const ProjectStatusTransitions = Object.freeze({
  0: [1, 3],     // Open → Active or Cancelled
  1: [2, 3],     // Active → Completed or Cancelled
  2: [],         // Completed is terminal
  3: [],         // Cancelled is terminal
});

// ---------------------------------------------------------------------------
// Feature Kit Priority & Status
// ---------------------------------------------------------------------------

export const FeatureKitPriority = Object.freeze({
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
});

export const FeatureKitPriorityLabel = Object.freeze({
  0: 'Low',
  1: 'Medium',
  2: 'High',
  3: 'Critical',
});

export const FeatureKitStatus = Object.freeze({
  Pending: 0,
  Validated: 1,
  Queued: 2,
  Rejected: 3,
  Implemented: 4,
});

export const FeatureKitStatusLabel = Object.freeze({
  0: 'Pending',
  1: 'Validated',
  2: 'Queued',
  3: 'Rejected',
  4: 'Implemented',
});

// ---------------------------------------------------------------------------
// Reputation Tiers
// ---------------------------------------------------------------------------

export const ReputationTier = Object.freeze({
  None: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
});

export const ReputationTierLabel = Object.freeze({
  0: 'None',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
});

/**
 * Tier thresholds and benefits.
 * An agent with score >= minScore qualifies for that tier.
 */
export const ReputationTierConfig = Object.freeze({
  0: { label: 'None',   minScore: 0,   messagingFeeDiscountBps: 0 },
  1: { label: 'Bronze', minScore: 100, messagingFeeDiscountBps: 1000 },
  2: { label: 'Silver', minScore: 300, messagingFeeDiscountBps: 2500 },
  3: { label: 'Gold',   minScore: 500, messagingFeeDiscountBps: 5000 },
});

export const REPUTATION_MAX_SCORE = 5000;

// ---------------------------------------------------------------------------
// Fee Configuration
// ---------------------------------------------------------------------------

export const FeeConfig = Object.freeze({
  /** Default fee in basis points (5 bps = 0.05%) */
  DEFAULT_FEE_BPS: 5,

  /** Minimum fee — owner cannot set lower than this */
  MIN_FEE_BPS: 1,

  /** Denominator for basis point calculations */
  FEE_BPS_DENOMINATOR: 10000,

  /** Default flat fee for ERC-721 asset transfers */
  DEFAULT_ASSET_TRANSFER_FLAT_FEE_WEI: 1_000_000_000_000n, // 1e12 wei
});

/**
 * Calculate the protocol fee for a given amount.
 * Matches the contract's _collectCybereumFee logic exactly.
 *
 * @param {bigint} amount — value in wei
 * @param {number} feeBps — fee in basis points (default: 5)
 * @returns {{ fee: bigint, net: bigint }}
 */
export function calculateFee(amount, feeBps = FeeConfig.DEFAULT_FEE_BPS) {
  let fee = (amount * BigInt(feeBps)) / BigInt(FeeConfig.FEE_BPS_DENOMINATOR);
  if (fee === 0n && amount > 0n) fee = 1n; // Minimum 1 wei fee
  const net = amount - fee;
  return { fee, net };
}

// ---------------------------------------------------------------------------
// Agent Types (matches agent-metadata.schema.json)
// ---------------------------------------------------------------------------

export const AgentType = Object.freeze({
  AiAgent: 'ai-agent',
  Bot: 'bot',
  Service: 'service',
  Oracle: 'oracle',
  HumanAssisted: 'human-assisted',
  MultiAgentSystem: 'multi-agent-system',
});

// ---------------------------------------------------------------------------
// Error Codes (custom Solidity errors the contract may revert with)
// ---------------------------------------------------------------------------

export const ContractErrors = Object.freeze({
  Unauthorized: 'Caller is not the owner',
  NotMember: 'Caller is not a DAO member',
  NotRegisteredAgent: 'Caller is not a registered agent',
  ContractPaused: 'Contract is currently paused by owner',
  ZeroAmount: 'Amount must be greater than zero',
  InsufficientBalance: 'Insufficient escrow balance for this operation',
  InvalidAddress: 'Address is zero or invalid',
  TransferFailed: 'ETH or ERC-20 transfer reverted',
  AlreadyExists: 'Agent is already registered at this address',
  NotFound: 'Requested resource does not exist',
  InvalidStatus: 'State transition not allowed from current status',
  InvalidFeeConfig: 'Fee BPS must be >= MIN_FEE_BPS (1)',
  TreasuryNotSet: 'Cybereum treasury address is not configured',
  SelfTransfer: 'Cannot transfer to self.',
});

// ---------------------------------------------------------------------------
// Capability helpers
// ---------------------------------------------------------------------------

/**
 * Check if a status transition is valid.
 *
 * @param {Object} transitions — e.g. PaymentStatusTransitions
 * @param {number} from — current status
 * @param {number} to — desired status
 * @returns {boolean}
 */
export function isValidTransition(transitions, from, to) {
  return transitions[from]?.includes(to) ?? false;
}

/**
 * Get human-readable label for a status integer.
 *
 * @param {Object} labels — e.g. PaymentStatusLabel
 * @param {number} status
 * @returns {string}
 */
export function getStatusLabel(labels, status) {
  return labels[status] ?? `Unknown(${status})`;
}
