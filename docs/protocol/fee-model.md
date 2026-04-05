# Cybereum Fee Rail Design

> The non-bypassable fee mechanism that funds the protocol treasury on every value transfer.

---

## Design Principles

1. **Non-bypassable**: Every value-transfer path deducts fees before crediting recipients
2. **Configurable but floored**: Owner can adjust `cybereumFeeBps` but cannot go below `MIN_FEE_BPS = 1`
3. **Transparent**: `previewFee(amount)` lets callers see exact fee + net before transacting
4. **Dual model**: Percentage fee for fungible transfers, flat fee for NFT/asset transfers

## Fee Parameters

| Parameter | Default | Range | Set by |
|---|---|---|---|
| `cybereumFeeBps` | 5 (0.05%) | 1–10,000 | `setCybereumFeeConfig()` (owner) |
| `assetTransferFlatFeeWei` | 1e12 wei (~$0.003) | 0+ | `setCybereumFeeConfig()` (owner) |
| `MIN_FEE_BPS` | 1 | Constant | Immutable |
| `FEE_BPS_DENOMINATOR` | 10,000 | Constant | Immutable |
| `cybereumTreasury` | (set by owner) | Non-zero address | `setCybereumTreasury()` (owner) |

## Fee Calculation

```
fee = (amount * cybereumFeeBps) / FEE_BPS_DENOMINATOR
if (fee == 0) fee = 1  // minimum 1 wei
net = amount - fee
```

In JavaScript (BigInt):
```js
const feeBps = await contract.cybereumFeeBps();
const fee = (amount * feeBps) / 10000n;
const net = fee === 0n ? amount - 1n : amount - fee;
```

## Fee Collection Points

Every value-transfer function routes through `_collectCybereumFee`:

| Function | Fee type | Deducted from |
|---|---|---|
| `depositNativeToEscrow` | Percentage | msg.value |
| `transferNativeBetweenAgents` | Percentage | Sender escrow |
| `depositTokenToEscrow` | Percentage | Token amount |
| `transferTokenBetweenAgents` | Percentage | Sender token escrow |
| `transferAssetBetweenAgents` | Flat fee | msg.value (exact match required) |
| `settleAgentPaymentRequest` | Percentage | Settlement amount |
| `fundProject` | Percentage | msg.value |
| `createServiceAgreement` | Percentage | Escrow lock amount |
| `createPaymentStream` | Percentage | Stream deposit |

## Treasury Routing

```
Fee collected → .call{value: fee}(cybereumTreasury) → CybereumFeePaid event
```

- Treasury address must be non-zero (validated on every fee collection, not just on set)
- Treasury is intended to resolve to `cybereum.eth`
- Both `setCybereumTreasury` and `setCybereumFeeConfig` require `whenNotPaused` (as of v0.5.0)

## Security Considerations

- Fee deduction happens **before** value transfer — no path skips the fee
- `MIN_FEE_BPS = 1` is a compile-time constant, not owner-configurable
- Minimum 1 wei fee applies even when calculated fee rounds to zero
- Fee transfer uses `.call{value:}()` with explicit revert on failure (not `.transfer()`)

---

## Backlinks

- [architecture.md](architecture.md) — Where fee rail sits in overall system
- [../knowledge-base/concepts/fee-rail-design.md](../knowledge-base/concepts/fee-rail-design.md) — Theory of protocol fee models
- [audit-findings.md](audit-findings.md) — Fee-related audit findings
- [contract-reference.md](contract-reference.md) — Full function signatures

---
*Source: contracts/Project_DAO.sol, CLAUDE.md §5*
*Last updated: 2026-04-05*
