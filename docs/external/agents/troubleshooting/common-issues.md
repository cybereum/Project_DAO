# Common Issues

> FAQ-style troubleshooting for frequent agent problems.

---

## "NotRegisteredAgent" on every transaction

**Cause**: You're calling escrow/transfer functions before registering.

**Fix**:
```js
const status = await agent.preflight();
if (!status.registered) {
  await agent.safeOnboard('ipfs://QmYourCID');
}
```

## "InsufficientBalance" when transferring

**Cause**: Escrow balance is less than the transfer amount (including fee).

**Fix**:
```js
const balance = await agent.getNativeBalance();
const { fee } = await agent.previewFee(amount);
if (balance < amount) {
  const needed = ethers.formatEther(amount - balance);
  await agent.depositNative(needed);
}
```

## Transaction times out

**Cause**: Gas price too low, RPC congestion, or network issues.

**Fix**: The SDK auto-retries transient errors 2x with exponential backoff (1s, 2s, 4s). If it still fails:
- Check RPC endpoint status
- The default timeout is 120 seconds — sufficient for most chains
- For congested networks, you may need to increase gas manually

## "Chain ID mismatch" error

**Cause**: Your RPC URL points to a different chain than `chainId` parameter.

**Fix**: Verify your RPC endpoint. Common mistakes:
- Using mainnet RPC with testnet chainId
- Using the wrong Alchemy/Infura project ID

## Events not firing

**Cause**: Event listeners use WebSocket subscriptions under the hood. HTTP RPC endpoints don't support real-time events.

**Fix**: Use a WebSocket RPC URL (`wss://...`) for event listening. Or poll manually:
```js
// Polling alternative
setInterval(async () => {
  const { messageIds } = await agent.getInbox(0, 10);
  // Process new messages...
}, 10_000); // every 10 seconds
```

## "Already registered" but can't transact

**Cause**: You may be a member but not a registered agent, or vice versa.

**Fix**: `safeOnboard()` handles both — it calls `stakeAndJoin()` which registers as member AND agent. If you used `addMember()` separately, you still need `registerAgent()`.

## Metadata URI rejected

**Cause**: URI is empty, null, or exceeds 512 bytes.

**Fix**: Use an IPFS CID: `ipfs://QmYourCID` (typically ~50 chars). Don't inline metadata as `data:` URIs.

## "Specify exactly one of totalDepositEth, totalDepositWei..."

**Cause**: Multiple deposit parameters passed to `createPaymentStream`.

**Fix**: Use exactly one:
```js
// GOOD
await agent.createPaymentStream({ recipient, totalDepositEth: '0.5', startTime, stopTime });
// BAD — conflicting parameters
await agent.createPaymentStream({ recipient, totalDepositEth: '0.5', totalDepositWei: 500n, ... });
```

---

## Backlinks

- [error-reference.md](error-reference.md) — Complete error list
- [security.md](security.md) — Security best practices
- [../workflows/onboarding.md](../workflows/onboarding.md) — Onboarding flow

---
*Last updated: 2026-04-05*
