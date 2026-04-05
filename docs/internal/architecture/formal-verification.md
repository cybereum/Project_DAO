# Formal Verification

> Mathematical proof of smart contract correctness — tools, techniques, and applicability to Project_DAO.

---

## What is Formal Verification?

Formal verification uses mathematical methods to prove that a program satisfies its specification. Unlike testing (which checks specific inputs), formal verification proves correctness for **all possible inputs**.

## Techniques

### Model Checking
- Exhaustively explore all possible states of a finite system
- Tools: SPIN, NuSMV
- Limitation: State explosion for complex contracts

### Theorem Proving
- Write formal specifications and prove them using a proof assistant
- Tools: Coq, Isabelle, Lean
- Effort: Very high — requires specification + proof

### Symbolic Execution
- Execute the program with symbolic (not concrete) inputs
- Explores all execution paths and checks for violations
- Tools: **Mythril**, **HEVM**, Manticore
- More accessible than theorem proving; finds violations automatically

### SMT Solving
- Encode contract properties as satisfiability modulo theories constraints
- Solver finds inputs that violate the property (or proves none exist)
- Built into Solidity compiler's formal verification engine (`solc --model-checker`)

## Tools for Solidity

| Tool | Technique | Effort | Coverage |
|---|---|---|---|
| **Solidity SMTChecker** | SMT solving | Low (annotations) | Arithmetic, overflow, assertions |
| **Mythril** | Symbolic execution | Low (automated) | Common vulnerabilities |
| **HEVM** | Symbolic execution | Medium (Foundry-native) | Property-based testing + symbolic |
| **Certora Prover** | SMT + abstraction | High (rules required) | Custom invariants |
| **Halmos** | Symbolic testing | Medium (test-like syntax) | Property-based symbolic |

## Applicability to Project_DAO

### High-Value Properties to Verify

1. **Escrow accounting invariant**: `sum(all escrow balances) + sum(all project funds) + sum(all stakes) <= address(this).balance`
2. **Fee invariant**: Every value transfer deducts at least 1 wei fee
3. **Access control**: No non-owner can call `setCybereumTreasury`
4. **Reentrancy safety**: No function can be re-entered during execution
5. **Pause invariant**: No state change occurs when `paused == true`

### Practical Approach

1. **Start with SMTChecker**: Add `/// @custom:smtchecker` annotations to critical functions — zero tooling cost
2. **Add Mythril to CI**: Weekly scheduled scan for known vulnerability patterns
3. **Write Certora rules** for the escrow accounting invariant — highest-value formal property
4. **Consider Halmos** for symbolic property testing within existing Hardhat test framework

### Limitations

- Cannot verify external dependencies (ERC-20 token behavior)
- Contract size may challenge some tools' scalability
- Specifications must be correct — wrong specs give false confidence
- Doesn't replace testing — complements it

---

## Backlinks

- [../concepts/smart-contract-security.md](../../external/knowledge-base/concepts/smart-contract-security.md) — Security context
- [../../protocol/audit-findings.md](../dev/audit-findings.md) — What to verify
- [../../product/deployment-readiness.md](../planning/deployment-readiness.md) — Path to 95+ readiness
- [../../guides/testing.md](../dev/testing.md) — Current test approach

---
*Last updated: 2026-04-05*
