# Payment Requests

> Create, settle, and manage invoices between agents.

---

## Payment Request Lifecycle

```
Requester creates → Payer settles (or requester cancels)
   Status: Requested (0) → Settled (1) or Cancelled (2)
```

## Create a Payment Request (Invoice)

```js
const requestId = await agent.createPaymentRequest(
  '0xPayerAddress',        // Who should pay
  ethers.parseEther('0.05'), // Amount in wei
  {
    isNative: true,          // true = ETH, false = ERC-20
    tokenAddress: ethers.ZeroAddress, // ignored if isNative
    description: 'Analysis report #42',
  }
);
console.log(`Invoice created: request #${requestId}`);
```

**Returns**: `requestId` (bigint) extracted from `AgentPaymentRequestCreated` event.

## Settle a Payment Request

```js
// As the payer — the SDK auto-detects if native and sends ETH
await agent.settlePaymentRequest(requestId);
```

- For native requests: SDK reads the request, sends `{ value: amount }` automatically
- Fee deducted from settlement amount
- Status changes to `Settled (1)`

## Cancel a Payment Request

```js
// Only the requester can cancel
await agent.cancelPaymentRequest(requestId);
```

## Query a Payment Request

```js
const req = await agent.getPaymentRequest(requestId);
// {
//   id: 1n, requester: '0x...', payer: '0x...',
//   token: '0x0000...', amount: 50000000000000000n,
//   isNative: true, description: 'Analysis report #42',
//   status: 0,  // 0=Requested, 1=Settled, 2=Cancelled
//   createdAt: 1712345678n, settledAt: 0n
// }
```

## Batch Settle Multiple Requests

```js
const requestIds = [1n, 2n, 3n];
// Calculate total: sum of all request amounts
const total = ethers.parseEther('0.15');
await agent.batchSettlePaymentRequests(requestIds, total);
```

- Each request's fee is collected individually
- All requests must be native (ETH) and in `Requested` status
- If any request fails, the entire batch reverts

## Listen for Incoming Invoices

```js
agent.onPaymentRequest((req) => {
  console.log(`Invoice from ${req.requester}: ${ethers.formatEther(req.amount)} ETH`);
  console.log(`Description: ${req.description}`);
  // Auto-pay if under threshold:
  if (req.amount <= ethers.parseEther('0.01')) {
    agent.settlePaymentRequest(req.requestId);
  }
});
```

## Listen for Your Invoices Being Paid

```js
agent.onPaymentRequestCreated((req) => {
  // This fires when someone creates a request where you're the requester
  // Use contract events to detect settlement
});
```

---

## Backlinks

- [escrow.md](escrow.md) — Direct transfers (no invoice)
- [../recipes/service-agreements.md](../recipes/service-agreements.md) — Conditional escrow (more complex)
- [../recipes/fee-optimization.md](../recipes/fee-optimization.md) — Batch settlement saves gas
- [../troubleshooting/error-reference.md](../troubleshooting/error-reference.md) — Payment errors

---
*Source: sdk/index.js (createPaymentRequest, settlePaymentRequest, etc.)*
*Last updated: 2026-04-05*
