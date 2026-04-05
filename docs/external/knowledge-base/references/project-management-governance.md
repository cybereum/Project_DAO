# Project Management & Governance Frameworks

> Traditional and emerging frameworks applicable to DAO operations, milestone tracking, and decentralized project coordination.

---

## Traditional PM Frameworks

### Agile / Scrum
- **Relevance**: Sprint-based development, iterative delivery, stakeholder feedback
- **DAO application**: Proposal-driven sprints — each proposal is a mini-sprint with deliverables
- **Mapping**: Proposals → sprint goals, milestones → epics, tasks → user stories

### Kanban
- **Relevance**: Visual workflow, WIP limits, continuous delivery
- **DAO application**: Feature kit pipeline (Pending → Validated → Queued → Implemented)
- **Mapping**: Feature kits follow a Kanban lifecycle with status transitions

### PRINCE2
- **Relevance**: Stage-gate governance, business case justification, defined roles
- **DAO application**: Economic projects with stages (Open → Active → Completed)
- **Mapping**: Project proposals include budget, deadline, contributor approval gates

### PMI/PMBOK
- **Relevance**: Scope, time, cost, quality, risk, stakeholder management
- **DAO application**: Economic projects track budget (targetBudget), time (deadline), and contributors
- **Gap**: No formal risk register or quality metrics on-chain

## Governance Frameworks

### Corporate Governance (Traditional)
- Board of directors → DAO members with voting power
- Shareholder voting → Token/stake-weighted proposals
- Audit committee → On-chain audit trail + external auditors
- Compensation committee → Revenue sharing via contributor shares (BPS)

### Sociocracy / Holacracy
- **Circles**: Self-organizing teams with defined domains
- **Consent-based decisions**: Proposals pass unless there's a "reasoned objection"
- **DAO application**: Role-based permissions with domain scoping (milestone-scoped roles in Project_DAO)
- **Relevance**: More aligned with decentralized governance than hierarchical models

### Ostrom's Principles (Commons Governance)
Elinor Ostrom's 8 principles for managing shared resources — highly relevant to DAOs:

1. **Clear boundaries**: Who is a member (stakeAndJoin with minimum stake)
2. **Proportional rules**: Voting power proportional to stake/contribution
3. **Collective choice**: Members participate in rule-making (proposals)
4. **Monitoring**: On-chain event audit trail, GlobalPulse dashboard
5. **Graduated sanctions**: Not yet implemented (potential future: reputation decay)
6. **Conflict resolution**: Dispute mechanism (disputeProposal + voting)
7. **Organizational autonomy**: DAO operates independently (pauseContract for self-protection)
8. **Nested governance**: Milestone-scoped voting is a form of nested governance

### Futarchy
- "Vote on values, bet on beliefs" — Robin Hanson
- Governance decisions made by prediction markets rather than direct voting
- **Relevance**: Could enhance proposal quality if prediction markets assess outcomes
- **Status**: Experimental (MetaDAO on Solana)

## Dispute Resolution

### Traditional ADR (Alternative Dispute Resolution)
- Negotiation → Mediation → Arbitration → Litigation
- **DAO mapping**: Direct messaging → Dispute proposal → Community vote → Owner override

### On-chain Dispute Resolution
- **Kleros**: Decentralized arbitration with juror staking (Schelling point)
- **Aragon Court**: DAO-specific dispute resolution
- **Project_DAO**: Has interfaces (`IKleros.sol`, `IAragonCourt.sol`) but no active integration
- **Current**: Community vote with owner override as backstop

## Emerging: AI-Assisted Governance

- AI agents analyze proposals for feasibility, cost, and risk before voting
- Automated compliance checking against DAO rules
- NexusAI triage mode already does this for feature kits
- Future: AI agents as voting delegates with predefined policy preferences

---

## Backlinks

- [../concepts/dao-governance.md](../concepts/dao-governance.md) — DAO governance models
- [../../protocol/architecture.md](../../protocol/architecture.md) — Governance module
- [../../product/product-guide.md](../../product/product-guide.md) — Project management features
- [../concepts/agent-economies.md](../concepts/agent-economies.md) — Agent-assisted governance

---
*Last updated: 2026-04-05*
