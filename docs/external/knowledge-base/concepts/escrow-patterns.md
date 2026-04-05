# Escrow Patterns in Smart Contracts

> Design patterns for holding and releasing value conditionally on-chain.

---

## What is On-chain Escrow?

Escrow is a mechanism where a third party (in this case, a smart contract) holds assets until predefined conditions are met. In decentralized systems, the smart contract replaces the traditional escrow agent.

## Pattern Taxonomy

### Simple Escrow
- Deposit → condition met → release to recipient
- Single depositor, single recipient, binary outcome
- Example: `depositNativeToEscrow()` / `withdrawNativeFromEscrow()` in Project_DAO

### Conditional Escrow (Service Agreements)
- Deposit → work performed → proof submitted → approval or dispute → release or refund
- Three-party: client, provider, arbiter
- Example: Project_DAO `createServiceAgreement` → `submitDelivery` → `approveDelivery` or `disputeServiceAgreement`

### Multi-Party Escrow (Projects)
- Multiple funders contribute → contributors work → completion → proportional distribution
- Example: Project_DAO economic projects with `fundProject` → `completeProject` → `claimProjectShare`

### Time-Locked Escrow (Payment Streams)
- Deposit streamed linearly over time period
- Recipient withdraws accrued amount; either party can cancel
- Example: Project_DAO `createPaymentStream` → `withdrawFromStream`

## Design Considerations

### Pool Segregation
- **Shared pool** (Project_DAO current): All escrow types share `address(this).balance`. Simple but risks cross-contamination.
- **Segregated pools**: Each escrow type has dedicated accounting and reserved balance. Safer but more complex.
- **Sub-contracts**: Each pool is a separate contract. Maximum isolation but higher deployment cost and complexity.

### Fee Integration
- Fees can be deducted on deposit (Project_DAO approach), on withdrawal, or on transfer
- Deposit-time fees mean the escrowed amount is already net of fees — simpler accounting
- Transfer-time fees allow fee-free deposits but require fee reserves on withdrawal

### Reentrancy Protection
- All escrow functions that transfer ETH/tokens must be protected against reentrancy
- Project_DAO uses inline `nonReentrant` modifier on all transfer functions
- The checks-effects-interactions pattern is necessary but not sufficient alone

### Accounting Integrity
- Balance tracking variables must perfectly match actual contract holdings
- Overflow/underflow protection (Solidity 0.8+ has built-in checks)
- Zero-amount transfers should be rejected to prevent event spam

---

## Backlinks

- [../../protocol/architecture.md](../../protocol/architecture.md) — Escrow in system architecture
- [../../protocol/audit-findings.md](../../../internal/dev/audit-findings.md) — C-2: shared pool risk
- [smart-contract-security.md](smart-contract-security.md) — Security considerations
- [../patterns/reentrancy-guards.md](../patterns/reentrancy-guards.md) — Reentrancy protection details
- [fee-rail-design.md](fee-rail-design.md) — Fee integration with escrow

---
*Last updated: 2026-04-05*
