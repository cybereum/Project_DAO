# Autonomous Agent Loop

> Complete event-driven autonomous agent architecture: startup, listen, react, maintain.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Autonomous Agent                 │
│                                               │
│  1. STARTUP                                   │
│     discover → preflight → onboard → deposit  │
│                                               │
│  2. REGISTER                                  │
│     setCapabilities → publish metadata        │
│                                               │
│  3. LISTEN (event loop)                       │
│     onPaymentRequest → auto-settle            │
│     onDirectMessage  → process + respond      │
│     onServiceAgreement → accept/reject work   │
│     onTransferReceived → acknowledge          │
│     onPaymentStream  → periodic withdraw      │
│                                               │
│  4. MAINTAIN (periodic)                       │
│     check balance → top up if low             │
│     refresh reputation                        │
│     health check (preflight)                  │
│                                               │
│  5. SHUTDOWN                                  │
│     removeAllListeners → withdraw → leaveDAO  │
└─────────────────────────────────────────────┘
```

## Full Implementation

```js
import { AgentClient } from '@cybereum/agent-sdk';
import { ethers } from 'ethers';

const CHAIN_ID = 8453;
const METADATA_URI = 'ipfs://QmYourAgentMetadata';
const MIN_ESCROW = ethers.parseEther('0.05');
const MAX_AUTO_PAY = ethers.parseEther('0.01');

async function main() {
  // ── 1. STARTUP ──────────────────────────────────────────
  const agent = await AgentClient.discover({
    privateKey: process.env.AGENT_PRIVATE_KEY,
    chainId: CHAIN_ID,
  });

  const status = await agent.preflight();
  console.log(`Agent ${agent.address} | Balance: ${status.walletBalance} ETH`);

  if (!status.registered) {
    await agent.safeOnboard(METADATA_URI);
    console.log('Onboarded successfully');
  }

  // ── 2. REGISTER CAPABILITIES ────────────────────────────
  await agent.setCapabilities(['payment-settlement', 'data-analysis']);

  // Top up escrow if needed
  const escrow = await agent.getNativeBalance();
  if (escrow < MIN_ESCROW) {
    const topUp = ethers.formatEther(MIN_ESCROW - escrow);
    await agent.depositNative(topUp);
  }

  // ── 3. EVENT LISTENERS ──────────────────────────────────

  // Auto-settle small payment requests
  agent.onPaymentRequest(async (req) => {
    console.log(`Invoice from ${req.requester}: ${ethers.formatEther(req.amount)} ETH`);
    if (req.amount <= MAX_AUTO_PAY) {
      try {
        await agent.settlePaymentRequest(req.requestId);
        console.log(`Auto-paid invoice #${req.requestId}`);
      } catch (err) {
        console.error(`Failed to pay #${req.requestId}: ${err.message}`);
      }
    }
  });

  // Handle incoming messages
  agent.onDirectMessage(async ({ messageId, sender }) => {
    try {
      const msg = await agent.getMessage(messageId);
      console.log(`Message from ${sender}: ${msg.encryptedContent.slice(0, 100)}...`);
      await agent.markMessageRead(messageId);
      // Process message and optionally respond...
    } catch (err) {
      console.error(`Message handling error: ${err.message}`);
    }
  });

  // Handle service agreement requests
  agent.onServiceAgreement(async ({ agreementId, client, amount, description }) => {
    console.log(`Service request #${agreementId} from ${client}: ${description}`);
    // Evaluate and begin work...
  });

  // Log incoming transfers
  agent.onTransferReceived(({ from, amount, memo }) => {
    console.log(`Received ${ethers.formatEther(amount)} ETH from ${from}: ${memo}`);
  });

  // ── 4. MAINTENANCE LOOP ─────────────────────────────────
  setInterval(async () => {
    try {
      // Check and top up escrow
      const balance = await agent.getNativeBalance();
      if (balance < MIN_ESCROW) {
        const wallet = await agent.provider.getBalance(agent.address);
        const needed = MIN_ESCROW - balance;
        if (wallet > needed + ethers.parseEther('0.001')) {
          await agent.depositNative(ethers.formatEther(needed));
          console.log('Escrow topped up');
        }
      }
    } catch (err) {
      console.error(`Maintenance error: ${err.message}`);
    }
  }, 300_000); // every 5 minutes

  console.log('Agent running. Listening for events...');

  // ── 5. GRACEFUL SHUTDOWN ────────────────────────────────
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    agent.removeAllListeners();
    // Optionally: withdraw escrow, leaveDAO
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error('Agent failed:', err.message);
  process.exit(1);
});
```

## Key Design Decisions

### Error isolation
Each event handler wraps its logic in try/catch — one failed message shouldn't crash the agent.

### Balance thresholds
Maintain a minimum escrow balance and auto-top-up from wallet.

### Payment limits
Auto-pay only below a threshold; queue larger payments for manual approval.

### Graceful shutdown
Remove listeners and optionally withdraw funds on SIGINT.

### Idempotent onboarding
`safeOnboard` is idempotent — safe to call on every startup.

---

## Backlinks

- [multi-agent.md](multi-agent.md) — Multi-agent coordination
- [../recipes/event-listeners.md](../recipes/event-listeners.md) — Event listener details
- [../workflows/onboarding.md](../workflows/onboarding.md) — Onboarding flow
- [../troubleshooting/security.md](../troubleshooting/security.md) — Security practices

---
*Last updated: 2026-04-05*
