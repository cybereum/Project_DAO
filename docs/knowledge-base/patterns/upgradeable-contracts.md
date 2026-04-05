# Upgradeable Contracts

> Proxy patterns for evolving smart contract logic without losing state.

---

## Why Upgradeability?

Smart contracts are immutable by default. But complex protocols need to fix bugs, add features, and respond to changing requirements. Proxy patterns separate logic from storage, allowing logic upgrades.

## Proxy Patterns

### 1. Transparent Proxy (EIP-1967)
- Proxy delegates all calls to an implementation contract
- Admin can upgrade the implementation address
- Users interact with the proxy (stable address)
- **Limitation**: Admin can't call implementation functions directly (clash avoidance)
- **Used by**: OpenZeppelin TransparentUpgradeableProxy

### 2. UUPS (Universal Upgradeable Proxy Standard)
- Upgrade logic lives in the implementation, not the proxy
- Lighter proxy contract (cheaper deployment)
- Implementation must include `upgradeTo()` function
- **Risk**: If upgrade function is removed, contract becomes permanently non-upgradeable
- **Used by**: OpenZeppelin UUPSUpgradeable

### 3. Diamond (EIP-2535)
- Multiple implementation contracts (facets) behind one proxy
- Can upgrade individual facets without touching others
- Shared storage across all facets
- See [diamond-proxy.md](diamond-proxy.md) for details

### 4. Beacon Proxy
- Multiple proxies point to a single beacon that holds the implementation address
- Upgrade the beacon → all proxies upgrade simultaneously
- Good for factory patterns (many identical contracts)

## Comparison

| Pattern | Proxy complexity | Upgrade mechanism | Multi-facet | Gas overhead |
|---|---|---|---|---|
| Transparent | Medium | Admin sets impl | No | ~2,600 gas per call |
| UUPS | Low | Impl has upgradeTo | No | ~200 gas per call |
| Diamond | High | DiamondCut | Yes | ~2,600+ gas per call |
| Beacon | Low | Beacon update | No | ~2,800 gas per call |

## Storage Considerations

All proxy patterns require careful storage management:

- **Storage collisions**: Proxy and implementation must not use the same storage slots
- **EIP-1967 storage slots**: Standard slots for implementation/admin addresses
- **Diamond storage**: App-specific storage at deterministic slots
- **Initializers**: Constructors don't work with proxies — use `initialize()` functions
- **Storage gaps**: Reserve slots in base contracts for future variables (`uint256[50] __gap`)

## Relevance to Project_DAO

- Currently non-upgradeable (no proxy)
- Diamond proxy is the planned path for contract splitting (required for mainnet)
- If Diamond is chosen, upgradeability comes "for free"
- Alternative: deploy immutable Diamond, removing upgrade functions after stabilization

## Security Implications

- Upgradeability introduces trust assumptions (who can upgrade?)
- Timelock on upgrades is essential for production
- Consider removing upgradeability after stabilization (make immutable)
- Storage layout changes across upgrades can corrupt data

---

## Backlinks

- [diamond-proxy.md](diamond-proxy.md) — Diamond pattern details
- [access-control-patterns.md](access-control-patterns.md) — Who controls upgrades
- [../references/openzeppelin-library.md](../references/openzeppelin-library.md) — OZ proxy implementations
- [../../product/roadmap.md](../../product/roadmap.md) — Contract splitting plans

---
*Last updated: 2026-04-05*
