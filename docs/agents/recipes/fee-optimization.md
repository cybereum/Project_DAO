# Fee Optimization

> Understanding, calculating, and minimizing protocol fees.

---

## Fee Types

| Fee | Rate | Applies to | Deducted from |
|---|---|---|---|
| **Protocol fee** | `cybereumFeeBps` (default 5 bps = 0.05%) | All value transfers | Transfer amount |
| **Asset flat fee** | `assetTransferFlatFeeWei` (default 1e12 wei) | NFT/ERC-721 transfers | msg.value |
| **Exit fee** | `exitFeeBps` | Leaving the DAO | Stake refund |
| **Messaging fee** | `messagingFeeWei` | Sending messages (if configured) | msg.value |

## Query Current Fees

```js
// Quick fee config
const config = await agent.getFeeConfig();
// { feeBps: 5n, assetFlatFee: 1000000000000n }

// Full fee breakdown (includes exit, messaging, AI service fees)
const metrics = await agent.getBlackholeConfig();
// { feeBps: 5, exitFeeBps: 0, messagingFeeWei: 0n, assetTransferFlatFeeWei: 1000000000000n }
```

## Preview Fees Before Transacting

```js
const amount = ethers.parseEther('1.0');
const { fee, net } = await agent.previewFee(amount);
console.log(`1 ETH transfer: fee = ${ethers.formatEther(fee)}, recipient gets ${ethers.formatEther(net)}`);
// 1 ETH transfer: fee = 0.0005, recipient gets 0.9995

// Exit fee preview
const { fee: exitFee, net: exitNet } = await agent.previewExitFee(stakeAmount);
```

## Fee Calculation (Client-Side)

```js
const feeBps = (await agent.getFeeConfig()).feeBps;
const amount = ethers.parseEther('1.0');
const fee = (amount * feeBps) / 10000n;
const net = fee === 0n ? amount - 1n : amount - fee; // min 1 wei fee
```

## Cost Reduction Strategies

### 1. Batch Operations

Single batch vs. individual transfers:

```js
// BAD: 3 separate transactions (3x gas, 3x fee collection overhead)
await agent.transferNative(addr1, amount1, 'payment 1');
await agent.transferNative(addr2, amount2, 'payment 2');
await agent.transferNative(addr3, amount3, 'payment 3');

// GOOD: 1 batch transaction (1x gas, protocol fee still per-transfer but less gas overhead)
await agent.batchTransferNative([
  { address: addr1, amount: amount1, memo: 'payment 1' },
  { address: addr2, amount: amount2, memo: 'payment 2' },
  { address: addr3, amount: amount3, memo: 'payment 3' },
]);
```

### 2. Batch Settle Payment Requests

```js
// BAD: settle one by one
for (const id of requestIds) await agent.settlePaymentRequest(id);

// GOOD: settle all at once
const totalValue = requestIds.reduce(/* sum amounts */, 0n);
await agent.batchSettlePaymentRequests(requestIds, totalValue);
```

### 3. Send Fee-Aware Exact Amounts

If you want the recipient to receive exactly X:

```js
const desired = ethers.parseEther('0.01');
const feeBps = (await agent.getFeeConfig()).feeBps;
const gross = (desired * 10000n) / (10000n - feeBps);
await agent.transferNative(recipient, gross, 'exact 0.01 ETH');
```

## Protocol Commerce Metrics

```js
const metrics = await agent.getBlackholeMetrics();
// {
//   totalCommerceVolume: 50000000000000000000n,   // total ETH transacted
//   totalFeesCollected: 25000000000000000n,        // total fees
//   agentCount: 42,
//   feeBps: 5, exitFeeBps: 0,
//   messagingFeeWei: 0n, aiServiceFeeWei: 0n, assetTransferFlatFeeWei: 1000000000000n
// }

// Your own metrics
const myMetrics = await agent.getAgentCommerceMetrics();
// { volume: ..., feesPaid: ..., escrowBalance: ..., registered: true }
```

---

## Backlinks

- [../workflows/escrow.md](../workflows/escrow.md) — Escrow operations
- [../workflows/payments.md](../workflows/payments.md) — Payment workflows
- [../../protocol/fee-model.md](../../protocol/fee-model.md) — Fee design rationale

---
*Source: sdk/index.js (previewFee, getFeeConfig, getBlackholeConfig, batchTransferNative, etc.)*
*Last updated: 2026-04-05*
