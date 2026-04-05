# Diamond Proxy Pattern (EIP-2535)

> Splitting large contracts into modular facets that share state — the solution for Project_DAO's 41 KB size problem.

---

## The Problem

Project_DAO.sol is ~41 KB, exceeding the 24,576-byte EIP-170 limit. It cannot be deployed to Ethereum mainnet or most L2s without splitting.

## What is the Diamond Pattern?

EIP-2535 defines a "Diamond" — a proxy contract that delegates calls to multiple implementation contracts ("facets") while sharing a single storage layout.

```
                    ┌──────────────────┐
                    │   Diamond Proxy   │
                    │  (delegatecall)   │
                    └───┬────┬────┬────┘
                        │    │    │
              ┌─────────┘    │    └─────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ Governance  │  │   Agent    │  │  Projects   │
     │   Facet     │  │  Economy   │  │   Facet     │
     │             │  │   Facet    │  │             │
     └────────────┘  └────────────┘  └────────────┘
```

### Key Components
1. **Diamond proxy**: Routes function calls to the correct facet via `delegatecall`
2. **Facets**: Implementation contracts containing the actual logic
3. **Diamond storage**: Shared storage layout using storage slots (not sequential storage)
4. **Diamond loupe**: Standard interface for inspecting which facets handle which functions

## How It Applies to Project_DAO

### Proposed Facet Split

| Facet | Functions | Estimated size |
|---|---|---|
| **GovernanceFacet** | Proposals, voting, disputes, roles, milestones, tasks | ~10 KB |
| **AgentEconomyFacet** | Registration, escrow, transfers, payments, messaging | ~12 KB |
| **ProjectsFacet** | Economic projects, feature kits | ~8 KB |
| **StreamsFacet** | Service agreements, payment streams | ~6 KB |
| **AdminFacet** | Owner functions, pause, fee config, treasury | ~3 KB |

Each facet < 24 KB, deployable individually.

### Shared Storage

All facets share the same storage via Diamond storage pattern:
```solidity
library LibAppStorage {
    struct AppStorage {
        mapping(address => AgentProfile) agents;
        address[] agentAddresses;
        mapping(address => Member) members;
        // ... all current state variables
    }

    function appStorage() internal pure returns (AppStorage storage s) {
        assembly { s.slot := 0 }
    }
}
```

## Alternatives Considered

| Approach | Pros | Cons |
|---|---|---|
| **Diamond (EIP-2535)** | Modular, upgradeable, shared state | Complex, diamond-specific tooling needed |
| **Library extraction** | Simple, no proxy overhead | Limited — libraries can't have state |
| **Multiple contracts** | Simple deployment | No shared state without message passing |
| **Solidity optimizer** | No code changes | Already optimized (1 run), only marginal gains |

## Implementation Resources

- [EIP-2535 specification](https://eips.ethereum.org/EIPS/eip-2535)
- [diamond-3-hardhat](https://github.com/mudgen/diamond-3-hardhat) — reference implementation
- [Louper](https://louper.dev/) — Diamond explorer and management UI

---

## Backlinks

- [../../protocol/architecture.md](../../protocol/architecture.md) — Current monolithic architecture
- [../../protocol/audit-findings.md](../../protocol/audit-findings.md) — C-1: size blocker
- [../../product/roadmap.md](../../product/roadmap.md) — WS4: contract splitting
- [../research/l2-scaling.md](../research/l2-scaling.md) — L2 deployment requires splitting
- [upgradeable-contracts.md](upgradeable-contracts.md) — Related upgradeability patterns

---
*Last updated: 2026-04-05*
