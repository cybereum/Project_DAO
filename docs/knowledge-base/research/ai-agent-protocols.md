# AI Agent Protocols

> Competing and complementary protocols in the autonomous agent economy space.

---

## Landscape Overview

The agent economy is emerging as a distinct sector, with protocols tackling different layers: identity, discovery, settlement, coordination, and intelligence.

## Protocols

### Cybereum / Project_DAO (This Project)
- **Focus**: Settlement layer — escrow, transfers, payments, messaging
- **Differentiator**: Non-bypassable fee rail, on-chain discovery, single-contract simplicity
- **Chain**: Base (planned), EVM-compatible
- **Agent SDK**: Headless JS client with auto-discovery

### Autonolas (OLAS)
- **Focus**: Multi-agent service framework with off-chain coordination
- **Architecture**: Agent services run off-chain in Docker containers; on-chain registration and staking
- **Differentiator**: Off-chain computation with on-chain finality, agent staking for service quality
- **Relevance**: Complementary — Autonolas agents could use Project_DAO for settlement

### Fetch.ai (FET)
- **Focus**: Agent marketplace and discovery (DeltaV)
- **Architecture**: Agent communication via OEF (Open Economic Framework), DeltaV for natural language discovery
- **Differentiator**: AI-native search and discovery, consumer-facing agent marketplace
- **Relevance**: Competing discovery layer, but different settlement approach

### SingularityNET (AGIX)
- **Focus**: AI service marketplace with staking and governance
- **Architecture**: Service publishers register on-chain, consumers pay per-call
- **Differentiator**: AI model marketplace (not just agents), cross-chain via bridge
- **Relevance**: Similar marketplace concept, but focused on ML model access rather than agent-to-agent transactions

### Virtuals Protocol
- **Focus**: AI agent tokenization and co-ownership
- **Architecture**: Each agent is a tokenized entity; holders govern the agent's behavior
- **Differentiator**: Agent-as-asset model, revenue sharing with token holders
- **Relevance**: Different paradigm (agent ownership vs. agent settlement)

### AI16Z / ElizaOS
- **Focus**: Open-source AI agent framework
- **Architecture**: Plugin-based agent runtime with social media and blockchain integrations
- **Differentiator**: Open-source, community-driven, rapid iteration
- **Relevance**: Agent runtime that could integrate with Project_DAO for settlement

## Positioning Matrix

| Protocol | Settlement | Discovery | Coordination | Identity | Governance |
|---|---|---|---|---|---|
| Project_DAO | ★★★ | ★★ | ★ | ★★ | ★★★ |
| Autonolas | ★ | ★★ | ★★★ | ★★ | ★★ |
| Fetch.ai | ★ | ★★★ | ★★ | ★★ | ★ |
| SingularityNET | ★★ | ★★ | ★ | ★ | ★★ |

## Integration Opportunities

1. **Autonolas agents** use Project_DAO as their settlement backend
2. **Fetch.ai DeltaV** discovers Project_DAO-registered agents
3. **ElizaOS plugins** connect to Project_DAO SDK for payments
4. **Cross-protocol** agent identity standards (DID-based)

---

## Backlinks

- [../concepts/agent-economies.md](../concepts/agent-economies.md) — Agent economy fundamentals
- [../../product/product-guide.md](../../product/product-guide.md) — Project_DAO's market position
- [cross-chain-interop.md](cross-chain-interop.md) — Multi-protocol interoperability
- [account-abstraction.md](account-abstraction.md) — Improving agent wallet UX

---
*Last updated: 2026-04-05*
