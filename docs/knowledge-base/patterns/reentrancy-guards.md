# Reentrancy Guards

> Protecting smart contracts against reentrancy attacks.

---

## The Attack

Reentrancy occurs when a contract makes an external call (e.g., sending ETH) before updating its own state. The recipient can call back into the original function before the state update, draining funds.

```
Attacker calls withdraw()
  → Contract sends ETH to attacker
    → Attacker's receive() calls withdraw() again
      → Contract still shows old balance → sends more ETH
        → ... repeat until drained
```

The DAO hack (2016, $60M) was the most famous reentrancy exploit.

## Defense Patterns

### 1. Checks-Effects-Interactions (CEI)
```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);  // Check
    balances[msg.sender] -= amount;            // Effect (state update FIRST)
    (bool ok,) = msg.sender.call{value: amount}("");  // Interaction (external call LAST)
    require(ok);
}
```

Necessary but not always sufficient for complex multi-function interactions.

### 2. Reentrancy Guard (Mutex Lock)
```solidity
uint256 private _locked = 1;

modifier nonReentrant() {
    require(_locked == 1, "Reentrant");
    _locked = 2;
    _;
    _locked = 1;
}
```

Prevents any `nonReentrant` function from being called while another is executing. Project_DAO uses this pattern inline (not via OpenZeppelin inheritance).

### 3. OpenZeppelin ReentrancyGuard
```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract MyContract is ReentrancyGuard {
    function withdraw() external nonReentrant { ... }
}
```

Production-tested implementation; recommended for new contracts.

## Project_DAO Coverage

All functions that transfer value use `nonReentrant`:

| Category | Functions |
|---|---|
| Native ETH | deposit, withdraw, transfer, settle, claim, refund, leave, stream withdraw/cancel |
| ERC-20 | deposit, withdraw, transfer |
| Service agreements | approve delivery, resolve dispute, cancel |

## Cross-Function Reentrancy

Even with per-function guards, reentrancy can occur across functions if they share state:
```
Function A (nonReentrant) calls external contract
  → External contract calls Function B (different nonReentrant)
    → Function B reads stale state from A's incomplete execution
```

Project_DAO's single `_locked` variable protects against this — the lock is global, not per-function.

---

## Backlinks

- [../../protocol/security-model.md](../../protocol/security-model.md) — Security implementation
- [../concepts/smart-contract-security.md](../concepts/smart-contract-security.md) — Broader security context
- [../concepts/escrow-patterns.md](../concepts/escrow-patterns.md) — Reentrancy in escrow
- [access-control-patterns.md](access-control-patterns.md) — Complementary defense layer

---
*Last updated: 2026-04-05*
