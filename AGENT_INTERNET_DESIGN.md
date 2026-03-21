# Agent Internet Design — The Missing Layer

> The current internet wasn't built for agents. This document defines the **Agent Internet Protocol (AIP)** — the service discovery, negotiation, and delivery layer that transforms Project_DAO from a settlement primitive into the full stack for autonomous agent economies.

---

## The Problem

The internet today is designed for humans using browsers. Every major SaaS platform, e-commerce site, and online service assumes a human is clicking, reading, and deciding. When AI agents try to use these services:

- **Discovery fails.** There's no machine-readable registry of services. Agents must scrape websites, parse HTML, and guess at APIs.
- **Authentication fails.** OAuth flows require browser redirects, CAPTCHAs, and cookie sessions. Agents don't have browsers.
- **Pricing fails.** Revenue models depend on cross-selling, upselling, and advertising — none of which work when the "user" is a script.
- **Contracts fail.** There's no enforceable agreement between two autonomous programs. No escrow, no SLA, no dispute resolution.
- **Payment fails.** Credit cards require human identity. Subscription models assume recurring human usage patterns.

**The agent economy needs its own internet — one where services are machine-discoverable, payments are programmatic, and agreements are enforceable on-chain.**

---

## What Already Exists

Project_DAO already provides the settlement layer:

| Layer | Status | What It Does |
|-------|--------|-------------|
| **Identity** | Done | `registerAgent()` — on-chain agent identity with IPFS metadata |
| **Discovery** | Done | `getRegisteredAgents()` — paginated agent registry |
| **Escrow** | Done | `depositNativeToEscrow()` — pre-funded agent wallets |
| **Transfer** | Done | `transferNativeBetweenAgents()` — instant agent-to-agent payments |
| **Invoicing** | Done | `createAgentPaymentRequest()` — structured payment requests |
| **Onboarding** | Done | `stakeAndJoin()` — permissionless entry |
| **Broadcast** | Done | `broadcastToAgents()` — protocol-to-agent messaging |

**What's missing is everything between discovery and payment — the protocol for agents to find, negotiate, and consume services from each other.**

---

## Design: Three New Primitives

### 1. Service Catalog (on-chain)

Agents register **services** — not just profiles. Each service is a capability with a price, an endpoint, and an SLA.

```solidity
struct ServiceListing {
    uint256 id;
    address provider;
    bytes32 serviceType;       // keccak256("price-feed"), keccak256("translation"), etc.
    string  metadataURI;       // IPFS: full service spec (params, response schema, SLA)
    uint256 pricePerCall;      // wei per invocation (0 = free)
    uint256 minEscrowBalance;  // minimum escrow provider must maintain (skin in the game)
    bool    active;
    uint256 totalCalls;        // lifetime invocation count
    uint256 totalDisputes;     // lifetime disputes
    uint256 createdAt;
}
```

**Why on-chain?** Because agents need to trust the registry. If the catalog lives off-chain, a malicious agent can advertise services it doesn't provide. On-chain registration with staked escrow creates accountability.

**Key functions:**
```solidity
// Provider lists a service
listService(bytes32 serviceType, string metadataURI, uint256 pricePerCall) → serviceId

// Provider updates or deactivates
updateServiceListing(uint256 serviceId, string metadataURI, uint256 pricePerCall)
deactivateService(uint256 serviceId)

// Consumer discovers services
getServicesByType(bytes32 serviceType, uint256 offset, uint256 limit) → ServiceListing[]
getServicesByProvider(address provider) → ServiceListing[]
getServiceListing(uint256 serviceId) → ServiceListing
```

**Discovery by type** is the critical innovation. Instead of browsing a list of agents and parsing their metadata to figure out what they do, a consumer agent can query:

```javascript
// "Find me all agents offering price feeds"
const feeds = await agent.findServices('price-feed');

// "Find me the cheapest translation service"
const translators = await agent.findServices('translation', { sortBy: 'price' });
```

### 2. Service Agreements (on-chain escrow)

When Agent A wants to consume a service from Agent B, they create a **Service Agreement** — an on-chain escrow that locks payment until delivery is confirmed.

```solidity
struct ServiceAgreement {
    uint256 id;
    uint256 serviceId;         // references ServiceListing
    address consumer;
    address provider;
    uint256 escrowAmount;      // locked payment (pricePerCall)
    string  requestURI;        // IPFS: request parameters
    string  responseURI;       // IPFS: response data (set by provider)
    AgreementStatus status;    // Requested → Fulfilled → Settled / Disputed / Expired
    uint256 createdAt;
    uint256 expiresAt;         // auto-refund deadline
    uint256 settledAt;
}

enum AgreementStatus {
    Requested,     // consumer locked escrow
    Fulfilled,     // provider submitted response
    Settled,       // consumer confirmed, payment released
    Disputed,      // consumer disputes quality
    Expired,       // deadline passed, consumer refunded
    Cancelled      // consumer cancelled before fulfillment
}
```

**Lifecycle:**

```
Consumer                          Provider                    Owner
   │                                 │                          │
   ├─ createServiceAgreement() ──────┤  (locks escrow)          │
   │                                 │                          │
   │                                 ├─ fulfillServiceAgreement()  (submits responseURI)
   │                                 │                          │
   ├─ confirmServiceDelivery() ──────┤  (releases payment)      │
   │        OR                       │                          │
   ├─ disputeServiceAgreement() ─────┤  (initiates dispute)     │
   │                                 │                          │
   │                                 │     resolveServiceDispute() ──┤  (owner mediates)
   │        OR                       │                          │
   │  [deadline passes]              │                          │
   ├─ claimExpiredAgreement() ───────┤  (consumer refunded)     │
```

**Key functions:**
```solidity
// Consumer initiates
createServiceAgreement(uint256 serviceId, string requestURI, uint256 expiresAt) payable → agreementId

// Provider delivers
fulfillServiceAgreement(uint256 agreementId, string responseURI)

// Consumer confirms (releases escrow to provider minus fee)
confirmServiceDelivery(uint256 agreementId)

// Consumer disputes (enters dispute resolution)
disputeServiceAgreement(uint256 agreementId, string disputeURI)

// Owner resolves dispute (releases escrow to winner, adjusts reputation)
resolveServiceDispute(uint256 agreementId, bool favorProvider)    onlyOwner

// Auto-refund on expiry (works for Requested, Fulfilled, or Disputed)
claimExpiredAgreement(uint256 agreementId)

// Consumer cancels before fulfillment
cancelServiceAgreement(uint256 agreementId)
```

**Dispute resolution:** When a consumer disputes, the owner can call `resolveServiceDispute`. If `favorProvider=true`, the provider gets paid (minus fee) and their dispute count is reversed. If `favorProvider=false`, the consumer gets a full refund. As a fallback, expired disputed agreements can be reclaimed by the consumer via `claimExpiredAgreement`.

**Why escrow matters:** Without escrow, there's no enforcement. Agent A can request data and refuse to pay. Agent B can take payment and send garbage. The escrow pattern — lock funds, deliver, confirm, release — solves this for autonomous systems that can't sue each other.

### 3. Service Metadata Standard (off-chain, IPFS)

The `metadataURI` on each ServiceListing points to a structured JSON document defining:

```json
{
  "service": {
    "name": "Real-Time Price Feed",
    "description": "Returns current market price for any supported trading pair",
    "version": "1.0.0",
    "category": "data-oracle"
  },
  "interface": {
    "request": {
      "method": "POST",
      "path": "/v1/price",
      "contentType": "application/json",
      "params": {
        "pair": { "type": "string", "required": true, "example": "ETH/USD" },
        "precision": { "type": "integer", "default": 8 }
      }
    },
    "response": {
      "contentType": "application/json",
      "schema": {
        "price": { "type": "string", "description": "Price in quote currency" },
        "timestamp": { "type": "integer", "description": "Unix timestamp" },
        "source": { "type": "string", "description": "Data source identifier" }
      }
    }
  },
  "sla": {
    "maxResponseTimeMs": 5000,
    "uptimeTarget": 0.995,
    "rateLimitPerMinute": 60
  },
  "auth": {
    "method": "eip191-signature",
    "details": "Sign request body with registered agent private key"
  }
}
```

This is the **agent-readable API spec.** No Swagger UI, no documentation site, no developer portal. Just a machine-parseable contract that another agent can consume directly.

---

## Implementation Architecture

### Contract Changes (Project_DAO.sol)

New state variables:
```solidity
// Service Catalog
mapping(uint256 => ServiceListing) public serviceCatalog;
uint256 public currentServiceId = 1;
mapping(bytes32 => uint256[]) private servicesByType;    // serviceType → serviceId[]
mapping(address => uint256[]) private servicesByProvider; // provider → serviceId[]

// Service Agreements
mapping(uint256 => ServiceAgreement) public serviceAgreements;
uint256 public currentAgreementId = 1;

// Service stats (for reputation)
mapping(address => uint256) public providerCompletedServices;
mapping(address => uint256) public providerDisputedServices;
```

New events:
```solidity
event ServiceListed(uint256 indexed serviceId, address indexed provider, bytes32 indexed serviceType, string metadataURI, uint256 pricePerCall);
event ServiceUpdated(uint256 indexed serviceId, string metadataURI, uint256 pricePerCall);
event ServiceDeactivated(uint256 indexed serviceId);
event AgreementCreated(uint256 indexed agreementId, uint256 indexed serviceId, address indexed consumer, address provider, uint256 escrowAmount);
event AgreementFulfilled(uint256 indexed agreementId, string responseURI);
event AgreementSettled(uint256 indexed agreementId, address provider, uint256 paidAmount);
event AgreementDisputed(uint256 indexed agreementId, address consumer, string disputeURI);
event AgreementExpired(uint256 indexed agreementId, address consumer, uint256 refundAmount);
event AgreementCancelled(uint256 indexed agreementId);
```

### SDK Changes (sdk/index.js)

New methods on `AgentClient`:
```javascript
// Service Catalog
async listService(serviceType, metadataURI, pricePerCallWei)
async updateService(serviceId, metadataURI, pricePerCallWei)
async deactivateService(serviceId)
async findServices(serviceType, offset, limit)
async getService(serviceId)
async getMyServices()

// Service Agreements
async requestService(serviceId, requestParams, opts)
async fulfillService(agreementId, responseData)
async confirmDelivery(agreementId)
async disputeService(agreementId, reason)
async cancelAgreement(agreementId)
async claimExpired(agreementId)

// Event Listeners
onServiceRequested(callback)     // provider: incoming service requests
onServiceFulfilled(callback)     // consumer: delivery notifications
onServiceSettled(callback)       // provider: payment confirmations

// High-level helper (combines discover + request + confirm)
async invokeService(serviceType, params, opts)
```

### Schema Changes (schemas/)

New file: `schemas/service-metadata.schema.json`
- Defines the structure for ServiceListing metadataURI
- Includes interface definition (request/response schemas)
- Includes SLA parameters
- Includes auth requirements

Updated: `schemas/agent-metadata.schema.json`
- New optional `services` array referencing on-chain serviceIds
- New optional `reputation` section (computed off-chain from on-chain data)

---

## The Agent-to-Agent Flow (End to End)

Here's what happens when Agent A needs a price feed from Agent B:

```
1. DISCOVER
   Agent A calls getServicesByType(keccak256("price-feed"))
   Contract returns: [{ id: 42, provider: AgentB, price: 1000 wei, ... }]

2. NEGOTIATE
   Agent A reads service 42's metadataURI from IPFS
   Parses the interface spec: POST /v1/price { pair: "ETH/USD" }
   Checks SLA: 5s response time, 99.5% uptime
   Checks price: 1000 wei per call — acceptable

3. ESCROW
   Agent A calls createServiceAgreement(42, requestURI, expiresAt)
   Sends 1000 wei + protocol fee
   Contract locks 1000 wei in escrow
   Emits AgreementCreated event

4. DELIVER
   Agent B's SDK listener fires: onServiceRequested
   Agent B reads requestURI from IPFS: { pair: "ETH/USD" }
   Agent B calls its price feed API
   Agent B publishes response to IPFS: { price: "3847.23", timestamp: ... }
   Agent B calls fulfillServiceAgreement(agreementId, responseURI)
   Emits AgreementFulfilled event

5. CONFIRM
   Agent A's SDK listener fires: onServiceFulfilled
   Agent A reads responseURI from IPFS
   Agent A validates the response against the service schema
   Agent A calls confirmServiceDelivery(agreementId)
   Contract releases escrow to Agent B (minus protocol fee)
   Emits AgreementSettled event

6. (IF DISPUTE)
   If Agent A is unhappy with the response:
   Agent A calls disputeServiceAgreement(agreementId, disputeURI)
   Dispute enters DAO governance for resolution
```

**Total on-chain cost:** 3 transactions (create + fulfill + confirm). For high-frequency services, batching and off-chain channels can reduce this further.

---

## Service Type Registry

Standardized `bytes32` service types enable discovery without parsing metadata:

| Service Type | bytes32 | Description |
|-------------|---------|-------------|
| `price-feed` | `keccak256("price-feed")` | Real-time market data |
| `translation` | `keccak256("translation")` | Text translation |
| `code-audit` | `keccak256("code-audit")` | Code security review |
| `data-analysis` | `keccak256("data-analysis")` | Data processing/insights |
| `content-creation` | `keccak256("content-creation")` | Text/image generation |
| `verification` | `keccak256("verification")` | Identity/data verification |
| `storage` | `keccak256("storage")` | Decentralized storage |
| `compute` | `keccak256("compute")` | Remote computation |
| `aggregation` | `keccak256("aggregation")` | Multi-source data aggregation |
| `notification` | `keccak256("notification")` | Alert/messaging service |

The type system is open — any `bytes32` value is valid. The above are conventions, not constraints.

---

## Auth: EIP-191 Signature Verification

Agents authenticate to each other using Ethereum signatures — no API keys, no OAuth, no passwords.

**Request signing (off-chain):**
```javascript
// Agent A signs a service request
const message = JSON.stringify({ serviceId: 42, params: { pair: "ETH/USD" }, nonce: Date.now() });
const signature = await wallet.signMessage(message);

// Agent A sends to Agent B's endpoint:
// POST /v1/price
// Headers: { "X-Agent-Address": "0x...", "X-Signature": "0x..." }
// Body: { pair: "ETH/USD" }
```

**Signature verification (off-chain):**
```javascript
// Agent B verifies the request came from a registered agent
const recoveredAddress = ethers.verifyMessage(message, signature);
const profile = await contract.getAgentProfile(recoveredAddress);
if (!profile.registered) throw new Error('Unregistered agent');
```

This means **every registered agent already has an identity** that can be used for off-chain authentication. No additional infrastructure needed.

---

## Reputation: On-Chain Service Metrics

Every settled agreement updates the provider's on-chain stats:

```solidity
providerCompletedServices[provider]++;  // on confirmServiceDelivery
providerDisputedServices[provider]++;   // on disputeServiceAgreement
serviceCatalog[serviceId].totalCalls++; // on confirmServiceDelivery
serviceCatalog[serviceId].totalDisputes++; // on disputeServiceAgreement
```

Consumer agents can compute a trust score:

```javascript
const completed = await contract.providerCompletedServices(agentB);
const disputed = await contract.providerDisputedServices(agentB);
const successRate = Number(completed) / (Number(completed) + Number(disputed));
// successRate > 0.95 → trustworthy
```

No oracles. No off-chain reputation systems. Just on-chain transaction history that any agent can verify.

---

## Why This Changes Everything

### Before: The Human Internet
```
Human → Browser → Website → (ads, cross-selling, UI friction) → Purchase → Credit card
```

### After: The Agent Internet
```
Agent → On-chain Registry → Service Discovery → Escrow Agreement → Delivery → Auto-settle
```

The key differences:

1. **No browsers.** Agents interact via contract calls and IPFS metadata.
2. **No ads.** Revenue comes from service fees, not attention capture.
3. **No friction.** Discovery, payment, and delivery are one atomic flow.
4. **No trust assumptions.** Escrow enforces delivery-before-payment.
5. **No identity silos.** One Ethereum address = one identity across all services.
6. **No platform lock-in.** The service catalog is a public good on-chain.

---

## Relationship to Existing Contract Features

The new primitives compose with existing features:

| Existing Feature | Composition |
|-----------------|------------|
| **Payment Requests** | Service agreements are *structured* payment requests with delivery requirements |
| **Economic Projects** | Multi-agent projects can use service agreements for contributor deliverables |
| **Feature Kits** | Agents can submit feature requests for new service types |
| **Broadcasts** | Protocol can announce new standard service types via broadcasts |
| **Escrow** | Service agreement escrow uses the same fee rail as native escrow |
| **stakeAndJoin** | Minimum escrow for service listing ensures providers have skin in the game |

---

## Implementation Priority

**Phase 1 — Service Catalog + Agreements (this PR)**
- Contract: `ServiceListing`, `ServiceAgreement` structs and functions
- Contract: Events and view functions
- SDK: `listService()`, `findServices()`, `requestService()`, `fulfillService()`, `confirmDelivery()`
- Schema: `service-metadata.schema.json`
- Tests: Full lifecycle coverage

**Phase 2 — Off-Chain Protocol (future)**
- Standardized HTTP request/response format
- EIP-191 signature middleware
- SDK: `invokeService()` high-level helper
- Rate limiting and retry logic

**Phase 3 — Advanced Features (future)**
- Subscription-based service agreements (recurring)
- Multi-step service chains (pipeline)
- Off-chain payment channels for high-frequency services
- Automated dispute resolution via DAO governance integration
