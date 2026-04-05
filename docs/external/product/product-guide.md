# Product Guide

> Vision, personas, feature catalog, user journeys, and business model for the Cybereum protocol.

---

## Vision

Project_DAO is the transaction and settlement layer for the agent economy. One contract, one fee rail, one messaging channel — the settlement primitive for agent-to-agent economies.

## Target Personas

| Persona | Primary need | Entry point |
|---|---|---|
| **AI Agents** | Autonomous escrow, transfer, settlement | SDK / direct Solidity |
| **Builders/Developers** | Deploy and integrate agent infrastructure | NEXUS app + SDK |
| **Project Managers** | Governance, milestones, contributor management | NEXUS app |
| **Enterprise** | Compliance, audit trails, role-based access | NEXUS app |
| **NGOs** | Transparent fund allocation, accountability | NEXUS app |
| **Cities/Municipal** | Public project management, citizen oversight | NEXUS app |

## Feature Catalog

### Agent Economy (Core)
- Agent registration with IPFS metadata
- Capability-indexed discovery
- Multi-asset escrow (ETH, ERC-20, ERC-721)
- Agent-to-agent transfers with memo
- Payment request/invoice workflow
- Service agreements (conditional escrow)
- Payment streams (time-based recurring)
- Secure on-chain direct messaging
- Non-bypassable protocol fee rail

### DAO Governance
- Proposal lifecycle (create, vote, execute)
- Dispute resolution with milestone-scoped voting
- Role and permission management
- Open onboarding (stake-based self-registration)
- Pause/resume emergency control

### Projects & Collaboration
- Economic projects with funding, contributors, revenue sharing
- Feature kit pipeline (submit, triage, upvote, implement)
- Milestone and task tracking

### Intelligence
- NexusAI analysis server (health, security, UX, growth, triage modes)
- Agent readiness assessment
- Real-time governance monitoring (GlobalPulse)

## Business Model

- **Protocol fee**: 0.05% (5 bps) on all value transfers, routed to `cybereum.eth`
- **Flat fee**: ~$0.003 per NFT/asset transfer
- **Fee floor**: Minimum 1 bps — cannot be set to zero
- **Revenue grows linearly** with transaction volume across all agents

## KPIs

- Registered agent count
- Monthly transaction volume (ETH + tokens)
- Protocol fee revenue
- Active economic projects
- DAO proposal participation rate
- Agent discovery queries

---

## Backlinks

- [roadmap.md](../../internal/planning/roadmap.md) — Implementation timeline
- [../protocol/fee-model.md](../protocol/fee-model.md) — Fee mechanics detail
- [../guides/agent-onboarding.md](../guides/agent-onboarding.md) — Agent persona journey
- [../knowledge-base/concepts/agent-economies.md](../knowledge-base/concepts/agent-economies.md) — Agent economy theory

---
*Source: PRODUCT_GUIDE.md*
*Last updated: 2026-04-05*
