# Project_DAO Knowledge Base

> **LLM-maintained knowledge base for the Cybereum protocol, NEXUS app, and agent economy.**
> This wiki is designed for both human and AI agent consumption. Index files (`_index.md`) in each directory provide summaries and navigation for LLM context efficiency.

---

## How This Knowledge Base Works

This follows the **LLM knowledge base pattern**: structured markdown files organized into a navigable wiki, with index files for fast discovery, cross-links between related topics, and a raw ingestion pipeline for new material.

- **Index files** (`_index.md`) in each directory list all articles with one-line summaries — LLMs read these first to decide what to deep-dive into
- **Backlinks** at the bottom of each article connect related topics
- **Raw intake** (`raw/`) is where new source material lands before being compiled into the wiki
- **Reviews and TODOs** are tracked centrally and linked from relevant articles
- The knowledge base grows incrementally — new articles are added as the project evolves

---

## Directory Map

```
docs/
├── README.md                ← YOU ARE HERE — master index
├── _todo.md                 ← Centralized TODO/roadmap tracker
├── _reviews.md              ← Review log (audits, code reviews, doc reviews)
│
├── protocol/                ← Core protocol design & architecture
│   ├── _index.md
│   ├── architecture.md      ← System architecture & contract structure
│   ├── fee-model.md         ← Cybereum fee rail design
│   ├── security-model.md    ← Access control, reentrancy, threat model
│   ├── contract-reference.md ← Function signatures & state reference
│   └── audit-findings.md    ← Security audit findings & status
│
├── guides/                  ← Audience-oriented how-to guides
│   ├── _index.md
│   ├── agent-onboarding.md  ← AI agent getting-started
│   ├── agent-quickstart.md  ← Minimal Solidity-level quickstart
│   ├── builder-integration.md ← Developer integration checklist
│   ├── operations.md        ← Day-to-day operational procedures
│   └── testing.md           ← Test architecture & writing tests
│
├── product/                 ← Product, business & project management
│   ├── _index.md
│   ├── product-guide.md     ← Vision, personas, features, KPIs
│   ├── roadmap.md           ← Implementation plan & work streams
│   ├── changelog.md         ← Version history
│   └── deployment-readiness.md ← Production readiness scorecard
│
├── knowledge-base/          ← Growing wiki of relevant topics
│   ├── _index.md            ← Master topic index
│   ├── concepts/            ← Core technical concepts
│   │   ├── _index.md
│   │   ├── dao-governance.md
│   │   ├── escrow-patterns.md
│   │   ├── agent-economies.md
│   │   ├── smart-contract-security.md
│   │   ├── fee-rail-design.md
│   │   └── token-standards.md
│   ├── research/            ← Emerging tech & research directions
│   │   ├── _index.md
│   │   ├── l2-scaling.md
│   │   ├── account-abstraction.md
│   │   ├── ai-agent-protocols.md
│   │   ├── cross-chain-interop.md
│   │   └── formal-verification.md
│   ├── patterns/            ← Design patterns & best practices
│   │   ├── _index.md
│   │   ├── diamond-proxy.md
│   │   ├── reentrancy-guards.md
│   │   ├── access-control-patterns.md
│   │   └── upgradeable-contracts.md
│   └── references/          ← Standards, frameworks & external refs
│       ├── _index.md
│       ├── eip-standards.md
│       ├── openzeppelin-library.md
│       └── project-management-governance.md
│
└── raw/                     ← Raw ingested material (articles, notes, papers)
    └── _index.md            ← Intake log & processing status
```

---

## Quick Navigation

| I want to... | Go to |
|---|---|
| Understand the protocol architecture | [protocol/architecture.md](protocol/architecture.md) |
| Onboard an AI agent | [guides/agent-onboarding.md](guides/agent-onboarding.md) |
| Review audit findings | [protocol/audit-findings.md](protocol/audit-findings.md) |
| Check production readiness | [product/deployment-readiness.md](product/deployment-readiness.md) |
| See the project roadmap | [product/roadmap.md](product/roadmap.md) |
| Track open TODOs | [_todo.md](_todo.md) |
| Review recent reviews | [_reviews.md](_reviews.md) |
| Learn about DAO governance theory | [knowledge-base/concepts/dao-governance.md](knowledge-base/concepts/dao-governance.md) |
| Research L2 scaling options | [knowledge-base/research/l2-scaling.md](knowledge-base/research/l2-scaling.md) |
| Understand the Diamond proxy pattern | [knowledge-base/patterns/diamond-proxy.md](knowledge-base/patterns/diamond-proxy.md) |
| Add new source material | [raw/_index.md](raw/_index.md) |

---

## Relationship to Root-Level Docs

The root-level `.md` files (README.md, CLAUDE.md, etc.) remain the **primary entry points** for developers and AI agents cloning the repo. This `docs/` knowledge base is a **deeper, cross-linked, and growing** companion that:

- Organizes the same information by topic rather than by audience
- Adds theoretical and research context that doesn't belong in operational docs
- Tracks reviews, TODOs, and ongoing investigations
- Serves as a queryable wiki for LLM-assisted research and Q&A

---

## Contributing to the Knowledge Base

### For LLM agents
1. Drop new source material into `raw/` and update `raw/_index.md`
2. Compile relevant content into the appropriate section
3. Update the section's `_index.md` with a one-line summary
4. Add backlinks to related articles
5. Run a periodic health check: look for broken links, stale content, missing cross-references

### For humans
1. Use Obsidian or any markdown editor to browse and edit
2. The `_index.md` files serve as table-of-contents for each section
3. File issues or add TODOs to `_todo.md` for things that need attention

---

*Last updated: 2026-04-05*
*Articles: 27 | Sections: 4 | Knowledge base topics: 15*
