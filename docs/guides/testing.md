# Testing Guide

> Test architecture, coverage areas, writing tests, and CI pipeline.

---

## Running Tests

```bash
npx hardhat test                    # All 391 tests
npx hardhat test --grep "escrow"    # Filter by pattern
cd nexus-app && npm run lint        # Frontend linting
```

## Test Architecture

- **Framework**: Mocha/Chai with Hardhat test helpers
- **File**: `test/ProjectDAO.test.js`
- **Structure**: 61 describe blocks, 391 tests
- **Helpers**: `deploy()` (fresh contract), `memberAgent()` (member + agent setup)

## Coverage Areas

| Area | Tests | Key assertions |
|---|---|---|
| Fee configuration | Defaults, bounds, preview calculations | MIN_FEE_BPS enforced |
| Treasury | Setting, zero-address validation | Revert on address(0) |
| Agent registration | Register, discover, metadata update | Event emission |
| Escrow (native) | Deposit, withdraw, transfer | Balance accounting, fee deduction |
| Escrow (ERC-20) | Deposit, withdraw, transfer | Token balance tracking |
| Payment requests | Create, settle, cancel, edge cases | Status transitions |
| Economic projects | Full lifecycle (create → complete/cancel) | Share distribution, refunds |
| Onboarding | stakeAndJoin, leaveDAO | Stake tracking, active project count |
| Governance | Proposals, voting, disputes | Time-bounded voting, milestone scoping |
| Roles & permissions | Create, assign, 1-based indexing | Permission checks |
| Direct messaging | Send, read, inbox, conversation | Sender/recipient access control |
| Feature kits | Submit, upvote, status changes | Lifecycle transitions |
| Reentrancy | All ETH/token-transferring functions | nonReentrant enforcement |
| Pause coverage | All state-changing functions | whenNotPaused enforcement |
| Event audit | Critical state changes | Event parameters correct |

## Writing New Tests

```js
describe("YourFeature", function () {
  let dao, owner, alice, bob;

  beforeEach(async () => {
    ({ dao, owner, alice, bob } = await deploy());
  });

  it("should do the expected thing", async () => {
    // Setup: use memberAgent() for quick agent setup
    await memberAgent(dao, owner, alice);

    // Act
    await dao.connect(alice).someFunction(args);

    // Assert
    expect(await dao.someView()).to.equal(expected);
  });
});
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`):
1. **contracts**: `npm ci` → compile → bytecode size check → test → dependency audit
2. **frontend**: `npm ci` → lint → build → dependency audit
3. **sdk**: module load → unit tests → dependency audit
4. **ABI sync**: verify frontend ABI matches compiled contract

---

## Backlinks

- [builder-integration.md](builder-integration.md) — Development setup
- [../protocol/security-model.md](../protocol/security-model.md) — What the tests protect
- [../product/deployment-readiness.md](../product/deployment-readiness.md) — Test coverage scores

---
*Source: TESTING_GUIDE.md, test/ProjectDAO.test.js*
*Last updated: 2026-04-05*
