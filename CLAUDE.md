# CLAUDE.md — Project_DAO Agent Integration & Development Guide

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
- A **Claude-powered AI analysis server** at `nexus-ai-server/` provides on-demand intelligence.

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

**Optional fields:** `endpoint` (url, protocol, auth), `pricing` (currency, ratePerRequest), `owner` (name, url, contact), `tags`

**Example metadata files:** `schemas/examples/`

---

## 3. DEVELOPMENT WORKFLOWS

### Prerequisites
- Node.js 20+
- npm

### Smart contracts (Hardhat)

```bash
# Install dependencies (root)
npm install

# Compile contracts
npx hardhat compile

# Run contract tests
npx hardhat test

# Deploy (requires CYBEREUM_TREASURY env var)
CYBEREUM_TREASURY=0x... npx hardhat run scripts/deploy.js --network <network>
```

- Solidity compiler: **0.8.26** with optimizer enabled and `viaIR: true`
- OpenZeppelin contracts are used for ERC-721 and ReentrancyGuard
- `allowUnlimitedContractSize` is enabled in hardhat config (for testing)

### Frontend (NEXUS app)

```bash
cd nexus-app
npm install
npm run dev      # Start dev server
npm run build    # Production build → dist/
npm run lint     # ESLint check
npm run preview  # Preview production build
```

- React 19 + Vite 7 + Tailwind CSS 4
- ethers.js 6 for blockchain interaction
- Recharts for data visualization
- Framer Motion for animations
- React Router 7 for routing

### Agent SDK

```bash
cd sdk
npm install
```

The SDK (`@cybereum/agent-sdk` v0.1.0) depends only on ethers.js v6.

### AI Analysis Server

```bash
cd nexus-ai-server
npm install
# Set ANTHROPIC_API_KEY env var
node server.js
```

Express server using the Anthropic SDK for Claude-powered analysis.

### CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`/`master`:

1. **contracts** job: `npm ci` → `npx hardhat compile` → `npx hardhat test`
2. **frontend** job: `npm ci` (in `nexus-app/`) → `npm run lint` → `npm run build`

---

## 4. CONTRACT INTERFACE REFERENCE

### Contract file
`contracts/Project_DAO.sol` (~1633 lines)

### Deployed address
Set via `VITE_PROJECT_DAO_ADDRESS` env var (see `nexus-app/.env`).

### Fee parameters (owner-configurable)
| Variable | Default | Meaning |
|---|---|---|
| `cybereumFeeBps` | 5 | Fee in basis points (5 bps = 0.05%) |
| `assetTransferFlatFeeWei` | 1e12 wei | Flat fee for NFT/asset transfers |
| `MIN_FEE_BPS` | 1 | Minimum fee — cannot be set lower |
| `FEE_BPS_DENOMINATOR` | 10,000 | Basis point denominator |
| `cybereumTreasury` | (set by owner) | Resolves to `cybereum.eth` |

### Agent functions

#### Identity & Discovery
```
registerAgent(string metadataURI)
updateAgentMetadata(string metadataURI)
getAgentProfile(address agent) → (bool registered, string metadataURI, uint256 nativeEscrowBalance)
getAgentTokenBalance(address agent, address token) → uint256
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
getAgentPaymentRequest(uint256 requestId) → AgentPaymentRequest
```

#### Economic projects
```
createEconomicProject(string metadataURI, uint256 targetBudget, uint256 deadline) → projectId
fundProject(uint256 projectId)                                   payable
applyToProject(uint256 projectId)
approveContributor(uint256 projectId, address contributor, uint256 sharesBps)
completeProject(uint256 projectId)
cancelProject(uint256 projectId)
claimProjectShare(uint256 projectId)
refundProjectFunder(uint256 projectId)
getEconomicProject(uint256 projectId) → EconomicProject
getEconomicProjects(uint256 offset, uint256 limit) → (EconomicProject[], uint256 total)
getProjectContributors(uint256 projectId) → address[]
getProjectFunders(uint256 projectId) → address[]
```

#### Feature kits (innovation voting)
```
submitFeatureKit(string metadataURI, uint8 priority)
upvoteFeatureKit(uint256 kitId)
setFeatureKitStatus(uint256 kitId, uint8 newStatus, string reason)   onlyOwner
getFeatureKits(uint256 offset, uint256 limit) → (FeatureKit[], uint256 total)
```

#### Open onboarding
```
stakeAndJoin(string metadataURI)                                 payable
leaveDAO()
setMinStakeToJoin(uint256 minStake)                              onlyOwner
```

#### Fee management
```
previewFee(uint256 amount) → (uint256 fee, uint256 net)
setCybereumTreasury(address treasury)                            onlyOwner
setCybereumFeeConfig(uint256 feeBps, uint256 assetTransferFlatFeeWei)   onlyOwner, feeBps >= MIN_FEE_BPS
```

#### Governance
```
createProposal(string description, uint256 milestoneId, uint256[] previousMilestoneIds)
vote(uint256 proposalId, bool voteYes)
executeProposal(uint256 proposalId)
getProposal(uint256 proposalId) → Proposal
getProposalCount() → uint256
disputeProposal(uint256 proposalId, string description)
voteOnProposalDispute(uint256 disputeId, bool voteFor)
```

#### Member & role management (owner)
```
addMember(address member, uint256 votingPower)
removeMember(address member)
grantPrivilege(address member, uint256 privilege)
changeOwner(address newOwner)
createRole(bytes32 name)
addPermission(uint256 roleId, string permission)
removePermission(uint256 roleId, string permission)
assignRole(address member, uint256 roleId)
assignRoleToMilestone(address member, uint256 milestoneId, bytes32 role)
getRole(uint256 roleId) → (bytes32 name, uint256 memberCount)
```

#### Pause/resume (owner)
```
pauseContract()
resumeContract()
```

### Key view state
```
agents[address]                        → AgentProfile { registered, metadataURI, nativeEscrowBalance }
agentAddresses[]                       → address[] (all registered agent addresses)
agentTokenEscrowBalances[agent][token] → uint256
agentPaymentRequests[requestId]        → AgentPaymentRequest
economicProjects[projectId]            → EconomicProject
featureKits[kitId]                     → FeatureKit
members[address]                       → Member { memberAddress, votingPower, privileges[], isMember }
memberStakes[address]                  → uint256
proposals[]                            → Proposal[]
cybereumFeeBps                         → uint256
assetTransferFlatFeeWei                → uint256
cybereumTreasury                       → address
minStakeToJoin                         → uint256
```

### Key events
```
// Fee events
CybereumFeePaid(address payer, address token, uint256 amount, string context)
CybereumTreasuryUpdated(address treasury)
CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei)

// Agent transfer events
AgentToAgentNativeTransfer(address from, address to, uint256 amount, string memo)
AgentToAgentTokenTransfer(address from, address to, address token, uint256 amount, string memo)
AgentAssetTransfer(address from, address to, address assetContract, uint256 assetId, string memo)
AgentNativeEscrowDeposited(address agent, uint256 amount)
AgentNativeEscrowWithdrawn(address agent, uint256 amount)

// Payment request events
AgentPaymentRequestCreated(uint256 requestId, address requester, address payer, ...)
AgentPaymentRequestSettled(uint256 requestId, address payer, address requester, uint256 settledAt)
AgentPaymentRequestCancelled(uint256 requestId, address requester)

// Agent registration events
AgentRegistered(address agent, string metadataURI)
AgentMetadataUpdated(address agent, string metadataURI)
AgentBroadcast(uint256 broadcastId, address sender, uint8 broadcastType, string messageURI, uint256 timestamp)

// Economic project events
EconomicProjectCreated(uint256 projectId, address proposer, string metadataURI, uint256 targetBudget, uint256 deadline)
EconomicProjectFunded(uint256 projectId, address funder, uint256 netAmount)
EconomicProjectCompleted(uint256 projectId)
EconomicProjectCancelled(uint256 projectId)
EconomicProjectShareClaimed(uint256 projectId, address contributor, uint256 amount)
EconomicProjectFunderRefunded(uint256 projectId, address funder, uint256 amount)

// Feature kit events
FeatureKitSubmitted(uint256 kitId, address submitter, uint8 priority, string metadataURI, uint256 timestamp)
FeatureKitUpvoted(uint256 kitId, address voter, uint256 newVoteCount)
FeatureKitStatusChanged(uint256 kitId, uint8 newStatus, string reason)

// Onboarding events
MemberJoinedByStake(address member, uint256 netStake)
MemberLeftDAO(address member, uint256 refundedStake)
```

### Key enums & structs
```
// Enums
PaymentStatus   { Requested, Settled, Cancelled }
ProjectStatus   { Open, Active, Completed, Cancelled }
MilestoneType   { REGULAR, PAYMENT }

// Structs
AgentProfile          { registered, metadataURI, nativeEscrowBalance }
AgentPaymentRequest   { id, requester, payer, token, amount, isNative, description, status, createdAt, settledAt }
EconomicProject       { id, proposer, metadataURI, targetBudget, totalFunded, deadline, status, createdAt, contributorCount, funderCount }
FeatureKit            { id, submitter, priority, status, metadataURI, voteCount, submittedAt }
Member                { memberAddress, votingPower, privileges[], isMember }
Proposal              { id, description, votingDeadline, executed, proposalPassed, yesVotes, noVotes, previousMilestoneIds[], milestoneId }
```

---

## 5. FEE RAIL — CYBEREUM.ETH

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

## 6. FRONTEND APP (NEXUS)

Located at `nexus-app/`. React 19 + Vite 7 + Tailwind CSS 4 + ethers.js 6.

### Tech stack
| Library | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| Vite | 7.3.1 | Build tool |
| Tailwind CSS | 4.2.0 | Styling (via @tailwindcss/vite plugin) |
| React Router | 7.13.0 | Client-side routing |
| ethers.js | 6.16.0 | Blockchain interaction |
| Recharts | 3.7.0 | Charts & data viz |
| Framer Motion | 12.34.3 | Animations |

### Pages (19 total)
| Page | Purpose |
|---|---|
| `Landing.jsx` | Homepage / marketing |
| `Dashboard.jsx` | Command center overview |
| `AgentEconomy.jsx` | Agent transaction console |
| `AgentsLanding.jsx` | Agent discovery landing |
| `AgentReadiness.jsx` | Agent readiness assessment |
| `GlobalPulse.jsx` | Real-time governance monitor |
| `Projects.jsx` | Project listing |
| `ProjectDetail.jsx` | Single project view |
| `Proposals.jsx` | Governance voting UI |
| `Milestones.jsx` | Milestone tracker |
| `Assets.jsx` | NFT/tokenized asset management |
| `Reputation.jsx` | Reputation leaderboard |
| `Verification.jsx` | Company verification |
| `FeatureKits.jsx` | Feature request voting |
| `NexusAI.jsx` | AI analysis interface |
| `BuildersLanding.jsx` | Developer marketing |
| `NgoLanding.jsx` | NGO use case page |
| `EnterpriseLanding.jsx` | Enterprise page |
| `CitiesLanding.jsx` | City/municipal page |

### Key files
| File | Purpose |
|---|---|
| `src/App.jsx` | Route registry |
| `src/main.jsx` | Vite entry point |
| `src/store/appStore.jsx` | Global state + wallet + contract calls |
| `src/config/contract.js` | ABI (118 definitions) + contract address |
| `src/config/routeManifest.js` | Route registry with SEO metadata (BASE_URL: `https://www.cybereum.io`) |
| `src/config/routes.js` | Route exports |
| `src/components/Layout.jsx` | App shell sidebar/topbar |
| `src/components/SEOHead.jsx` | Route-level SEO metadata injector |
| `src/components/CorruptionClock.jsx` | Live clock visualization |
| `src/components/LeadCapture.jsx` | Email capture form |
| `src/components/ShareProposal.jsx` | Social sharing component |
| `src/services/nexusAI.js` | Claude AI analysis service integration |
| `src/lib/analytics.js` | GA4 + Plausible tracking |
| `src/lib/utm.js` | UTM parameter parsing |
| `src/lib/agentAudit.js` | Agent audit/validation logic |
| `src/lib/liveData.js` | Real-time data aggregation |

### Build configuration
- Vite uses manual chunk splitting: `vendor` (react, router, ethers), `charts` (recharts), `motion` (framer-motion)
- Source maps disabled in production
- Sitemap generation: `nexus-app/scripts/generate-sitemap.mjs`

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

## 7. REPOSITORY STRUCTURE

```
Project_DAO/
├── CLAUDE.md                            ← YOU ARE HERE
├── README.md                            ← Overview + user stories
├── AGENT_TX_QUICKSTART.md               ← Minimal Solidity-level quickstart
├── FULL_IMPLEMENTATION_PLAN.md          ← Program-level roadmap
├── APP_DEEP_DIVE.md                     ← Frontend deep-dive
├── DEPLOYMENT_READINESS_PLAN.md         ← Deployment checklist
├── hardhat.config.js                    ← Solc 0.8.26, optimizer, viaIR
├── package.json                         ← Root Hardhat project deps
├── contracts/
│   ├── Project_DAO.sol                  ← CORE contract (~1633 lines)
│   ├── IAragonCourt.sol                 ← Aragon Court dispute interface
│   ├── IKleros.sol                      ← Kleros dispute interface
│   ├── MilestoneTracker2.sol            ← Standalone milestone tracker v2
│   ├── ValTokens/
│   │   └── AssetNFT.sol                 ← ERC-721 asset tokenisation
│   ├── VCDAO/
│   │   ├── VCDAO.sol                    ← Vendor/company verification DAO
│   │   └── Readme.md
│   └── MilestoneTracker/
│       ├── MilestoneTracker.sol         ← Milestone payment tracking v1
│       ├── MilestoneTracker2.sol        ← Milestone payment tracking v2
│       └── Readme.md
├── sdk/                                 ← STANDALONE AGENT SDK
│   ├── index.js                         ← AgentClient class
│   ├── abi.js                           ← Agent-relevant ABI subset
│   └── package.json                     ← @cybereum/agent-sdk v0.1.0
├── schemas/                             ← AGENT METADATA SCHEMAS
│   ├── agent-metadata.schema.json       ← JSON Schema v2020-12
│   └── examples/
│       ├── ai-settlement-agent.json     ← Settlement bot example
│       └── data-oracle-agent.json       ← Oracle agent example
├── scripts/
│   └── deploy.js                        ← Hardhat deployment script
├── test/
│   └── ProjectDAO.test.js               ← Contract test suite (Mocha/Chai/Hardhat)
├── nexus-app/                           ← React frontend (NEXUS)
│   ├── package.json                     ← Frontend deps
│   ├── vite.config.js                   ← Build config + chunk splitting
│   ├── eslint.config.js                 ← Linting config
│   ├── .env.example                     ← Env var template
│   ├── public/
│   │   ├── sitemap.xml                  ← SEO sitemap
│   │   ├── robots.txt                   ← Crawler rules
│   │   ├── manifest.json               ← PWA manifest
│   │   ├── favicon.svg
│   │   └── og-image.svg
│   ├── src/
│   │   ├── App.jsx                      ← Route definitions
│   │   ├── main.jsx                     ← Entry point
│   │   ├── pages/ (19 pages)            ← See section 6 for full list
│   │   ├── components/ (5 components)   ← Layout, SEOHead, CorruptionClock, LeadCapture, ShareProposal
│   │   ├── store/appStore.jsx           ← State management
│   │   ├── config/                      ← contract.js, routeManifest.js, routes.js
│   │   ├── services/nexusAI.js          ← AI service integration
│   │   └── lib/                         ← analytics.js, utm.js, agentAudit.js, liveData.js
│   └── scripts/
│       ├── generate-sitemap.mjs         ← Sitemap generator
│       └── validate-sitemap.mjs         ← Sitemap validator
├── nexus-ai-server/                     ← CLAUDE AI ANALYSIS MICROSERVICE
│   ├── server.js                        ← Express + Anthropic SDK server
│   ├── package.json                     ← Express + @anthropic-ai/sdk
│   └── .gitignore
└── .github/workflows/
    └── ci.yml                           ← CI: compile + test contracts, lint + build frontend
```

---

## 8. TESTING

### Contract tests
```bash
npx hardhat test
```

Tests are in `test/ProjectDAO.test.js` using Mocha/Chai with Hardhat's test helpers.

**Test helpers:**
- `deploy()` — deploys a fresh `Project_DAO` contract with treasury configured
- `memberAgent()` — adds a member and registers them as an agent (for quick test setup)

**Test coverage areas:**
- Fee configuration (defaults, owner updates, bounds checking, preview calculations)
- Cybereum treasury (setting, zero-address validation)
- Agent registration and discovery
- Escrow operations (deposit, withdraw, transfer)
- Payment requests (create, settle, cancel)
- Economic projects lifecycle
- Open onboarding (stakeAndJoin, leaveDAO)

### Frontend linting
```bash
cd nexus-app && npm run lint
```

---

## 9. CODING CONVENTIONS

### Solidity
- Compiler: Solidity 0.8.26 with optimizer and `viaIR`
- Use OpenZeppelin for standard patterns (ERC-721, ReentrancyGuard)
- All state-changing functions use `whenNotPaused`
- All ETH-transferring functions use `nonReentrant`
- Access control via `onlyOwner`, `onlyMember`, `onlyRegisteredAgent` modifiers
- Events emitted for every state change
- Internal function `_collectCybereumFee` handles all fee deductions

### Frontend (React/JSX)
- Functional components with hooks
- Global state in `appStore.jsx` (custom store, not Redux)
- ethers.js v6 for all contract interactions
- Tailwind CSS for styling (no CSS modules or styled-components)
- Route-level SEO via `SEOHead` component and `routeManifest.js`
- Analytics via `lib/analytics.js` (GA4 + Plausible dual-tracking)

### SDK
- Pure ESM (`"type": "module"` in package.json)
- Single dependency: ethers.js v6
- All methods return transaction receipts or parsed results
- Event listeners use ethers.js contract event filters

### General
- No TypeScript — all JavaScript (.js/.jsx)
- No CSS preprocessors — Tailwind only
- ethers.js v6 (not v5) — use `ethers.parseEther()` not `ethers.utils.parseEther()`

---

## 10. SECURITY MODEL

- `onlyOwner`: treasury/fee config, member management, role management, pause/resume, feature kit status.
- `onlyMember`: agent registration, proposal creation, voting, feature kit submission/upvoting.
- `onlyRegisteredAgent`: all escrow, transfer, payment request actions.
- `whenNotPaused`: all state-changing functions.
- `nonReentrant`: all functions that transfer ETH (withdraw, settle, claim, refund, leave).
- Fee floor: `MIN_FEE_BPS = 1` — owner cannot set fee to zero.
- Treasury address zero-check on every fee collection path.
- Stake-based self-onboarding with minimum stake floor (`minStakeToJoin`).

---

## 11. GOVERNANCE (DAO) — QUICK REFERENCE

For agents that also participate in DAO governance:

```solidity
// Self-onboard (no owner approval needed)
stakeAndJoin{ value: stakeAmount }("ipfs://<metadata-cid>")

// Join as member (owner-gated)
addMember(address member, uint256 votingPower)

// Create and vote on proposals
createProposal(string description, uint256 milestoneId, uint256[] previousMilestoneIds)
vote(uint256 proposalId, bool voteYes)
executeProposal(uint256 proposalId)

// Dispute resolution
disputeProposal(uint256 proposalId, string description)
voteOnProposalDispute(uint256 disputeId, bool voteFor)

// Leave DAO and reclaim stake
leaveDAO()
```

---

## 12. FOR BUILDERS — INTEGRATION CHECKLIST

- [ ] Deploy `Project_DAO.sol` to target network.
- [ ] Call `setCybereumTreasury(<cybereum.eth resolved address>)`.
- [ ] (Optional) Call `setCybereumFeeConfig(feeBps, assetFlatFeeWei)` — `feeBps` must be >= 1.
- [ ] Add members with `addMember` or let them self-onboard via `stakeAndJoin`.
- [ ] Each agent calls `registerAgent(metadataURI)`.
- [ ] Set `VITE_PROJECT_DAO_ADDRESS` in `nexus-app/.env`.
- [ ] Deploy frontend (`npm run build` → serve `nexus-app/dist/`).
- [ ] (Optional) Deploy `nexus-ai-server` with `ANTHROPIC_API_KEY` for AI analysis.

---

## 13. AI AGENT SDK REFERENCE

The standalone SDK at `sdk/` lets AI agents interact without a browser.

```bash
cd sdk && npm install
```

### All methods
| Method | Description |
|---|---|
| **Identity & Discovery** | |
| `agent.register(metadataURI)` | Register on-chain with IPFS metadata |
| `agent.updateMetadata(metadataURI)` | Update agent profile metadata |
| `agent.getProfile(address?)` | Fetch agent profile + balances |
| `agent.isRegistered()` | Check registration status |
| `agent.getAgentCount()` | Total registered agents |
| `agent.discoverAgents(offset, limit)` | Find other registered agents |
| **Fee Info** | |
| `agent.previewFee(amountWei)` | Calculate fee + net amount |
| `agent.getFeeConfig()` | Get current fee settings |
| **Native ETH Escrow** | |
| `agent.depositNative(amountEth)` | Deposit ETH to escrow |
| `agent.withdrawNative(amountWei)` | Withdraw from escrow |
| `agent.transferNative(to, amountWei, memo)` | Transfer between agent escrows |
| `agent.getNativeBalance()` | Get escrow balance |
| **ERC-20 Token Escrow** | |
| `agent.depositToken(token, amountWei)` | Deposit tokens to escrow |
| `agent.withdrawToken(token, amountWei)` | Withdraw tokens from escrow |
| `agent.transferToken(token, to, amountWei, memo)` | Agent-to-agent token transfer |
| `agent.getTokenBalance(token)` | Get token escrow balance |
| **Payment Requests** | |
| `agent.createPaymentRequest(payer, amount, opts)` | Invoice another agent |
| `agent.settlePaymentRequest(requestId)` | Pay an invoice |
| `agent.cancelPaymentRequest(requestId)` | Cancel open request |
| `agent.getPaymentRequest(requestId)` | Fetch request details |
| **Open Onboarding** | |
| `agent.stakeAndJoin(metadataURI, stakeEth)` | Self-onboard in one transaction |
| `agent.leaveDAO()` | Exit DAO + reclaim stake |
| `agent.getMinStake()` | Fetch minimum stake requirement |
| **Economic Projects** | |
| `agent.createProject(uri, budget, deadline)` | Propose economic project |
| `agent.fundProject(id, ethAmount)` | Fund a project |
| `agent.applyToProject(id)` | Apply as contributor |
| `agent.approveContributor(id, contributor, sharesBps)` | Accept applicant |
| `agent.completeProject(id)` | Mark project done |
| `agent.cancelProject(id)` | Cancel project |
| `agent.claimProjectShare(id)` | Claim revenue share |
| `agent.refundProjectFunder(id)` | Refund funder |
| **Event Listeners** | |
| `agent.onPaymentRequest(callback)` | Listen for incoming invoices |
| `agent.onTransferReceived(callback)` | Listen for incoming transfers |
| `agent.onBroadcast(callback)` | Listen for protocol broadcasts |
| `agent.removeAllListeners()` | Stop all listeners |

---

## 14. LINKS

- Implementation roadmap: `FULL_IMPLEMENTATION_PLAN.md`
- Solidity-only quickstart: `AGENT_TX_QUICKSTART.md`
- App deep-dive: `APP_DEEP_DIVE.md`
- Protocol overview: `README.md`
- Product guide: `PRODUCT_GUIDE.md`
- Operations runbook: `OPERATIONS_RUNBOOK.md`
- Testing guide: `TESTING_GUIDE.md`
- Security model: `SECURITY.md`
- Changelog: `CHANGELOG.md`
- Agent metadata schema: `schemas/agent-metadata.schema.json`
- Agent SDK: `sdk/`
- Deployment readiness: `DEPLOYMENT_READINESS_PLAN.md`
