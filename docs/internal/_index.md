# Internal Documentation

> **Internal-only documentation: planning, reviews, audits, architecture research, and raw intake.**
> This directory contains work-in-progress, sensitive findings, and internal planning documents that are NOT intended for external consumption.

---

## Sections

### Project Tracking
| Document | Summary |
|---|---|
| [_todo.md](_todo.md) | Centralized TODO/roadmap tracker with priorities |
| [_reviews.md](_reviews.md) | Review log (audits, code reviews, doc reviews) |

### [dev/](dev/) — Development & Security
| Document | Summary |
|---|---|
| [audit-findings.md](dev/audit-findings.md) | AI-assisted audit: critical, high, medium findings + remediation status |
| [testing.md](dev/testing.md) | Test architecture, coverage map, CI pipeline, writing tests |

### [planning/](planning/) — Planning & Readiness
| Document | Summary |
|---|---|
| [roadmap.md](planning/roadmap.md) | Implementation plan, work streams, gap analysis |
| [deployment-readiness.md](planning/deployment-readiness.md) | Production readiness scorecard (target 95+) |

### [architecture/](architecture/) — Architecture Research
| Document | Summary |
|---|---|
| [diamond-proxy.md](architecture/diamond-proxy.md) | EIP-2535 Diamond pattern for contract splitting (needed for mainnet) |
| [l2-scaling.md](architecture/l2-scaling.md) | L2 rollups, Base/Arbitrum deployment considerations |
| [account-abstraction.md](architecture/account-abstraction.md) | ERC-4337, smart accounts, session keys |
| [cross-chain-interop.md](architecture/cross-chain-interop.md) | Bridges, messaging protocols, chain abstraction |
| [formal-verification.md](architecture/formal-verification.md) | Mathematical proof of contract correctness |

### [raw/](raw/) — Raw Intake Pipeline
| Document | Summary |
|---|---|
| [raw/_index.md](raw/raw/_index.md) | General intake log & processing pipeline |
| [agents/_index.md](raw/agents/_index.md) | Agent-specific intake log |

---

## Article Count

| Section | Articles |
|---|---|
| Project tracking | 2 |
| dev/ | 2 |
| planning/ | 2 |
| architecture/ | 5 |
| raw/ | 2 |
| **Total** | **13** |

## External Docs

Public-facing documentation (protocol, guides, agents, product, knowledge base) is in [../external/](../external/_index.md).

---
*Last updated: 2026-04-05*
