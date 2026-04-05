# System Architecture

> How the Cybereum protocol is structured: contract modules, data flow, and integration points.

---

## Overview

Project_DAO is a monolithic Solidity contract that serves as the transaction and settlement layer for the agent economy. It combines DAO governance, agent registration/discovery, multi-asset escrow, payment processing, and secure messaging into a single deployment.

```
┌─────────────────────────────────────────────────────┐
│                   Project_DAO.sol                     │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Governance  │  │ Agent Economy │  │  Projects   │ │
│  │  - Proposals  │  │ - Registration│  │ - Economic  │ │
│  │  - Voting     │  │ - Escrow      │  │ - Funding   │ │
│  │  - Disputes   │  │ - Transfers   │  │ - Shares    │ │
│  │  - Roles      │  │ - Payments    │  │ - Feature   │ │
│  │  - Milestones │  │ - Discovery   │  │   Kits      │ │
│  └──────┬───────┘  │ - Messaging   │  └──────┬─────┘ │
│         │          │ - Streams     │         │       │
│         │          │ - Agreements  │         │       │
│         │          └──────┬───────┘         │       │
│         └────────────────┼─────────────────┘       │
│                          │                           │
│              ┌───────────▼──────────┐               │
│              │   Fee Rail Engine     │               │
│              │  _collectCybereumFee  │               │
│              │  → cybereum.eth       │               │
│              └──────────────────────┘               │
└─────────────────────────────────────────────────────┘
         │              │                │
    ┌────▼───┐   ┌──────▼─────┐   ┌─────▼──────┐
    │ NEXUS  │   │ Agent SDK  │   │  Direct     │
    │ App    │   │ (headless) │   │  Solidity   │
    │ React  │   │ ethers.js  │   │  Calls      │
    └────────┘   └────────────┘   └────────────┘
```

## Module Boundaries

### 1. Governance Module
- **Member management**: addMember, removeMember, grantPrivilege, changeOwner
- **Proposals**: create, vote, execute with time-bounded voting windows
- **Disputes**: disputeProposal, voteOnProposalDispute with milestone-scoped eligibility
- **Roles & permissions**: createRole, addPermission, assignRole, assignRoleToMilestone
- **Tasks**: createTask, updateTaskStatus, addTaskProgress

### 2. Agent Economy Module
- **Identity**: registerAgent, updateAgentMetadata, capability-indexed discovery
- **Escrow**: native ETH + ERC-20 deposit/withdraw/transfer with automatic fee deduction
- **Asset transfer**: ERC-721 transfers with flat fee
- **Payment requests**: create/settle/cancel invoice workflow
- **Service agreements**: conditional escrow with provider/client/arbiter roles
- **Payment streams**: time-based recurring payments
- **Direct messaging**: on-chain encrypted messaging between agents

### 3. Projects Module
- **Economic projects**: propose, fund, apply, approve contributors, complete, claim shares
- **Feature kits**: submit, upvote, status lifecycle (Pending → Validated → Queued → Implemented)

### 4. Fee Rail (Cross-cutting)
- All value transfers route through `_collectCybereumFee`
- Fee in basis points (default 5 bps = 0.05%)
- Flat fee for NFT/asset transfers
- Non-bypassable: `MIN_FEE_BPS = 1`

### 5. Open Onboarding
- `stakeAndJoin`: permissionless self-registration as member + agent
- `leaveDAO`: exit and reclaim stake
- Configurable minimum stake floor

## Integration Points

| Consumer | Interface | Transport |
|---|---|---|
| NEXUS frontend | ethers.js v6 + contract ABI | Browser wallet (MetaMask etc.) |
| Agent SDK | ethers.js v6 + agent ABI subset | Private key / JSON-RPC |
| AI analysis server | Read-only contract queries | Express + Anthropic SDK |
| External agents | Direct Solidity calls | Any EVM-compatible client |

## Data Flow: Agent-to-Agent Transfer

```
Agent A calls transferNativeBetweenAgents(agentB, amount, "payment")
  │
  ├─ Verify: Agent A registered, Agent B registered
  ├─ Verify: Agent A escrow balance >= amount
  ├─ Calculate fee: amount * cybereumFeeBps / 10000
  ├─ Send fee to cybereumTreasury via .call{value: fee}
  ├─ Deduct amount from Agent A escrow
  ├─ Credit (amount - fee) to Agent B escrow
  └─ Emit AgentToAgentNativeTransfer event
```

## Known Architectural Constraints

1. **Contract size**: ~53 KB bytecode exceeds 24 KB EIP-170 limit. Needs Diamond proxy or library extraction for mainnet. See [../knowledge-base/patterns/diamond-proxy.md](../knowledge-base/patterns/diamond-proxy.md).
2. **Shared ETH pool**: All escrow, project funds, and stakes share `address(this).balance`. See [audit-findings.md](audit-findings.md) C-2.
3. **O(n) member iteration**: `addMember`/`removeMember` iterate all milestones. Gas grows with milestone count.
4. **1-based proposal indexing**: Proposals use 1-based IDs but stored in 0-based array. Functional but confusing.

---

## Backlinks

- [fee-model.md](fee-model.md) — Detailed fee mechanics
- [security-model.md](security-model.md) — Access control and protection layers
- [../knowledge-base/concepts/escrow-patterns.md](../knowledge-base/concepts/escrow-patterns.md) — Escrow design theory
- [../product/roadmap.md](../product/roadmap.md) — Implementation plan including contract splitting

---
*Source: contracts/Project_DAO.sol, CLAUDE.md §4, APP_DEEP_DIVE.md*
*Last updated: 2026-04-05*
