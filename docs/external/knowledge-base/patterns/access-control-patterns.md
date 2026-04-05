# Access Control Patterns

> Role-based, hierarchical, and capability-based access control in smart contracts.

---

## Pattern Taxonomy

### 1. Owner-Only (Ownable)
- Single address with full admin privileges
- Simple, widely used (OpenZeppelin `Ownable`)
- Risk: Single point of failure — owner key compromise = total loss
- **Project_DAO**: Uses `onlyOwner` for admin functions

### 2. Role-Based (AccessControl)
- Multiple roles with specific permissions
- OpenZeppelin `AccessControl`: `grantRole`, `revokeRole`, `hasRole`
- More granular than Ownable, supports separation of duties
- **Project_DAO**: Has `createRole`, `addPermission`, `assignRole` — custom implementation

### 3. Hierarchical (Tiered)
- Roles form a hierarchy: higher tiers can do everything lower tiers can
- Project_DAO hierarchy: `Owner > Member > Registered Agent > Public`
- Each tier unlocks additional function access

### 4. Capability-Based
- Access granted by possessing a specific token or capability, not by address
- ERC-721 ownership as access control (NFT-gated)
- More composable — capabilities can be transferred

### 5. Timelock
- Actions require a delay between proposal and execution
- Prevents instant malicious changes; gives community time to react
- Common in DeFi governance (Compound Timelock, OpenZeppelin TimelockController)
- **Project_DAO gap**: No timelock on critical owner functions (treasury, fee config)

### 6. Multisig
- Multiple signatures required to execute (Gnosis Safe / Safe)
- 2-of-3, 3-of-5, etc. — no single point of failure
- **Project_DAO gap**: Owner is a single EOA

## Best Practice: Defense in Depth

Combine multiple patterns:
```
Multisig wallet (owner) → Timelock delay → Role check → Pause check → Execute
```

## Project_DAO Implementation

```solidity
modifier onlyOwner()          { require(msg.sender == owner); }
modifier onlyMember()         { require(members[msg.sender].isMember); }
modifier onlyRegisteredAgent() { require(agents[msg.sender].registered); }
modifier whenNotPaused()      { require(!paused); }
```

**Strengths**: Clear hierarchy, consistent modifier usage, pause mechanism
**Gaps**: No timelock, single-owner EOA, no multisig

## Migration Path

1. **Deploy Gnosis Safe** as owner (immediate improvement, no contract changes)
2. **Add TimelockController** between Safe and contract for critical functions
3. **Consider on-chain governance** for fee/treasury changes long-term

---

## Backlinks

- [../../protocol/security-model.md](../../protocol/security-model.md) — Current access control
- [../concepts/smart-contract-security.md](../concepts/smart-contract-security.md) — Security theory
- [reentrancy-guards.md](reentrancy-guards.md) — Complementary defense
- [../references/openzeppelin-library.md](../references/openzeppelin-library.md) — OZ AccessControl

---
*Last updated: 2026-04-05*
