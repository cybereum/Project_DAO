# TODO Tracker

> Centralized task tracking for the Cybereum protocol. Updated by both humans and LLM agents.
> Items link to relevant knowledge base articles for context.

---

## Critical (Blocks Mainnet)

- [ ] **Contract splitting** — Split Project_DAO.sol (~2750 lines, ~53 KB bytecode) into Diamond facets (<24 KB each)
  - See: [knowledge-base/patterns/diamond-proxy.md](knowledge-base/patterns/diamond-proxy.md)
  - Depends on: architectural decision (Diamond vs. library extraction)
  - Effort: Large
  
- [ ] **Professional security audit** — Engage Trail of Bits, OpenZeppelin, Spearbit, or Cyfrin
  - See: [protocol/audit-findings.md](protocol/audit-findings.md)
  - Budget: $15K–$50K
  - Depends on: contract splitting (audit final form, not current)
  - Effort: External

## High Priority

- [ ] **Timelock/multisig on owner functions** — setCybereumTreasury, setCybereumFeeConfig
  - See: [knowledge-base/patterns/access-control-patterns.md](knowledge-base/patterns/access-control-patterns.md)
  - Quick win: Deploy Gnosis Safe as owner (no contract changes)
  - Effort: Small–Medium

- [ ] **Event indexer/subgraph** — Protocol analytics and historical query support
  - See: [product/roadmap.md](product/roadmap.md) (WS3)
  - Options: The Graph subgraph, Ponder, custom indexer
  - Effort: Medium

- [ ] **L2 deployment** — Deploy to Base (primary) and Arbitrum (secondary)
  - See: [knowledge-base/research/l2-scaling.md](knowledge-base/research/l2-scaling.md)
  - Depends on: contract splitting
  - Effort: Medium

- [ ] **Static analysis in CI** — Add Slither to CI pipeline
  - See: [product/deployment-readiness.md](product/deployment-readiness.md)
  - Effort: Small

## Medium Priority

- [ ] **Server-side owner dashboard auth** — Replace client-side passcode
  - Current: `VITE_OWNER_DASHBOARD_PASSCODE` (insecure)
  - Effort: Medium

- [ ] **Frontend E2E tests** — Playwright or Cypress for contract integration
  - See: [guides/testing.md](guides/testing.md)
  - Effort: Medium

- [ ] **NexusAI rate limiting** — Prevent abuse of AI analysis endpoint
  - Effort: Small

- [ ] **IPFS metadata pinning** — Replace `data:` URIs in feature kits
  - Effort: Small

- [ ] **Pool segregation** — Separate escrow, project, and stake ETH accounting
  - See: [protocol/audit-findings.md](protocol/audit-findings.md) (C-2)
  - Depends on: contract splitting (can be part of refactor)
  - Effort: Medium

## Low Priority

- [ ] **TypeScript migration** — SDK and frontend
  - Effort: Large
  
- [ ] **Broadcast notification panel** — In-app notifications for agent broadcasts
  - Effort: Small

- [ ] **Prerender/SSR** — For public-facing routes (SEO)
  - Effort: Medium

## Completed (Recent)

- [x] `nonReentrant` on `depositTokenToEscrow` (v0.5.0, 2026-04-03)
- [x] `whenNotPaused` on owner config functions (v0.5.0, 2026-04-03)
- [x] SDK `_validateMetadataURI()` (v0.5.0, 2026-04-03)
- [x] Per-route `RouteErrorBoundary` (v0.5.0, 2026-04-03)
- [x] `txPending` reset on wallet disconnect (v0.5.0, 2026-04-03)
- [x] Knowledge base created (2026-04-05)

---

## How to Use This File

- **LLM agents**: Update this file when completing tasks or discovering new work items
- **Humans**: Add items directly or via GitHub issues
- **Priority mapping**: Critical = blocks release, High = should fix soon, Medium = quality improvement, Low = nice to have
- **Link context**: Every item should link to a relevant knowledge base article

---
*Last updated: 2026-04-05*
