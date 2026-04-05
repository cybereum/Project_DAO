# Account Abstraction

> ERC-4337, smart accounts, session keys, and gas sponsorship — implications for AI agent UX.

---

## What is Account Abstraction?

Account abstraction decouples transaction validation from EOA (Externally Owned Account) private key signatures. Instead of requiring a specific signature scheme, smart contract accounts can define their own validation logic.

## ERC-4337: The Standard

- **EIP**: [EIP-4337](https://eips.ethereum.org/EIPS/eip-4337) (2023, live on mainnet)
- **Key concept**: UserOperations bundled by Bundlers, validated by EntryPoint contract
- **No protocol changes required** — works on existing EVM chains

### Components
1. **Smart Account**: Contract wallet with custom validation logic
2. **EntryPoint**: Singleton contract that validates and executes UserOps
3. **Bundler**: Off-chain service that packages UserOps into transactions
4. **Paymaster**: Optional — sponsors gas for users (gasless transactions)

## Relevance to Project_DAO Agents

### Session Keys
- AI agents can be granted limited-scope session keys instead of full private keys
- Example: session key valid for "transfer up to 0.1 ETH per day for 30 days"
- Reduces risk if agent is compromised

### Gas Sponsorship (Paymasters)
- Protocol can sponsor gas for agent onboarding (lower barrier to entry)
- Paymaster pays gas; agent only needs to have escrow balance
- Enables "zero ETH start" for new agents

### Batch Operations
- Smart accounts can batch multiple operations in a single UserOp
- Example: register + deposit + set capabilities in one transaction
- Reduces gas and improves UX

### Custom Validation
- Agents could use non-ECDSA signature schemes (ed25519, threshold signatures)
- Multi-agent wallets with n-of-m signing

## Implementation Considerations

- Project_DAO currently requires EOA (private key) for all agent operations
- Migrating to AA would need: smart account factory, EntryPoint integration, optional Paymaster
- The SDK's `AgentClient` would need a smart account adapter
- Existing `onlyRegisteredAgent` modifier works with smart accounts (checks `msg.sender`)

## Ecosystem

- **Implementations**: Safe (formerly Gnosis Safe), Kernel, Biconomy, ZeroDev, Alchemy Account Kit
- **Bundlers**: Stackup, Pimlico, Alchemy, Biconomy
- **Paymasters**: Stackup, Pimlico, Alchemy

---

## Backlinks

- [../concepts/agent-economies.md](../../external/knowledge-base/concepts/agent-economies.md) — Agent UX considerations
- [ai-agent-protocols.md](../../external/knowledge-base/research/ai-agent-protocols.md) — How other protocols handle agent wallets
- [../references/eip-standards.md](../../external/knowledge-base/references/eip-standards.md) — EIP-4337 specification
- [../../product/roadmap.md](../planning/roadmap.md) — Potential future work stream

---
*Last updated: 2026-04-05*
