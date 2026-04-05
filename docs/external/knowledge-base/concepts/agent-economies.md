# Agent Economies

> The emerging field of autonomous AI agent economic systems: discovery, settlement, trust, and coordination.

---

## What is an Agent Economy?

An agent economy is a system where autonomous software agents (AI models, bots, oracles, services) transact with each other and with humans using programmable money and enforceable agreements. The settlement layer replaces human intermediaries with smart contracts.

## Core Components

### 1. Identity & Registration
- Agents need on-chain identity to be discoverable and accountable
- Metadata (capabilities, pricing, model info) published to IPFS or similar
- Project_DAO: `registerAgent(metadataURI)`, capability-indexed discovery

### 2. Discovery
- Agents find each other by capability, not by knowing addresses in advance
- Capability registry: `setAgentCapabilities(["payment-settlement", "data-oracle"])`
- Paginated discovery: `discoverAgentsByCapability("data-oracle", offset, limit)`

### 3. Settlement
- Escrow-based: agents deposit value, transfer net of fees, withdraw
- Invoice-based: `createPaymentRequest` → `settlePaymentRequest`
- Streaming: time-based recurring payments for ongoing services
- Conditional: service agreements with proof of delivery and dispute resolution

### 4. Communication
- On-chain encrypted messaging for coordination
- Content hashing for integrity verification
- No external messaging infrastructure required

### 5. Trust & Reputation
- Stake-based skin-in-the-game (stakeAndJoin)
- Transaction history on-chain (event audit trail)
- Future: reputation scoring based on settlement history

## Why On-chain?

| Property | Off-chain | On-chain |
|---|---|---|
| Enforcement | Trust-based / legal | Code-enforced |
| Transparency | Opaque | Auditable |
| Composability | API-specific | Universal interface |
| Availability | Depends on provider | 24/7 as long as chain lives |
| Cost | API fees | Gas fees |
| Speed | Milliseconds | Seconds to minutes |

The trade-off is speed/cost vs. enforcement/transparency. For high-value or low-trust interactions, on-chain settlement is worth the gas cost.

## Current Landscape (2026)

### Protocols
- **Project_DAO / Cybereum**: Settlement layer with escrow, payments, messaging, discovery
- **Autonolas (OLAS)**: Multi-agent service framework with off-chain coordination
- **Fetch.ai**: Agent marketplace with DeltaV search and discovery
- **SingularityNET (AGIX)**: AI service marketplace with staking

### Emerging Patterns
- **Agent-to-agent payment channels**: Off-chain high-frequency settlements with on-chain finality
- **Reputation-weighted pricing**: Better-reputed agents charge more / get priority
- **Multi-agent workflows**: Complex tasks decomposed across specialist agents
- **Agent DAOs**: Agents governing shared infrastructure collectively

## Open Research Questions

1. How should agent reputation decay over time?
2. Can zero-knowledge proofs enable private agent transactions while preserving auditability?
3. What's the optimal fee model for agent microtransactions?
4. How do you prevent agent collusion in multi-agent governance?
5. What identity standards work for agents that may be ephemeral or multi-instance?

---

## Backlinks

- [../../protocol/architecture.md](../../protocol/architecture.md) — Project_DAO's agent economy implementation
- [../../guides/agent-onboarding.md](../../guides/agent-onboarding.md) — Practical agent onboarding
- [../../agents/_index.md](../../agents/_index.md) — Full agent SDK knowledge base (workflows, recipes, patterns)
- [dao-governance.md](dao-governance.md) — Governance in agent context
- [escrow-patterns.md](escrow-patterns.md) — Settlement mechanics
- [../research/ai-agent-protocols.md](../research/ai-agent-protocols.md) — Research frontiers

---
*Last updated: 2026-04-05*
