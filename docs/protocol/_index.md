# Protocol Documentation

> Core protocol design, architecture, and security documentation for the Cybereum settlement layer.

## Articles

| Article | Summary | Status |
|---|---|---|
| [architecture.md](architecture.md) | System architecture: contract structure, module boundaries, data flow | Current |
| [fee-model.md](fee-model.md) | Cybereum fee rail: basis points, treasury routing, non-bypassable design | Current |
| [security-model.md](security-model.md) | Access control, reentrancy protection, pause mechanism, threat model | Current |
| [contract-reference.md](contract-reference.md) | Complete function signatures, state variables, events, enums, structs | Current |
| [audit-findings.md](audit-findings.md) | AI-assisted audit: 2 critical, 6 high, 13 medium findings + remediation status | Current |

## Key Facts (Quick Reference)

- **Contract**: `contracts/Project_DAO.sol` (~1633 lines, Solidity 0.8.26)
- **Size**: ~41 KB (exceeds 24 KB EIP-170 limit — needs splitting for mainnet)
- **Fee**: 5 bps default (0.05%), minimum 1 bps, non-bypassable
- **Treasury**: `cybereum.eth` — set via `setCybereumTreasury()`
- **Access tiers**: Owner > Member > Registered Agent > Public (read-only)

## Related

- [../guides/agent-onboarding.md](../guides/agent-onboarding.md) — Agent-focused walkthrough
- [../knowledge-base/concepts/smart-contract-security.md](../knowledge-base/concepts/smart-contract-security.md) — Security theory
- [../knowledge-base/patterns/diamond-proxy.md](../knowledge-base/patterns/diamond-proxy.md) — Contract splitting pattern (needed for mainnet)

---
*Last updated: 2026-04-05*
