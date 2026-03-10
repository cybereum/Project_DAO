# Deployment Readiness Plan (Execution Sprint)

## Reviewed notes
- `FULL_IMPLEMENTATION_PLAN.md`
- `APP_DEEP_DIVE.md`
- `CLAUDE.md`
- `AGENT_TX_QUICKSTART.md`
- Full contract source (`contracts/Project_DAO.sol`, 1,590+ lines)
- Complete test suite (`test/ProjectDAO.test.js`, 58 tests)
- Frontend app (`nexus-app/`, React + Vite + Tailwind + ethers.js)

---

## Current completion estimate
**~88% complete toward production deployment readiness.**

Rationale:
- Core contract rails (agent escrow, transfers, payment requests, economic projects) are complete and tested.
- Reentrancy guard added to all ETH transfer functions (defense-in-depth).
- Custom error types declared for gas-efficient reverts and better client integration.
- Agent economy UI includes native, token, asset, and payment request flows.
- Deployment script (`scripts/deploy.js`) with treasury configuration.
- CI/CD pipeline (`.github/workflows/ci.yml`) running contract tests + frontend lint/build on PR.
- 58 unit tests passing across all critical paths.
- SEO sitemap generation + validation + deployment gate (`npm run check:deploy`).
- Remaining work is contract size reduction and operational infrastructure.

---

## Deployment Readiness Scorecard

| Category | Weight | Score | Status |
|----------|--------|-------|--------|
| **Core contract logic** | 20% | 19/20 | All agent rails, governance, economic projects complete and tested |
| **Security hardening** | 20% | 17/20 | ReentrancyGuard added; fee floor enforced; `.call` pattern used; needs audit |
| **Test coverage** | 15% | 13/15 | 58 tests covering critical paths; missing: disputes, tasks, VCDAO, reentrancy attack tests |
| **Deployment infra** | 10% | 9/10 | Deploy script + Hardhat config + network templates ready |
| **CI/CD pipeline** | 10% | 9/10 | GitHub Actions for contract tests + frontend build on PR |
| **Frontend completeness** | 10% | 9/10 | Full NEXUS app with agent economy UI, SEO, analytics |
| **Documentation** | 5% | 5/5 | CLAUDE.md, README, quickstart, deep-dive, roadmap all comprehensive |
| **Operational readiness** | 10% | 7/10 | Missing: event indexer/subgraph, monitoring, alerts |
| **Total** | 100% | **88/100** | |

---

## Completed this sprint

### Contract hardening
1. Added **ReentrancyGuard** (inline, no external dependency) to all ETH-transferring functions:
   - `withdrawNativeFromEscrow`
   - `settleAgentPaymentRequest`
   - `claimProjectShare`
   - `refundProjectFunder`
   - `leaveDAO`
2. Added **custom error declarations** (ERC-6093 style) for gas-efficient reverts:
   - `Unauthorized`, `NotMember`, `NotRegisteredAgent`, `ContractPaused`
   - `ZeroAmount`, `InsufficientBalance`, `InvalidAddress`, `TransferFailed`
   - `AlreadyExists`, `NotFound`, `InvalidStatus`
3. All `.transfer()` paths in Project_DAO.sol already use safe `.call{value:}` pattern (confirmed).

### Deployment infrastructure
4. Created **Hardhat deployment script** (`scripts/deploy.js`) with:
   - Automatic treasury configuration via `CYBEREUM_TREASURY` env var
   - Optional fee config via `FEE_BPS` and `ASSET_FEE_WEI` env vars
   - Deployment summary with next-steps guidance
5. Added **network configuration templates** in hardhat.config.js (Sepolia, mainnet)
6. Reduced optimizer runs to 1 for smallest possible bytecode output

### Release controls
7. Created **GitHub Actions CI pipeline** (`.github/workflows/ci.yml`):
   - Contract job: compile + test on every PR/push to main
   - Frontend job: lint + build on every PR/push to main

## Previous sprint (completed)
1. Consolidated route/SEO/sitemap data into one manifest (`routeManifest.js`).
2. Added deterministic sitemap generation + validation scripts.
3. Added frontend deployment gate command (`npm run check:deploy`).
4. Added `.env.example` for environment setup.

---

## Remaining blockers to reach 95%+

### Tier-1: Contract size (DEPLOYMENT BLOCKER)
The contract is **40,329 bytes** — exceeding the 24,576-byte Spurious Dragon limit.

**Options (choose one):**
- **A. EIP-2535 Diamond Proxy** — split into facets (AgentFacet, GovernanceFacet, ProjectFacet)
- **B. Library extraction** — move pure/view helpers into Solidity libraries
- **C. L2-first deployment** — deploy on L2 chains (Arbitrum, Base, Optimism) where the limit is relaxed or not enforced, then split for L1 later

> Recommendation: **Option C** for fastest time-to-market. Deploy on Base/Arbitrum first, then refactor for L1 mainnet.

### Tier-2: Security
- [ ] Professional smart contract audit (OpenZeppelin, Trail of Bits, or Cyfrin)
- [ ] Add reentrancy attack tests (malicious contract test)
- [ ] Add governance/dispute test coverage

### Tier-3: Operational infrastructure
- [ ] Event indexer (The Graph subgraph or Ponder) for fee and agent activity events
- [ ] Protocol KPI dashboard (fee revenue, agent count, project TVL)
- [ ] Alert system for anomalies (large withdrawals, treasury changes)

### Tier-4: Growth reliability
- [ ] Prerender/SSR for SEO (non-JS crawler compatibility)
- [ ] Timelock or multisig guard on `setCybereumTreasury()` and `setCybereumFeeConfig()`
- [ ] Frontend E2E tests (Playwright or Cypress)

---

## Target milestones to 95%+
- **Milestone A (Ship):** L2 deployment on testnet → audit → L2 mainnet launch
- **Milestone B (Observe):** Subgraph + dashboard + alerts
- **Milestone C (Harden):** Contract splitting for L1 + timelock governance
- **Milestone D (Scale):** SSR + E2E tests + content pipeline
