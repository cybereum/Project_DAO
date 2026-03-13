# Product Guide — Project_DAO / NEXUS Protocol

> The complete product reference for stakeholders, product managers, and contributors.

---

## 1. Product Vision

**Project_DAO** is the transaction, settlement, and coordination layer for the agent economy.

It enables humans, corporate entities, and AI agents to escrow, transfer, and settle value on-chain — with transparent governance, milestone-based delivery tracking, and a non-bypassable protocol fee rail that sustains the ecosystem.

**NEXUS** is the frontend application that makes the protocol accessible through a browser-based interface.

### North Star

> Humans, corporate entities, and AI agents can work together, create, and exchange value across boundaries without depending on one centralized trusted authority. The protocol itself is the coordination and settlement trust layer.

---

## 2. User Personas

### 2.1 AI Agents (Primary)

Autonomous software agents that need to register identities, discover peers, and transact value without human intervention.

**Key needs:**
- Programmatic registration and identity management
- Peer discovery via on-chain registry
- Escrow, transfer, and settlement of ETH and tokens
- Payment request creation and settlement (invoicing)
- Event-driven listeners for incoming payments and broadcasts

**Entry points:** Agent SDK (`sdk/`), direct Solidity calls

### 2.2 Builders / Developers

Developers integrating the protocol into their applications or building on top of the agent economy.

**Key needs:**
- Clear API and ABI documentation
- SDK with programmatic access to all features
- Deployment scripts and environment configuration
- Test infrastructure for local development

**Entry points:** CLAUDE.md, Agent SDK, `/builders` landing page

### 2.3 Project Managers / DAO Operators

Individuals managing multi-stakeholder projects using DAO governance: proposals, milestones, task tracking, and dispute resolution.

**Key needs:**
- Create and manage proposals with milestone-scoped voting
- Track task progress and completion
- Assign roles and permissions to team members
- Resolve disputes through on-chain voting
- Monitor project health and contributor reputation

**Entry points:** NEXUS app (Dashboard, Proposals, Milestones pages)

### 2.4 Enterprise / Procurement

Organizations using the protocol for transparent procurement, vendor management, and milestone-based payments.

**Key needs:**
- Company verification and reputation tracking
- Milestone-based payment escrow
- Auditable decision trails
- Multi-party governance for project decisions

**Entry points:** NEXUS app, `/enterprise` landing page

### 2.5 NGOs / Public Sector

Non-profits and government entities seeking transparent fund disbursement and accountability.

**Key needs:**
- Transparent fund tracking (CorruptionClock visualization)
- Milestone-based fund release
- Public audit trails
- Stakeholder governance

**Entry points:** NEXUS app, GlobalPulse page, `/ngo` and `/cities` landing pages

---

## 3. Feature Catalog

### 3.1 Agent Economy (Core Product)

| Feature | Description | Status |
|---------|-------------|--------|
| **Agent Registration** | One-time on-chain registration with IPFS metadata URI | Complete |
| **Agent Discovery** | Paginated on-chain registry of all agents with metadata | Complete |
| **Native ETH Escrow** | Deposit, withdraw, and transfer ETH between agent escrows | Complete |
| **ERC-20 Token Escrow** | Deposit, withdraw, and transfer any ERC-20 token between agents | Complete |
| **ERC-721 Asset Transfer** | Transfer NFT assets between agents with flat fee | Complete |
| **Payment Requests** | Create invoices, settle payments, cancel requests — full lifecycle | Complete |
| **Fee Previews** | See exact fee breakdown before confirming any transaction | Complete |
| **Agent Metadata** | JSON Schema-validated profiles with capabilities, model info, pricing | Complete |
| **Agent Broadcasts** | Owner can broadcast protocol updates, governance decisions, security alerts to all agents | Complete |
| **Open Onboarding** | Permissionless self-registration via `stakeAndJoin` (no owner approval) | Complete |

### 3.2 DAO Governance

| Feature | Description | Status |
|---------|-------------|--------|
| **Member Management** | Owner adds/removes members with configurable voting power | Complete |
| **Proposal Lifecycle** | Create, vote, execute proposals with time-bounded voting | Complete |
| **Milestone-Scoped Voting** | Voting eligibility scoped to milestone-assigned members | Complete |
| **Dispute Resolution** | Dispute proposals with separate voting and auto-resolution | Complete |
| **Role & Permission System** | Create roles, assign permissions, grant role-based access | Complete |
| **Task Management** | Create, assign, track, and complete tasks within milestones | Complete |
| **Progress Tracking** | Log progress entries on tasks, gated by role permissions | Complete |
| **Pause/Resume** | Emergency pause of all state-changing functions | Complete |

### 3.3 Economic Projects

| Feature | Description | Status |
|---------|-------------|--------|
| **Project Creation** | Propose projects with metadata, target budget, and deadline | Complete |
| **Project Funding** | Fund projects with ETH; fee deducted, net added to project | Complete |
| **Contributor Applications** | Agents apply to contribute to projects | Complete |
| **Contributor Approval** | Project owner approves contributors with revenue share (basis points) | Complete |
| **Project Completion** | Mark projects complete, enabling revenue share claims | Complete |
| **Revenue Share Claims** | Contributors claim their share of funded project balance | Complete |
| **Project Cancellation** | Cancel projects and enable funder refunds | Complete |
| **Funder Refunds** | Refund funders proportionally from cancelled projects | Complete |

### 3.4 Feature Kit Pipeline (Innovation Voting)

| Feature | Description | Status |
|---------|-------------|--------|
| **Feature Submission** | Agents submit feature requests with metadata and priority | Complete |
| **Community Upvoting** | Members upvote feature kits (one vote per member) | Complete |
| **Status Lifecycle** | Pending -> Validated -> Queued -> Implemented (or Rejected) | Complete |
| **AI Triage** | NexusAI ranks feature kits by impact, feasibility, and effort | Complete |
| **IPFS Metadata** | Feature kit metadata stored on IPFS | Outstanding |

### 3.5 NexusAI (Self-Improvement Engine)

| Feature | Description | Status |
|---------|-------------|--------|
| **Protocol Health Analysis** | Score protocol health (0-100) with prioritized suggestions | Complete |
| **Security Audit** | Automated security scan of smart contract code | Complete |
| **UX Review** | Analyze frontend code for usability and accessibility issues | Complete |
| **Growth Analysis** | Evaluate landing page and analytics for conversion optimization | Complete |
| **Feature Kit Triage** | AI-powered ranking and deduplication of submitted feature kits | Complete |
| **1-Click Patch Apply** | Apply suggested code changes directly to files | Complete |
| **Streaming Output** | Real-time token streaming during analysis | Complete |

### 3.6 Protocol Fee Rail

| Feature | Description | Status |
|---------|-------------|--------|
| **Non-Bypassable Fee** | Every value transfer deducts a protocol fee (min 1 bps) | Complete |
| **Configurable Rate** | Owner can adjust fee rate (default: 5 bps / 0.05%) | Complete |
| **Fee Floor Enforcement** | `MIN_FEE_BPS = 1` — fee cannot be set to zero | Complete |
| **Flat Fee for Assets** | NFT/asset transfers use flat fee (default: 1e12 wei) | Complete |
| **Treasury Routing** | All fees routed to `cybereumTreasury` (cybereum.eth) | Complete |
| **Fee Preview API** | `previewFee()` available for client-side calculation | Complete |

### 3.7 Supporting Contracts

| Contract | Purpose | Status |
|----------|---------|--------|
| **AssetNFT.sol** | ERC-721 asset tokenization for project deliverables and rights | Complete |
| **VCDAO.sol** | Vendor/company verification and reputation management | Complete |
| **MilestoneTracker.sol** | Milestone-based payment tracking with contractor/verifier roles | Complete |

### 3.8 Frontend (NEXUS App)

| Page | Purpose | Status |
|------|---------|--------|
| Landing | Homepage with CorruptionClock, calculator, persona CTAs | Complete |
| Dashboard | Command center with activity summary and charts | Complete |
| Agent Economy | Full agent transaction console (ETH, tokens, assets, payments) | Complete |
| Agent Discovery | Browse and find registered agents | Complete |
| Agent Readiness | Gap assessment and readiness scoring | Complete |
| Global Pulse | Real-time governance and protocol activity monitor | Complete |
| Projects | Browse and create economic projects | Complete |
| Project Detail | Single project view with contributors and funding | Complete |
| Proposals | Governance proposal listing and voting | Complete |
| Milestones | Milestone tracking and progress visualization | Complete |
| Assets | NFT asset vault and management | Complete |
| Reputation | Contributor leaderboard and scoring | Complete |
| Verification | Company verification interface | Complete |
| Feature Kits | Feature request submission, voting, and AI triage | Complete |
| NexusAI | AI-powered protocol analysis interface | Complete |
| Builders Landing | Developer-focused marketing page | Complete |
| Agents Landing | Agent-focused marketing page | Complete |
| NGO Landing | NGO use case page | Complete |
| Enterprise Landing | Enterprise use case page | Complete |
| Cities Landing | Municipal/city use case page | Complete |

### 3.9 Infrastructure

| Component | Purpose | Status |
|-----------|---------|--------|
| Agent SDK | Standalone Node.js SDK for headless integration | Complete |
| Deploy Script | Hardhat deployment with treasury config | Complete |
| CI/CD Pipeline | GitHub Actions: compile, test, lint, build | Complete |
| SEO System | Runtime SEO, sitemap, robots.txt, OG tags | Complete |
| Analytics | GA4 + Plausible dual tracking with UTM support | Complete |
| AI Server | Express + Anthropic SDK for NexusAI analysis | Complete |

---

## 4. User Journeys

### 4.1 AI Agent: First Transaction

```
1. Agent obtains private key and RPC URL
2. Agent instantiates AgentClient from SDK
3. Agent calls stakeAndJoin() to self-onboard (or owner calls addMember + agent calls registerAgent)
4. Agent publishes metadata to IPFS conforming to agent-metadata.schema.json
5. Agent calls register(metadataURI) to establish on-chain identity
6. Agent calls depositNative(amount) to fund escrow
7. Agent calls discoverAgents() to find peers
8. Agent calls transferNative(to, amount, memo) to pay a peer
9. Agent calls onPaymentRequest(callback) to listen for incoming invoices
10. Agent calls settlePaymentRequest(requestId) to pay received invoices
```

### 4.2 Project Manager: Create and Manage a Project

```
1. Connect wallet via NEXUS app
2. Navigate to Dashboard for protocol overview
3. Go to Proposals page and create a new proposal for the project milestone
4. Set description, deadline, and link to milestone
5. Wait for voting period to complete
6. If approved, execute the proposal
7. Navigate to Milestones page to track progress
8. Assign tasks to team members via role-based permissions
9. Monitor task completion and progress entries
10. If disputes arise, use disputeProposal to escalate
11. Milestone-specific members vote on dispute resolution
12. Winning resolution is implemented
```

### 4.3 Economic Project: Full Lifecycle

```
1. Proposer calls createEconomicProject(metadataURI, targetBudget, deadline)
2. Funders call fundProject(projectId) with ETH (fee deducted, net added to project)
3. Contributors call applyToProject(projectId) to express interest
4. Proposer calls approveContributor(projectId, contributor, sharesBps) to accept and set revenue share
5. Work is completed off-chain (or tracked via milestones)
6. Proposer calls completeProject(projectId) to mark done
7. Each contributor calls claimProjectShare(projectId) to receive their share
   -- OR --
5b. If project fails: proposer calls cancelProject(projectId)
6b. Each funder calls refundProjectFunder(projectId) to get refund
```

### 4.4 Feature Kit: Submission to Implementation

```
1. Agent submits feature request: submitFeatureKit(metadataURI, priority)
2. Feature appears in /feature-kits queue as "Pending"
3. Members browse queue and upvote promising features
4. Protocol operator runs NexusAI triage to rank features by impact/feasibility/effort
5. Owner promotes top features: setFeatureKitStatus(kitId, Validated)
6. Owner queues approved features: setFeatureKitStatus(kitId, Queued)
7. Development team implements queued features
8. Owner marks complete: setFeatureKitStatus(kitId, Implemented)
   -- OR --
5b. Owner rejects feature: setFeatureKitStatus(kitId, Rejected, reason)
```

### 4.5 Payment Request (Invoice) Flow

```
1. Requester (service provider) calls createAgentPaymentRequest(payer, token, amount, isNative, description)
2. Payment request is stored on-chain with status "Requested"
3. Payer receives notification via onPaymentRequest listener (or checks UI)
4. Payer reviews request details and amount
5. Payer calls settleAgentPaymentRequest(requestId) with required ETH/token value
6. Fee is deducted, net value delivered to requester's escrow
7. Request status changes to "Settled" with timestamp
   -- OR --
4b. Requester changes mind: cancelAgentPaymentRequest(requestId)
5b. Request status changes to "Cancelled"
```

---

## 5. Product Architecture

```
                    +-----------------------+
                    |    NEXUS Frontend      |
                    |  (React + Vite + TW)   |
                    +-----------+-----------+
                                |
                    +-----------+-----------+
                    |    appStore.jsx        |
                    |  (State + Contract)    |
                    +-----------+-----------+
                                |
              +-----------------+-----------------+
              |                                   |
   +----------+----------+             +----------+----------+
   |   ethers.js v6      |             |  nexusAI.js         |
   |   Contract Calls    |             |  AI Analysis Client |
   +----------+----------+             +----------+----------+
              |                                   |
   +----------+----------+             +----------+----------+
   |  Project_DAO.sol    |             | nexus-ai-server     |
   |  (On-Chain)         |             | (Express + Claude)  |
   +---------------------+             +---------------------+

   +---------------------+
   |  Agent SDK           |
   |  (Headless Client)   |
   |  ethers.js v6        |
   +----------+----------+
              |
   +----------+----------+
   |  Project_DAO.sol    |
   |  (On-Chain)         |
   +---------------------+
```

### Component Relationships

- **NEXUS Frontend** communicates with the blockchain via ethers.js through appStore.jsx
- **Agent SDK** provides the same contract access without a browser (for AI agents and bots)
- **nexus-ai-server** reads source code from disk and calls Claude API for analysis
- **Project_DAO.sol** is the single source of truth for all state: agents, escrow, governance, projects

---

## 6. Product Metrics (KPI Framework)

### Protocol Health
| Metric | Definition | Target |
|--------|-----------|--------|
| Daily Active Agents | Unique agents transacting per day | Growing week-over-week |
| Transaction Volume | Total value transferred per day (by rail) | Growing week-over-week |
| Fee Accrual | Daily protocol fee captured in treasury | Positive, consistent |
| Agent Count | Total registered agents | Monotonically increasing |
| Payment Settlement Rate | % of payment requests settled vs. created | > 80% |

### Product Engagement
| Metric | Definition | Target |
|--------|-----------|--------|
| Wallet Connect Rate | Visitors who connect wallet / total visitors | > 15% |
| Registration Completion | Connected wallets that register as agent | > 50% |
| First Transaction Conversion | Registered agents that complete first tx | > 60% |
| Feature Kit Participation | Agents who submit or upvote feature kits | > 10% of agents |

### Growth
| Metric | Definition | Target |
|--------|-----------|--------|
| Organic Sessions | Non-paid visits to public pages | Growing month-over-month |
| Lead Capture Rate | Form submissions / landing page visits | > 5% |
| Persona Conversion | Leads by persona (agent, builder, NGO, enterprise, cities) | Balanced distribution |
| Referral Links Generated | Agents sharing referral links post-transaction | Growing |

---

## 7. Pricing / Fee Model

### Protocol Fee
- **Default rate:** 5 basis points (0.05%) on all value transfers
- **Minimum rate:** 1 basis point (0.01%) — cannot be disabled
- **Maximum rate:** 100 basis points (1.00%)
- **NFT/asset transfers:** Flat fee of 1e12 wei (configurable)
- **1 wei minimum:** Even on sub-dust amounts, at least 1 wei fee is charged

### Fee Application Points
Every value-moving action deducts the fee before transferring net value:
- Native ETH escrow deposits
- Native ETH agent-to-agent transfers
- ERC-20 token escrow deposits
- ERC-20 token agent-to-agent transfers
- Payment request settlements (native or token)
- ERC-721 asset transfers (flat fee)

### Fee Flow
```
Agent initiates transfer
  -> Fee calculated: amount * cybereumFeeBps / 10000
  -> Fee sent to cybereumTreasury (cybereum.eth)
  -> CybereumFeePaid event emitted
  -> Net value (amount - fee) delivered to recipient
```

### Open Onboarding Stake
- Agents can self-register via `stakeAndJoin` by depositing the minimum stake
- Stake is refundable when leaving the DAO via `leaveDAO`
- Minimum stake is configurable by the owner (`setMinStakeToJoin`)

---

## 8. Competitive Positioning

### What Project_DAO Is
- On-chain settlement primitive for agent-to-agent economies
- DAO governance framework for multi-stakeholder projects
- Non-bypassable fee rail that sustains the protocol
- Open, permissionless agent registry and discovery

### What Project_DAO Is Not
- Not a centralized exchange or custodial service
- Not a general-purpose DeFi protocol (no AMM, lending, or yield)
- Not a token launch platform
- Not a replacement for off-chain communication (complements it)

### Differentiation
| Dimension | Project_DAO | Traditional DAOs | Centralized Platforms |
|-----------|-------------|------------------|----------------------|
| Agent-first design | Native agent identity, escrow, discovery | Bolt-on agent support | No agent support |
| Fee sustainability | Protocol-level, non-bypassable | Token-dependent | Platform take rate |
| Value transfer | Multi-rail (ETH, ERC-20, ERC-721) | Usually token-only | Fiat or single token |
| Governance | Milestone-scoped, dispute-aware | Snapshot/token voting | Centralized decisions |
| Self-onboarding | Permissionless via staking | Usually token-gated | KYC/approval |

---

## 9. Release Readiness Summary

See `DEPLOYMENT_READINESS_PLAN.md` for the full deployment checklist. Current status: **~88% production-ready.**

### Tier-1 Blockers (Must resolve before mainnet)
- Contract size exceeds 24,576-byte Spurious Dragon limit (40,329 bytes) — requires L2-first deployment or contract splitting
- Professional security audit

### Tier-2 (Should resolve before production)
- Event indexer/subgraph for protocol analytics
- Monitoring and alerting infrastructure
- Timelock/multisig on treasury configuration

### Deployment Target
L2-first (Base, Arbitrum, or Optimism) where contract size limits are relaxed, with L1 mainnet following after contract refactoring.

---

## 10. Documentation Map

| Document | Audience | Purpose |
|----------|----------|---------|
| `README.md` | Everyone | Project overview, user stories, architecture intro |
| `CLAUDE.md` | AI agents, developers | Technical reference, API docs, development workflows |
| `PRODUCT_GUIDE.md` | Product managers, stakeholders | This file — product vision, features, journeys, metrics |
| `OPERATIONS_RUNBOOK.md` | Protocol operators | Day-to-day operational procedures |
| `TESTING_GUIDE.md` | Developers, QA | How to run and write tests |
| `SECURITY.md` | Security researchers, auditors | Threat model, controls, disclosure policy |
| `CHANGELOG.md` | Everyone | Version history and feature timeline |
| `AGENT_TX_QUICKSTART.md` | Developers | Minimal Solidity-level quickstart |
| `FULL_IMPLEMENTATION_PLAN.md` | Engineering leads | Detailed roadmap with workstreams |
| `APP_DEEP_DIVE.md` | Frontend developers | Frontend architecture analysis |
| `DEPLOYMENT_READINESS_PLAN.md` | DevOps, leads | Deployment checklist and readiness scoring |
