# Deployment Costs & Revenue Guide

**Date:** 2026-04-12
**Treasury:** `cybereum.eth` → `0x41Eb4491306817eC607e9fb12E96C1B8e4aE4E72`
**Target chain:** Base mainnet (chain ID 8453)

---

## 1. Deployment Steps (In Sequence)

### Phase 0: Pre-Deployment (Day 1) — ~$27

| # | Action | Cost | Time |
|---|--------|------|------|
| 0.1 | Fund deployer wallet on Base mainnet with 0.01 ETH | ~$22 (reusable) | 5 min |
| 0.2 | Deploy Gnosis Safe 3-of-5 multisig on Base via safe.global | ~$5 gas | 15 min |
| 0.3 | Claim `@cybereum` npm scope on npmjs.com | $0 | 5 min |

### Phase 1: Testnet Validation (Days 1-7) — $0

| # | Action | Cost | Time |
|---|--------|------|------|
| 1.1 | Deploy split architecture to Base Sepolia: `CYBEREUM_TREASURY=0x41Eb4491306817eC607e9fb12E96C1B8e4aE4E72 npx hardhat run scripts/deploy-split.js --network baseSepolia` | $0 | 30 min |
| 1.2 | Run SDK autonomous bootstrap against testnet: `cd sdk && node examples/autonomous-bootstrap.js` | $0 | 1 hour |
| 1.3 | Validate all 93 SDK methods against deployed contract | $0 | 2 days |
| 1.4 | Test timelock flows: `queueSetTreasury` → wait 24h → `executeSetTreasury` | $0 | 2 days |
| 1.5 | Test `pauseContract` / `resumeContract` emergency flow | $0 | 1 hour |
| 1.6 | Update `sdk/deployments.json` with testnet addresses | $0 | 10 min |

### Phase 2: Security Audit (Weeks 2-8) — $40,000-180,000

Run free tools first (parallel with audit engagement):
- Slither static analysis: `pip install slither-analyzer && slither contracts/Project_DAO.sol`
- Cyfrin Aderyn: `aderyn .`
- Mythril: `myth analyze contracts/Project_DAO.sol`

#### Audit Options

| Option | Firm / Platform | Cost | Timeline | Best For |
|--------|----------------|------|----------|----------|
| A (Budget) | Mid-tier private (Hacken, QuillAudits) | $40,000-80,000 | 4-6 weeks | Minimum viable audit for launch |
| B (Competitive) | Code4rena or Sherlock contest | $50,000-100,000 | 6-10 weeks | Broad coverage, many eyes |
| C (Premium) | Trail of Bits or OpenZeppelin | $150,000-300,000 | 8-16 weeks | Maximum credibility |
| **Recommended** | **Option A then B** | **$90,000-180,000** | **10-16 weeks** | **Best coverage for cost** |

Note: Project scope is ~6,000 lines of Solidity across split architecture with delegatecall proxy, escrow, payment streams, service agreements, referral system, and timelock governance. This complexity pushes costs toward the upper end of ranges.

### Phase 3: Mainnet Deployment (Day after audit) — <$1

| # | Action | Cost | Time |
|---|--------|------|------|
| 3.1 | Deploy to Base mainnet: `CYBEREUM_TREASURY=0x41Eb4491306817eC607e9fb12E96C1B8e4aE4E72 npx hardhat run scripts/deploy-split.js --network base` | <$1 | 30 min |
| 3.2 | Verify all contracts on Basescan | $0 | 30 min |
| 3.3 | Queue ownership transfer: `queueChangeOwner(safeAddress)` | <$0.01 | 5 min |
| 3.4 | Wait 24 hours (timelock) | — | 24h |
| 3.5 | Execute ownership transfer: `executeChangeOwner(safeAddress)` | <$0.01 | 5 min |
| 3.6 | Verify: `owner()` returns Safe address | $0 | 1 min |

Deployment detail: 8 libraries + 4 implementation contracts + 1 Router + selector registration + initialization = ~22 transactions, ~29M gas total. At Base L2 gas prices, total cost is under $1.

### Phase 4: Frontend & Services Launch (Same week) — $37/mo

| # | Action | Cost | Time |
|---|--------|------|------|
| 4.1 | Set `VITE_PROJECT_DAO_ADDRESS` in `nexus-app/.env.production` to deployed Router address | — | 5 min |
| 4.2 | Deploy frontend: `cd nexus-app && npm run build` → upload `dist/` to Cloudflare Pages | $0/mo | 30 min |
| 4.3 | Point `cybereum.io` DNS to Cloudflare | ~$35/yr | 10 min |
| 4.4 | Deploy AI server: push `nexus-ai-server/` to Render with `ANTHROPIC_API_KEY` | $7/mo | 30 min |
| 4.5 | Switch AI model to `claude-sonnet-4-6` in `server.js` (5x cheaper than Opus) | — | 5 min |
| 4.6 | Publish SDK: `cd sdk && npm publish --access public` | $0 | 15 min |
| 4.7 | Update `sdk/deployments.json` with mainnet Router address and push | — | 5 min |
| 4.8 | Start monitoring: `RPC_URL=... CONTRACT_ADDRESS=... node scripts/monitor.js` | $0 | 30 min |

### Phase 5: Revenue Begins (Immediately after Phase 4)

Every on-chain action by any agent generates revenue to `0x41Eb4491306817eC607e9fb12E96C1B8e4aE4E72`:

| Trigger | Fee | Revenue event |
|---------|-----|---------------|
| Agent calls `depositNativeToEscrow()` | 0.05% of deposit | `CybereumFeePaid` |
| Agent-to-agent transfer | 0.05% of amount | `CybereumFeePaid` |
| Payment request settled | 0.05% of settlement | `CybereumFeePaid` |
| Service agreement completed | 0.05% of agreement value | `CybereumFeePaid` |
| Payment stream withdrawn | 0.05% of withdrawn amount | `CybereumFeePaid` |
| NFT/asset transfer | 0.000001 ETH flat | `CybereumFeePaid` |
| On-chain message sent | 0.0001 ETH per message | `CybereumFeePaid` |
| AI service call | 0.0003 ETH per call | `CybereumFeePaid` |
| DAO member exit | 0.03% of returned stake | `ExitFeePaid` |

---

## 2. One-Time Cost Summary

| Item | Budget Path | Premium Path |
|------|-------------|--------------|
| Deployer ETH (reusable) | $22 | $22 |
| Gnosis Safe deployment | $5 | $5 |
| Contract deployment (Base L2) | <$1 | <$1 |
| Security audit | $40,000-80,000 | $150,000-300,000 |
| **Total** | **~$40,028** | **~$150,028-300,028** |

---

## 3. Monthly Operating Costs

| Item | Early Stage | Growth | Scale |
|------|-------------|--------|-------|
| Frontend hosting (Cloudflare Pages) | $0 | $0 | $5 |
| AI server hosting (Render) | $7 | $7 | $15 |
| Anthropic API — Sonnet (recommended) | $27 | $405 | $2,700 |
| Anthropic API — Opus (if using) | $135 | $2,025 | $13,500 |
| RPC provider (Alchemy free → Growth) | $0 | $0 | $49 |
| Domain (cybereum.io) | $3 | $3 | $3 |
| ENS renewal (cybereum.eth, paid to 2032) | $0 | $0 | $0 |
| Gnosis Safe operations | $0 | $0 | $0 |
| npm publishing (@cybereum/agent-sdk) | $0 | $0 | $0 |
| **Monthly total (Sonnet)** | **$37** | **$415** | **$2,772** |
| **Monthly total (Opus)** | **$145** | **$2,035** | **$13,572** |
| **Annual total (Sonnet)** | **$444** | **$4,980** | **$33,264** |

Cost driver: Anthropic API is 75-97% of operating costs depending on tier.

---

## 4. Revenue Model

All fees flow to `cybereumTreasury` (`0x41Eb4491306817eC607e9fb12E96C1B8e4aE4E72`).

### Fee structure (hardcoded guarantees)

| Parameter | Value | Modifiable? |
|-----------|-------|-------------|
| Fee rate | 5 bps (0.05%) default | Yes, via 24h timelock. Range: 1-100 bps. |
| Fee floor | 1 bps (0.01%) minimum | **No** — `constant MIN_FEE_BPS = 1` in bytecode |
| Fee ceiling | 100 bps (1%) maximum | **No** — hardcoded `require` |
| Minimum fee per tx | 1 wei | **No** — hardcoded in `_calculateFee` |
| Asset transfer flat fee | 1e12 wei (~$0.002) default | Yes, via 24h timelock |
| Messaging fee | 0.0001 ETH (~$0.22) default | Yes, owner (instant, not timelocked) |
| AI service fee | 0.0003 ETH (~$0.66) default | Yes, owner (instant, not timelocked) |
| Exit fee | 3 bps (0.03%) default | Yes, owner (instant, not timelocked) |

### Referral dilution (capped)

Up to 30% of each fee can be allocated to referral rewards (10% tier-1 + 3% tier-2 defaults). This is paid from the fee before the remainder reaches the treasury.

| Scenario | Fee collected | Referral payout | Treasury receives |
|----------|---------------|-----------------|-------------------|
| No referrer | 5 bps | 0% | 5.00 bps |
| Tier-1 referrer only (default 10%) | 5 bps | 0.50 bps | 4.50 bps |
| Tier-1 + Tier-2 (default 10%+3%) | 5 bps | 0.65 bps | 4.35 bps |
| Max dilution (25%+5%) | 5 bps | 1.50 bps | 3.50 bps |

Referral config changes now require 24h timelock (`queueSetReferralConfig` / `executeSetReferralConfig`).

### Revenue projections

| Monthly Agent Volume | Gross Fee (5 bps) | After Max Referral | Net to Treasury |
|---------------------|--------------------|--------------------|-----------------|
| 10 ETH ($22,000) | 0.005 ETH ($11) | 0.0035 ETH ($7.70) | $7.70-11.00 |
| 100 ETH ($220,000) | 0.05 ETH ($110) | 0.035 ETH ($77) | $77-110 |
| 1,000 ETH ($2.2M) | 0.5 ETH ($1,100) | 0.35 ETH ($770) | $770-1,100 |
| 10,000 ETH ($22M) | 5 ETH ($11,000) | 3.5 ETH ($7,700) | $7,700-11,000 |
| 100,000 ETH ($220M) | 50 ETH ($110,000) | 35 ETH ($77,000) | $77,000-110,000 |

### Breakeven analysis

| Cost scenario | Monthly cost | Volume needed to break even |
|---------------|--------------|----------------------------|
| Early stage (Sonnet) | $37/mo | ~17 ETH ($37K volume) |
| Growth (Sonnet) | $415/mo | ~190 ETH ($418K volume) |
| Scale (Sonnet) | $2,772/mo | ~1,260 ETH ($2.8M volume) |
| Audit payback ($80K) | One-time | ~36,400 ETH cumulative ($80M) |

### Additional revenue streams (messaging + AI + assets)

These are additive to the percentage-based fee and become significant at scale:

| Activity | Fee per event | 1,000 events/mo | 10,000 events/mo |
|----------|---------------|------------------|-------------------|
| On-chain messages | 0.0001 ETH | 0.1 ETH ($220) | 1 ETH ($2,200) |
| AI service calls | 0.0003 ETH | 0.3 ETH ($660) | 3 ETH ($6,600) |
| NFT transfers | 0.000001 ETH | 0.001 ETH ($2.20) | 0.01 ETH ($22) |

---

## 5. Revenue Protection (Timelocked Functions)

All functions that affect revenue flow require a 24-hour timelock. No instant bypass path exists.

| Function | What it protects |
|----------|-----------------|
| `queueSetTreasury` / `executeSetTreasury` | Prevents instant redirect of fee destination |
| `queueSetFeeConfig` / `executeSetFeeConfig` | Prevents instant fee reduction |
| `queueChangeOwner` / `executeChangeOwner` | Prevents instant ownership takeover |
| `queueSetReferralConfig` / `executeSetReferralConfig` | Prevents instant fee dilution via referrals |

Bytecode-level guarantees (cannot be changed by anyone, ever):
- `MIN_FEE_BPS = 1` — fee can never be zero
- `feeBps <= 100` — fee can never exceed 1%
- Contract has no upgrade/proxy pattern — immutable once deployed

---

## 6. Timeline to Revenue

```
Week 1      Testnet deploy + SDK validation + free security scans
Week 2      Engage audit firm (runs in parallel with continued testing)
Weeks 2-7   Audit in progress
Week 7      Remediate any audit findings
Week 8      Mainnet deploy → multisig ownership → frontend live → SDK published
Week 8+     Revenue flows to cybereum.eth on every agent transaction
```

Fastest path (skipping audit — not recommended): **1 day to mainnet, revenue same day**.
Recommended path (with mid-tier audit): **8 weeks to mainnet**.
Premium path (top-tier audit + competitive contest): **16 weeks to mainnet**.
