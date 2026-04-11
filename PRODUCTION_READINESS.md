# Production Readiness Guide — Path to 95+

> Current overall score: **~88/100** across 7 dimensions (updated 2026-04-11 after the 0.6.0 encrypted-smart-contracts + library-split pass).
> This document describes the exact work remaining to reach **95+/100**.

---

## Score Summary (Current → Target)

| Dimension | Current | Target | Gap |
|---|---|---|---|
| Contract Security | 84 | 95 | +11 |
| Contract Tests | 95 | 96 | +1 |
| Frontend | 89 | 95 | +6 |
| SDK | 88 | 95 | +7 |
| SDK Tests | 88 | 95 | +7 |
| CI Pipeline | 75 | 95 | +20 |
| Deploy Script | 90 | 95 | +5 |
| **Overall** | **~88** | **95+** | **+7** |

## 0.6.0 — Encrypted Smart Contracts + Library Split (delta from 0.5.0)

**Hard blocker resolved**:
- **EIP-7825 (Fusaka) per-transaction deploy gas**: creation tx is now ~16.59 M gas, under the 16.78 M per-tx cap. Achieved by moving field-level initializers into a single-use `initialize()` function the deployer calls in a second transaction immediately after `CREATE`. CI guardrail test (`EIP-7825 deploy-gas guardrail`) enforces the cap going forward.

**Hard blocker still open**:
- **Spurious Dragon 24 KB code-size limit**: main contract is ~75,800 bytes, still ~3x over the limit. Cannot deploy to Ethereum mainnet or Base until more subsystems are extracted into libraries (Reputation engine, Economic projects, Payment streams, Service agreements, Referral rewards remain the large blocks) OR the contract is split into multiple deployed contracts composed at runtime.

**Security improvements landed in 0.6.0**:
- On-chain PKI: agent public key registry + per-party encrypted envelopes for service agreements and payment requests, with EIP-712 signed-attach variants for non-repudiation
- `PKILib` uses OpenZeppelin's audited `ECDSA.recover` (custom signature math eliminated)
- Partial re-attach footgun fixed: new-hash re-attach atomically clears stale ciphertexts; same-hash re-attach preserves existing ciphertexts for the legitimate "rotate one party's key" flow
- `uint256[50] __gap;` reserves added to every library `Store` struct so future field additions don't shift unrelated state-variable layout
- Library-shim backwards-compat getters verified by dedicated parity tests
- Solidity pragma harmonized to `^0.8.26` across main contract and all libraries
- Frontend ABI (`nexus-app/src/config/contract.js`) updated with all new PKI / Trust / FeatureKit / Messaging entries and re-validated as a valid ethers `Interface`
- 35 new SDK unit tests cover the PKI validators, EIP-712 signing, and SDK ↔ ECIES interop

**Test surface**: 432 contract tests + 160 SDK unit tests, all green.

---

---

## 1. Contract Security (82 → 95)

### 1a. Professional Security Audit (+8 points)

No professional audit has been performed. This is the single highest-impact item for the entire project.

**Action items:**
- Engage a reputable Solidity auditor (Trail of Bits, OpenZeppelin, Spearbit, Cyfrin)
- Scope: `contracts/Project_DAO.sol` (~1633 lines), focus on escrow flows, fee rail, reentrancy paths, and access control
- Budget expectation: $15K–$50K depending on firm and timeline
- Fix all Critical/High findings before mainnet deployment
- Publish the audit report hash on-chain or link from contract metadata

### 1b. Static Analysis in CI (+3 points)

No automated security scanning exists.

**Action items:**
1. Add [Slither](https://github.com/crytic/slither) to CI:
   ```yaml
   # .github/workflows/ci.yml — add to contracts job
   - name: Run Slither
     uses: crytic/slither-action@v0.4.0
     with:
       solc-version: '0.8.26'
       slither-args: '--filter-paths "node_modules"'
   ```
2. Add [Mythril](https://github.com/Consensys/mythril) as a scheduled weekly scan (too slow for every PR):
   ```yaml
   # .github/workflows/security-weekly.yml
   on:
     schedule:
       - cron: '0 6 * * 1'  # Monday 6am UTC
   jobs:
     mythril:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - run: pip3 install mythril
         - run: myth analyze contracts/Project_DAO.sol --solv 0.8.26 --execution-timeout 300
   ```
3. Triage and fix or document all findings before mainnet.

### 1c. Upgradeability Assessment (+2 points)

The contract is **not upgradeable** (no proxy pattern). At 40,329 bytes it exceeds the 24KB L1 limit, restricting deployment to L2 chains (Base, Arbitrum, Optimism, etc.).

**Decision required — choose one:**
- **Option A (recommended for v1):** Accept immutability. Document L2-only constraint. Deploy behind a known address registry so agents can migrate to v2 contracts later.
- **Option B:** Refactor into a UUPS proxy pattern using OpenZeppelin's `UUPSUpgradeable`. This is a significant refactor (~2-3 weeks) and requires re-auditing.
- **Option C:** Split into multiple contracts (core escrow + governance + messaging) behind a router. Reduces per-contract size below 24KB. Medium effort (~1-2 weeks).

**Minimum action for 95:** Document the chosen strategy in `DEPLOYMENT_READINESS_PLAN.md` and ensure the deploy script enforces the L2 constraint (already partially done — deploy script checks contract size).

---

## 2. Contract Tests (93 → 96)

251 tests passing. Gaps are narrow.

### 2a. Edge Case Coverage (+2 points)

**Action items:**
- Add fuzz-style tests for fee calculations with extreme values (1 wei, `type(uint256).max / 2`)
- Test all `require` paths in `_collectCybereumFee` (treasury not set, zero amount edge)
- Test role permission checks: `assignRole` to non-member, `removePermission` for non-existent permission
- Test `executeProposal` with tied votes and expired deadlines

### 2b. Gas Reporting (+1 point)

**Action items:**
1. Install gas reporter:
   ```bash
   npm install --save-dev hardhat-gas-reporter
   ```
2. Add to `hardhat.config.js`:
   ```javascript
   require("hardhat-gas-reporter");
   module.exports = {
     gasReporter: {
       enabled: true,
       currency: 'USD',
       gasPrice: 0.1, // L2 gas price in gwei
       outputFile: 'gas-report.txt',
       noColors: true,
     },
   };
   ```
3. Add `gas-report.txt` to `.gitignore`.
4. Include gas report step in CI.

---

## 3. Frontend (88 → 95)

### 3a. E2E Tests (+4 points)

No end-to-end test framework exists.

**Action items:**
1. Install Playwright:
   ```bash
   cd nexus-app
   npm install --save-dev @playwright/test
   npx playwright install
   ```
2. Create `nexus-app/e2e/` directory with tests for:
   - Page navigation (all 19 routes render without crash)
   - Wallet connection flow (mock MetaMask with Synpress or manual mock)
   - Agent registration form submission
   - Transaction error states (rejected by wallet, timeout)
   - Responsive layout at mobile/tablet/desktop breakpoints
3. Add to CI:
   ```yaml
   e2e:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - run: cd nexus-app && npm ci
       - run: cd nexus-app && npx playwright install --with-deps
       - run: cd nexus-app && npm run build
       - run: cd nexus-app && npx playwright test
   ```

### 3b. Content Security Policy (+2 points)

No CSP headers configured anywhere.

**Action items:**
1. Add CSP meta tag to `nexus-app/index.html`:
   ```html
   <meta http-equiv="Content-Security-Policy"
     content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.alchemy.com https://*.infura.io wss://*.alchemy.com; img-src 'self' data: https:; font-src 'self';">
   ```
2. For production hosting (Vercel/Cloudflare/Nginx), configure CSP as HTTP response headers (stronger than meta tag). Example for Vercel `vercel.json`:
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; connect-src 'self' https://*.alchemy.com wss://*.alchemy.com; style-src 'self' 'unsafe-inline'" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
         ]
       }
     ]
   }
   ```

### 3c. Error Monitoring Integration (+1 point)

**Action items:**
- Add Sentry (or similar) for production error tracking:
  ```bash
  cd nexus-app && npm install @sentry/react
  ```
- Initialize in `main.jsx` with environment-gated DSN
- Connect `ErrorBoundary` component to report caught errors

---

## 4. SDK (85 → 95)

### 4a. Integration Tests Against Local Hardhat (+5 points)

Current SDK tests are unit-only (mocked). No tests hit a real contract.

**Action items:**
1. Create `sdk/test/integration.test.js` that:
   - Spawns a Hardhat node (`npx hardhat node`)
   - Deploys the contract
   - Tests the full agent lifecycle: `discover()` → `safeOnboard()` → `depositNative()` → `transferNative()` → `createPaymentRequest()` → `settlePaymentRequest()`
   - Tests event listeners (`onPaymentRequest`, `onDirectMessage`)
2. Add npm script: `"test:integration": "npx hardhat node & sleep 3 && node --test test/integration.test.js; kill %1"`
3. Add to CI as a separate job (depends on contract compilation).

### 4b. TypeScript Declarations (+3 points)

The SDK is pure JS with no type information, making IDE integration poor.

**Action items:**
1. Create `sdk/index.d.ts` with type declarations for `AgentClient` class, all public methods, and the `PROJECT_DAO_ABI` export
2. Add `"types": "./index.d.ts"` to `sdk/package.json`
3. No need to convert to TypeScript — just the declaration file is sufficient

### 4c. Populate Deployment Registry (+2 points)

`sdk/deployments.json` has empty entries for all chains.

**Action items:**
- After deploying to testnet (Base Sepolia recommended), update:
  ```json
  {
    "84532": {
      "address": "0x<ACTUAL_DEPLOYED_ADDRESS>",
      "rpc": "https://sepolia.base.org"
    }
  }
  ```
- After mainnet deployment, update the `8453` entry
- The `discover()` method depends on this file — empty entries cause runtime errors

---

## 5. SDK Tests (80 → 95)

### 5a. Coverage Gaps (+10 points)

88 unit tests exist but several method families are untested beyond existence checks.

**Action items — add tests for:**
- `register()` / `updateMetadata()` — validate metadataURI format enforcement
- `depositToken()` / `withdrawToken()` / `transferToken()` — token address validation
- `stakeAndJoin()` — stake amount validation, metadata validation
- `createProject()` / `fundProject()` — deadline validation, budget validation
- `sendMessage()` — contentHash format validation, recipient validation
- `getInbox()` / `getMessage()` — pagination validation
- `onPaymentRequest()` / `onDirectMessage()` — callback registration (mock contract events)
- `safeOnboard()` — end-to-end flow with mocked contract responses
- `preflight()` — various contract states (not registered, low balance, already onboarded)
- Error message formatting for all error paths

### 5b. Test Coverage Reporting (+5 points)

**Action items:**
1. Add c8 for coverage:
   ```bash
   cd sdk && npm install --save-dev c8
   ```
2. Add script: `"test:coverage": "c8 node --test test/*.test.js"`
3. Target: 90%+ line coverage, 85%+ branch coverage
4. Add coverage badge to SDK README

---

## 6. CI Pipeline (75 → 95)

This dimension has the largest gap. Current CI only compiles contracts, runs contract tests, lints frontend, and builds frontend.

### 6a. Hardhat Verify Plugin (+3 points)

**Action items:**
1. Install:
   ```bash
   npm install --save-dev @nomicfoundation/hardhat-verify
   ```
2. Add to `hardhat.config.js`:
   ```javascript
   require("@nomicfoundation/hardhat-verify");
   module.exports = {
     etherscan: {
       apiKey: {
         base: process.env.BASESCAN_API_KEY || '',
         baseSepolia: process.env.BASESCAN_API_KEY || '',
       },
     },
   };
   ```
3. The deploy script already calls `hre.run("verify:verify")` — this makes it actually work.

### 6b. SDK Integration Test Job (+5 points)

**Action items:**
Add to `.github/workflows/ci.yml`:
```yaml
sdk-integration:
  runs-on: ubuntu-latest
  needs: contracts
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci
    - run: npx hardhat compile
    - run: cd sdk && npm ci
    - run: cd sdk && npm run test:integration
```

### 6c. Frontend E2E Job (+4 points)

See section 3a above. Add Playwright tests as a CI job.

### 6d. Dependency Audit (+3 points)

**Action items:**
Add to CI:
```yaml
audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm audit --audit-level=high
    - run: cd nexus-app && npm audit --audit-level=high
    - run: cd sdk && npm audit --audit-level=high
```

### 6e. Contract Size Gate (+2 points)

The CI already checks contract size but only within the test suite. Make it a first-class CI check:
```yaml
- name: Check contract size
  run: |
    npx hardhat compile
    node -e "
      const art = require('./artifacts/contracts/Project_DAO.sol/Project_DAO.json');
      const size = (art.deployedBytecode.length - 2) / 2;
      console.log('Contract size: ' + size + ' bytes (' + (size/1024).toFixed(1) + ' KB)');
      if (size > 24576) { console.log('WARNING: Exceeds L1 24KB limit. L2 deployment only.'); }
      if (size > 49152) { console.error('FATAL: Exceeds 48KB. Too large even for most L2s.'); process.exit(1); }
    "
```

### 6f. Branch Protection Rules (+3 points)

**Action items (GitHub settings, not code):**
- Require CI to pass before merging to `main`
- Require at least 1 approval on PRs
- Require branches to be up-to-date before merging
- Disable force-push to `main`

---

## 7. Deploy Script (88 → 95)

### 7a. Deployment Artifact Persistence (+4 points)

The deploy script logs to console but doesn't save artifacts.

**Action items:**
Add to `scripts/deploy.js` after the deployment summary:
```javascript
const fs = require('fs');
const artifactPath = `deployments/${chainId}-${address}.json`;
fs.mkdirSync('deployments', { recursive: true });
fs.writeFileSync(artifactPath, JSON.stringify({
  chainId,
  contractAddress: address,
  owner: finalOwner,
  treasury: finalTreasury,
  feeBps: Number(finalFeeBps),
  assetTransferFlatFeeWei: finalAssetFee.toString(),
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  transactionHash: dao.deploymentTransaction()?.hash,
}, null, 2));
console.log(`Deployment artifact saved to ${artifactPath}`);
```

### 7b. Auto-Update SDK Deployment Registry (+3 points)

After writing the deployment artifact, also update `sdk/deployments.json`:
```javascript
const registryPath = './sdk/deployments.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
registry[String(chainId)] = {
  address,
  rpc: registry[String(chainId)]?.rpc || '',
};
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Updated sdk/deployments.json for chain ${chainId}`);
```

---

## Priority Order (Effort vs Impact)

| Priority | Item | Effort | Impact | Score Gain |
|---|---|---|---|---|
| 1 | Slither in CI (6b) | 1 hour | High | +3 |
| 2 | `npm audit` in CI (6d) | 30 min | Medium | +3 |
| 3 | SDK unit test coverage (5a) | 4 hours | High | +10 |
| 4 | hardhat-verify plugin (6a) | 30 min | Medium | +3 |
| 5 | hardhat-gas-reporter (2b) | 30 min | Low | +1 |
| 6 | Deployment artifact persistence (7a+7b) | 1 hour | Medium | +7 |
| 7 | CSP headers (3b) | 1 hour | Medium | +2 |
| 8 | TypeScript declarations (4b) | 3 hours | Medium | +3 |
| 9 | SDK integration tests (4a) | 6 hours | High | +5 |
| 10 | Frontend E2E tests (3a) | 8 hours | High | +4 |
| 11 | Contract edge case tests (2a) | 3 hours | Medium | +2 |
| 12 | Populate deployment registry (4c) | Post-deploy | Medium | +2 |
| 13 | Error monitoring (3c) | 1 hour | Low | +1 |
| 14 | Branch protection (6f) | 15 min | Medium | +3 |
| 15 | Professional security audit (1a) | 2-6 weeks | Critical | +8 |

**Items 1-8 can be done in a single focused day (~11 hours) and would bring the score to ~92.**
**Items 9-14 require another 1-2 days and reach ~95.**
**Item 15 (audit) is the gatekeeper for true production deployment on mainnet.**

---

## Non-Negotiable Before Mainnet

These items MUST be completed before any mainnet deployment with real funds:

1. Professional security audit of `Project_DAO.sol`
2. Deployment registry populated with verified contract addresses
3. CSP headers configured at hosting layer
4. All CI checks passing (including Slither, audit, E2E)
5. Branch protection rules enabled on `main`
6. Treasury set to the correct `cybereum.eth` resolved address
7. Fee configuration verified (minimum 1 bps enforced by contract)

---

## Testnet Deployment Checklist

Before mainnet, deploy to Base Sepolia and verify:

- [ ] Deploy with `CYBEREUM_TREASURY` set
- [ ] Contract verified on Basescan
- [ ] SDK `discover()` works against testnet
- [ ] Full agent lifecycle tested: register → deposit → transfer → payment request → settle
- [ ] Frontend connects and displays correct data
- [ ] E2E tests pass against testnet
- [ ] Gas costs documented for all major operations
- [ ] Deployment artifact saved and SDK registry updated
