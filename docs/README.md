# Project_DAO Knowledge Base

> **LLM-maintained knowledge base for the Cybereum protocol, NEXUS app, and agent economy.**
> This wiki is designed for both human and AI agent consumption. Index files (`_index.md`) in each directory provide summaries and navigation for LLM context efficiency.

---

## How This Knowledge Base Works

This follows the **LLM knowledge base pattern**: structured markdown files organized into a navigable wiki, with index files for fast discovery, cross-links between related topics, and a raw ingestion pipeline for new material.

- **Index files** (`_index.md`) in each directory list all articles with one-line summaries — LLMs read these first to decide what to deep-dive into
- **Backlinks** at the bottom of each article connect related topics
- **Raw intake** (`internal/raw/`) is where new source material lands before being compiled into the wiki
- **Reviews and TODOs** are tracked centrally in `internal/` and linked from relevant articles
- The knowledge base grows incrementally — new articles are added as the project evolves

---

## External / Internal Split

Documentation is split into two top-level directories:

- **`external/`** — Public-facing docs safe to share: protocol design, integration guides, agent knowledge base, product info, technical wiki
- **`internal/`** — Internal-only docs: TODOs, reviews, audit findings, roadmap, deployment readiness, architecture research, raw intake

---

## Directory Map

```
docs/
├── README.md                          ← YOU ARE HERE — master index
│
├── external/                          ← PUBLIC-FACING DOCUMENTATION
│   ├── _index.md                      ← External docs index
│   │
│   ├── protocol/                      ← Core protocol design & architecture
│   │   ├── _index.md
│   │   ├── architecture.md            ← System architecture & contract structure
│   │   ├── fee-model.md               ← Cybereum fee rail design
│   │   ├── security-model.md          ← Access control, reentrancy, threat model
│   │   └── contract-reference.md      ← Function signatures & state reference
│   │
│   ├── guides/                        ← Audience-oriented how-to guides
│   │   ├── _index.md
│   │   ├── agent-onboarding.md        ← AI agent getting-started
│   │   ├── agent-quickstart.md        ← Minimal Solidity-level quickstart
│   │   ├── builder-integration.md     ← Developer integration checklist
│   │   └── operations.md              ← Day-to-day operational procedures
│   │
│   ├── product/                       ← Product & business (public)
│   │   ├── _index.md
│   │   ├── product-guide.md           ← Vision, personas, features, KPIs
│   │   └── changelog.md               ← Version history
│   │
│   ├── agents/                        ← AGENT KNOWLEDGE BASE (SDK + contract usage)
│   │   ├── _index.md                  ← Agent KB master index
│   │   ├── workflows/                 ← Step-by-step operational workflows
│   │   │   ├── onboarding.md          ← Zero-to-transacting flow
│   │   │   ├── escrow.md              ← Deposit, withdraw, transfer
│   │   │   ├── payments.md            ← Payment requests & batch settlement
│   │   │   ├── messaging.md           ← Secure direct messaging
│   │   │   ├── discovery.md           ← Agent discovery & evaluation
│   │   │   └── metadata.md            ← Metadata schema & IPFS publishing
│   │   ├── recipes/                   ← Copy-paste code for specific tasks
│   │   │   ├── service-agreements.md  ← Conditional escrow
│   │   │   ├── payment-streams.md     ← Recurring payments
│   │   │   ├── event-listeners.md     ← Event-driven agents
│   │   │   ├── fee-optimization.md    ← Fee calculation & batching
│   │   │   └── reputation.md          ← Reputation system
│   │   ├── troubleshooting/           ← Error reference & debugging
│   │   │   ├── error-reference.md     ← Every SDK/contract error
│   │   │   ├── common-issues.md       ← FAQ
│   │   │   └── security.md            ← Agent security practices
│   │   └── patterns/                  ← Advanced multi-agent patterns
│   │       ├── multi-agent.md         ← Coordination & delegation
│   │       └── autonomous-loop.md     ← Event-driven agent architecture
│   │
│   └── knowledge-base/                ← Growing wiki of relevant topics
│       ├── _index.md                  ← Master topic index
│       ├── concepts/                  ← Core technical concepts
│       │   ├── dao-governance.md
│       │   ├── escrow-patterns.md
│       │   ├── agent-economies.md
│       │   ├── smart-contract-security.md
│       │   ├── fee-rail-design.md
│       │   └── token-standards.md
│       ├── research/                  ← Emerging tech (public)
│       │   └── ai-agent-protocols.md
│       ├── patterns/                  ← Design patterns
│       │   ├── reentrancy-guards.md
│       │   ├── access-control-patterns.md
│       │   └── upgradeable-contracts.md
│       └── references/                ← Standards & external refs
│           ├── eip-standards.md
│           ├── openzeppelin-library.md
│           └── project-management-governance.md
│
└── internal/                          ← INTERNAL-ONLY DOCUMENTATION
    ├── _index.md                      ← Internal docs index
    ├── _todo.md                       ← Centralized TODO/roadmap tracker
    ├── _reviews.md                    ← Review log (audits, code reviews)
    │
    ├── dev/                           ← Development & security
    │   ├── audit-findings.md          ← Security audit findings & status
    │   └── testing.md                 ← Test architecture & writing tests
    │
    ├── planning/                      ← Planning & readiness
    │   ├── roadmap.md                 ← Implementation plan & work streams
    │   └── deployment-readiness.md    ← Production readiness scorecard
    │
    ├── architecture/                  ← Architecture research
    │   ├── diamond-proxy.md           ← EIP-2535 contract splitting
    │   ├── l2-scaling.md              ← L2 rollup deployment
    │   ├── account-abstraction.md     ← ERC-4337 smart accounts
    │   ├── cross-chain-interop.md     ← Multi-chain bridges
    │   └── formal-verification.md     ← Contract correctness proofs
    │
    └── raw/                           ← Raw ingested material
        ├── raw/_index.md              ← General intake log
        └── agents/_index.md           ← Agent-specific intake log
```

---

## Quick Navigation

| I want to... | Go to |
|---|---|
| Understand the protocol architecture | [external/protocol/architecture.md](external/protocol/architecture.md) |
| Onboard an AI agent (quick) | [external/guides/agent-onboarding.md](external/guides/agent-onboarding.md) |
| **Full agent SDK knowledge base** | [external/agents/_index.md](external/agents/_index.md) |
| Agent onboarding (code-first) | [external/agents/workflows/onboarding.md](external/agents/workflows/onboarding.md) |
| Debug an agent error | [external/agents/troubleshooting/error-reference.md](external/agents/troubleshooting/error-reference.md) |
| Multi-agent coordination | [external/agents/patterns/multi-agent.md](external/agents/patterns/multi-agent.md) |
| Review audit findings | [internal/dev/audit-findings.md](internal/dev/audit-findings.md) |
| Check production readiness | [internal/planning/deployment-readiness.md](internal/planning/deployment-readiness.md) |
| See the project roadmap | [internal/planning/roadmap.md](internal/planning/roadmap.md) |
| Track open TODOs | [internal/_todo.md](internal/_todo.md) |
| Review recent reviews | [internal/_reviews.md](internal/_reviews.md) |
| Learn about DAO governance theory | [external/knowledge-base/concepts/dao-governance.md](external/knowledge-base/concepts/dao-governance.md) |
| Research L2 scaling options | [internal/architecture/l2-scaling.md](internal/architecture/l2-scaling.md) |
| Understand the Diamond proxy pattern | [internal/architecture/diamond-proxy.md](internal/architecture/diamond-proxy.md) |
| Add new source material | [internal/raw/raw/_index.md](internal/raw/raw/_index.md) |

---

## Relationship to Root-Level Docs

The root-level `.md` files (README.md, CLAUDE.md, etc.) remain the **primary entry points** for developers and AI agents cloning the repo. This `docs/` knowledge base is a **deeper, cross-linked, and growing** companion that:

- Organizes the same information by topic rather than by audience
- Separates public-facing docs (`external/`) from internal planning (`internal/`)
- Adds theoretical and research context that doesn't belong in operational docs
- Tracks reviews, TODOs, and ongoing investigations
- Serves as a queryable wiki for LLM-assisted research and Q&A

---

## Contributing to the Knowledge Base

### For LLM agents
1. Drop new source material into `internal/raw/` and update the intake log
2. Compile relevant content into the appropriate section (`external/` for public, `internal/` for private)
3. Update the section's `_index.md` with a one-line summary
4. Add backlinks to related articles
5. Run a periodic health check: look for broken links, stale content, missing cross-references

### For humans
1. Use Obsidian or any markdown editor to browse and edit
2. The `_index.md` files serve as table-of-contents for each section
3. File issues or add TODOs to `internal/_todo.md` for things that need attention

---

*Last updated: 2026-04-05*
*External articles: 40 | Internal articles: 13 | Total: 53*
