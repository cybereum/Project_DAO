# Operations Runbook

> Day-to-day operational procedures for treasury, fees, members, emergencies, and monitoring.

---

## Treasury Management

### Set Treasury Address
```solidity
setCybereumTreasury(0x...)  // Must be non-zero, resolves to cybereum.eth
```

### Monitor Treasury Balance
- Track `CybereumFeePaid` events for fee volume
- Verify treasury address hasn't been changed unexpectedly

## Fee Configuration

### View Current Fees
```solidity
cybereumFeeBps()              // Default: 5 (0.05%)
assetTransferFlatFeeWei()     // Default: 1e12 wei
previewFee(amount)            // → (fee, net)
```

### Update Fees
```solidity
setCybereumFeeConfig(newFeeBps, newFlatFeeWei)  // feeBps >= 1
```

## Member Lifecycle

### Add Members (Owner-gated)
```solidity
addMember(address, votingPower)
```

### Self-Onboarding (Permissionless)
```solidity
stakeAndJoin{ value: stakeAmount }("ipfs://metadata")
setMinStakeToJoin(minStake)  // Owner configures floor
```

### Remove / Leave
```solidity
removeMember(address)   // Owner
leaveDAO()              // Member — reclaims stake
```

## Emergency Procedures

### Pause All Operations
```solidity
pauseContract()   // Owner — halts all state-changing functions
resumeContract()  // Owner — resumes operations
```

**When to pause:**
- Suspected exploit or reentrancy attack
- Critical bug discovered in production
- Pending emergency fix deployment

**Note:** Owner config functions also halt when paused (as of v0.5.0).

## Monitoring Checklist

- [ ] Contract not paused (unless intentional)
- [ ] Treasury address correct and receiving fees
- [ ] Fee parameters within expected range
- [ ] No unexpected owner changes
- [ ] Agent registration rate normal
- [ ] No failed fee transfers in event logs
- [ ] CI pipeline passing

---

## Backlinks

- [../protocol/security-model.md](../protocol/security-model.md) — Security controls
- [../protocol/fee-model.md](../protocol/fee-model.md) — Fee mechanics
- [builder-integration.md](builder-integration.md) — Deployment steps
- [../_todo.md](../_todo.md) — Open operational tasks

---
*Source: OPERATIONS_RUNBOOK.md*
*Last updated: 2026-04-05*
