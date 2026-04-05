# OpenZeppelin Library

> OpenZeppelin contracts used by and available to Project_DAO.

---

## Currently Used

| Contract | Import | Usage in Project_DAO |
|---|---|---|
| **ERC721** | `@openzeppelin/contracts/token/ERC721/ERC721.sol` | `AssetNFT.sol` — asset tokenization |

## Custom Implementations (Not Using OZ)

| Pattern | Project_DAO approach | OZ equivalent |
|---|---|---|
| **ReentrancyGuard** | Inline `_locked` variable + `nonReentrant` modifier | `ReentrancyGuard.sol` |
| **Ownable** | Custom `onlyOwner` modifier with `owner` state variable | `Ownable.sol` |
| **Pausable** | Custom `paused` + `whenNotPaused` modifier | `Pausable.sol` |
| **AccessControl** | Custom role system with `createRole`, `assignRole` | `AccessControl.sol` |

## Available for Future Use

| Contract | Purpose | Relevance |
|---|---|---|
| **AccessControl** | Role-based access with admin roles | Could replace custom role system |
| **TimelockController** | Delayed execution of privileged operations | Needed for owner action timelock |
| **TransparentUpgradeableProxy** | Contract upgradeability | Alternative to Diamond if simpler upgrade needed |
| **UUPSUpgradeable** | Lightweight proxy pattern | Alternative proxy approach |
| **SafeERC20** | Safe token transfers (handles non-standard tokens) | Recommended for ERC-20 interactions |
| **ReentrancyGuardTransient** | Gas-optimized reentrancy guard (EIP-1153 transient storage) | Future optimization on supporting chains |
| **ERC1155** | Multi-token support | Batch agent transfers |

## Why Custom Instead of OZ?

Project_DAO uses custom implementations for:
1. **Smaller bytecode**: Avoiding inheritance overhead (contract already at 41 KB)
2. **Simpler dependencies**: Fewer imports = less surface area
3. **Custom semantics**: Role system has DAO-specific features (milestone-scoped roles)

The trade-off: less battle-tested code, more maintenance burden.

---

## Backlinks

- [../patterns/reentrancy-guards.md](../patterns/reentrancy-guards.md) — Reentrancy patterns
- [../patterns/access-control-patterns.md](../patterns/access-control-patterns.md) — Access control
- [../patterns/upgradeable-contracts.md](../patterns/upgradeable-contracts.md) — Proxy patterns
- [eip-standards.md](eip-standards.md) — Standards these implement

---
*Last updated: 2026-04-05*
