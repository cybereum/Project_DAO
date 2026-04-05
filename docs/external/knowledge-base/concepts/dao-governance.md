# DAO Governance

> Decentralized Autonomous Organization governance models, voting mechanisms, and dispute resolution — theory and application to Project_DAO.

---

## What is DAO Governance?

DAO governance is the set of rules and processes by which a decentralized organization makes collective decisions without central authority. Decisions are encoded in smart contracts and executed automatically when conditions are met.

## Governance Models

### Token-Weighted Voting
- Each token = one vote. Simple, widely used (Compound, Uniswap, MakerDAO).
- **Pros**: Sybil-resistant, aligns economic incentives.
- **Cons**: Plutocratic — wealthy participants dominate. Low voter turnout is common.
- **Project_DAO uses**: Voting power assigned per member (not proportional to tokens), closer to reputation-weighted.

### Conviction Voting
- Votes accumulate weight over time — the longer you support a proposal, the stronger your vote.
- Designed to prevent last-minute vote swings and flash loan attacks.
- Used by: 1Hive (Gardens), Giveth.

### Optimistic Governance
- Proposals pass automatically unless challenged within a time window.
- Reduces voter fatigue — only contentious proposals need active participation.
- Used by: Optimism (The Optimism Collective), Nouns DAO.

### Quadratic Voting
- Cost of votes increases quadratically: 1 vote = 1 token, 2 votes = 4 tokens, etc.
- Gives minority stakeholders more influence per token.
- Used by: Gitcoin Grants (for funding allocation).

## Dispute Resolution

### On-chain Disputes (Project_DAO)
- `disputeProposal()` creates a dispute with description
- `voteOnProposalDispute()` — milestone-scoped voting eligibility
- Disputes resolved by community vote or owner override
- Limitations: no external arbitration integration (Kleros/Aragon interfaces exist but unused)

### External Arbitration
- **Kleros**: Decentralized court with juror staking and Schelling point mechanism
- **Aragon Court**: Dispute resolution for Aragon DAOs with appeal system
- Project_DAO has interface contracts (`IKleros.sol`, `IAragonCourt.sol`) but no active integration

## Key Challenges in DAO Governance

1. **Voter apathy**: Most DAOs see <10% participation rates
2. **Plutocracy**: Token-weighted voting concentrates power
3. **Governance attacks**: Flash loans to acquire temporary voting power
4. **Execution risk**: On-chain execution of flawed proposals is irreversible
5. **Speed vs. safety**: Fast governance (short voting periods) trades off against deliberation

## Application to Project_DAO

- Uses member-based voting with assigned voting power (not pure token-weighted)
- Time-bounded voting windows with automatic deadline enforcement
- Milestone-scoped dispute voting — only relevant participants can vote
- Owner can resolve disputes (centralization trade-off for early-stage safety)
- `stakeAndJoin` enables permissionless entry with skin-in-the-game

---

## Backlinks

- [../../protocol/architecture.md](../../protocol/architecture.md) — Governance module in system architecture
- [../../protocol/contract-reference.md](../../protocol/contract-reference.md) — Governance function signatures
- [agent-economies.md](agent-economies.md) — Governance in agent-to-agent context
- [../references/project-management-governance.md](../references/project-management-governance.md) — Traditional governance frameworks

---
*Last updated: 2026-04-05*
