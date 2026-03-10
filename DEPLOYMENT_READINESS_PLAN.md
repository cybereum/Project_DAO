# Deployment Readiness Plan (Execution Sprint)

## Reviewed notes
- `FULL_IMPLEMENTATION_PLAN.md`
- `APP_DEEP_DIVE.md`
- `CLAUDE.md`
- `AGENT_TX_QUICKSTART.md`

## Current completion estimate
**~75% complete toward production deployment readiness.**

Rationale:
- Core contract rails + extensive tests are in place.
- Agent economy UI includes native, token, asset, and payment request flows.
- Missing work is now concentrated in production operations: observability/indexing, governance hardening, and release automation.

## This sprint (completed)
1. Consolidated route/SEO/sitemap data into one manifest (`routeManifest.js`) to reduce drift risk.
2. Added deterministic sitemap generation + validation scripts.
3. Added a frontend deployment gate command (`npm run check:deploy`).
4. Added `.env.example` for faster and safer environment setup.

## Remaining Tier-1 blockers before mainnet
1. Contract hardening:
   - Replace native fee `.transfer` paths with `.call` + explicit revert handling.
   - Introduce owner action governance guard (timelock/multisig) for treasury/fee config.
2. Observability:
   - Ship event indexer/subgraph for fee and agent activity events.
   - Add protocol KPI dashboard + alerts.
3. Release controls:
   - Add CI pipeline that runs contract + frontend deployment gates on PR.
4. SEO runtime:
   - Add prerender/SSR for non-JS crawler compatibility.

## Target path to 90%+
- **Milestone A (Hardening):** treasury transfer safety + owner guardrails.
- **Milestone B (Ops):** indexer + dashboards + alerts.
- **Milestone C (Release):** CI/CD and staged testnet-to-mainnet rollout.
- **Milestone D (Growth reliability):** prerender + content pipeline checks.
