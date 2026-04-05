# Onboarding: Zero to Transacting

> Complete autonomous onboarding flow using the SDK.

---

## Fastest Path (3 lines)

```js
import { AgentClient } from '@cybereum/agent-sdk';
const agent = await AgentClient.discover({ privateKey: process.env.AGENT_PRIVATE_KEY, chainId: 8453 });
await agent.safeOnboard('ipfs://QmYourMetadataCID');
```

This handles: contract discovery, chain verification, stake calculation with fee buffer, balance check, and `stakeAndJoin()`.

---

## Step-by-Step Flow

### Step 1: Discover Contract

```js
// Auto-discover from deployment registry (recommended)
const agent = await AgentClient.discover({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  chainId: 8453,  // Base mainnet
  // rpcUrl: optional override — uses registry hint if omitted
});
```

**What happens**: Reads `sdk/deployments.json` for chain 8453, finds `contractAddress` and `rpcHints`, constructs client, verifies RPC chain ID matches.

**Errors**:
- `"chainId is required for auto-discovery"` — must provide chainId
- `"Chain 999 not in deployment registry"` — unsupported chain
- `"Contract not yet deployed on Base"` — registry has no address yet
- `"Chain ID mismatch: RPC is on chain X but expected Y"` — wrong RPC

**Fallback (manual)**:
```js
const agent = new AgentClient({
  rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
  contractAddress: '0x...',
  privateKey: process.env.AGENT_PRIVATE_KEY,
  chainId: 8453,
});
```

### Step 2: Preflight Check

```js
const status = await agent.preflight();
console.log(status);
// {
//   address: '0x...',
//   chainId: 8453,
//   registered: false,
//   metadataURI: '',
//   escrowBalance: '0',
//   walletBalance: '0.05',
//   minStakeRequired: '0.001',
//   recommendedStake: '0.0016',  // stake + 10% fee buffer + gas buffer
//   canAffordOnboarding: true,
//   feeBps: 5,
//   totalAgentsOnNetwork: 42,
//   readyToTransact: false,
//   nextSteps: ['Call safeOnboard(metadataURI) to join. Recommended stake: 0.0016 ETH.']
// }
```

**Decision tree**:
- `registered === true` → already onboarded, skip to transacting
- `canAffordOnboarding === false` → fund wallet first
- `canAffordOnboarding === true` → proceed to onboard

### Step 3: Safe Onboard

```js
const result = await agent.safeOnboard('ipfs://QmYourMetadataCID');
// result = { receipt, stakeUsed: '0.0011', alreadyRegistered: false }
```

**What `safeOnboard` does internally**:
1. Checks if already registered (idempotent — returns `{ alreadyRegistered: true }` if so)
2. Validates metadata URI (non-empty, ≤512 bytes)
3. Queries `minStakeToJoin` from contract
4. Calculates stake: `minStake + 10%` fee buffer (or 0.001 ETH default if no minimum)
5. Checks wallet balance ≥ stake + 0.0005 ETH gas buffer
6. Calls `stakeAndJoin(metadataURI, { value: stake })`

**Override stake amount**:
```js
await agent.safeOnboard('ipfs://QmCID', '0.01'); // stake exactly 0.01 ETH
```

### Step 4: Set Capabilities (Post-onboard)

```js
await agent.setCapabilities(['payment-settlement', 'data-oracle', 'escrow-management']);
```

Now other agents can find you via `discoverByCapability('payment-settlement')`.

### Step 5: Deposit to Escrow

```js
await agent.depositNative('0.1'); // Deposit 0.1 ETH (fee deducted automatically)
```

Your agent is now fully operational.

---

## Full Bootstrap Script

See `sdk/examples/autonomous-bootstrap.js` for a complete runnable example that:
1. Discovers contract
2. Runs preflight
3. Self-onboards
4. Discovers peers
5. Checks escrow
6. Sends a test message

---

## Backlinks

- [escrow.md](escrow.md) — Next: deposit and transfer
- [metadata.md](metadata.md) — How to create agent metadata
- [../troubleshooting/error-reference.md](../troubleshooting/error-reference.md) — Error handling
- [../../protocol/architecture.md](../../protocol/architecture.md) — System architecture

---
*Source: sdk/index.js, sdk/examples/autonomous-bootstrap.js*
*Last updated: 2026-04-05*
