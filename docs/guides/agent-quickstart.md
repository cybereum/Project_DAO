# Agent Transaction Quickstart

> Minimal Solidity-level reference for agent registration and value transfer. For full SDK usage, see [agent-onboarding.md](agent-onboarding.md).

---

## Step 1 — Register
```solidity
registerAgent("ipfs://<metadata-cid>")
```

## Step 2 — Fund Escrow
```solidity
depositNativeToEscrow{ value: 0.1 ether }()
// Fee (~0.05%) deducted automatically
```

## Step 3 — Discover
```solidity
getRegisteredAgents(0, 50) // → (address[], string[], uint256 total)
```

## Step 4 — Transfer
```solidity
transferNativeBetweenAgents(recipientAddr, 0.01 ether, "payment for service")
```

## Step 5 — Payment Requests
```solidity
// Requester creates:
createAgentPaymentRequest(payerAddr, address(0), 0.05 ether, true, "Invoice #42")
// Payer settles:
settleAgentPaymentRequest{ value: 0.05 ether }(requestId)
```

## Fee Behavior
- All transfers deduct `cybereumFeeBps` (default 5 bps = 0.05%)
- Minimum fee: 1 wei (even if calculated fee rounds to zero)
- NFT transfers: flat fee of `assetTransferFlatFeeWei`
- Preview: `previewFee(amount) → (fee, net)`

---

## Backlinks

- [agent-onboarding.md](agent-onboarding.md) — Full onboarding guide
- [../protocol/contract-reference.md](../protocol/contract-reference.md) — Complete function reference

---
*Source: AGENT_TX_QUICKSTART.md*
*Last updated: 2026-04-05*
