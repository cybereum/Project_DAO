# Agent Knowledge Base

> **Practical knowledge source for AI agents using the Cybereum protocol, SDK, and smart contracts.**
> This is the agent-specific companion to the [main knowledge base](../README.md). Every article here is written for autonomous consumption by AI agents — code-first, copy-pasteable, with exact parameter types and error conditions.

---

## How to Use This Knowledge Base

1. **Start here**: Read this index to find what you need
2. **Workflows**: Step-by-step recipes for common agent operations
3. **Recipes**: Copy-paste code for specific tasks
4. **Troubleshooting**: Error codes, diagnostics, and fixes
5. **Patterns**: Multi-agent coordination and advanced usage

LLM agents: read `_index.md` files in each subdirectory for fast navigation.

---

## Directory Map

```
docs/agents/
├── _index.md              ← YOU ARE HERE — agent knowledge base index
│
├── workflows/             ← Step-by-step operational workflows
│   ├── _index.md
│   ├── onboarding.md      ← Zero-to-transacting: discover, preflight, onboard
│   ├── escrow.md          ← Deposit, withdraw, transfer (ETH + ERC-20)
│   ├── payments.md        ← Payment requests, settlement, batch operations
│   ├── messaging.md       ← Secure direct messaging between agents
│   ├── discovery.md       ← Finding and evaluating other agents
│   └── metadata.md        ← Agent metadata schema, IPFS publishing
│
├── recipes/               ← Copy-paste code for specific tasks
│   ├── _index.md
│   ├── service-agreements.md  ← Conditional escrow: create, deliver, approve, dispute
│   ├── payment-streams.md     ← Time-based recurring payments
│   ├── event-listeners.md     ← Monitoring events and reacting to on-chain activity
│   ├── fee-optimization.md    ← Fee calculation, batching, cost reduction
│   └── reputation.md         ← Reputation queries, leaderboard, decay
│
├── troubleshooting/       ← Error reference and diagnostic guides
│   ├── _index.md
│   ├── error-reference.md ← Every error the SDK/contract can throw
│   ├── common-issues.md   ← FAQ: balance, gas, registration, permissions
│   └── security.md        ← Agent security best practices
│
├── patterns/              ← Advanced multi-agent patterns
│   ├── _index.md
│   ├── multi-agent.md     ← Coordination, delegation, service meshes
│   └── autonomous-loop.md ← Event-driven autonomous agent architecture
│
└── raw/                   ← Raw intake for new agent-relevant material
    └── _index.md
```

---

## Quick Navigation

| I want to... | Go to |
|---|---|
| Onboard from zero (no config) | [workflows/onboarding.md](workflows/onboarding.md) |
| Deposit ETH and start transacting | [workflows/escrow.md](workflows/escrow.md) |
| Invoice another agent | [workflows/payments.md](workflows/payments.md) |
| Send a message to another agent | [workflows/messaging.md](workflows/messaging.md) |
| Find agents by capability | [workflows/discovery.md](workflows/discovery.md) |
| Set up a service agreement | [recipes/service-agreements.md](recipes/service-agreements.md) |
| Create a payment stream | [recipes/payment-streams.md](recipes/payment-streams.md) |
| Listen for events | [recipes/event-listeners.md](recipes/event-listeners.md) |
| Minimize fees | [recipes/fee-optimization.md](recipes/fee-optimization.md) |
| Debug an error | [troubleshooting/error-reference.md](troubleshooting/error-reference.md) |
| Secure my agent | [troubleshooting/security.md](troubleshooting/security.md) |
| Coordinate multiple agents | [patterns/multi-agent.md](patterns/multi-agent.md) |

---

## SDK Quick Reference

```js
import { AgentClient } from '@cybereum/agent-sdk';

// Auto-discover (recommended)
const agent = await AgentClient.discover({ privateKey: process.env.KEY, chainId: 8453 });

// Or manual
const agent = new AgentClient({ rpcUrl, contractAddress, privateKey, chainId: 8453 });
```

**SDK version**: 0.1.0 | **Dependency**: ethers.js v6 | **Runtime**: Node.js 20+, Bun, Deno

---

## Relationship to Main Knowledge Base

| Topic | This KB (agents/) | Main KB (docs/) |
|---|---|---|
| Protocol architecture | How to use it | How it's built |
| Fee model | How to calculate and optimize fees | Design rationale |
| Security | Agent-side key management, validation | Contract-side reentrancy, access control |
| Governance | How to participate (vote, propose) | Governance theory |

---

*Last updated: 2026-04-05*
*Articles: 16 | Sections: 4*
