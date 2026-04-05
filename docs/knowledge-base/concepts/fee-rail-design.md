# Fee Rail Design

> Theory and practice of protocol fee models: percentage, flat, tiered, dynamic, and non-bypassable architectures.

---

## Why Protocol Fees?

Protocol fees are the primary revenue mechanism for decentralized infrastructure. Unlike SaaS subscriptions, protocol fees are:
- **Permissionless**: Anyone can use the protocol; fees are automatic
- **Proportional**: Revenue scales with usage, not with customer count
- **Non-custodial**: Fees are collected at the contract level, not by a company

## Fee Model Taxonomy

### Percentage (Basis Points)
- Fee = `amount * feeBps / 10000`
- Scales with transaction size — fair for large and small transfers
- Used by: Uniswap (0.3%), Project_DAO (0.05%), OpenSea (2.5%)

### Flat Fee
- Fixed amount per transaction regardless of size
- Better for high-value transfers, regressive for small ones
- Used by: Project_DAO for NFT transfers (`assetTransferFlatFeeWei`)

### Tiered / Volume-Based
- Fee rate decreases with volume (encouraging large usage)
- More complex to implement on-chain
- Used by: CEXs (Binance, Coinbase)

### Dynamic / Auction-Based
- Fee adjusts based on demand, congestion, or market conditions
- Example: Ethereum base fee (EIP-1559)

### Hybrid
- Combine percentage + flat fee, or different models for different asset types
- Project_DAO uses: percentage for fungible, flat for NFTs

## Non-Bypassable Design

The key architectural decision in Project_DAO's fee rail:

1. **Every value-transfer function** routes through `_collectCybereumFee`
2. **No direct transfer path** exists that skips fee collection
3. **Minimum floor** (`MIN_FEE_BPS = 1`) is a compile-time constant
4. **Fee deduction happens before** value reaches recipient — not an opt-in step
5. **Treasury address validated** on every fee collection (not just on set)

This makes the fee rail a **protocol invariant**, not a configurable feature.

## Design Trade-offs

| Decision | Project_DAO choice | Alternative | Trade-off |
|---|---|---|---|
| When to deduct | On deposit/transfer | On withdrawal | Simpler accounting vs. flexibility |
| Fee floor | 1 bps minimum | Zero allowed | Revenue guarantee vs. governance flexibility |
| Treasury mutability | Owner-configurable | Immutable | Operational flexibility vs. trustlessness |
| Fee rate mutability | Owner-configurable (≥1) | Governance vote | Speed vs. decentralization |

## Economic Considerations

- **Too high**: Users route around the protocol or fork it
- **Too low**: Insufficient revenue to sustain development
- **Sweet spot**: Low enough to be invisible (<0.1%), high enough to compound meaningfully
- Project_DAO's 0.05% is in the "invisible fee" range — comparable to interchange fees

---

## Backlinks

- [../../protocol/fee-model.md](../../protocol/fee-model.md) — Project_DAO's implementation
- [escrow-patterns.md](escrow-patterns.md) — Fee integration with escrow
- [agent-economies.md](agent-economies.md) — Fee models in agent context
- [../references/eip-standards.md](../references/eip-standards.md) — EIP-1559 dynamic fees

---
*Last updated: 2026-04-05*
