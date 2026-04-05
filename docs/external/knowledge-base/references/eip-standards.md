# EIP Standards Reference

> Key Ethereum Improvement Proposals relevant to Project_DAO.

---

## Token Standards

| EIP | Name | Status | Used in Project_DAO |
|---|---|---|---|
| **ERC-20** | Fungible token standard | Final | Yes — token escrow |
| **ERC-721** | Non-fungible token standard | Final | Yes — AssetNFT.sol |
| **ERC-1155** | Multi-token standard | Final | No — potential future |
| **ERC-4626** | Tokenized vault standard | Final | No |

## Contract Standards

| EIP | Name | Status | Relevance |
|---|---|---|---|
| **EIP-170** | Contract code size limit (24,576 bytes) | Final | CRITICAL — Project_DAO exceeds this |
| **EIP-2535** | Diamond standard (multi-facet proxy) | Final | Planned for contract splitting |
| **EIP-1967** | Proxy storage slots | Final | Used by transparent/UUPS proxies |
| **ERC-6093** | Custom error standard | Draft | Used for Project_DAO error declarations |

## Protocol Standards

| EIP | Name | Status | Relevance |
|---|---|---|---|
| **EIP-1559** | Fee market change (base fee + priority fee) | Final | Ethereum gas mechanics |
| **ERC-4337** | Account abstraction (UserOperations) | Final | Future agent UX improvement |
| **EIP-7579** | Minimal modular smart accounts | Draft | Future smart account standard |

## Governance Standards

| EIP | Name | Status | Relevance |
|---|---|---|---|
| **ERC-2771** | Meta-transactions (trusted forwarder) | Final | Gasless agent transactions |
| **EIP-712** | Typed structured data signing | Final | Off-chain signature verification |

---

## Backlinks

- [../concepts/token-standards.md](../concepts/token-standards.md) — Token standard details
- [../patterns/diamond-proxy.md](../../../internal/architecture/diamond-proxy.md) — EIP-2535 implementation
- [../research/account-abstraction.md](../../../internal/architecture/account-abstraction.md) — ERC-4337 details
- [openzeppelin-library.md](openzeppelin-library.md) — OZ implementations of these standards

---
*Last updated: 2026-04-05*
