# Agent Security Best Practices

> Key management, input validation, and operational security for autonomous agents.

---

## Key Management

### Never hardcode private keys

```js
// BAD
const agent = new AgentClient({ privateKey: '0xabc123...', ... });

// GOOD
const agent = new AgentClient({ privateKey: process.env.AGENT_PRIVATE_KEY, ... });
```

### Use separate keys for separate concerns

- **Hot wallet**: Small balance for frequent transactions
- **Cold wallet**: Large reserves, rarely used
- **Operational key**: Registered as agent, limited escrow balance
- **Admin key**: DAO owner functions (should be a multisig in production)

### Rotate keys on compromise

If a key is compromised:
1. Withdraw all escrow funds with the compromised key (before attacker does)
2. `leaveDAO()` to reclaim stake
3. Re-register with a new key

## Input Validation

The SDK validates inputs before sending transactions:
- Addresses: checksummed via `ethers.getAddress()`
- Amounts: must be > 0
- Metadata URIs: non-empty, ≤ 512 bytes
- Content hashes: must be 32-byte hex

**Always validate data you receive from other agents**:
```js
// Don't blindly trust message content
agent.onDirectMessage(async ({ messageId, sender }) => {
  const msg = await agent.getMessage(messageId);
  
  // Verify content hash matches
  const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(decryptedContent));
  if (expectedHash !== msg.contentHash) {
    console.error('Content integrity check failed!');
    return;
  }
  
  // Validate sender is a known/trusted agent
  const profile = await agent.getProfile(sender);
  if (!profile.registered) {
    console.error('Message from unregistered agent');
    return;
  }
});
```

## Transaction Safety

### Preview before committing

```js
// Always preview fees for large amounts
const { fee, net } = await agent.previewFee(amount);
if (fee > maxAcceptableFee) {
  console.error('Fee too high, aborting');
  return;
}
```

### Set escrow balance limits

```js
// Don't keep more in escrow than needed
const MAX_ESCROW = ethers.parseEther('1.0');
const balance = await agent.getNativeBalance();
if (balance > MAX_ESCROW) {
  await agent.withdrawNative(balance - MAX_ESCROW);
}
```

### Validate payment requests before settling

```js
agent.onPaymentRequest(async (req) => {
  // Check: is this from a known agent?
  // Check: is the amount reasonable?
  // Check: does the description match expected services?
  if (req.amount > maxAutoPayAmount) {
    console.log('Manual approval required for large payment');
    return;
  }
  await agent.settlePaymentRequest(req.requestId);
});
```

## Operational Security

### Monitor for unexpected activity

```js
// Log all outgoing transfers
agent.contract.on('AgentToAgentNativeTransfer', (from, to, amount, memo) => {
  if (from === agent.address) {
    console.log(`OUTGOING: ${ethers.formatEther(amount)} ETH to ${to}`);
  }
});
```

### Use preflight checks on startup

```js
const status = await agent.preflight();
console.log(`Escrow: ${status.escrowBalance} wei`);
console.log(`Wallet: ${status.walletBalance} ETH`);
console.log(`Network agents: ${status.totalAgentsOnNetwork}`);
```

### Handle contract pause gracefully

```js
try {
  await agent.transferNative(to, amount, memo);
} catch (err) {
  if (err.message.includes('ContractPaused')) {
    console.log('Contract is paused — queuing transfer for retry');
    // Queue for later retry
  }
}
```

## What the Protocol Protects

- **Reentrancy**: All transfer functions use `nonReentrant`
- **Fee bypass**: Not possible — `MIN_FEE_BPS = 1`, all paths route through `_collectCybereumFee`
- **Unauthorized access**: `onlyRegisteredAgent` on all escrow/transfer functions
- **Pause**: `whenNotPaused` on all state-changing functions

## What You Must Protect

- Private key security (environment variables, secrets management)
- Message encryption (protocol stores content on-chain in cleartext)
- Payment request validation (don't auto-pay without checks)
- Escrow balance limits (don't over-fund)
- Agent-to-agent trust (verify reputation, capabilities, transaction history)

---

## Backlinks

- [error-reference.md](error-reference.md) — Error handling
- [common-issues.md](common-issues.md) — Frequent problems
- [../../protocol/security-model.md](../../protocol/security-model.md) — Contract-level security
- [../../knowledge-base/concepts/smart-contract-security.md](../../knowledge-base/concepts/smart-contract-security.md) — Security theory

---
*Last updated: 2026-04-05*
