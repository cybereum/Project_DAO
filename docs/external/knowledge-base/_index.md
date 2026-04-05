# Knowledge Base

> Growing wiki of technical concepts, research directions, design patterns, and external references relevant to the Cybereum protocol and agent economy.

This section follows the **LLM knowledge base pattern**: articles are maintained and cross-linked by AI agents, with index files for efficient navigation. New topics are added as the project evolves.

---

## Sections

### [concepts/](concepts/_index.md) — Core Technical Concepts
Foundational topics that underpin the protocol: DAO governance, escrow patterns, agent economies, smart contract security, fee design, token standards.

### [research/](research/_index.md) — Emerging Technology & Research (Public)
Public research articles: AI agent protocols and market positioning. Additional architecture research (L2 scaling, account abstraction, cross-chain, formal verification) is in [internal/architecture/](../../internal/architecture/).

### [patterns/](patterns/_index.md) — Design Patterns & Best Practices
Proven patterns used or planned for the protocol: reentrancy guards, access control, upgradeable contracts. The Diamond proxy pattern (needed for mainnet deployment) is in [internal/architecture/diamond-proxy.md](../../internal/architecture/diamond-proxy.md).

### [references/](references/_index.md) — Standards, Frameworks & External Resources
EIP standards, OpenZeppelin library, project management and governance frameworks.

---

## Article Count by Section

| Section | Articles | Last updated |
|---|---|---|
| concepts/ | 6 | 2026-04-05 |
| research/ | 1 | 2026-04-05 |
| patterns/ | 3 | 2026-04-05 |
| references/ | 3 | 2026-04-05 |
| **Total** | **13** | |

> 5 research/architecture articles moved to [internal/architecture/](../../internal/architecture/) — see [internal docs index](../../internal/_index.md).

## How to Add a New Article

1. Identify the best section (concept, research, pattern, or reference)
2. Create a `.md` file with frontmatter: title, one-line summary, backlinks
3. Update the section's `_index.md` with the new article
4. Add backlinks from related articles
5. Update this master index article count

## Suggested Future Articles

- MEV (Maximal Extractable Value) and its implications for agent transactions
- Zero-knowledge proofs for private agent-to-agent settlements
- Decentralized identity (DID) standards for agent registration
- Multi-agent coordination protocols (beyond pairwise transactions)
- Gas optimization techniques for large contracts
- Subgraph/indexer architecture for event-driven analytics

---
*Last updated: 2026-04-05*
