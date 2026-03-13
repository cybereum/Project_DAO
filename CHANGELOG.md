# Changelog — Project_DAO

> Version history and feature timeline for the protocol, NEXUS app, and supporting infrastructure.

All notable changes to this project are documented here. Dates reference implementation completion, not deployment.

---

## [Unreleased] — Next Steps

### Planned
- Professional security audit
- L2 deployment (Base/Arbitrum) — contract exceeds L1 size limit (40,329 bytes > 24,576)
- Event indexer/subgraph for protocol analytics (WS3)
- Timelock/multisig on `setCybereumTreasury()` and `setCybereumFeeConfig()`
- NexusAI rate limiting and suggestion history persistence
- IPFS metadata pinning for feature kits (replacing `data:` URIs)
- Broadcast notification panel in NEXUS app
- Frontend E2E tests (Playwright/Cypress)
- Prerender/SSR for public routes

---

## [0.5.0] — 2026-03-13

### Added — Documentation
- **PRODUCT_GUIDE.md** — comprehensive product reference: vision, personas, feature catalog, user journeys, architecture, KPIs, pricing model
- **OPERATIONS_RUNBOOK.md** — operational procedures: treasury management, fee configuration, member management, emergency procedures, monitoring
- **TESTING_GUIDE.md** — test architecture, coverage map, how to write tests, CI/CD pipeline docs
- **SECURITY.md** — threat model, security controls, known limitations, audit status, disclosure policy
- **CHANGELOG.md** — this file; version history and feature timeline
- Updated **CLAUDE.md** — expanded from 11 to 14 sections with development workflows, testing, coding conventions, complete frontend/SDK/contract documentation

---

## [0.4.0] — 2026-03-10

### Added — Deployment Infrastructure
- **Hardhat deployment script** (`scripts/deploy.js`) with automatic treasury configuration
- **GitHub Actions CI pipeline** (`.github/workflows/ci.yml`): contract compile + test, frontend lint + build
- **Contract test suite** (`test/ProjectDAO.test.js`): 58 tests covering fee configuration, treasury, agent registration, discovery, escrow (deposit/withdraw/transfer), payment requests, pause, member management, stakeAndJoin/leaveDAO, economic projects, feature kits, and system integration

### Added — Contract Hardening
- **ReentrancyGuard** (inline, no external dependency) on all ETH-transferring functions: `withdrawNativeFromEscrow`, `settleAgentPaymentRequest`, `claimProjectShare`, `refundProjectFunder`, `leaveDAO`
- **Custom error declarations** (ERC-6093 style): `Unauthorized`, `NotMember`, `NotRegisteredAgent`, `ContractPaused`, `ZeroAmount`, `InsufficientBalance`, `InvalidAddress`, `TransferFailed`, `AlreadyExists`, `NotFound`, `InvalidStatus`
- Hardhat network config with Sepolia and mainnet templates
- Optimizer reduced to 1 run for smallest bytecode

### Added — Frontend
- SEO route manifest (`routeManifest.js`) consolidating sitemap/SEO data
- Sitemap generation and validation scripts
- Frontend deployment gate (`npm run check:deploy`)
- `.env.example` template

---

## [0.3.0] — 2026-03-09

### Added — Feature Kit Pipeline (WS8)
- **On-chain functions:** `broadcastToAgents`, `submitFeatureKit`, `upvoteFeatureKit`, `setFeatureKitStatus`, `getFeatureKits`
- **FeatureKit struct** with lifecycle: Pending (0) -> Validated (1) -> Queued (2) -> Implemented (4), Rejected (3)
- **Broadcast types:** 0=info, 1=upgrade, 2=governance, 3=security
- **4 new events:** `FeatureKitSubmitted`, `FeatureKitUpvoted`, `FeatureKitStatusChanged`, `AgentBroadcast`
- **NexusAI triage mode** — 5th analysis mode: semantic deduplication, plan cross-reference, impact/feasibility/effort scoring
- **FeatureKits.jsx** — three-tab pipeline UI (Queue, AI Triage, Submit)
- **appStore.jsx** — `featureKits` state + `loadFeatureKits`, `submitFeatureKit`, `upvoteFeatureKit` methods
- `/feature-kits` route and sidebar nav entry

### Added — NexusAI Self-Improvement Engine (WS7)
- **nexus-ai-server/server.js** — Express proxy with Anthropic SDK, 4 analysis modes (health, security, ux, growth) + streaming SSE
- **nexusAI.js** — frontend client with `ping`, `getModes`, `analyse`, `analyseStream`, `applySuggestion`
- **NexusAI.jsx** — full UI: mode selector, streaming token display, score rings, collapsible suggestion cards, 1-click patch apply
- `/nexus-ai` route and sidebar nav entry

### Added — Agent Economy UI Completion (WS2)
- **ERC-20 Token Escrow tab** in AgentEconomy.jsx with deposit, withdraw, transfer forms
- **ERC-721 NFT Transfer tab** in AgentEconomy.jsx
- **Token balance check** — inline per-token balance query
- **appStore.jsx methods:** `agentDepositToken`, `agentWithdrawToken`, `agentTransferToken`, `agentTransferAsset`

### Fixed
- Fee collection upgraded from `.transfer()` to `.call{value:}()` with explicit revert on all 6 native transfer sites
- Added `parseUnits` to AgentEconomy imports
- Added `Coins` and `Image` icons to lucide-react imports
- Renamed ambiguous "Escrow" tab to "ETH Escrow" for clarity

---

## [0.2.0] — 2026-03-08

### Added — Agent Economy Core
- **Agent registration system:** `registerAgent`, `updateAgentMetadata`, `getAgentProfile`, `getAgentCount`, `getRegisteredAgents`
- **Native ETH escrow:** `depositNativeToEscrow`, `withdrawNativeFromEscrow`, `transferNativeBetweenAgents`
- **ERC-20 token escrow:** `depositTokenToEscrow`, `withdrawTokenFromEscrow`, `transferTokenBetweenAgents`
- **ERC-721 asset transfer:** `transferAssetBetweenAgents` with flat fee
- **Payment request lifecycle:** `createAgentPaymentRequest`, `settleAgentPaymentRequest`, `cancelAgentPaymentRequest`
- **Cybereum fee rail:** `_collectNativeFee`, `_collectTokenFee`, `_calculateFee`, `previewFee`
- **Fee configuration:** `setCybereumTreasury`, `setCybereumFeeConfig` with `MIN_FEE_BPS = 1` floor
- **Agent events:** `AgentRegistered`, `AgentToAgentNativeTransfer`, `AgentToAgentTokenTransfer`, `AgentAssetTransfer`, `AgentPaymentRequestCreated`, `AgentPaymentRequestSettled`, `CybereumFeePaid`

### Added — Open Onboarding
- **`stakeAndJoin`** — permissionless self-registration as member + agent in one transaction
- **`leaveDAO`** — exit DAO and reclaim staked ETH
- **`setMinStakeToJoin`** — owner configures minimum stake

### Added — Economic Projects
- **`createEconomicProject`** — propose projects with metadata, budget, deadline
- **`fundProject`** — fund projects with ETH (fee deducted)
- **`applyToProject`** / **`approveContributor`** — contributor application and approval with revenue share (bps)
- **`completeProject`** / **`claimProjectShare`** — project completion and revenue distribution
- **`cancelProject`** / **`refundProjectFunder`** — cancellation and refund flow

### Added — Frontend (NEXUS App)
- **AgentEconomy.jsx** — agent transaction console with native ETH forms
- **AgentsLanding.jsx** — agent discovery persona page
- **BuildersLanding.jsx** — developer persona page
- **AgentReadiness.jsx** — agent gap assessment and readiness scoring
- **GlobalPulse.jsx** — real-time governance and activity monitor
- **Landing.jsx** — homepage with CorruptionClock, interactive calculator, persona CTAs
- **LeadCapture.jsx** — persona-aware form with webhook submission
- **SEOHead.jsx** — route-level SEO metadata injector
- **analytics.js** — GA4 + Plausible dual tracking
- **utm.js** — full UTM capture with referral link generation
- **appStore.jsx** — global state management with contract integration for agent functions

### Added — Agent SDK
- **sdk/index.js** — `AgentClient` class with full programmatic API
- **sdk/abi.js** — agent-relevant ABI subset
- **sdk/package.json** — `@cybereum/agent-sdk` v0.1.0
- Methods: register, discover, deposit, withdraw, transfer (native + token), payment requests, stakeAndJoin/leaveDAO, economic projects, event listeners

### Added — Agent Metadata Schema
- **schemas/agent-metadata.schema.json** — JSON Schema v2020-12 for agent profiles
- **schemas/examples/** — example metadata for settlement agent and data oracle

---

## [0.1.0] — Initial Release

### Core DAO Governance
- **Member management:** `addMember`, `removeMember`, `grantPrivilege`, `changeOwner`
- **Proposal lifecycle:** `createProposal`, `vote`, `executeProposal` with time-bounded voting
- **Dispute resolution:** `disputeProposal`, `voteOnProposalDispute` with milestone-scoped voting
- **Milestone management:** milestone creation, milestone-scoped voting eligibility
- **Task management:** `createTask`, `updateTaskStatus`, `addTaskProgress` with role-gated permissions
- **Role & permission system:** `createRole`, `addPermission`, `assignRole`, `assignRoleToMilestone`
- **Pause/resume:** `pauseContract`, `resumeContract` for emergency control

### Supporting Contracts
- **AssetNFT.sol** — ERC-721 asset tokenization
- **VCDAO.sol** — vendor/company verification DAO
- **MilestoneTracker.sol** — milestone-based payment tracking
- **IAragonCourt.sol** / **IKleros.sol** — dispute resolution interfaces

### Frontend (NEXUS App) — Initial Pages
- Dashboard, Projects, ProjectDetail, Proposals, Milestones, Assets, Reputation, Verification
- Layout with sidebar navigation
- Mock state management in appStore.jsx

### Documentation
- README.md — project overview and user stories
- APP_DEEP_DIVE.md — frontend architecture analysis
- FULL_IMPLEMENTATION_PLAN.md — implementation roadmap
- DEPLOYMENT_READINESS_PLAN.md — deployment checklist
- AGENT_TX_QUICKSTART.md — Solidity quickstart
- CLAUDE.md — AI agent integration guide
