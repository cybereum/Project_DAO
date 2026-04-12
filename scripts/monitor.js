#!/usr/bin/env node
// scripts/monitor.js — Real-time monitor for critical Project_DAO contract events.
// Usage: RPC_URL=... CONTRACT_ADDRESS=... node scripts/monitor.js

const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const ALERT_THRESHOLD_ETH = parseFloat(process.env.ALERT_THRESHOLD_ETH || '1.0');
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const RECONNECT_DELAY_MS = 5000;

if (!RPC_URL || !CONTRACT_ADDRESS) {
  console.error('ERROR: RPC_URL and CONTRACT_ADDRESS environment variables are required.');
  process.exit(1);
}

// ABI fragment — only the events and views we need for monitoring
const MONITOR_ABI = [
  'event CybereumTreasuryUpdated(address indexed treasury)',
  'event CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei)',
  'event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo)',
  'event TimelockQueued(bytes32 indexed opId, uint256 readyTime, uint256 expiresAt)',
  'event TimelockExecuted(bytes32 indexed opId)',
  'event TimelockCancelled(bytes32 indexed opId)',
  'event MemberJoinedByStake(address indexed member, uint256 netStake)',
  'event MemberLeftDAO(address indexed member, uint256 refundedStake)',
  'event ServiceAgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address arbiter, uint256 amount, uint256 deadline, string description)',
  'event NetworkMilestoneReached(uint256 agentCount, uint256 milestone, string benefit)',
  'function cybereumTreasury() external view returns (address)',
];

function log(level, event, data) {
  const entry = { timestamp: new Date().toISOString(), level, event, ...data };
  console.log(JSON.stringify(entry));
  if (WEBHOOK_URL) sendWebhook(entry);
}

async function sendWebhook(payload) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`Webhook POST failed: ${res.status}`);
  } catch (err) {
    console.error(`Webhook error: ${err.message}`);
  }
}

const fmtEth = (wei) => ethers.formatEther(wei);

async function pollTreasuryBalance(provider, contract) {
  try {
    const treasury = await contract.cybereumTreasury();
    const balance = await provider.getBalance(treasury);
    log('INFO', 'TreasuryBalancePoll', {
      treasury,
      balanceETH: fmtEth(balance),
      balanceWei: balance.toString(),
    });
  } catch (err) {
    log('WARN', 'TreasuryBalancePollError', { error: err.message });
  }
}

function attachListeners(contract) {
  contract.on('CybereumTreasuryUpdated', (treasury) => {
    log('ALERT', 'CybereumTreasuryUpdated', { treasury });
  });

  contract.on('CybereumFeeConfigUpdated', (feeBps, flatFee) => {
    log('ALERT', 'CybereumFeeConfigUpdated', {
      feeBps: feeBps.toString(),
      assetTransferFlatFeeWei: flatFee.toString(),
    });
  });

  contract.on('AgentToAgentNativeTransfer', (from, to, amount, memo) => {
    const amountEth = parseFloat(fmtEth(amount));
    const large = amountEth >= ALERT_THRESHOLD_ETH;
    log(large ? 'ALERT' : 'INFO', 'AgentToAgentNativeTransfer', {
      from, to, amountETH: fmtEth(amount), memo, largeTransfer: large,
    });
  });

  contract.on('TimelockQueued', (opId, readyTime, expiresAt) => {
    log('ALERT', 'TimelockQueued', {
      opId,
      readyTime: readyTime.toString(),
      expiresAt: expiresAt.toString(),
      readyAt: new Date(Number(readyTime) * 1000).toISOString(),
    });
  });

  contract.on('TimelockExecuted', (opId) => {
    log('ALERT', 'TimelockExecuted', { opId });
  });

  contract.on('TimelockCancelled', (opId) => {
    log('INFO', 'TimelockCancelled', { opId });
  });

  contract.on('MemberJoinedByStake', (member, netStake) => {
    log('INFO', 'MemberJoinedByStake', { member, stakeETH: fmtEth(netStake) });
  });

  contract.on('MemberLeftDAO', (member, refundedStake) => {
    log('INFO', 'MemberLeftDAO', { member, refundedETH: fmtEth(refundedStake) });
  });

  contract.on('ServiceAgreementCreated', (id, client, provider, arbiter, amount, deadline, desc) => {
    log('INFO', 'ServiceAgreementCreated', {
      agreementId: id.toString(), client, provider, arbiter,
      amountETH: fmtEth(amount),
      deadline: new Date(Number(deadline) * 1000).toISOString(),
      description: desc,
    });
  });

  contract.on('NetworkMilestoneReached', (agentCount, milestone, benefit) => {
    log('ALERT', 'NetworkMilestoneReached', {
      agentCount: agentCount.toString(),
      milestone: milestone.toString(),
      benefit,
    });
  });
}

async function start() {
  log('INFO', 'MonitorStarting', {
    contract: CONTRACT_ADDRESS,
    alertThresholdETH: ALERT_THRESHOLD_ETH,
    webhookConfigured: !!WEBHOOK_URL,
  });

  let pollTimer = null;

  function scheduleReconnect() {
    log('INFO', 'Reconnecting', { delayMs: RECONNECT_DELAY_MS });
    setTimeout(connect, RECONNECT_DELAY_MS);
  }

  async function connect() {
    let provider;
    try {
      provider = RPC_URL.startsWith('ws')
        ? new ethers.WebSocketProvider(RPC_URL)
        : new ethers.JsonRpcProvider(RPC_URL);

      const network = await provider.getNetwork();
      log('INFO', 'Connected', { chainId: network.chainId.toString(), name: network.name });

      const contract = new ethers.Contract(CONTRACT_ADDRESS, MONITOR_ABI, provider);
      attachListeners(contract);

      // Initial treasury poll, then every 5 minutes
      await pollTreasuryBalance(provider, contract);
      pollTimer = setInterval(() => pollTreasuryBalance(provider, contract), POLL_INTERVAL_MS);

      provider.on('error', (err) => {
        log('WARN', 'ProviderError', { error: err.message });
        cleanup();
        scheduleReconnect();
      });

      if (provider.websocket) {
        provider.websocket.on('close', () => {
          log('WARN', 'WebSocketClosed', { message: 'Connection lost' });
          cleanup();
          scheduleReconnect();
        });
      }
    } catch (err) {
      log('ERROR', 'ConnectionFailed', { error: err.message });
      cleanup();
      scheduleReconnect();
    }

    function cleanup() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      try { provider?.removeAllListeners(); } catch (_) {}
    }
  }

  await connect();
}

start().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
