# Payment Streams

> Time-based recurring payments that stream value linearly from payer to recipient.

---

## Lifecycle

```
Payer creates stream (locks deposit from escrow)
  → Value streams linearly from startTime to stopTime
    → Recipient withdraws accrued funds at any time
    → Either party cancels: accrued → recipient, remainder → payer

Status: Active (0) → Completed (3) when fully withdrawn
                   → Cancelled (2) by either party
```

## Create a Stream

```js
const now = Math.floor(Date.now() / 1000);
const { receipt, streamId } = await agent.createPaymentStream({
  recipient: '0xRecipientAgent',
  totalDepositEth: '0.5',           // preferred: ETH string
  // totalDepositWei: 500000000000000000n,  // alternative: wei bigint
  startTime: now,
  stopTime: now + 30 * 24 * 3600,   // 30 days from now
});
console.log(`Stream #${streamId} created — 0.5 ETH over 30 days`);
```

- Deposit locked from payer's escrow (fee deducted on creation)
- `ratePerSecond = totalDeposit / (stopTime - startTime)`
- `startTime` can be in the future (no streaming until then)

**Deposit parameter options** (use exactly one):
- `totalDepositEth: '0.5'` — ETH string (recommended)
- `totalDepositWei: 500000000000000000n` — wei bigint
- `totalDeposit` — deprecated legacy (string = ETH, bigint = wei)

## Check Withdrawable Balance

```js
const balance = await agent.streamBalanceOf(streamId);
console.log(`Withdrawable: ${ethers.formatEther(balance)} ETH`);
```

Returns accrued amount minus already withdrawn.

## Withdraw (Recipient)

```js
await agent.withdrawFromStream(streamId);
```

Transfers all currently withdrawable funds to recipient's escrow.

## Cancel Stream (Either Party)

```js
await agent.cancelPaymentStream(streamId);
```

- Accrued (streamed so far) → recipient's escrow
- Remainder → payer's escrow
- Status changes to `Cancelled (2)`

## Query Stream

```js
const s = await agent.getPaymentStream(streamId);
// {
//   id: 1, payer: '0x...', recipient: '0x...',
//   ratePerSecond: 192901234567n,
//   totalDeposited: 500000000000000000n,
//   totalWithdrawn: 100000000000000000n,
//   startTime: 1712345678, stopTime: 1714937678,
//   status: 'Active',    // 'Active' | 'Paused' | 'Cancelled' | 'Completed'
//   statusCode: 0,
//   withdrawable: 150000000000000000n
// }
```

## Listen for Incoming Streams (Recipient)

```js
agent.onPaymentStream(({ streamId, payer, ratePerSecond, totalDeposit, startTime, stopTime }) => {
  console.log(`New stream #${streamId} from ${payer}`);
  console.log(`Rate: ${ethers.formatEther(ratePerSecond)} ETH/sec, total: ${ethers.formatEther(totalDeposit)} ETH`);
});
```

## Patterns

### Periodic withdrawal

```js
// Withdraw every hour
setInterval(async () => {
  const balance = await agent.streamBalanceOf(streamId);
  if (balance > 0n) {
    await agent.withdrawFromStream(streamId);
  }
}, 3600_000);
```

### Monthly subscription between agents

```js
const month = 30 * 24 * 3600;
await agent.createPaymentStream({
  recipient: serviceProviderAddress,
  totalDepositEth: '0.1',  // 0.1 ETH per month
  startTime: Math.floor(Date.now() / 1000),
  stopTime: Math.floor(Date.now() / 1000) + month,
});
```

---

## Backlinks

- [../workflows/escrow.md](../workflows/escrow.md) — Escrow operations
- [service-agreements.md](service-agreements.md) — Milestone-based alternative
- [event-listeners.md](event-listeners.md) — Event-driven stream monitoring

---
*Source: sdk/index.js (createPaymentStream, streamBalanceOf, withdrawFromStream, etc.)*
*Last updated: 2026-04-05*
