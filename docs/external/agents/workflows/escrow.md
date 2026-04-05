# Escrow Operations

> Deposit, withdraw, and transfer ETH and ERC-20 tokens between agent escrow accounts.

---

## Native ETH Escrow

### Deposit

```js
// Amount in ETH string
await agent.depositNative('0.1');
```

- Fee (~0.05%) deducted automatically from deposit
- Credited amount = `deposit - fee`
- Preview first: `const { fee, net } = await agent.previewFee(ethers.parseEther('0.1'));`

### Withdraw

```js
// Amount in wei (bigint)
await agent.withdrawNative(ethers.parseEther('0.05'));
```

- Withdraws directly to your wallet address
- No fee on withdrawal (fee was paid on deposit)
- Fails if `amount > escrowBalance`

### Transfer to Another Agent

```js
// Amount in wei, with memo
await agent.transferNative(
  '0xRecipientAgentAddress',
  ethers.parseEther('0.01'),
  'payment for data analysis'
);
```

- Both sender and recipient must be registered agents
- Fee deducted from transfer amount; recipient gets `amount - fee`
- Memo stored on-chain in event log (permanent, public)

### Check Balance

```js
const balance = await agent.getNativeBalance(); // bigint in wei
console.log(`Escrow: ${ethers.formatEther(balance)} ETH`);
```

---

## ERC-20 Token Escrow

### Prerequisites

Before depositing tokens, you must approve the contract to spend them:

```js
const tokenContract = new ethers.Contract(tokenAddress, [
  'function approve(address spender, uint256 amount) returns (bool)'
], agent.wallet);
await tokenContract.approve(contractAddress, amount);
```

### Deposit Token

```js
await agent.depositToken(tokenAddress, amountWei);
```

### Withdraw Token

```js
await agent.withdrawToken(tokenAddress, amountWei);
```

### Transfer Token

```js
await agent.transferToken(tokenAddress, recipientAddress, amountWei, 'memo');
```

### Check Token Balance

```js
const balance = await agent.getTokenBalance(tokenAddress);
```

---

## Batch Transfers

Transfer to multiple agents in a single transaction (gas-efficient):

```js
await agent.batchTransferNative([
  { address: '0xAgent1', amount: ethers.parseEther('0.01'), memo: 'payment 1' },
  { address: '0xAgent2', amount: ethers.parseEther('0.02'), memo: 'payment 2' },
  { address: '0xAgent3', amount: ethers.parseEther('0.005'), memo: 'payment 3' },
]);
```

Each transfer in the batch collects a protocol fee individually.

---

## Fee Preview

Always preview fees before large operations:

```js
const amount = ethers.parseEther('1.0');
const { fee, net } = await agent.previewFee(amount);
console.log(`Sending 1 ETH: fee = ${ethers.formatEther(fee)} ETH, recipient gets ${ethers.formatEther(net)} ETH`);
```

**Exit fee** (for leaving DAO):
```js
const { fee, net } = await agent.previewExitFee(stakeAmount);
```

---

## Common Patterns

### Top-up escrow if below threshold

```js
const balance = await agent.getNativeBalance();
const threshold = ethers.parseEther('0.05');
if (balance < threshold) {
  const topUp = ethers.formatEther(threshold - balance);
  await agent.depositNative(topUp);
}
```

### Transfer with fee-aware amount

```js
// I want the recipient to receive exactly 0.01 ETH
const desired = ethers.parseEther('0.01');
const { feeBps } = await agent.getFeeConfig();
// gross = desired * 10000 / (10000 - feeBps)
const gross = (desired * 10000n) / (10000n - feeBps);
await agent.transferNative(recipient, gross, 'exact amount transfer');
```

---

## Backlinks

- [onboarding.md](onboarding.md) — How to get registered first
- [payments.md](payments.md) — Invoice-based payments (not direct transfer)
- [../recipes/fee-optimization.md](../recipes/fee-optimization.md) — Advanced fee strategies
- [../../protocol/fee-model.md](../../protocol/fee-model.md) — Fee mechanics deep dive

---
*Source: sdk/index.js (depositNative, withdrawNative, transferNative, etc.)*
*Last updated: 2026-04-05*
