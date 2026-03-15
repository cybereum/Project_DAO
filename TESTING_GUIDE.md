# Testing Guide — Project_DAO

> How to run, understand, and write tests for the protocol.

---

## 1. Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run all contract tests
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run a specific test file
npx hardhat test test/ProjectDAO.test.js

# Compile contracts (tests auto-compile, but useful for checking compilation errors)
npx hardhat compile

# Frontend linting
cd nexus-app && npm run lint
```

---

## 2. Test Architecture

### Framework
- **Hardhat** test runner with **Mocha** test framework and **Chai** assertions
- Uses Hardhat's built-in local Ethereum network (no external testnet needed)
- ethers.js v6 for contract interaction in tests

### File Structure
```
test/
└── ProjectDAO.test.js    # All contract tests (single file, ~790 lines)
```

### Test Helpers

Two reusable helpers simplify test setup:

```javascript
// Deploy a fresh contract with treasury configured
async function deploy() {
  const [owner, alice, bob, carol, treasury] = await ethers.getSigners();
  const DAO = await ethers.getContractFactory("Project_DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();
  await dao.setCybereumTreasury(treasury.address);
  return { dao, owner, alice, bob, carol, treasury };
}

// Add a member and register them as an agent (common setup pattern)
async function memberAgent(dao, signer) {
  await dao.addMember(signer.address, 10);
  await dao.connect(signer).registerAgent("ipfs://test");
}
```

Each test calls `deploy()` for a fresh contract instance, ensuring test isolation.

---

## 3. Test Coverage by Domain

### Fee Configuration (7 tests)
| Test | What It Verifies |
|------|-----------------|
| defaults to 5 bps | Initial fee rate is 5 basis points |
| owner can update fee config | `setCybereumFeeConfig` changes both parameters |
| reverts if feeBps < MIN_FEE_BPS | Fee floor of 1 bps is enforced |
| reverts if feeBps > 100 | Fee ceiling of 100 bps (1%) is enforced |
| non-owner cannot update | Access control on fee changes |
| previewFee returns correct fee and net | Fee calculation math is correct |
| previewFee applies minimum 1-wei fee | Dust amount handling |

### Treasury Management (3 tests)
| Test | What It Verifies |
|------|-----------------|
| owner can set treasury | Treasury address can be changed |
| reverts on zero address | Zero-address treasury is rejected |
| non-owner cannot set treasury | Access control on treasury changes |

### Agent Registration (5 tests)
| Test | What It Verifies |
|------|-----------------|
| member can register as agent | Registration succeeds and stores metadata |
| emits AgentRegistered event | Correct event emitted with args |
| non-member cannot register | Access control on registration |
| cannot register twice | Duplicate registration prevented |
| registered agent can update metadata | Metadata update works |

### Agent Discovery (4 tests)
| Test | What It Verifies |
|------|-----------------|
| getAgentCount increases on registration | Counter tracks registrations |
| getRegisteredAgents returns addresses and metadata | Paginated query returns correct data |
| getRegisteredAgents paginates correctly | Pagination with offset/limit works |
| stakeAndJoin also populates agent registry | Self-onboarding adds to discovery |

### Native ETH Escrow — Deposit (5 tests)
| Test | What It Verifies |
|------|-----------------|
| increases escrow balance net of fee | Balance = deposit - fee |
| sends fee to treasury | Treasury receives exact fee amount |
| emits AgentNativeEscrowDeposited | Correct event with net amount |
| reverts on zero value | Zero deposits rejected |
| non-agent cannot deposit | Access control |

### Native ETH Escrow — Withdraw (3 tests)
| Test | What It Verifies |
|------|-----------------|
| decreases balance and delivers net amount | Withdrawal accounting is correct |
| emits AgentNativeEscrowWithdrawn | Correct event emitted |
| reverts on insufficient balance | Overdraw prevented |

### Agent-to-Agent Transfer (6 tests)
| Test | What It Verifies |
|------|-----------------|
| moves net amount from sender to recipient | Transfer accounting correct |
| emits AgentToAgentNativeTransfer | Correct event with net amount |
| emits CybereumFeePaid | Fee event emitted |
| reverts if recipient not registered | Only agent-to-agent transfers |
| reverts on self-transfer | Self-transfers prevented |
| reverts on insufficient balance | Overdraw prevented |

### Payment Requests (7 tests)
| Test | What It Verifies |
|------|-----------------|
| create a native payment request | Request stored with correct fields |
| emits AgentPaymentRequestCreated | Correct event emitted |
| payer can settle with exact ETH | Settlement delivers net to requester wallet |
| emits AgentPaymentRequestSettled | Correct event on settlement |
| reverts settling with wrong ETH | Exact amount required |
| requester can cancel | Cancellation works |
| non-requester cannot cancel | Access control on cancellation |

### Contract Pause (3 tests)
| Test | What It Verifies |
|------|-----------------|
| owner can pause and unpause | Pause/resume lifecycle works |
| pauseContract blocks state-changing calls | Paused contract rejects writes |
| non-owner cannot pause | Access control |

### Member Management (3 tests)
| Test | What It Verifies |
|------|-----------------|
| owner can add a member | Member added with voting power |
| owner can remove a member | Member removed |
| non-owner cannot add member | Access control |

### Open Onboarding — stakeAndJoin / leaveDAO (4 tests)
| Test | What It Verifies |
|------|-----------------|
| non-member can stake and join | Self-registration works |
| stake and join, then leave to reclaim | Full lifecycle with refund |
| reverts if already a member | Duplicate prevention |
| reverts below minStakeToJoin | Minimum stake enforced |

### Economic Projects (5 tests)
| Test | What It Verifies |
|------|-----------------|
| agent can create a project | Project created with correct fields |
| anyone can fund a project | Funding adds net amount (minus fee) |
| contributor apply -> approve -> complete -> claim | Full project lifecycle |
| contributor cannot claim twice | Double-claim prevented |
| reverts funding cancelled project | Cancelled projects reject funding |

### Feature Kit Pipeline (5 tests)
| Test | What It Verifies |
|------|-----------------|
| registered agent can submit a kit | Kit stored with correct fields |
| member can upvote a kit once | Vote counted |
| cannot upvote twice | Double-voting prevented |
| owner can change kit status | Status lifecycle works |
| getFeatureKits paginates correctly | Pagination works |

### System Integration (2 tests)
| Test | What It Verifies |
|------|-----------------|
| two agents: deposit, transfer, withdraw end-to-end | Full lifecycle with fee verification |
| payment request full round-trip | Create -> settle -> verify balances |

**Total: 62 tests across 13 test suites**

---


## 3.1 Coverage Runner Limitation

- `npm run test:coverage` currently fails in this repository because `Project_DAO` is very large and deployment runs out of gas in the coverage-instrumented EVM, even though the normal Hardhat test run passes.
- Use `npm test` as the CI gate for now, and treat coverage output as non-authoritative until the contract is split/refactored or coverage config is adjusted further.

---

## 4. Writing New Tests

### Test Structure Pattern

Follow the existing pattern for consistency:

```javascript
describe("Feature name", () => {
  it("describes expected behavior", async () => {
    // 1. Setup: deploy fresh contract
    const { dao, owner, alice } = await deploy();

    // 2. Arrange: set up preconditions
    await dao.registerAgent("ipfs://test");
    await memberAgent(dao, alice);

    // 3. Act: perform the action
    await dao.someFunction(args);

    // 4. Assert: verify results
    const result = await dao.someView();
    expect(result).to.equal(expectedValue);
  });

  it("reverts on invalid input", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).restrictedFunction())
      .to.be.revertedWith("Expected error message.");
  });

  it("emits correct event", async () => {
    const { dao, owner } = await deploy();
    await expect(dao.someFunction(args))
      .to.emit(dao, "EventName")
      .withArgs(expectedArg1, expectedArg2);
  });
});
```

### Key Testing Patterns

**Fee math verification:**
```javascript
const amount = ethers.parseEther("1");
const fee = amount * 5n / 10000n;  // 5 bps
const net = amount - fee;
```

**Balance tracking across transactions:**
```javascript
const balBefore = await ethers.provider.getBalance(address);
const tx = await contract.someFunction();
const receipt = await tx.wait();
const gasCost = receipt.gasUsed * receipt.gasPrice;
const balAfter = await ethers.provider.getBalance(address);
expect(balAfter - balBefore + gasCost).to.equal(expectedChange);
```

**Using closeTo for approximate comparisons:**
```javascript
expect(actual).to.be.closeTo(expected, ethers.parseEther("0.0001"));
```

### Adding a New Test Suite

1. Add your `describe` block to `test/ProjectDAO.test.js`
2. Use the `deploy()` helper for a fresh contract
3. Use `memberAgent(dao, signer)` when you need a registered agent
4. Follow naming convention: `"Feature name"` for describe, `"describes what happens"` for it
5. Test both happy path and error cases
6. Verify events are emitted with correct arguments
7. Verify fee deductions on any value-moving operation

---

## 5. Coverage Gaps (Known)

The following areas have limited or no test coverage. These are priorities for expanding the test suite:

### High Priority
- **Dispute resolution** — `disputeProposal`, `voteOnProposalDispute` not tested
- **Task management** — `createTask`, `updateTaskStatus`, `addTaskProgress` not tested
- **Reentrancy attack tests** — No malicious contract tests verifying `nonReentrant` guard
- **ERC-20 token escrow** — `depositTokenToEscrow`, `withdrawTokenFromEscrow`, `transferTokenBetweenAgents` not tested
- **ERC-721 asset transfer** — `transferAssetBetweenAgents` not tested

### Medium Priority
- **Role and permission system** — `createRole`, `addPermission`, `assignRole` not tested
- **Proposal lifecycle** — `createProposal`, `vote`, `executeProposal` not tested
- **Milestone management** — Milestone creation and scoped voting not tested
- **Agent broadcasts** — `broadcastToAgents` not tested
- **Project cancellation and refunds** — `cancelProject`, `refundProjectFunder` partially tested

### Low Priority
- **Gas optimization benchmarks** — No gas usage regression tests
- **Large-scale pagination** — Pagination not tested with 100+ entries
- **Edge cases** — Concurrent operations, contract size limits, max uint256 values

---

## 6. Frontend Testing

### Linting
```bash
cd nexus-app
npm run lint
```

ESLint is configured via `nexus-app/eslint.config.js`. The CI pipeline runs lint checks on every PR.

### Build Verification
```bash
cd nexus-app
npm run build
```

A successful build verifies that all imports resolve, JSX compiles, and Vite chunking produces valid output.

### Deployment Gate
```bash
cd nexus-app
npm run check:deploy
```

Validates sitemap, SEO metadata, and build output before deployment.

### Frontend E2E Tests (Not Yet Implemented)
E2E tests using Playwright or Cypress are planned but not yet implemented. Priority areas:
- Wallet connection flow
- Agent registration via UI
- Escrow deposit/withdraw/transfer flows
- Payment request lifecycle via UI
- Feature kit submission and voting

---

## 7. CI/CD Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs automatically on push/PR to `main`/`master`:

### Contract Job
```yaml
- npm ci
- npx hardhat compile
- npx hardhat test
```

### Frontend Job
```yaml
- npm ci (in nexus-app/)
- npm run lint
- npm run build
```

Both jobs must pass for a PR to be mergeable. Tests run on Ubuntu latest with Node.js 20.

---

## 8. Running Tests Locally

### Prerequisites
- Node.js 20+
- npm

### First-Time Setup
```bash
git clone <repo-url>
cd Project_DAO
npm install
```

### Running Tests
```bash
# All tests
npx hardhat test

# With verbose output
npx hardhat test --verbose

# Specific test by grep
npx hardhat test --grep "Fee configuration"

# With gas reporting
REPORT_GAS=true npx hardhat test
```

### Common Issues

**"Cannot find module 'hardhat'"**
Run `npm install` in the project root.

**"Contract exceeds size limit"**
The contract is 40,329 bytes, which exceeds L1 limits. Tests run on Hardhat's local network where this limit is not enforced (`allowUnlimitedContractSize: true` in hardhat.config.js).

**"Only the owner can call this function"**
Ensure you're calling with the correct signer. The first signer from `ethers.getSigners()` is the contract deployer (owner).
