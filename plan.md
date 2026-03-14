# Implementation Plan: Velocity-Maximizing Monetization Features

## Insight Summary
Cybereum's 0.05% fee is a **velocity tax** — AI agents transact at machine speed, so the same ETH generates fees at every hop. Features that increase transaction velocity directly multiply revenue without raising the fee rate.

## Implementation Scope

### 1. Smart Contract: Batch Transfer Rail (`contracts/Project_DAO.sol`)
**Why:** Batch transfers reduce gas costs per transfer, making high-frequency micro-payments economically viable. Each transfer in the batch still pays the full 0.05% fee individually — so Cybereum collects N fees in one tx instead of agents being discouraged by N separate gas costs.

**Add these functions:**

- `batchTransferNativeBetweenAgents(address[] to, uint256[] amounts, string[] memos)` — Loop through recipients, deduct fee on each transfer individually. Sender pays gas once, Cybereum collects N fees.
- `batchTransferTokenBetweenAgents(address token, address[] to, uint256[] amounts, string[] memos)` — Same pattern for ERC-20s.

**Add these events:**
- `AgentBatchNativeTransfer(address indexed from, uint256 recipientCount, uint256 totalAmount, uint256 totalFees)`
- `AgentBatchTokenTransfer(address indexed from, address indexed token, uint256 recipientCount, uint256 totalAmount, uint256 totalFees)`

**Add velocity tracking state:**
- `uint256 public totalNativeFeesCollected` — Running total of all native fees ever collected (incremented in `_collectNativeFee`)
- `uint256 public totalTokenFeesCollected` — Count of token fee collection events
- `uint256 public totalTransactionCount` — Incremented on every fee-collecting operation

**Insert location:** After line 601 (after `transferTokenBetweenAgents`), before `transferAssetBetweenAgents`.

### 2. Smart Contract: Recurring Payment Subscriptions (`contracts/Project_DAO.sol`)

**Why:** Subscriptions create automated, recurring fee generation. An agent subscribing to another agent's service generates fees every billing cycle without any human intervention.

**Add struct:**
```solidity
struct AgentSubscription {
    uint256 id;
    address subscriber;
    address provider;
    address token;        // address(0) for native
    uint256 amount;
    bool isNative;
    uint256 interval;     // seconds between payments
    uint256 nextPaymentDue;
    uint256 totalPayments;
    uint256 paymentsMade;  // 0 = unlimited if totalPayments == 0
    bool active;
    string description;
}
```

**Add functions:**
- `createAgentSubscription(address provider, address token, uint256 amount, bool isNative, uint256 interval, uint256 totalPayments, string description) → subscriptionId` — Agent sets up recurring payment.
- `executeSubscriptionPayment(uint256 subscriptionId)` — Anyone can call (permissionless crank). Transfers from subscriber escrow to provider escrow, fee collected each time.
- `cancelAgentSubscription(uint256 subscriptionId)` — Only subscriber can cancel.
- `getAgentSubscription(uint256 subscriptionId)` — View function.

**Events:**
- `AgentSubscriptionCreated(uint256 indexed subscriptionId, address indexed subscriber, address indexed provider, uint256 amount, uint256 interval)`
- `AgentSubscriptionPaymentExecuted(uint256 indexed subscriptionId, address indexed subscriber, address indexed provider, uint256 netAmount, uint256 paymentNumber)`
- `AgentSubscriptionCancelled(uint256 indexed subscriptionId)`

**Insert location:** After batch transfers, before `transferAssetBetweenAgents`.

### 3. Smart Contract: Protocol Velocity Metrics (View Functions)

**Add view functions:**
- `getProtocolMetrics() → (uint256 totalNativeFees, uint256 totalTxCount, uint256 agentCount, uint256 activeSubscriptions)`
- `getActiveSubscriptionCount() → uint256`

### 4. Agent SDK Updates (`sdk/index.js`, `sdk/abi.js`)

**Add to `sdk/abi.js`:**
- ABI entries for `batchTransferNativeBetweenAgents`, `batchTransferTokenBetweenAgents`
- ABI entries for `createAgentSubscription`, `executeSubscriptionPayment`, `cancelAgentSubscription`, `getAgentSubscription`
- ABI entries for `getProtocolMetrics`, `totalNativeFeesCollected`, `totalTransactionCount`

**Add to `sdk/index.js` (AgentClient class):**
- `batchTransferNative(recipients)` — Takes array of `{address, amountWei, memo}`, calls batch contract function
- `batchTransferToken(token, recipients)` — Same for tokens
- `createSubscription(provider, amount, opts)` — Create recurring payment
- `executeSubscription(subscriptionId)` — Crank a due subscription payment
- `cancelSubscription(subscriptionId)` — Cancel
- `getSubscription(subscriptionId)` — View
- `getProtocolMetrics()` — Fetch velocity stats
- `onSubscriptionPayment(callback)` — Listen for incoming subscription payments

### 5. Frontend ABI Update (`nexus-app/src/config/contract.js`)

Add ABI entries for all new contract functions so the frontend can call them.

### 6. Frontend: Velocity Analytics Dashboard (`nexus-app/src/pages/AgentEconomy.jsx`)

**Add a "Protocol Velocity" section** to the existing Agent Economy page:
- Total fees collected (ETH)
- Total transaction count
- Active subscriptions count
- Agent count
- Estimated daily fee run-rate (based on recent activity)

**Add to appStore.jsx:**
- `protocolMetrics` state + `loadProtocolMetrics()` function

### 7. Contract Tests (`test/ProjectDAO.test.js`)

**Add test sections:**
- `describe("Batch Transfers")` — Test batch native transfers (multiple recipients, fee per transfer, insufficient balance, empty arrays, mismatched array lengths)
- `describe("Batch Token Transfers")` — Same for ERC-20
- `describe("Subscriptions")` — Create, execute (fee deducted), execute too early (revert), cancel, execute cancelled (revert), unlimited vs fixed payment count
- `describe("Protocol Metrics")` — Verify counters increment correctly across operations

### 8. Update CLAUDE.md

Add new functions to the Contract Interface Reference section.

---

## File Change Summary

| File | Action |
|------|--------|
| `contracts/Project_DAO.sol` | Add batch transfers, subscriptions, velocity metrics |
| `sdk/abi.js` | Add ABI for new functions |
| `sdk/index.js` | Add SDK methods for batch, subscriptions, metrics |
| `nexus-app/src/config/contract.js` | Add ABI entries for new functions |
| `nexus-app/src/pages/AgentEconomy.jsx` | Add velocity metrics section |
| `nexus-app/src/store/appStore.jsx` | Add protocol metrics state |
| `test/ProjectDAO.test.js` | Add tests for batch, subscriptions, metrics |
| `CLAUDE.md` | Document new functions |

## Implementation Order

1. Contract changes (batch transfers + subscriptions + metrics)
2. Contract tests (verify everything works)
3. SDK updates (abi.js + index.js)
4. Frontend ABI update (contract.js)
5. Frontend velocity dashboard (AgentEconomy.jsx + appStore.jsx)
6. CLAUDE.md documentation update
