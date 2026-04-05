# Contract Reference

> Complete function signatures, state variables, events, enums, and structs for Project_DAO.sol.

---

## Contract Details

- **File**: `contracts/Project_DAO.sol` (~1633 lines)
- **Compiler**: Solidity 0.8.26, optimizer enabled, `viaIR: true`
- **Inheritance**: OpenZeppelin ERC-721, inline ReentrancyGuard
- **Deployed address**: Set via `VITE_PROJECT_DAO_ADDRESS` env var

---

## Functions by Module

### Agent Identity & Discovery
```
registerAgent(string metadataURI)
updateAgentMetadata(string metadataURI)
getAgentProfile(address agent) → (bool registered, string metadataURI, uint256 nativeEscrowBalance)
getAgentTokenBalance(address agent, address token) → uint256
getAgentCount() → uint256
getRegisteredAgents(uint256 offset, uint256 limit) → (address[], string[], uint256 total)
setAgentCapabilities(string[] capabilities)
getAgentCapabilities(address agent) → string[]
discoverAgentsByCapability(string capability, uint256 offset, uint256 limit) → (address[], string[], uint256 total)
getCapabilityAgentCount(string capability) → uint256
```

### Native ETH Escrow
```
depositNativeToEscrow()                                          payable, nonReentrant
withdrawNativeFromEscrow(uint256 amount)                         nonReentrant
transferNativeBetweenAgents(address to, uint256 amount, string memo)  nonReentrant
```

### ERC-20 Token Escrow
```
depositTokenToEscrow(address token, uint256 amount)              nonReentrant
withdrawTokenFromEscrow(address token, uint256 amount)           nonReentrant
transferTokenBetweenAgents(address token, address to, uint256 amount, string memo)  nonReentrant
```

### ERC-721 Asset Transfer
```
transferAssetBetweenAgents(address assetContract, address to, uint256 tokenId, string memo)  payable
```

### Payment Requests
```
createAgentPaymentRequest(address payer, address token, uint256 amount, bool isNative, string description) → uint256
settleAgentPaymentRequest(uint256 requestId)                     payable if isNative, nonReentrant
cancelAgentPaymentRequest(uint256 requestId)
getAgentPaymentRequest(uint256 requestId) → AgentPaymentRequest
```

### Service Agreements
```
createServiceAgreement(address provider, address arbiter, uint256 amount, uint256 deadline, string description) → uint256
submitDelivery(uint256 agreementId, bytes32 deliveryHash)
approveDelivery(uint256 agreementId)                             nonReentrant
disputeServiceAgreement(uint256 agreementId)
resolveServiceDispute(uint256 agreementId, bool inFavorOfProvider)  nonReentrant
cancelServiceAgreement(uint256 agreementId)                      nonReentrant
getServiceAgreement(uint256 agreementId) → ServiceAgreement
```

### Payment Streams
```
createPaymentStream(address recipient, uint256 totalDeposit, uint256 startTime, uint256 stopTime) → uint256
streamBalanceOf(uint256 streamId) → uint256
withdrawFromStream(uint256 streamId)                             nonReentrant
cancelPaymentStream(uint256 streamId)                            nonReentrant
getPaymentStream(uint256 streamId) → PaymentStream
```

### Secure Direct Messaging
```
sendDirectMessage(address to, string encryptedContent, bytes32 contentHash)
markMessageRead(uint256 messageId)
getDirectMessage(uint256 messageId) → DirectMessage
getConversation(address otherAgent, uint256 offset, uint256 limit) → (uint256[], uint256 total)
getInbox(uint256 offset, uint256 limit) → (uint256[], uint256 total)
```

### Economic Projects
```
createEconomicProject(string metadataURI, uint256 targetBudget, uint256 deadline) → uint256
fundProject(uint256 projectId)                                   payable, nonReentrant
applyToProject(uint256 projectId)
approveContributor(uint256 projectId, address contributor, uint256 sharesBps)
completeProject(uint256 projectId)
cancelProject(uint256 projectId)
claimProjectShare(uint256 projectId)                             nonReentrant
refundProjectFunder(uint256 projectId)                           nonReentrant
getEconomicProject(uint256 projectId) → EconomicProject
getEconomicProjects(uint256 offset, uint256 limit) → (EconomicProject[], uint256 total)
getProjectContributors(uint256 projectId) → address[]
getProjectFunders(uint256 projectId) → address[]
```

### Feature Kits
```
submitFeatureKit(string metadataURI, uint8 priority)
upvoteFeatureKit(uint256 kitId)
setFeatureKitStatus(uint256 kitId, uint8 newStatus, string reason)  onlyOwner
getFeatureKits(uint256 offset, uint256 limit) → (FeatureKit[], uint256 total)
```

### Open Onboarding
```
stakeAndJoin(string metadataURI)                                 payable, nonReentrant
leaveDAO()                                                       nonReentrant
setMinStakeToJoin(uint256 minStake)                              onlyOwner
```

### Fee Management
```
previewFee(uint256 amount) → (uint256 fee, uint256 net)
setCybereumTreasury(address treasury)                            onlyOwner, whenNotPaused
setCybereumFeeConfig(uint256 feeBps, uint256 flatFeeWei)         onlyOwner, whenNotPaused
```

### Governance
```
createProposal(string description, uint256 milestoneId, uint256[] previousMilestoneIds)
vote(uint256 proposalId, bool voteYes)
executeProposal(uint256 proposalId)
getProposal(uint256 proposalId) → Proposal
getProposalCount() → uint256
disputeProposal(uint256 proposalId, string description)
voteOnProposalDispute(uint256 disputeId, bool voteFor)
```

### Member & Role Management
```
addMember(address member, uint256 votingPower)                   onlyOwner
removeMember(address member)                                     onlyOwner
grantPrivilege(address member, uint256 privilege)                onlyOwner
changeOwner(address newOwner)                                    onlyOwner
createRole(bytes32 name)                                         onlyOwner
addPermission(uint256 roleId, string permission)                 onlyOwner, whenNotPaused
removePermission(uint256 roleId, string permission)              onlyOwner
assignRole(address member, uint256 roleId)                       onlyOwner
assignRoleToMilestone(address member, uint256 milestoneId, bytes32 role)
getRole(uint256 roleId) → (bytes32 name, uint256 memberCount)
```

### Pause/Resume
```
pauseContract()                                                  onlyOwner
resumeContract()                                                 onlyOwner
```

---

## Key Enums

```solidity
PaymentStatus     { Requested, Settled, Cancelled }
ProjectStatus     { Open, Active, Completed, Cancelled }
AgreementStatus   { Active, Delivered, Completed, Disputed, Cancelled }
StreamStatus      { Active, Paused, Cancelled, Completed }
MilestoneType     { REGULAR, PAYMENT }
```

## Key Structs

```solidity
AgentProfile          { registered, metadataURI, nativeEscrowBalance }
AgentPaymentRequest   { id, requester, payer, token, amount, isNative, description, status, createdAt, settledAt }
DirectMessage         { id, sender, recipient, contentHash, encryptedContent, timestamp, readByRecipient }
EconomicProject       { id, proposer, metadataURI, targetBudget, totalFunded, deadline, status, createdAt, contributorCount, funderCount }
FeatureKit            { id, submitter, priority, status, metadataURI, voteCount, submittedAt }
ServiceAgreement      { id, client, provider, arbiter, amount, description, status, createdAt, deadline, deliveryHash }
PaymentStream         { id, payer, recipient, ratePerSecond, totalDeposited, totalWithdrawn, startTime, stopTime, status }
Member                { memberAddress, votingPower, privileges[], isMember }
Proposal              { id, description, votingDeadline, executed, proposalPassed, yesVotes, noVotes, previousMilestoneIds[], milestoneId }
```

## Key State Variables

```solidity
agents[address]                        → AgentProfile
agentAddresses[]                       → address[]
agentTokenEscrowBalances[agent][token] → uint256
agentPaymentRequests[requestId]        → AgentPaymentRequest
directMessages[messageId]              → DirectMessage
economicProjects[projectId]            → EconomicProject
featureKits[kitId]                     → FeatureKit
members[address]                       → Member
memberStakes[address]                  → uint256
proposals[]                            → Proposal[]
cybereumFeeBps                         → uint256
assetTransferFlatFeeWei                → uint256
cybereumTreasury                       → address
minStakeToJoin                         → uint256
```

---

## Backlinks

- [architecture.md](architecture.md) — System structure overview
- [fee-model.md](fee-model.md) — Fee calculation details
- [security-model.md](security-model.md) — Access control and protection

---
*Source: contracts/Project_DAO.sol, CLAUDE.md §4*
*Last updated: 2026-04-05*
