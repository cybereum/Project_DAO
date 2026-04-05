# Cross-Chain Interoperability

> Bridges, messaging protocols, and chain abstraction for multi-chain agent economies.

---

## Why Cross-Chain?

As Project_DAO deploys to L2s (Base, Arbitrum), agents on different chains need to interact. Cross-chain interop enables:
- Agent discovery across chains
- Cross-chain escrow and settlement
- Unified identity regardless of deployment chain

## Approaches

### Bridges (Asset Transfer)
- **Lock-and-mint**: Lock on source chain, mint wrapped asset on target
- **Burn-and-mint**: Burn on source, mint native on target (requires issuance control)
- **Liquidity pools**: Swap across chains via shared pools (Stargate, Across)
- **Risk**: Bridge hacks are the largest source of DeFi losses ($2B+ in 2022-2023)

### Messaging Protocols (Arbitrary Data)
- **LayerZero**: Omnichain messaging with configurable security (DVNs)
- **Chainlink CCIP**: Cross-chain interoperability protocol with rate limiting
- **Hyperlane**: Permissionless interchain messaging with ISMs (Interchain Security Modules)
- **Wormhole**: Guardian-validated cross-chain messaging
- **Axelar**: General message passing with PoS validator set

### Chain Abstraction
- **Emerging paradigm**: Users/agents interact with a unified interface; routing happens automatically
- **Projects**: Socket (modular ordering), Particle Network (universal accounts), NEAR chain abstraction
- **Goal**: Agents shouldn't need to know which chain they're on

## Relevance to Project_DAO

### Near-term (Single L2)
- Deploy to Base with SDK pre-configured for `chainId: 8453`
- No cross-chain needed initially

### Medium-term (Multi-L2)
- Deploy to Base + Arbitrum
- Agent identity needs to be consistent across deployments
- Option A: Separate agent registries, cross-referenced via messaging protocol
- Option B: Single canonical registry on one chain, with light verification on others

### Long-term (Chain-Abstracted)
- Agents register once, discoverable from any chain
- Cross-chain payment streams and service agreements
- Unified escrow balance across deployments

## Design Considerations

1. **Canonical deployment**: Which chain holds the source of truth for agent identity?
2. **Fee collection**: Do cross-chain transfers pay fees on source, destination, or both?
3. **Latency**: Cross-chain messages take minutes to hours (depending on finality)
4. **Security**: Bridge/messaging protocol security is only as strong as its weakest validator set

---

## Backlinks

- [l2-scaling.md](l2-scaling.md) — L2 deployment specifics
- [../concepts/agent-economies.md](../concepts/agent-economies.md) — Multi-chain agent implications
- [ai-agent-protocols.md](ai-agent-protocols.md) — How other protocols handle multi-chain
- [../../product/roadmap.md](../../product/roadmap.md) — WS6: deployment planning

---
*Last updated: 2026-04-05*
