# Project DAO + NEXUS Full Implementation Plan

## Objective
Build Project DAO into an indispensable transaction and settlement layer for the agent economy, with:
- mandatory minuscule fee routing to Cybereum (`cybereum.eth` resolved address),
- complete agent transaction UX,
- production-grade analytics/indexing,
- SEO + inbound marketing system embedded into the app,
- test/security/release gates.

---

## Current-State Gap Summary *(updated 2026-03-09)*

> **Overall status: ~70% production-ready.** Core protocol, agent UX, and growth mechanics are substantially complete. The remaining gaps are concentrated in testing, observability, token/asset UI, and three missing persona pages. The system should not deploy to mainnet without resolving the Tier 1 blockers below.

### WS1 — Protocol Fee Enforcement: LARGELY COMPLETE

What exists:
- `MIN_FEE_BPS = 1` and `MAX_FEE_BPS = 100` constants are enforced in `Project_DAO.sol`.
- `setCybereumFeeConfig()` rejects any value below the floor — fee cannot be zeroed.
- `_calculateFee()` enforces a 1 wei minimum on every call.
- `_collectNativeFee()` and `_collectTokenFee()` helpers emit `CybereumFeePaid` on every rail.
- `previewFee()` is available as a public view for client-side calculation.
- NFT/asset rail uses an explicit flat fee (`assetTransferFlatFeeWei`); this hybrid model is codified and functional.

Remaining gaps:
- Fee collection uses Solidity's `.transfer()` — can silently fail when the treasury is a contract that lacks a `receive()` function. **Should use `.call{value: fee}("")` with explicit revert.**
- No timelock or multisig guard on `setCybereumTreasury()` — treasury can be redirected immediately by the owner with no governance delay.
- No custom error types; contract uses `require` strings throughout (less gas-efficient and harder to catch in client code).
- No events emitted for `pauseContract()` / `resumeContract()`.
- No NatSpec documentation on agent functions.

### WS2 — Agent Economy Product Surface: MOSTLY COMPLETE

What exists:
- `AgentEconomy.jsx` (24 KB) is fully built: register, native ETH deposit/withdraw, agent-to-agent ETH transfer, payment request create/settle/cancel, fee previews before every action.
- All native ETH methods are wired in `appStore.jsx`: `agentRegister`, `agentDepositNative`, `agentWithdrawNative`, `agentTransferNative`, `agentCreatePaymentRequest`, `agentSettlePaymentRequest`, `agentCancelPaymentRequest`, `loadAgentProfile`, `loadAgentConfig`.
- ABI in `contract.js` is complete — all 62 agent, governance, and event signatures are present, including `depositTokenToEscrow`, `withdrawTokenFromEscrow`, `transferTokenBetweenAgents`, `transferAssetBetweenAgents`.

Remaining gaps:
- **ERC-20 token rail: contract complete, UI and store methods missing.** `depositTokenToEscrow`, `withdrawTokenFromEscrow`, `transferTokenBetweenAgents` have no corresponding form in `AgentEconomy.jsx` and no store methods in `appStore.jsx`. Users cannot call these from the app.
- **ERC-721 asset rail: contract complete, UI and store methods missing.** `transferAssetBetweenAgents` has no UI or store method.
- No token balance view — users cannot see their ERC-20 escrow balances on-screen.
- No transaction history feed — settlement history is not shown in the UI (would require indexing or manual event polling).
- No reusable component library for agent actions — all forms are inline in `AgentEconomy.jsx`; hard to maintain as rails expand.
- No toast/notification system for transaction confirmations beyond inline state.

### WS3 — Event Indexing, BI, and Operations Dashboard: NOT STARTED

What exists: nothing. This workstream has zero implementation.

Remaining gaps (entire workstream):
- No subgraph or indexer defined for `Agent*` / `CybereumFeePaid` events.
- No aggregate jobs for daily active agents, volume by rail, fee accrual, conversion cohorts.
- No analytics API endpoints consumed by the app.
- No protocol dashboard in the app showing KPIs.
- No monitoring or alerting rules for fee drops, treasury changes, or error spikes.
- **Impact:** operators currently have no visibility into protocol health, fee capture accuracy, or growth metrics.

### WS4 — SEO Foundation: PARTIALLY COMPLETE

What exists:
- `SEOHead.jsx` handles runtime metadata mutation for all 11 routes: title, description, keywords, OG tags, Twitter cards, canonical links.
- `sitemap.xml` covers 13 URLs with correct `changefreq` and `priority` values.
- `robots.txt` references the production domain and crawler directives.
- `og-image.svg`, `favicon.svg`, and `manifest.json` are present.

Remaining gaps:
- **No prerender or SSR.** The app is SPA-only. Crawlers that do not execute JavaScript will receive an empty HTML shell. This limits indexing for non-Google bots and social media link unfurling.
- Sitemap is static and manually maintained — there is no build-time generation tied to the route registry.
- No CI script validates that canonical, OG, and Twitter tags are consistent across routes.

### WS5 — Inbound Marketing Engine: MOSTLY COMPLETE

What exists:
- `Landing.jsx` (39 KB): hero, CorruptionClock, interactive calculator, 5-persona lead capture sections.
- `GlobalPulse.jsx` (23 KB): live protocol activity feed with social share CTAs.
- `AgentsLanding.jsx` (15 KB) at `/agents`: fully built persona page for AI agents and autonomous systems.
- `BuildersLanding.jsx` (15 KB) at `/builders`: fully built developer persona page with integration playbook and dual lead forms.
- `LeadCapture.jsx`: persona-aware form with webhook submission, post-submit share card.
- `CorruptionClock.jsx`: animated real-time ticker showing $82,385/second lost to corruption globally.
- `utm.js`: full UTM capture (all 5 params + referrer + landing path), dual storage (session + local), `generateReferralLink()`, `submitLead()` with attribution context, `markFunnelStep()` / `getFunnelSteps()` funnel tracking.
- `analytics.js`: GA4 + Plausible dual analytics, Web Vitals (LCP, INP, CLS), UTM-enriched `trackConversion()`.

Remaining gaps:
- **3 of 5 persona landing pages are missing:** `/ngo`, `/enterprise`, and `/cities` are planned but not implemented. Only `/agents` and `/builders` exist.
- No webhook endpoint or CRM integration configured by default — `submitLead()` falls back to `console.info` if `VITE_LEAD_WEBHOOK` is unset.
- Social sharing after on-chain transactions is basic (Twitter/Telegram link) — no rich share card populated with the agent's referral link and transaction details.
- No event taxonomy or analytics event dictionary documented.

### WS6 — Testing, Security, and Release Gates: NOT STARTED

What exists: nothing. This workstream has zero implementation.

Remaining gaps (entire workstream):
- **No Solidity test files** — no Hardhat, Foundry, or Truffle tests exist anywhere in the repo.
- **No invariant tests** — the invariant "treasury accrual equals sum of all fees charged" is unverified.
- **No edge-case tests** — dust amounts, unauthorized calls, zero-config attempts are untested.
- **No CI/CD pipeline** — no `.github/workflows/` directory exists; no automated lint, test, or build gates on PRs.
- **No deployment scripts** — no `hardhat.config.js`, no migration files, no network configuration.
- No `.env.example` template documenting required environment variables.
- No security audit checklist or release checklist.
- **Impact:** the contract cannot be confidently deployed to mainnet without a test suite. This is the single largest production blocker.

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

> **Status: largely complete.** Remaining items are hardening tasks, not net-new features.

### Deliverables
- Fix fee collection to use `.call()` instead of `.transfer()` to avoid silent failures when treasury is a contract.
- Add timelock or governance guard on `setCybereumTreasury()`.
- Replace `require` strings with custom errors throughout `Project_DAO.sol`.
- Add events for pause/resume state changes.
- Add NatSpec documentation on all agent and fee functions.

### Acceptance criteria
- Every transfer/settlement path emits fee event and routes fee to treasury.
- Config cannot disable mandatory fee routing.
- Fee collection cannot silently fail due to treasury contract incompatibility.
- All fee config changes are auditable and constrained.

---

## WS2 — Agent Economy Product Surface (Core UX)

> **Status: native ETH rail complete; ERC-20 and ERC-721 rails missing from UI and store.**

### Deliverables
- Add `agentDepositToken`, `agentWithdrawToken`, `agentTransferToken` methods to `appStore.jsx`.
- Add `agentTransferAsset` method to `appStore.jsx`.
- Add ERC-20 escrow forms to `AgentEconomy.jsx`: token address input, amount, fee preview, confirmation.
- Add ERC-20 balance display per token in the agent profile section.
- Add ERC-721 asset transfer form to `AgentEconomy.jsx`: contract address, token ID, recipient, flat fee preview.
- Add transaction confirmation toast/notification system.

### Acceptance criteria
- A connected wallet can complete the full agent rail lifecycle — native ETH, ERC-20 token, ERC-721 asset, and payment requests — from the UI only.
- Each action shows fee breakdown before submit and on completion.
- Payment request state transitions are visible and auditable in-app.

---

## WS3 — Event Indexing, BI, and Operations Dashboard

> **Status: not started. Entire workstream is outstanding.**

### Deliverables
- Event ingestion for `Agent*` and `Cybereum*` events.
- Protocol analytics API + dashboard cards/charts.
- Ops alerts for anomalies.

### Tasks
1. Stand up indexing service (Graph Protocol subgraph or equivalent) and define schema for all agent events.
2. Build aggregate jobs for:
   - daily active agents,
   - volume by rail (native / ERC-20 / ERC-721 / payment requests),
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

> **Status: runtime SEO complete; prerender/SSR and automated sitemap generation are outstanding.**

### Deliverables
- Prerender or SSR for public routes (`/`, `/pulse`, `/agents`, `/builders`, `/ngo`, `/enterprise`, `/cities`).
- Build-time sitemap generation from route registry.
- CI script validating canonical, OG, and Twitter tag consistency across all routes.

### Tasks
1. Add prerender strategy (Vite SSG plugin, Vercel prerender, or equivalent) for all public routes.
2. Keep `SEOHead` as a runtime enhancement; ensure build output HTML contains complete tags.
3. Generate sitemap at build time from the route registry with accurate `lastmod` and priorities.
4. Validate canonical/OG/Twitter tags in CI.
5. Confirm robots.txt references production sitemap URL.

### Acceptance criteria
- Public route source HTML contains correct title/meta/canonical/JSON-LD without JavaScript execution.
- Sitemap is generated at build time and matches registered routes.
- Canonical consistency checks pass in CI.

---

## WS5 — Inbound Marketing Engine Embedded in Product

> **Status: core infrastructure complete (UTM, analytics, lead capture, 2 persona pages). 3 persona pages and CRM integration outstanding.**

### Deliverables
- Add `/ngo`, `/enterprise`, `/cities` persona landing pages (modelled on existing `/agents` and `/builders`).
- Connect `submitLead()` to a live webhook/CRM endpoint in production config.
- Enrich post-transaction share cards with agent referral link and transaction summary data.
- Document analytics event taxonomy.

### Tasks
1. Build `NgoLanding.jsx`, `EnterpriseLanding.jsx`, `CitiesLanding.jsx` and register routes.
2. Add conversion components tailored to each persona (NGO fund disbursement, enterprise procurement, city transparency).
3. Connect forms to automation/CRM endpoint with consent + validation; document required env vars.
4. Enrich social share card after on-chain settlement with agent referral link and amount detail.
5. Produce analytics event dictionary documenting all custom events and their parameters.

### Acceptance criteria
- All 5 persona pages exist, are indexed, and have working lead capture.
- End-to-end funnel data is available: visit -> CTA -> form submit -> wallet connect -> first tx.
- Campaign pages are tied to measurable conversion outcomes.

---

## WS6 — Testing, Security, and Release Gates

> **Status: not started. Entire workstream is outstanding and is the primary mainnet blocker.**

### Deliverables
- Contract unit tests for all agent rails and fee logic.
- Invariant tests verifying treasury accrual equals sum of all fees charged.
- Edge-case tests (dust amounts, zero-config attempts, unauthorized calls, reentrancy).
- CI/CD pipeline with lint + test + build gates on every PR.
- Deployment scripts and environment configuration.
- Security checklist and mainnet release checklist.

### Tasks
1. Choose and configure test framework (Foundry recommended for invariant testing).
2. Add unit tests for fee logic on every transaction rail (native, token, asset, payment request).
3. Add invariant test: `sum(CybereumFeePaid.amount) == cybereumTreasury.balance delta`.
4. Add edge tests: dust amounts, `MIN_FEE_BPS` floor enforcement, unauthorized modifier paths.
5. ~~Fix fee collection from `.transfer()` to `.call()`.~~ **DONE** — all 6 native transfer sites replaced.
6. Add GitHub Actions CI: lint (`solhint`, `eslint`) + contract tests + frontend build.
7. Add deployment scripts for testnet and mainnet with environment variable templates.
8. Produce security checklist and release checklist.

### Acceptance criteria
- No merge without passing CI (lint + tests + build).
- Critical fee/settlement invariants continuously enforced.
- Deployment is scripted and reproducible.

---

## WS7 — NexusAI Self-Improvement Engine

> **Status: scaffold complete (server + frontend service + UI page). Requires ANTHROPIC_API_KEY and running server.**

The app can now analyse its own codebase using Claude claude-opus-4-6 and surface prioritised, actionable improvement suggestions — including patch diffs that can be applied directly to files on disk.

### Architecture

```
NEXUS app (/nexus-ai route)
    └── nexusAI.js service (fetch client)
        └── nexus-ai-server/server.js (Express + @anthropic-ai/sdk)
            └── Claude claude-opus-4-6 (adaptive thinking)
                └── reads live repo source files from disk
```

### Analysis modes

| Mode | Files read | Output |
|---|---|---|
| **Protocol Health** | contract + store + AgentEconomy + config + plan | Score (0–100), prioritised suggestions with patches, plan gaps, new ideas |
| **Security Audit** | `Project_DAO.sol` | Risk level, SWC findings, severity, recommendations, patches |
| **UX Review** | `AgentEconomy.jsx` + `appStore.jsx` | Issue list by type/severity, accessibility gaps, missing error handling |
| **Growth Analysis** | `Landing.jsx` + `analytics.js` + `utm.js` | Conversion score, copy/CTA/funnel suggestions |

### Deliverables (complete)
- `nexus-ai-server/server.js` — Express proxy; reads source files, calls Claude with adaptive thinking, returns structured JSON; streaming SSE endpoint for real-time token display.
- `nexus-ai-server/package.json` — `@anthropic-ai/sdk`, `express`, `cors`.
- `nexus-app/src/services/nexusAI.js` — frontend client with `ping`, `getModes`, `analyse`, `analyseStream`, `applySuggestion`.
- `nexus-app/src/pages/NexusAI.jsx` — full UI: mode selector, streaming token display, score rings, collapsible suggestion cards with 1-click patch apply.
- Route `/nexus-ai` registered in `App.jsx`.
- NexusAI entry added to sidebar navigation (`Layout.jsx`).

### Deliverables (outstanding)
- `VITE_NEXUS_AI_URL` documented in `nexus-app/.env.example`.
- Rate limiting on the Express server to prevent runaway Claude API spend.
- Suggestion history — persist past analysis runs in localStorage so results survive page reload.
- Scheduled auto-analysis — cron trigger that runs health scan nightly and emails/Slacks a diff of new findings.
- Proposal integration — high-severity suggestions can be submitted as DAO governance proposals with one click.
- Multi-file patch application — when a suggestion spans more than one file, apply all hunks atomically.

### Newly discovered gaps (added while implementing)
- `parseUnits` was missing from the AgentEconomy imports — now fixed.
- `Coins` and `Image` icons were missing from lucide-react imports — now fixed.
- The `escrow` tab label was ambiguous — renamed to `ETH Escrow` for clarity.
- No `VITE_NEXUS_AI_URL` in `.env.example` template — outstanding.
- `nexus-ai-server` not yet in `.gitignore` for `node_modules` — outstanding.

### Acceptance criteria
- Running `ANTHROPIC_API_KEY=sk-ant-... npm start` in `nexus-ai-server/` starts the server.
- Setting `VITE_NEXUS_AI_URL=http://localhost:3737` and opening `/nexus-ai` shows the mode grid.
- Clicking any mode card runs analysis, streams tokens, and renders typed suggestions.
- Patch apply writes the updated file to disk.

---

## Revised Phased Execution Plan

> Phases 0–2 from the original plan are now complete or partially complete. The plan below reflects the remaining work from the current state.

## Phase A (1–2 weeks) — Testnet Readiness (WS6 priority + WS1 hardening)
- Add Solidity test suite (unit + invariant + edge cases).
- ~~Fix fee collection from `.transfer()` to `.call()`.~~ **DONE.**
- Add GitHub Actions CI pipeline.
- Add deployment scripts and `.env.example`.
- Deploy to testnet with all tests passing.

**Exit:** testnet deployment live, all fee tests green, CI enforced on every PR.

## Phase B (1–2 weeks) — Feature Parity (WS2 completion) — *partially done*
- ~~Add ERC-20 token escrow UI and store methods.~~ **DONE** — Token Escrow tab live.
- ~~Add ERC-721 asset transfer UI and store method.~~ **DONE** — NFT Transfer tab live.
- ~~Add token balance view.~~ **DONE** — inline balance check in Token Escrow tab.
- Add transaction notification/toast system (currently inline state only).
- Add `parseUnits` decimal handling UX (warn if decimals don't match token).

**Exit:** all four agent rails (ETH, ERC-20, ERC-721, payment requests) usable end-to-end from the UI.

## Phase C (2–3 weeks) — Observability (WS3)
- Deploy subgraph or indexer for all agent events.
- Build analytics API and expose to app dashboard.
- Add KPI cards: daily active agents, volume by rail, fee accrual.
- Set up ops alerting for anomalies.

**Exit:** live protocol KPI visibility; ops alerting active.

## Phase D (1–2 weeks) — SEO + Growth Completion (WS4 + WS5)
- Add `/ngo`, `/enterprise`, `/cities` persona landing pages.
- Implement prerender/SSR for all public routes.
- Auto-generate sitemap at build time.
- Connect lead capture to live CRM webhook.
- Enrich post-settlement share cards.

**Exit:** all 5 persona pages live, crawlable, and conversion-instrumented.

## Phase E (Ongoing) — Mainnet Launch + Optimisation
- Security audit of `Project_DAO.sol` (NexusAI security mode can seed the finding list).
- Address audit findings.
- Mainnet deployment with observability active.
- Weekly KPI review and funnel optimisation loop.
- Schedule NexusAI nightly health scans; route findings to DAO proposal queue.

**Exit:** mainnet live with reliability and growth baseline established.

---

## Feature Completion Matrix

| Feature | Workstream | Status |
|---|---|---|
| Fee floor enforcement (MIN_FEE_BPS) | WS1 | **Complete** |
| Fee collection safety (`.call()`) | WS1 | **Complete** *(fixed 2026-03-09)* |
| Treasury timelock / multisig | WS1 | **Missing — Tier 2** |
| Custom errors + NatSpec | WS1 | **Missing — Tier 3** |
| Agent identity (register/update) | WS2 | **Complete** |
| Native ETH escrow + transfer | WS2 | **Complete** |
| ERC-20 token escrow (contract) | WS2 | **Complete** |
| ERC-20 token escrow (UI + store) | WS2 | **Complete** *(done 2026-03-09)* |
| ERC-721 asset transfer (contract) | WS2 | **Complete** |
| ERC-721 asset transfer (UI + store) | WS2 | **Complete** *(done 2026-03-09)* |
| Payment request lifecycle | WS2 | **Complete** |
| Fee previews before submit | WS2 | **Complete** |
| Transaction notification/toast system | WS2 | **Missing — Tier 2** |
| Token decimal mismatch UX warning | WS2 | **Missing — Tier 3** |
| Transaction history feed | WS2 | **Missing — Tier 2** |
| Event indexing / subgraph | WS3 | **Not started — Tier 1** |
| Protocol analytics API | WS3 | **Not started — Tier 1** |
| KPI dashboard in app | WS3 | **Not started — Tier 2** |
| Ops alerting | WS3 | **Not started — Tier 2** |
| Runtime SEO (SEOHead) | WS4 | **Complete** |
| Static sitemap + robots.txt | WS4 | **Complete** |
| Prerender / SSR | WS4 | **Missing — Tier 2** |
| Build-time sitemap generation | WS4 | **Missing — Tier 3** |
| CI metadata validation | WS4 | **Missing — Tier 3** |
| Landing page + CorruptionClock | WS5 | **Complete** |
| GlobalPulse with share CTAs | WS5 | **Complete** |
| `/agents` persona page | WS5 | **Complete** |
| `/builders` persona page | WS5 | **Complete** |
| `/ngo` persona page | WS5 | **Missing — Tier 2** |
| `/enterprise` persona page | WS5 | **Missing — Tier 2** |
| `/cities` persona page | WS5 | **Missing — Tier 2** |
| UTM capture + referral links | WS5 | **Complete** |
| Lead capture + funnel tracking | WS5 | **Complete** |
| CRM webhook integration | WS5 | **Missing — Tier 2** |
| Rich post-tx share cards | WS5 | **Missing — Tier 3** |
| Solidity unit tests | WS6 | **Not started — Tier 1** |
| Fee invariant tests | WS6 | **Not started — Tier 1** |
| Edge-case tests | WS6 | **Not started — Tier 1** |
| CI/CD pipeline | WS6 | **Not started — Tier 1** |
| Deployment scripts + .env.example | WS6 | **Not started — Tier 1** |
| Security audit + release checklist | WS6 | **Not started — Tier 2** |
| NexusAI server (Claude API proxy) | WS7 | **Complete** *(done 2026-03-09)* |
| NexusAI frontend service + page | WS7 | **Complete** *(done 2026-03-09)* |
| NexusAI: health / security / ux / growth modes | WS7 | **Complete** *(done 2026-03-09)* |
| NexusAI: 1-click patch apply | WS7 | **Complete** *(done 2026-03-09)* |
| NexusAI: suggestion history (localStorage) | WS7 | **Missing — Tier 3** |
| NexusAI: scheduled nightly scan + alerts | WS7 | **Missing — Tier 3** |
| NexusAI: DAO proposal submission from finding | WS7 | **Missing — Tier 2** |
| NexusAI: rate limiting on server | WS7 | **Missing — Tier 2** |

**Tier 1** = mainnet blocker. **Tier 2** = should fix before production. **Tier 3** = improvement / nice-to-have.

---

## KPI Framework (North Star + Supporting)

### Protocol KPIs
- Daily active agents
- Transaction count by rail (native / ERC-20 / ERC-721 / payment requests)
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

- **~~Silent fee loss via `.transfer()`~~** -> **FIXED** — all 6 sites now use `.call{value}()` + `require`.
- **No test coverage on contract** -> add Foundry test suite as Phase A gate; block mainnet until green.
- **Over-centralised owner controls** -> add timelock or multisig governance for treasury and fee config updates in Phase A/B.
- **SPA SEO limitations** -> prerender/SSR before scaling paid or content campaigns (Phase D).
- **Data trust gaps** -> reconcile indexer totals with on-chain event checksums once subgraph is deployed.
- **~~Incomplete token/asset UI~~** -> **FIXED** — ERC-20 and ERC-721 rails now fully exposed in NEXUS UI.
- **NexusAI API key exposure risk** -> server reads `ANTHROPIC_API_KEY` from env only; never set `VITE_ANTHROPIC_API_KEY` in the browser bundle.
- **NexusAI runaway spend** -> add per-IP rate limiting and monthly budget cap before exposing server publicly.
- **Token decimal mismatch** -> `parseUnits` uses user-supplied decimals field; incorrect decimals will produce wrong amounts — add on-chain decimal validation or warn prominently.

---

## Repo Implementation Checklist

### Contracts
- [x] Fix fee collection: `.transfer()` → `.call()` with revert on failure. *(done 2026-03-09)*
- [ ] Add Foundry (or Hardhat) test suite with unit + invariant + edge tests.
- [ ] Add deployment scripts and `.env.example`.
- [ ] Add timelock/multisig on `setCybereumTreasury()`.
- [ ] Replace `require` strings with custom errors.
- [ ] Add NatSpec to all public and agent functions.

### Frontend
- [x] Agent economy UI for native ETH rail — complete.
- [x] ERC-20 token escrow forms + store methods. *(done 2026-03-09)*
- [x] ERC-721 asset transfer form + store method. *(done 2026-03-09)*
- [x] Token balance view (inline per-token balance check). *(done 2026-03-09)*
- [ ] Transaction notification/toast system (currently inline state only).
- [ ] Token decimal auto-detection (query ERC-20 `decimals()` on-chain instead of manual input).
- [ ] `/ngo`, `/enterprise`, `/cities` persona landing pages.
- [ ] Prerender/SSR for public routes.
- [ ] Build-time sitemap generation.
- [ ] CRM webhook integration.

### NexusAI (self-improvement engine)
- [x] `nexus-ai-server/server.js` — Express proxy with 4 Claude-backed analysis modes. *(done 2026-03-09)*
- [x] `nexus-app/src/services/nexusAI.js` — frontend client. *(done 2026-03-09)*
- [x] `nexus-app/src/pages/NexusAI.jsx` — full UI with streaming + patch apply. *(done 2026-03-09)*
- [x] `/nexus-ai` route + sidebar nav entry. *(done 2026-03-09)*
- [ ] `VITE_NEXUS_AI_URL` added to `nexus-app/.env.example`.
- [ ] `node_modules` added to `nexus-ai-server/.gitignore`.
- [ ] Rate limiting on NexusAI server.
- [ ] Suggestion history persisted in localStorage.
- [ ] Scheduled nightly scan with alert webhook.
- [ ] "Submit as DAO proposal" CTA on critical findings.

### Data + Ops
- [ ] Deploy subgraph or indexer for all agent events.
- [ ] Build analytics API endpoints.
- [ ] Add KPI dashboard components to app.
- [ ] Add monitoring and alerting config.

### CI/CD
- [ ] Add `.github/workflows/` with lint + test + build gates.
- [ ] Add CI metadata validation for SEO tags.

### Documentation
- [ ] Produce analytics event taxonomy.
- [ ] Add security audit checklist.
- [ ] Add mainnet launch and rollback runbooks.
- [ ] Update `README.md` with current deployment instructions.

---

## Definition of Done (Program-Level)
1. Every supported transaction/settlement path enforces non-bypassable Cybereum fee routing — validated by invariant tests and CI.
2. Agent users can complete all four rails (native ETH, ERC-20, ERC-721, payment requests) from the UI with clear fee previews and reliable confirmations.
3. Event indexing and dashboards provide real-time protocol/business visibility.
4. Public web surfaces are crawlable, campaign-ready, and conversion-instrumented across all five personas.
5. Tests, invariants, and CI gates protect the system before every release.
