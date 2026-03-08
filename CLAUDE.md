# CLAUDE.md — Project_DAO Agent Integration Guide

> **For AI agents, autonomous systems, and developers building on the agent economy.**
> This file is optimised for fast discovery and use. Read section 1 first, then jump to what you need.

---

## 1. WHAT THIS IS (30-second read)

**Project_DAO** is the transaction and settlement layer for the agent economy.

- Every registered agent can escrow, transfer, and settle value (native ETH + ERC-20 + ERC-721 assets) directly on-chain.
- Every value transaction automatically routes a **minuscule protocol fee** (~0.05 % by default) to `cybereum.eth` — non-bypassable by design.
- DAO governance (proposals, milestones, roles, disputes) is built on the same contract.
- The frontend app is **NEXUS** at `nexus-app/`.

**One contract. One fee rail. The settlement primitive for agent-to-agent economies.**

---

## 2. QUICK-START FOR AGENTS (< 5 minutes)

### Step 0 — Prerequisites
- You are a DAO member (`members[address].isMember == true`).
- The owner has called `setCybereumTreasury(<cybereum.eth resolved address>)`.

### Step 1 — Register as an agent
```solidity
registerAgent("ipfs://<your-metadata-cid>")
```
One-time call. Metadata URI should point to a JSON file with `name`, `description`, `type`, `capabilities[]`.

### Step 2 — Fund your escrow (native ETH)
```solidity
depositNativeToEscrow{ value: <amount> }()
```
A minuscule fee (~0.05 %) is deducted automatically. Your `nativeEscrowBalance` increases by `amount - fee`.

### Step 3 — Transfer to another agent
```solidity
transferNativeBetweenAgents(<toAddress>, <amount>, "memo")
```
Recipient must also be a registered agent. Fee is deducted from amount; net lands in recipient escrow.

### Step 4 — Settle a payment request
```solidity
// Requester creates request:
createAgentPaymentRequest(<payerAddress>, address(0), <amount>, true, "invoice description")

// Payer settles (native):
settleAgentPaymentRequest{ value: <amount> }(<requestId>)
```

### Step 5 — Withdraw
```solidity
withdrawNativeFromEscrow(<amount>)
```
Net amount (after fee) transferred to your wallet.

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

#### Identity
```
registerAgent(string metadataURI)
updateAgentMetadata(string metadataURI)
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

## 10. LINKS

- Implementation roadmap: `FULL_IMPLEMENTATION_PLAN.md`
- Solidity-only quickstart: `AGENT_TX_QUICKSTART.md`
- App deep-dive: `APP_DEEP_DIVE.md`
- Protocol overview: `README.md`
