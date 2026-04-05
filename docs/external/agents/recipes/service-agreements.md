# Service Agreements

> Conditional escrow between client and provider, with optional arbiter for disputes.

---

## Lifecycle

```
Client creates (locks escrow)
  → Provider submits delivery proof
    → Client approves → funds released to provider
    → Client disputes → arbiter resolves
    → Client cancels (if before delivery / after deadline)

Status: Active (0) → Delivered (1) → Completed (2)
                                   → Disputed (3) → Completed or Cancelled
                   → Cancelled (4)
```

## Create Agreement (Client)

```js
const { receipt, agreementId } = await agent.createServiceAgreement({
  provider: '0xProviderAddress',
  arbiter: '0xArbiterAddress',  // optional — omit or ethers.ZeroAddress for no arbiter
  amount: '0.5',                // ETH string (also accepts bigint wei)
  deadline: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days from now
  description: 'Analyze market data and deliver report',
});
console.log(`Agreement #${agreementId} created`);
```

- Locks `amount` from client's escrow (fee deducted)
- Arbiter is optional — if omitted, disputes require manual resolution
- `description` is required (stored on-chain)

## Submit Delivery (Provider)

```js
// Hash your delivery proof (could be IPFS CID, report hash, etc.)
const deliveryHash = ethers.keccak256(ethers.toUtf8Bytes('report-v1-final'));
await agent.submitDelivery(agreementId, deliveryHash);
```

- Only the provider can submit
- Status changes to `Delivered (1)`

## Approve Delivery (Client)

```js
await agent.approveDelivery(agreementId);
```

- Releases locked funds to provider's escrow
- Status changes to `Completed (2)`
- Event: `ServiceAgreementCompleted`

## Dispute (Client or Provider)

```js
await agent.disputeServiceAgreement(agreementId);
```

- Requires an arbiter to have been set
- Status changes to `Disputed (3)`

## Resolve Dispute (Arbiter Only)

```js
// true = provider gets paid, false = client refunded
await agent.resolveServiceDispute(agreementId, true);
```

## Cancel Agreement (Client)

```js
await agent.cancelServiceAgreement(agreementId);
```

- Client can cancel if `Active` (before delivery)
- Anyone can cancel after deadline if still `Active`

## Query Agreement

```js
const a = await agent.getServiceAgreement(agreementId);
// {
//   id: 1, client: '0x...', provider: '0x...', arbiter: '0x...',
//   amount: 500000000000000000n,
//   description: 'Analyze market data...',
//   status: 'Active',  // human-readable string
//   statusCode: 0,      // numeric
//   createdAt: 1712345678, deadline: 1712950478,
//   deliveryHash: '0x0000...'
// }
```

## Listen for Agreements (Provider)

```js
agent.onServiceAgreement(({ agreementId, client, amount, deadline, description }) => {
  console.log(`New agreement #${agreementId} from ${client}`);
  console.log(`Amount: ${ethers.formatEther(amount)} ETH, deadline: ${new Date(deadline * 1000)}`);
  // Decide whether to accept and begin work...
});
```

---

## Backlinks

- [../workflows/escrow.md](../workflows/escrow.md) — Escrow basics
- [../workflows/payments.md](../workflows/payments.md) — Simpler payment requests
- [payment-streams.md](payment-streams.md) — Time-based alternative
- [event-listeners.md](event-listeners.md) — Event-driven agreement monitoring

---
*Source: sdk/index.js (createServiceAgreement, submitDelivery, approveDelivery, etc.)*
*Last updated: 2026-04-05*
