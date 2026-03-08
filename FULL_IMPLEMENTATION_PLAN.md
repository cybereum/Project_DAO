# Project DAO + NEXUS Full Implementation Plan

## Objective
Build Project DAO into an indispensable transaction and settlement layer for the agent economy, with:
- mandatory minuscule fee routing to Cybereum (`cybereum.eth` resolved address),
- complete agent transaction UX,
- production-grade analytics/indexing,
- SEO + inbound marketing system embedded into the app,
- test/security/release gates.

## Current-State Gap Summary

### Smart contract gaps
- Fee/toll policy can be zeroed or redirected by owner config, which weakens the requirement that every transaction routes fee to Cybereum.
- NFT/asset rail is flat-fee while other rails are basis-point fee; policy needs explicit unification.
- No comprehensive test suite validating fee invariants and edge-case settlement behavior.

### Product/app gaps
- Contract ABI is present, but app lacks full agent transaction workflows (register, escrow management, transfers, payment requests).
- No fee preview and no event-driven settlement history for users.
- No dedicated “agent economy” interface or onboarding path.

### Growth/SEO gaps
- SEO relies heavily on SPA runtime metadata mutation; route-level prerender/SSR is missing.
- Static sitemap/robots without automated generation checks.
- Inbound loops (lead capture, UTM attribution, persona landing pages, CRM hooks) are incomplete.

### Data and GTM gaps
- No indexer/subgraph pipeline for fee revenue, adoption, and funnel metrics.
- No KPI dashboard for protocol usage, transaction rails, and Cybereum treasury accruals.

---

## Guiding Principles
1. **Non-bypassable fee routing** for all value rails.
2. **Agent-first UX**: complete in <3 clicks for common actions.
3. **Observe everything**: on-chain events -> indexed analytics -> product dashboards.
4. **Search-discoverable growth surfaces**: public pages must be crawlable and campaign-ready.
5. **Security and correctness first**: no release without invariant and integration checks.

---

## Workstreams and Deliverables

## WS1 — Protocol Fee Enforcement + Settlement Hardening

### Deliverables
- Enforce minimum fee floors and policy constraints in `Project_DAO.sol`.
- Harden treasury configuration path and governance controls.
- Standardize fee policy semantics across all rails (or explicitly codify exceptions).
- Add richer events and explicit custom errors for policy/fee violations.

### Tasks
1. Add policy constants (`MIN_FEE_BPS`, optional `MAX_FEE_BPS`, optional `MIN_ASSET_FEE_WEI`).
2. Restrict `setCybereumFeeConfig` so fee cannot be zero if mandatory routing is required.
3. Add stricter treasury management (e.g., timelocked update path or immutable + governed migration).
4. Refactor fee collection helpers for one policy model and consistent event emission.
5. Document explicit policy: “all rails percentage-based” or “fungible % + NFT fixed toll”.

### Acceptance criteria
- Every transfer/settlement path emits fee event and routes fee to treasury.
- Config cannot disable mandatory fee routing.
- All fee config changes are auditable and constrained.

---

## WS2 — Agent Economy Product Surface (Core UX)

### Deliverables
- New end-to-end user flows for:
  - agent registration and metadata,
  - native/token escrow deposit & withdrawal,
  - agent-to-agent transfers,
  - payment request lifecycle,
  - asset transfer with fee visibility.
- New “Agent Economy” app section with histories and statuses.

### Tasks
1. Add store/domain methods in `nexus-app/src/store/appStore.jsx` for all agent actions.
2. Expand `nexus-app/src/config/contract.js` ABI with reads needed by UI (balances, requests, config).
3. Add dedicated pages/components (e.g., `src/pages/AgentEconomy.jsx`, `src/components/agent/*`).
4. Add preflight transaction previews: gross amount, fee, net payout, recipient.
5. Add robust toast/error states and tx hash confirmation links.

### Acceptance criteria
- A connected wallet can complete full agent rail lifecycle from UI only.
- Each action shows fee breakdown before submit and on completion.
- Payment request state transitions are visible and auditable in-app.

---

## WS3 — Event Indexing, BI, and Operations Dashboard

### Deliverables
- Event ingestion for `Agent*` and `Cybereum*` events.
- Protocol analytics API + dashboard cards/charts.
- Ops alerts for anomalies.

### Tasks
1. Stand up indexing service (subgraph or equivalent) and define schema.
2. Build aggregate jobs for:
   - daily active agents,
   - volume by rail,
   - fees by token/time,
   - conversion cohorts (first transfer, repeat settlement).
3. Expose API endpoints consumed by app dashboards.
4. Add monitoring rules (fee drop, treasury change, error spikes).
5. Add runbook docs for finance and ops reporting.

### Acceptance criteria
- Dashboard shows live usage and fee accrual trends.
- Ops alerts trigger on config and behavior anomalies.

---

## WS4 — SEO Foundation Upgrade (Technical SEO)

### Deliverables
- Prerender/SSR for public routes.
- Build-time route metadata generation.
- Automated sitemap generation and metadata QA in CI.

### Tasks
1. Add prerender strategy for `/`, `/pulse`, and all public campaign routes.
2. Keep `SEOHead` as enhancement; ensure crawlers see complete HTML tags server/build time.
3. Generate sitemap from route registry with accurate `lastmod` and priorities.
4. Validate canonical/OG/Twitter tags in CI script.
5. Ensure robots.txt references production sitemap and policy.

### Acceptance criteria
- Public route source HTML contains correct title/meta/canonical/JSON-LD without JS execution.
- Sitemap and canonical consistency checks pass in CI.

---

## WS5 — Inbound Marketing Engine Embedded in Product

### Deliverables
- Persona landing pages and conversion funnels.
- Lead capture integrated with attribution and CRM.
- Product-driven growth loops and social sharing surfaces.

### Tasks
1. Add persona routes (`/agents`, `/cities`, `/ngo`, `/enterprise`, `/builders`).
2. Add conversion components: waitlist/newsletter/demo/partner forms.
3. Capture and persist UTM/referrer/source in analytics events.
4. Connect forms to automation/CRM endpoint with consent + validation.
5. Add share-ready data snippets and CTA modules in Landing + Global Pulse.

### Acceptance criteria
- End-to-end funnel data available: visit -> CTA -> form submit -> wallet connect -> first tx.
- Campaign pages are indexable and tied to measurable conversion outcomes.

---

## WS6 — Testing, Security, and Release Gates

### Deliverables
- Contract tests (unit + invariants), frontend integration tests, CI gates.
- Security review checklist and release checklist.

### Tasks
1. Add Solidity test suite for fee logic on every transaction rail.
2. Add invariant tests: treasury accrual equals sum of charged fees.
3. Add edge tests (dust amounts, zero config attempts, unauthorized calls).
4. Add frontend tests for fee preview math and state transitions.
5. Add CI workflow: lint + tests + build + metadata validation.

### Acceptance criteria
- No merge without passing tests and CI checks.
- Critical fee/settlement invariants continuously enforced.

---

## Phased Execution Plan

## Phase 0 (Week 0) — Architecture + Specs
- Freeze policy decisions:
  - strict mandatory percentage on all rails vs hybrid model.
  - treasury governance model.
- Produce implementation RFC for contract + app + indexer.

**Exit:** signed-off technical spec and migration strategy.

## Phase 1 (Weeks 1–2) — Contract hardening + tests
- Implement WS1 and most of WS6 (contract side).
- Deploy to testnet and run scenario validation.

**Exit:** hardened contract + full fee tests green.

## Phase 2 (Weeks 2–4) — Agent UX + histories
- Implement WS2 and integrate analytics event instrumentation.

**Exit:** users can complete full agent transaction lifecycle in-app.

## Phase 3 (Weeks 3–5) — Indexing + protocol dashboards
- Implement WS3 and wire data views into app dashboard.

**Exit:** live KPI visibility and ops alerting.

## Phase 4 (Weeks 4–6) — SEO + inbound system
- Implement WS4 and WS5 in parallel.

**Exit:** crawlable campaign pages, lead funnels, attribution reports.

## Phase 5 (Week 6+) — Production launch + optimization
- Mainnet rollout with observability.
- Weekly KPI review and funnel optimization loop.

**Exit:** production launch with reliability and growth baseline.

---

## KPI Framework (North Star + Supporting)

### Protocol KPIs
- Daily active agents
- Transaction count by rail
- Settlement volume
- Cybereum treasury accrual/day
- Fee capture rate consistency

### Product KPIs
- Wallet connect rate
- Agent registration completion
- First transaction conversion
- Payment request settlement success rate

### Growth KPIs
- Organic sessions to public pages
- Campaign landing conversion by persona
- CAC proxy by channel (if paid acquisition added)
- Lead-to-first-tx conversion

---

## Risks and Mitigations
- **Policy ambiguity on NFT fee model** -> finalize governance-approved fee policy before coding.
- **Over-centralized owner controls** -> timelock/multisig governance controls for treasury/config updates.
- **SPA SEO limitations** -> prerender/SSR before scaling content campaigns.
- **Data trust gaps** -> reconcile indexer totals with on-chain event checksums.

---

## Repo Implementation Checklist

### Contracts
- [ ] Update `contracts/Project_DAO.sol` fee invariants and governance constraints.
- [ ] Add contract tests in chosen framework.
- [ ] Add deployment/migration scripts.

### Frontend
- [ ] Add agent transaction pages/components.
- [ ] Expand app store and contract integration.
- [ ] Add conversion forms + attribution capture.
- [ ] Add SEO prerender/metadata pipeline.

### Data + Ops
- [ ] Add event indexing project + schema docs.
- [ ] Add analytics API adapters.
- [ ] Add dashboard KPI components.
- [ ] Add monitoring/alert config docs.

### Documentation
- [ ] Update `README.md` and `AGENT_TX_QUICKSTART.md` with final policy + user flow.
- [ ] Add launch and rollback runbooks.

---

## Definition of Done (Program-Level)
1. Every supported transaction/settlement path enforces non-bypassable Cybereum fee routing by policy.
2. Agent users can complete all rails from UI with clear fee previews and reliable confirmations.
3. Event indexing and dashboards provide real-time protocol/business visibility.
4. Public web surfaces are crawlable, campaign-ready, and conversion-instrumented.
5. Tests, invariants, and CI gates protect the system before every release.
