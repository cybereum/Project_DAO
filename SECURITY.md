# Security — Project_DAO

> Security model, threat landscape, controls, and disclosure policy.

---

## 1. Security Architecture Overview

Project_DAO is a Solidity smart contract deployed on EVM-compatible chains. Security is enforced at the contract level through access control modifiers, reentrancy guards, fee floor enforcement, and pause mechanisms.

```
┌─────────────────────────────────────────────────────┐
│                   Access Control                     │
│  onlyOwner │ onlyMember │ onlyRegisteredAgent        │
│  onlyRole  │ whenNotPaused                           │
├─────────────────────────────────────────────────────┤
│              Reentrancy Protection                   │
│  nonReentrant on all ETH-transferring functions      │
├─────────────────────────────────────────────────────┤
│              Fee Floor Enforcement                   │
│  MIN_FEE_BPS = 1 (cannot be set to zero)            │
│  Treasury zero-address check on every fee path       │
├─────────────────────────────────────────────────────┤
│              Emergency Controls                      │
│  pauseContract() / resumeContract() (owner only)     │
└─────────────────────────────────────────────────────┘
```

---

## 2. Access Control Model

### Modifiers

| Modifier | Who Can Call | Protected Functions |
|----------|------------|---------------------|
| `onlyOwner` | Contract deployer / owner | Treasury config, fee config, member management, role management, pause/resume, feature kit status, broadcasts |
| `onlyMember` | DAO members (added by owner or self-onboarded) | Agent registration, proposal creation, voting, feature kit submission/upvoting |
| `onlyRegisteredAgent` | Members who called `registerAgent` | All escrow operations, transfers, payment requests, project creation |
| `onlyRole(permission)` | Members assigned a role with the specific permission | Task progress updates, milestone-scoped operations |
| `whenNotPaused` | Anyone (when contract is active) | All state-changing functions |
| `nonReentrant` | N/A (internal guard) | All functions that transfer ETH |

### Privilege Escalation Path

```
Non-member (no access)
  → stakeAndJoin() → Member + Agent (self-service, requires stake)
  → addMember()    → Member (owner-gated)
    → registerAgent() → Registered Agent (self-service for members)
      → Full escrow, transfer, payment request access
```

### Owner Capabilities

The owner has significant power. In the current implementation, the owner can:

- Change the treasury address (redirects all future fees)
- Adjust fee rates (within 1-100 bps range)
- Add/remove members
- Pause/resume the entire contract
- Change ownership to another address
- Set feature kit statuses
- Broadcast messages to agents
- Set minimum stake for self-onboarding

**Mitigation consideration:** A timelock or multisig guard on `setCybereumTreasury()` and `setCybereumFeeConfig()` is recommended before mainnet deployment to prevent instant, unilateral changes. This is currently a Tier-2 item in the deployment roadmap.

---

## 3. Threat Model

### 3.1 Reentrancy Attacks

**Threat:** Malicious contract calls back into Project_DAO during ETH transfer, attempting to drain funds.

**Controls:**
- `nonReentrant` modifier (inline ReentrancyGuard) on all ETH-transferring functions:
  - `withdrawNativeFromEscrow`
  - `settleAgentPaymentRequest`
  - `claimProjectShare`
  - `refundProjectFunder`
  - `leaveDAO`
- Safe `.call{value:}` pattern used instead of `.transfer()` (avoids 2300 gas limit issues)

**Residual risk:** Low. Reentrancy guard + checks-effects-interactions pattern. However, no dedicated reentrancy attack tests exist yet (planned).

### 3.2 Fee Bypass

**Threat:** Agent finds a way to transfer value without paying the protocol fee.

**Controls:**
- `_collectNativeFee()` and `_collectTokenFee()` are called internally on every value transfer path
- `_calculateFee()` enforces minimum 1 wei fee even on dust amounts
- `MIN_FEE_BPS = 1` — owner cannot set fee to zero
- Treasury zero-address check prevents fee from being sent to burn address
- Fee is deducted before net value is transferred (not after)

**Residual risk:** Very low. All value paths go through centralized fee collection helpers.

### 3.3 Treasury Hijacking

**Threat:** Attacker gains owner access and redirects treasury to their address.

**Controls:**
- `setCybereumTreasury` requires `onlyOwner`
- Zero-address check prevents setting treasury to burn address
- `CybereumTreasuryUpdated` event emitted on every change (auditable)

**Residual risk:** Medium. No timelock, multisig, or governance delay currently exists. A compromised owner key can immediately redirect all fees. **Recommended: add timelock before mainnet.**

### 3.4 Escrow Drain

**Threat:** Attacker withdraws more than their escrow balance.

**Controls:**
- Balance check: `require(agents[msg.sender].nativeEscrowBalance >= _amount)`
- Balance updated before transfer (checks-effects-interactions)
- `nonReentrant` on withdrawal functions

**Residual risk:** Low.

### 3.5 Payment Request Manipulation

**Threat:** Attacker settles someone else's payment request or settles with wrong amount.

**Controls:**
- Settlement requires exact `msg.value == request.amount` for native payments
- Only the designated payer can settle (enforced by `require(msg.sender == request.payer)`)
- Only the requester can cancel
- Status checks prevent double-settlement or settling cancelled requests

**Residual risk:** Low.

### 3.6 Denial of Service via Pause

**Threat:** Owner maliciously pauses the contract, freezing all agent operations.

**Controls:**
- Only owner can pause (access control)
- Only owner can resume (same key required)
- Escrow balances are preserved during pause (no loss of funds)

**Residual risk:** Medium. A malicious or compromised owner could indefinitely freeze operations. Funds remain safe but inaccessible. **Recommended: add governance-based unpause mechanism.**

### 3.7 Front-Running

**Threat:** MEV bots front-run agent transactions (especially payment request settlements).

**Controls:**
- Payment requests have designated payers — random addresses cannot settle
- Escrow operations are account-scoped — only the agent's own balance is affected

**Residual risk:** Low for most operations. Agent-to-agent transfers could theoretically be front-run, but the impact is minimal since balances are internal to the contract.

### 3.8 Integer Overflow/Underflow

**Threat:** Arithmetic operations produce unexpected results.

**Controls:**
- Solidity 0.8.26 has built-in overflow/underflow protection (reverts automatically)
- Fee calculation uses `uint256` with explicit bounds checking

**Residual risk:** Very low.

### 3.9 API Key Exposure (NexusAI Server)

**Threat:** Anthropic API key leaked to frontend or logs.

**Controls:**
- API key read from `ANTHROPIC_API_KEY` environment variable only
- Server-side proxy architecture — browser never sees the API key
- No `VITE_ANTHROPIC_API_KEY` prefix (would expose to frontend bundle)

**Residual risk:** Low, provided server is properly configured. **Recommended: add rate limiting before public exposure.**

---

## 4. Solidity Security Patterns Used

### Checks-Effects-Interactions
All state-changing functions follow this pattern:
1. **Check** preconditions (modifiers, require statements)
2. **Update** state (balance changes, status updates)
3. **Interact** with external contracts (ETH transfers, token calls)

### ReentrancyGuard
Inline implementation (no external dependency) using a `_reentrancyLock` state variable. Functions marked `nonReentrant` cannot be re-entered during execution.

### Safe ETH Transfer
All ETH transfers use the `.call{value:}("")` pattern with explicit success checking:
```solidity
(bool success, ) = recipient.call{value: amount}("");
require(success, "Transfer failed.");
```
This avoids the 2300 gas stipend limitation of `.transfer()` and prevents silent failures.

### Custom Error Types
ERC-6093 style custom errors are declared for gas-efficient reverts:
- `Unauthorized`, `NotMember`, `NotRegisteredAgent`, `ContractPaused`
- `ZeroAmount`, `InsufficientBalance`, `InvalidAddress`, `TransferFailed`
- `AlreadyExists`, `NotFound`, `InvalidStatus`

Note: The contract currently uses both custom errors and `require` strings. Migration to custom errors throughout is a Tier-3 improvement.

---

## 5. Known Limitations

### Contract Size
The contract is **40,329 bytes**, exceeding the Ethereum L1 Spurious Dragon limit of 24,576 bytes. This means:
- **Cannot deploy to Ethereum L1** without splitting into multiple contracts (Diamond proxy or library extraction)
- **Can deploy to L2 chains** (Base, Arbitrum, Optimism) where this limit is relaxed
- Hardhat tests use `allowUnlimitedContractSize: true` to bypass this locally

### Single Owner
The contract uses a single owner address with broad powers. There is no:
- Multisig requirement
- Timelock on critical operations
- Governance-based owner changes

### No Formal Verification
The contract has not undergone formal verification. Critical invariants (e.g., "treasury balance delta equals sum of all fees") are tested but not formally proven.

### No Upgrade Mechanism
The contract is not upgradeable. Any bug fixes require deploying a new contract and migrating state.

---

## 6. Audit Status

### Current State
- **No professional security audit has been performed.**
- NexusAI security analysis mode provides automated scanning (available at `/nexus-ai` in the NEXUS app)
- 58 unit tests cover critical paths (fee math, escrow, transfers, payment requests, projects)
- ReentrancyGuard added to all ETH-transferring functions
- Safe `.call{value:}` pattern used throughout

### Recommended Before Mainnet
1. Professional audit by a reputable firm (OpenZeppelin, Trail of Bits, Cyfrin, or equivalent)
2. Reentrancy attack tests with malicious contract
3. Formal invariant verification for fee accounting
4. Gas optimization review

---

## 7. Responsible Disclosure

If you discover a security vulnerability in Project_DAO:

1. **Do not** open a public GitHub issue
2. **Do not** exploit the vulnerability on any live deployment
3. Report the vulnerability via the project's GitHub security advisory feature or contact the repository owner directly
4. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if applicable)

We aim to acknowledge reports within 48 hours and provide a resolution timeline within 1 week.

---

## 8. Security Checklist for Contributors

When modifying the contract, verify:

- [ ] All new state-changing functions include `whenNotPaused`
- [ ] All new ETH-transferring functions include `nonReentrant`
- [ ] All new functions have appropriate access control (`onlyOwner`, `onlyMember`, `onlyRegisteredAgent`)
- [ ] State is updated before external calls (checks-effects-interactions)
- [ ] ETH transfers use `.call{value:}` not `.transfer()` or `.send()`
- [ ] Fee is collected on all new value-transfer paths
- [ ] Treasury zero-address is checked before fee transfer
- [ ] Events are emitted for all state changes
- [ ] No new `msg.value` operations allow re-entrancy
- [ ] No new integer arithmetic can overflow (Solidity 0.8+ handles this, but verify logic)
- [ ] No sensitive data is stored on-chain (private keys, API keys, PII)
- [ ] Tests are added for both happy path and error cases
