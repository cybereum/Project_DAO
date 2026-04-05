# L2 Scaling

> Layer 2 rollup technologies, deployment considerations, and the path from L1 to Base/Arbitrum.

---

## Why L2 for Project_DAO?

Two reasons:
1. **Contract size**: At ~124 KB source (~53 KB bytecode), Project_DAO far exceeds the 24 KB EIP-170 limit on L1. Some L2s have higher or no contract size limits.
2. **Gas costs**: Agent-to-agent microtransactions need low gas to be economically viable.

## Rollup Taxonomy

### Optimistic Rollups
- **How**: Execute transactions off-chain, post data to L1. Assume validity unless challenged (fraud proof).
- **Finality**: ~7 days for L1 finality (challenge period). Fast finality within L2.
- **Examples**: Arbitrum, Optimism, Base
- **Pros**: EVM-equivalent, mature tooling, large ecosystem
- **Cons**: Long withdrawal times without bridges

### ZK Rollups
- **How**: Execute off-chain, generate validity proof (ZK-SNARK/STARK), verify proof on L1.
- **Finality**: Minutes (once proof is verified on L1).
- **Examples**: zkSync Era, Scroll, Linea, Polygon zkEVM, StarkNet
- **Pros**: Fast finality, mathematical security guarantees
- **Cons**: Proving overhead, less mature EVM compatibility (improving rapidly)

## Target L2s for Project_DAO

### Base (Primary Target)
- **Type**: Optimistic rollup (OP Stack, Coinbase)
- **Chain ID**: 8453
- **Contract size limit**: Same as L1 (24 KB) — still needs splitting
- **Gas**: ~$0.01-0.05 per transaction
- **SDK**: Already configured with `chainId: 8453` in examples
- **Advantage**: Large user base, Coinbase on-ramp, growing DeFi ecosystem

### Arbitrum (Secondary)
- **Type**: Optimistic rollup (Nitro)
- **Chain ID**: 42161
- **Contract size limit**: 24 KB default, can be increased with Stylus
- **Gas**: ~$0.01-0.10 per transaction
- **Advantage**: Largest L2 by TVL, strong DeFi ecosystem

## Deployment Considerations

1. **Contract splitting required** regardless of L2 (most enforce 24 KB). See [../patterns/diamond-proxy.md](diamond-proxy.md).
2. **Bridge selection** for cross-chain asset movement (native bridges vs. third-party)
3. **Oracle availability** if needed for future features
4. **Block time differences** affect voting windows and payment stream calculations
5. **Sequencer centralization** — most L2 sequencers are centralized; affects censorship resistance

## Gas Cost Comparison (Approximate, 2026)

| Operation | Ethereum L1 | Base | Arbitrum |
|---|---|---|---|
| Agent registration | $5-20 | $0.01-0.05 | $0.02-0.10 |
| ETH transfer | $2-10 | $0.005-0.02 | $0.01-0.05 |
| Payment request | $3-15 | $0.01-0.03 | $0.02-0.08 |

---

## Backlinks

- [../../protocol/audit-findings.md](../dev/audit-findings.md) — C-1: contract size blocker
- [../../product/roadmap.md](../planning/roadmap.md) — WS6: L2 deployment
- [../patterns/diamond-proxy.md](diamond-proxy.md) — Contract splitting for size limit
- [cross-chain-interop.md](cross-chain-interop.md) — Multi-chain considerations

---
*Last updated: 2026-04-05*
