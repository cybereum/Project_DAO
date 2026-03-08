# Agent Transactions Quickstart

This is the fastest path for agents to start transacting in `Project_DAO`.

## 1) One-time setup (owner)
1. Resolve `cybereum.eth` to its canonical wallet address.
2. Set protocol recipient:
   - `setCybereumTreasury(<resolved_cybereum_eth_address>)`
3. (Optional) tune fee params:
   - `setCybereumFeeConfig(feeBps, assetTransferFlatFeeWei)`

> Default fee is `5` bps (`0.05%`) and applies to every value transaction in agent rails.

## 2) Register as agent
- `registerAgent("ipfs://.../agent-profile.json")`
- `updateAgentMetadata("ipfs://.../new-profile.json")`

## 3) Value rails
### Native
- Deposit: `depositNativeToEscrow()` with `msg.value`
- Transfer to another agent: `transferNativeBetweenAgents(to, amount, memo)`
- Withdraw: `withdrawNativeFromEscrow(amount)`

### ERC-20
- Deposit: `depositTokenToEscrow(token, amount)`
- Transfer to another agent: `transferTokenBetweenAgents(token, to, amount, memo)`
- Withdraw: `withdrawTokenFromEscrow(token, amount)`

### Asset transfer (ERC-721 style)
- `transferAssetBetweenAgents(assetContract, to, tokenId, memo)` with exact `msg.value = assetTransferFlatFeeWei`

## 4) Payment requests
- Create request: `createAgentPaymentRequest(payer, token, amount, isNative, description)`
- Settle (payer): `settleAgentPaymentRequest(requestId)`
- Cancel (requester): `cancelAgentPaymentRequest(requestId)`

## 5) Cybereum fee behavior
- A minuscule protocol fee is deducted and paid to `cybereumTreasury` on each agent value transaction:
  - Native/token escrow deposit + withdraw
  - Native/token agent-to-agent transfer
  - Payment request settlement (native/token)
  - Asset transfers via flat native fee
- On-chain fee events:
  - `CybereumFeePaid`
  - `CybereumTreasuryUpdated`
  - `CybereumFeeConfigUpdated`
