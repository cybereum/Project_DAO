# Changelog

> Version history for the Cybereum protocol, NEXUS app, and supporting infrastructure. Dates reference implementation completion, not deployment.

---

## [Unreleased]

### Planned
- Professional security audit
- L2 deployment (Base/Arbitrum)
- Event indexer/subgraph for analytics
- Timelock/multisig on `setCybereumTreasury()` and `setCybereumFeeConfig()`
- NexusAI rate limiting and suggestion history persistence
- IPFS metadata pinning for feature kits
- Frontend E2E tests (Playwright/Cypress)
- Prerender/SSR for public routes

---

## [0.5.0] — 2026-03-13

### Documentation
- PRODUCT_GUIDE.md, OPERATIONS_RUNBOOK.md, TESTING_GUIDE.md, SECURITY.md, CHANGELOG.md
- Expanded CLAUDE.md from 11 to 14 sections

### Security Hardening (2026-04-03)
- `depositTokenToEscrow` — added `nonReentrant`
- `setCybereumTreasury`, `setCybereumFeeConfig`, `setAIServiceFee`, `addPermission` — added `whenNotPaused`
- SDK: `_validateMetadataURI()` on all write-path methods
- Frontend: per-route `RouteErrorBoundary`, hidden stack traces in production, `txPending` reset on disconnect
- Tests: 285 → 328 tests, 49 → 54 describe blocks

---

## [0.4.0] — 2026-03-10

### Deployment Infrastructure
- Hardhat deployment script (`scripts/deploy.js`) with treasury configuration
- GitHub Actions CI pipeline: contract compile + test, frontend lint + build
- Initial test suite: 58 tests

### Contract Hardening
- `nonReentrant` on all ETH-transferring functions
- Custom error declarations (ERC-6093 style)
- Optimizer reduced to 1 run for smallest bytecode

### Frontend
- SEO route manifest, sitemap generation/validation
- Deployment gate (`npm run check:deploy`)

---

## [0.3.0] — 2026-03-09

### Feature Kit Pipeline
- `submitFeatureKit`, `upvoteFeatureKit`, `setFeatureKitStatus`, `getFeatureKits`
- Broadcast types: info, upgrade, governance, security
- FeatureKits.jsx three-tab pipeline UI

### NexusAI Engine
- Express proxy with Anthropic SDK, 4 analysis modes + streaming SSE
- Full UI: mode selector, streaming display, score rings, suggestion cards

### Agent Economy UI
- ERC-20 token escrow tab, ERC-721 NFT transfer tab
- Fee collection upgraded from `.transfer()` to `.call{value:}()`

---

## [0.2.0] — 2026-03-08

### Agent Economy Core
- Agent registration, native ETH escrow, ERC-20/ERC-721 support
- Payment request lifecycle, Cybereum fee rail
- Open onboarding (stakeAndJoin/leaveDAO), economic projects
- NEXUS app pages: AgentEconomy, AgentsLanding, BuildersLanding, AgentReadiness, GlobalPulse, Landing
- Agent SDK (`@cybereum/agent-sdk` v0.1.0), agent metadata schema

---

## [0.1.0] — Initial Release

### Core DAO
- Member management, proposals, voting, disputes
- Milestone and task management, role/permission system, pause/resume
- Supporting contracts: AssetNFT, VCDAO, MilestoneTracker
- NEXUS app: Dashboard, Projects, Proposals, Milestones, Assets, Reputation, Verification

---

## Backlinks

- [roadmap.md](roadmap.md) — Future plans
- [deployment-readiness.md](deployment-readiness.md) — Current readiness
- [../protocol/audit-findings.md](../protocol/audit-findings.md) — What was fixed and when

---
*Source: CHANGELOG.md*
*Last updated: 2026-04-05*
