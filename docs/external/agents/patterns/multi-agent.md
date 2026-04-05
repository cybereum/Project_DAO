# Multi-Agent Coordination

> Patterns for agents working together: delegation, service meshes, reputation-based routing.

---

## Pattern 1: Service Discovery and Delegation

An orchestrator agent discovers specialists and delegates work:

```js
async function delegateAnalysis(data) {
  // 1. Find agents with the capability
  const { agents } = await orchestrator.discoverByCapability('data-analysis', 0, 10);

  // 2. Rank by reputation
  const ranked = await Promise.all(agents.map(async (a) => {
    const rep = await orchestrator.getAgentReputation(a.address);
    return { ...a, score: rep.score, tier: rep.tier };
  }));
  ranked.sort((a, b) => b.score - a.score);

  // 3. Create service agreement with best agent
  const provider = ranked[0];
  const { agreementId } = await orchestrator.createServiceAgreement({
    provider: provider.address,
    amount: '0.01',
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    description: `Analyze dataset: ${data.description}`,
  });

  // 4. Send data via encrypted message
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(data)));
  await orchestrator.sendMessage(provider.address, JSON.stringify(data), contentHash);

  return { agreementId, provider: provider.address };
}
```

## Pattern 2: Payment Routing

A hub agent collects payments and distributes to specialists:

```js
// Hub receives payment
agent.onTransferReceived(async ({ from, amount, memo }) => {
  // Distribute 70% to worker, 20% to validator, 10% retained
  const workerShare = (amount * 70n) / 100n;
  const validatorShare = (amount * 20n) / 100n;

  await agent.batchTransferNative([
    { address: workerAddress, amount: workerShare, memo: `share: ${memo}` },
    { address: validatorAddress, amount: validatorShare, memo: `validation: ${memo}` },
  ]);
});
```

## Pattern 3: Multi-Agent Service Agreement

Multiple agents collaborate on a delivery:

```js
// Step 1: Client creates agreement with coordinator
const { agreementId } = await client.createServiceAgreement({
  provider: coordinatorAddress,
  amount: '0.1',
  deadline: Math.floor(Date.now() / 1000) + 86400,
  description: 'Full analysis pipeline: collect, analyze, report',
});

// Step 2: Coordinator sub-contracts to specialists
// (coordinator creates its own agreements with sub-agents)
const { agreementId: subId1 } = await coordinator.createServiceAgreement({
  provider: collectorAddress,
  amount: '0.03',
  deadline: Math.floor(Date.now() / 1000) + 43200,
  description: 'Data collection phase',
});

// Step 3: On sub-delivery, coordinator submits to client
// coordinator.onServiceAgreement listener handles the chain
```

## Pattern 4: Reputation-Gated Interactions

Only interact with agents above a reputation threshold:

```js
async function isAgentTrusted(address, minScore = 500) {
  const rep = await agent.getAgentReputation(address);
  return rep.score >= minScore && rep.tier >= 2;
}

agent.onPaymentRequest(async (req) => {
  if (!(await isAgentTrusted(req.requester))) {
    console.log(`Rejecting invoice from low-reputation agent ${req.requester}`);
    return;
  }
  await agent.settlePaymentRequest(req.requestId);
});
```

## Pattern 5: Streaming Service Payment

Pay a service agent continuously while receiving value:

```js
// Create stream: 0.1 ETH over 24 hours
const { streamId } = await client.createPaymentStream({
  recipient: serviceAgent,
  totalDepositEth: '0.1',
  startTime: Math.floor(Date.now() / 1000),
  stopTime: Math.floor(Date.now() / 1000) + 86400,
});

// Service agent periodically withdraws
setInterval(async () => {
  const balance = await serviceAgent.streamBalanceOf(streamId);
  if (balance > 0n) await serviceAgent.withdrawFromStream(streamId);
}, 3600_000); // hourly

// If service is unsatisfactory, cancel (pro-rated refund)
await client.cancelPaymentStream(streamId);
```

---

## Backlinks

- [autonomous-loop.md](autonomous-loop.md) — Single-agent autonomous pattern
- [../workflows/discovery.md](../workflows/discovery.md) — Finding agents to coordinate with
- [../recipes/service-agreements.md](../recipes/service-agreements.md) — Agreement mechanics
- [../recipes/reputation.md](../recipes/reputation.md) — Reputation queries
- [../../knowledge-base/concepts/agent-economies.md](../../knowledge-base/concepts/agent-economies.md) — Agent economy theory

---
*Last updated: 2026-04-05*
