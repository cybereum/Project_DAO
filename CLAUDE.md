# CLAUDE.md — Project_DAO Agent Integration Guide

> **For AI agents, autonomous systems, and developers building on the agent economy.**
> AI agents are the primary and fastest-growing users of this protocol.
> This file is optimised for fast discovery and use. Read section 1 first, then jump to what you need.

---

## 1. WHAT THIS IS (30-second read)

**Project_DAO** is the transaction and settlement layer for the agent economy.

- Every registered agent — AI agent, bot, oracle, or human-assisted system — can escrow, transfer, and settle value (native ETH + ERC-20 + ERC-721 assets) directly on-chain.
- Every value transaction automatically routes a **minuscule protocol fee** (~0.05 % by default) to `cybereum.eth` — non-bypassable by design.
- AI agents can **discover each other** on-chain, read metadata/capabilities, and transact autonomously.
- DAO governance (proposals, milestones, roles, disputes) is built on the same contract.
- The frontend app is **NEXUS** at `nexus-app/`.
- A standalone **Agent SDK** at `sdk/` enables headless (no-browser) integration.

**One contract. One fee rail. The settlement primitive for agent-to-agent economies.**

---

## 2. QUICK-START FOR AI AGENTS (< 5 minutes)

### Option A — Using the Agent SDK (recommended for AI agents)

```js
import { AgentClient } from '@cybereum/agent-sdk';

const agent = new AgentClient({
  rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
  contractAddress: '0x...',
  privateKey: process.env.AGENT_PRIVATE_KEY,
});

// Register with metadata
await agent.register('ipfs://QmYourAgentMetadataCID');

// Deposit ETH into escrow
await agent.depositNative('0.1');

// Discover other agents
const { agents } = await agent.discoverAgents(0, 50);

// Transfer to another agent
await agent.transferNative(agents[0].address, ethers.parseEther('0.01'), 'payment for data');

// Create a payment request (invoice)
const requestId = await agent.createPaymentRequest(payerAddress, ethers.parseEther('0.05'), {
  description: 'Analysis report #42',
});

// Listen for incoming payments
agent.onPaymentRequest((req) => {
  console.log(`Payment request from ${req.requester}: ${req.amount} wei`);
});
```

### Option B — Direct Solidity calls

#### Step 0 — Prerequisites
- You are a DAO member (`members[address].isMember == true`), **OR** use `stakeAndJoin()` to self-onboard.
- The owner has called `setCybereumTreasury(<cybereum.eth resolved address>)`.

#### Step 1 — Register as an agent
```solidity
registerAgent("ipfs://<your-metadata-cid>")
```
One-time call. Metadata must conform to the schema at `schemas/agent-metadata.schema.json`.

#### Step 2 — Fund your escrow (native ETH)
```solidity
depositNativeToEscrow{ value: <amount> }()
```
A minuscule fee (~0.05 %) is deducted automatically. Your `nativeEscrowBalance` increases by `amount - fee`.

#### Step 3 — Discover other agents
```solidity
getRegisteredAgents(0, 50)  // returns (address[], string[] metadataURIs, uint256 total)
getAgentCount()             // total registered agents
```

#### Step 4 — Transfer to another agent
```solidity
transferNativeBetweenAgents(<toAddress>, <amount>, "memo")
```
Recipient must also be a registered agent. Fee is deducted from amount; net lands in recipient escrow.

#### Step 5 — Settle a payment request
```solidity
// Requester creates request:
createAgentPaymentRequest(<payerAddress>, address(0), <amount>, true, "invoice description")

// Payer settles (native):
settleAgentPaymentRequest{ value: <amount> }(<requestId>)
```

#### Step 6 — Self-onboard (no owner approval needed)
```solidity
stakeAndJoin{ value: <stakeAmount> }("ipfs://<metadata-cid>")
// Registers as member + agent in one transaction
```

---

## 2.1 AGENT METADATA SCHEMA

Every agent must publish metadata at their `metadataURI`. The canonical schema is at `schemas/agent-metadata.schema.json`.

**Required fields:**
```json
{
  "name": "SettlementAgent-v1",
  "version": "1",
  "type": "ai-agent",
  "capabilities": ["payment-settlement", "invoice-validation"],
  "description": "Autonomous agent that settles payment requests...",
  "model": {
    "provider": "anthropic",
    "modelId": "claude-sonnet-4-6",
    "framework": "claude-agent-sdk"
  }
}
```

**Agent types:** `ai-agent`, `bot`, `service`, `oracle`, `human-assisted`, `multi-agent-system`

**Example metadata files:** `schemas/examples/`

---

## 3. CONTRACT INTERFACE REFERENCE

### Contract file
`contracts/Project_DAO.sol`

### Deployed address
Set via `VITE_PROJECT_DAO_ADDRESS` env var (see `nexus-app/.env`).

### Fee parameters (owner-configurable)
| Variable | Default | Meaning |
|---|---|---|
| `cybereumFeeBps` | 5 | Fee in basis points (5 bps = 0.05%) |
| `assetTransferFlatFeeWei` | 1e12 wei | Flat fee for NFT/asset transfers |
| `MIN_FEE_BPS` | 1 | Minimum fee — cannot be set lower |
| `cybereumTreasury` | (set by owner) | Resolves to `cybereum.eth` |

### All agent functions

#### Identity & Discovery
```
registerAgent(string metadataURI)
updateAgentMetadata(string metadataURI)
getAgentCount() → uint256
getRegisteredAgents(uint256 offset, uint256 limit) → (address[], string[] metadataURIs, uint256 total)
```

#### Native ETH escrow
```
depositNativeToEscrow()                                          payable
withdrawNativeFromEscrow(uint256 amount)
transferNativeBetweenAgents(address to, uint256 amount, string memo)
```

#### ERC-20 token escrow
```
depositTokenToEscrow(address token, uint256 amount)
withdrawTokenFromEscrow(address token, uint256 amount)
transferTokenBetweenAgents(address token, address to, uint256 amount, string memo)
```

#### ERC-721 asset transfer
```
transferAssetBetweenAgents(address assetContract, address to, uint256 tokenId, string memo)   payable (exact assetTransferFlatFeeWei)
```

#### Payment requests
```
createAgentPaymentRequest(address payer, address token, uint256 amount, bool isNative, string description) → requestId
settleAgentPaymentRequest(uint256 requestId)   payable if isNative
cancelAgentPaymentRequest(uint256 requestId)
```

#### Owner/governance (not for regular agents)
```
setCybereumTreasury(address treasury)
setCybereumFeeConfig(uint256 feeBps, uint256 assetTransferFlatFeeWei)   // feeBps >= MIN_FEE_BPS
```

### Key view state
```
agents[address]                        → AgentProfile { registered, metadataURI, nativeEscrowBalance }
agentAddresses[]                       → address[] (all registered agent addresses)
agentTokenEscrowBalances[agent][token] → uint256
agentPaymentRequests[requestId]        → AgentPaymentRequest
cybereumFeeBps                         → uint256
assetTransferFlatFeeWei                → uint256
cybereumTreasury                       → address
```

### Events emitted on every value transfer
```
CybereumFeePaid(address payer, address token, uint256 amount, string context)
AgentToAgentNativeTransfer(address from, address to, uint256 amount, string memo)
AgentToAgentTokenTransfer(address from, address to, address token, uint256 amount, string memo)
AgentAssetTransfer(address from, address to, address assetContract, uint256 assetId, string memo)
AgentPaymentRequestCreated(uint256 requestId, address requester, address payer, ...)
AgentPaymentRequestSettled(uint256 requestId, address payer, address requester, uint256 settledAt)
AgentNativeEscrowDeposited(address agent, uint256 amount)
AgentNativeEscrowWithdrawn(address agent, uint256 amount)
```

---

## 4. FEE RAIL — CYBEREUM.ETH

**The fee is non-bypassable.** Every value-transfer path in the agent rails charges the protocol fee before transferring net value. The fee cannot be set to zero (enforced by `MIN_FEE_BPS = 1`).

Fee flows:
```
Agent action → fee deducted → sent to cybereumTreasury (cybereum.eth) → net value to recipient/requester
```

To calculate fee in a client before submitting:
```js
const feeBps = await contract.cybereumFeeBps();       // e.g. 5
const fee = (amount * feeBps) / 10000n;               // BigInt math
const net = fee === 0n ? amount - 1n : amount - fee;  // min 1 wei fee applies
```

---

## 5. FRONTEND APP (NEXUS)

Located at `nexus-app/`. React + Vite + Tailwind + ethers.js.

### Key files
| File | Purpose |
|---|---|
| `src/App.jsx` | Route registry |
| `src/store/appStore.jsx` | State, wallet, contract calls |
| `src/config/contract.js` | ABI + contract address |
| `src/pages/AgentEconomy.jsx` | Agent transaction UI |
| `src/pages/Landing.jsx` | Public marketing page |
| `src/components/Layout.jsx` | App shell sidebar/topbar |
| `src/components/SEOHead.jsx` | Route-level SEO metadata |
| `src/lib/analytics.js` | GA4 / Plausible analytics |

### Env vars
```
VITE_PROJECT_DAO_ADDRESS=<deployed contract address>
VITE_GA_MEASUREMENT_ID=<optional, GA4>
VITE_PLAUSIBLE_DOMAIN=<optional, Plausible>
```

### Run locally
```bash
cd nexus-app
npm install
npm run dev
```

---

## 6. REPOSITORY STRUCTURE

```
Project_DAO/
├── CLAUDE.md                        ← YOU ARE HERE (agent quickstart)
├── AGENT_TX_QUICKSTART.md           ← Minimal Solidity-level quickstart
├── FULL_IMPLEMENTATION_PLAN.md      ← Program-level roadmap
├── APP_DEEP_DIVE.md                 ← Frontend deep-dive
├── README.md                        ← Overview + user stories
├── contracts/
│   ├── Project_DAO.sol              ← CORE contract (agent rails + DAO governance)
│   ├── ValTokens/AssetNFT.sol       ← ERC-721 asset tokenisation
│   ├── VCDAO/                       ← Company/vendor verification contracts
│   └── MilestoneTracker/            ← Milestone payment tracking
├── sdk/                             ← STANDALONE AGENT SDK (no browser required)
│   ├── index.js                     ← AgentClient class — full programmatic API
│   ├── abi.js                       ← Agent-relevant ABI subset
│   └── package.json                 ← @cybereum/agent-sdk
├── schemas/                         ← AGENT METADATA SCHEMAS
│   ├── agent-metadata.schema.json   ← JSON Schema for agent profile metadata
│   └── examples/                    ← Example metadata for common agent types
├── scripts/
│   └── deploy.js                    ← Hardhat deployment script
├── .github/workflows/ci.yml         ← CI pipeline (contract tests + frontend build)
└── nexus-app/                       ← React frontend (NEXUS app)
    ├── src/
    │   ├── pages/
    │   │   ├── AgentEconomy.jsx     ← Agent transaction UI
    │   │   ├── Landing.jsx          ← Public marketing page
    │   │   └── ...                  ← Other app pages
    │   ├── store/appStore.jsx        ← App state + contract integration
    │   └── config/contract.js       ← ABI + address config
    └── public/
        ├── sitemap.xml
        └── robots.txt
```

---

## 7. GOVERNANCE (DAO) — QUICK REFERENCE

For agents that also participate in DAO governance:

```solidity
// Join as member (owner-gated)
addMember(address member, uint256 votingPower)

// Create and vote on proposals
createProposal(string description, uint256 milestoneId, uint256[] previousMilestoneIds)
vote(uint256 proposalId, bool voteYes)
executeProposal(uint256 proposalId)

// Dispute resolution
disputeProposal(uint256 proposalId, string description)
voteOnProposalDispute(uint256 disputeId, bool voteFor)
```

---

## 8. SECURITY MODEL

- `onlyOwner`: treasury/fee config, member management, role management, pause/resume.
- `onlyMember`: agent registration, proposal creation, voting.
- `onlyRegisteredAgent`: all escrow, transfer, payment request actions.
- `whenNotPaused`: all state-changing functions.
- `nonReentrant`: all functions that transfer ETH (withdraw, settle, claim, refund, leave).
- Fee floor: `MIN_FEE_BPS = 1` — owner cannot set fee to zero.
- Treasury address zero-check on every fee collection path.

---

## 9. FOR BUILDERS — INTEGRATION CHECKLIST

- [ ] Deploy `Project_DAO.sol` to target network.
- [ ] Call `setCybereumTreasury(<cybereum.eth resolved address>)`.
- [ ] (Optional) Call `setCybereumFeeConfig(feeBps, assetFlatFeeWei)` — `feeBps` must be >= 1.
- [ ] Add members with `addMember`.
- [ ] Each agent calls `registerAgent(metadataURI)`.
- [ ] Set `VITE_PROJECT_DAO_ADDRESS` in `nexus-app/.env`.
- [ ] Deploy frontend (`npm run build` → serve `nexus-app/dist/`).

---

## 10. AI AGENT SDK REFERENCE

The standalone SDK at `sdk/` lets AI agents interact without a browser.

```bash
cd sdk && npm install
```

### Key methods
| Method | Description |
|---|---|
| `agent.register(metadataURI)` | Register on-chain with IPFS metadata |
| `agent.discoverAgents(offset, limit)` | Find other registered agents |
| `agent.depositNative(ethAmount)` | Deposit ETH to escrow |
| `agent.transferNative(to, weiAmount, memo)` | Transfer between agent escrows |
| `agent.createPaymentRequest(payer, amount, opts)` | Invoice another agent |
| `agent.settlePaymentRequest(requestId)` | Pay an invoice |
| `agent.onPaymentRequest(callback)` | Listen for incoming invoices |
| `agent.onTransferReceived(callback)` | Listen for incoming transfers |
| `agent.onBroadcast(callback)` | Listen for protocol broadcasts |
| `agent.stakeAndJoin(metadataURI, stakeEth)` | Self-onboard in one transaction |
| `agent.createProject(uri, budget, deadline)` | Propose economic project |
| `agent.fundProject(id, ethAmount)` | Fund a project |
| `agent.claimProjectShare(id)` | Claim revenue share |

---

## 11. LINKS

- Implementation roadmap: `FULL_IMPLEMENTATION_PLAN.md`
- Solidity-only quickstart: `AGENT_TX_QUICKSTART.md`
- App deep-dive: `APP_DEEP_DIVE.md`
- Protocol overview: `README.md`
- Agent metadata schema: `schemas/agent-metadata.schema.json`
- Agent SDK: `sdk/`
- Deployment readiness: `DEPLOYMENT_READINESS_PLAN.md`
