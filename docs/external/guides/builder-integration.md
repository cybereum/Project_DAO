# Builder Integration Checklist

> End-to-end checklist for deploying and integrating with Project_DAO.

---

## Deployment Checklist

- [ ] Deploy `Project_DAO.sol` to target network
- [ ] Call `setCybereumTreasury(<cybereum.eth resolved address>)`
- [ ] (Optional) Call `setCybereumFeeConfig(feeBps, assetFlatFeeWei)` — `feeBps >= 1`
- [ ] Add members with `addMember` or enable self-onboarding via `stakeAndJoin`
- [ ] Each agent calls `registerAgent(metadataURI)`
- [ ] Set `VITE_PROJECT_DAO_ADDRESS` in `nexus-app/.env`
- [ ] Deploy frontend (`npm run build` → serve `nexus-app/dist/`)
- [ ] (Optional) Deploy `nexus-ai-server` with `ANTHROPIC_API_KEY`

## Smart Contract Development

```bash
npm install                    # Root dependencies
npx hardhat compile            # Compile contracts
npx hardhat test               # Run 391 tests
CYBEREUM_TREASURY=0x... npx hardhat run scripts/deploy.js --network <network>
```

- Solidity 0.8.26, optimizer enabled, `viaIR: true`
- `allowUnlimitedContractSize` enabled in test config (contract > 24 KB)

## Frontend (NEXUS)

```bash
cd nexus-app && npm install && npm run dev
```

- React 19 + Vite 7 + Tailwind CSS 4 + ethers.js 6
- 19 pages, route-level SEO, GA4 + Plausible analytics
- Env vars: `VITE_PROJECT_DAO_ADDRESS`, `VITE_GA_MEASUREMENT_ID`, `VITE_PLAUSIBLE_DOMAIN`

## Agent SDK

```bash
cd sdk && npm install
```

- Pure ESM, single dependency (ethers.js v6)
- Auto-discovery via `deployments.json` registry

## CI Pipeline

GitHub Actions runs on push/PR to main/master:
1. Contract compile + test + dependency audit
2. Frontend lint + build + dependency audit
3. SDK module load + unit tests

---

## Backlinks

- [testing.md](../../internal/dev/testing.md) — Test architecture and writing tests
- [operations.md](operations.md) — Post-deployment procedures
- [../protocol/architecture.md](../protocol/architecture.md) — System structure
- [../product/deployment-readiness.md](../../internal/planning/deployment-readiness.md) — Production readiness scorecard

---
*Source: CLAUDE.md §3 & §12, DEPLOYMENT_READINESS_PLAN.md*
*Last updated: 2026-04-05*
