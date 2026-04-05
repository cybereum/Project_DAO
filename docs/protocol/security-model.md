# Security Model

> Access control, reentrancy protection, pause mechanism, and threat model for Project_DAO.

---

## Access Control Hierarchy

```
Owner (deployer)
  └─ Member (addMember / stakeAndJoin)
       └─ Registered Agent (registerAgent — requires membership)
            └─ Public (read-only views)
```

### Modifiers

| Modifier | Scope | Applies to |
|---|---|---|
| `onlyOwner` | Treasury/fee config, member management, roles, pause, feature kit status | Owner address only |
| `onlyMember` | Agent registration, proposals, voting, feature kit submit/upvote | `members[msg.sender].isMember` |
| `onlyRegisteredAgent` | All escrow, transfer, payment, messaging, agreement, stream operations | `agents[msg.sender].registered` |
| `whenNotPaused` | All state-changing functions (including owner config as of v0.5.0) | `!paused` |
| `nonReentrant` | All ETH/token transferring functions | Reentrancy lock |

## Reentrancy Protection

All functions that transfer ETH or ERC-20 tokens use `nonReentrant`:

**Native ETH**: depositNativeToEscrow, withdrawNativeFromEscrow, transferNativeBetweenAgents, settleAgentPaymentRequest, claimProjectShare, refundProjectFunder, leaveDAO, withdrawFromStream, cancelPaymentStream

**ERC-20**: depositTokenToEscrow, withdrawTokenFromEscrow, transferTokenBetweenAgents

The guard is implemented inline (not via OpenZeppelin's ReentrancyGuard) to avoid additional inheritance.

## Pause Mechanism

- `pauseContract()` / `resumeContract()` — owner only
- All state-changing functions check `whenNotPaused`
- As of v0.5.0: owner config functions (`setCybereumTreasury`, `setCybereumFeeConfig`, `setAIServiceFee`, `addPermission`) also enforce `whenNotPaused`
- Read-only view functions remain accessible when paused

## Known Security Constraints

### Critical
1. **Contract size** (~53 KB bytecode > 24 KB limit) — cannot deploy to mainnet without splitting
2. **Shared ETH pool** — agent escrow, project funds, and stakes share `address(this).balance`. Cross-contamination risk if one pool is depleted by another.

### High
- No professional audit performed (AI-assisted only)
- No timelock/multisig on critical owner functions (treasury, fee config)
- No formal verification

### Medium
- Owner dashboard uses client-side passcode (`VITE_OWNER_DASHBOARD_PASSCODE`)
- `addMember`/`removeMember` iterate all milestones (O(n) gas)
- No rate limiting on messaging or payment request creation

### Mitigations in Place
- Fee transfer uses `.call{value:}()` with explicit revert (not `.transfer()`)
- Treasury zero-address check on every fee collection path
- SDK validates contract address on construction and metadata URIs on write
- Frontend enforces HTTPS for AI service calls in production
- Frontend `dataLoadError` state surfaces contract read failures (no silent swallowing)

## Threat Model Summary

| Threat | Mitigation | Gap |
|---|---|---|
| Reentrancy | `nonReentrant` on all transfer functions | None — comprehensive coverage |
| Owner compromise | Single owner address | HIGH — needs multisig/timelock |
| Fee bypass | `MIN_FEE_BPS = 1`, all paths route through `_collectCybereumFee` | None |
| Pause bypass | `whenNotPaused` on all state-changing functions | None |
| Cross-pool insolvency | Accounting variables track per-pool balances | MEDIUM — no hard reserve segregation |
| Malicious ERC-20 | `nonReentrant` on token operations | Partial — no token whitelist |
| Front-running | No mitigation | LOW — fee structure makes sandwich attacks unprofitable |

---

## Backlinks

- [architecture.md](architecture.md) — System structure
- [audit-findings.md](audit-findings.md) — Detailed findings
- [../knowledge-base/concepts/smart-contract-security.md](../knowledge-base/concepts/smart-contract-security.md) — Security theory
- [../knowledge-base/patterns/reentrancy-guards.md](../knowledge-base/patterns/reentrancy-guards.md) — Reentrancy pattern details
- [../knowledge-base/patterns/access-control-patterns.md](../knowledge-base/patterns/access-control-patterns.md) — Access control theory

---
*Source: contracts/Project_DAO.sol, SECURITY.md, AUDIT_REPORT.md, CLAUDE.md §10*
*Last updated: 2026-04-05*
