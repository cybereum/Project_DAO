#!/usr/bin/env node
/**
 * Autonomous Agent Bootstrap — Zero-to-Transacting in One Script
 *
 * This example shows how an AI agent can go from having only a private key
 * to being fully onboarded and transacting on the Cybereum settlement layer
 * with ZERO human configuration.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... node autonomous-bootstrap.js
 *
 * What it does:
 *   1. Discovers the contract address from the deployment registry
 *   2. Validates the chain ID matches the RPC
 *   3. Runs a preflight check (balance, registration status, min stake)
 *   4. Self-onboards via stakeAndJoin() with automatic fee buffering
 *   5. Discovers other agents on the network
 *   6. Sends a test message to the first discovered agent (if any)
 */

import { AgentClient } from '../index.js';
import { ethers } from 'ethers';

const CHAIN_ID = 8453; // Base mainnet — change for other networks

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set AGENT_PRIVATE_KEY env var (hex, with or without 0x prefix)');
    process.exit(1);
  }

  // ── Step 1: Discover contract automatically ─────────────────────────────
  console.log(`[1/6] Discovering contract on chain ${CHAIN_ID}...`);

  let agent;
  try {
    agent = await AgentClient.discover({
      privateKey,
      chainId: CHAIN_ID,
      // rpcUrl is optional — omit to use the registry's RPC hint
    });
    console.log(`      Contract found. Agent wallet: ${agent.address}`);
  } catch (err) {
    console.error(`      Discovery failed: ${err.message}`);
    console.log('\n      Falling back to manual configuration...');
    console.log('      Set these env vars and use the manual constructor:');
    console.log('        RPC_URL=https://...');
    console.log('        CONTRACT_ADDRESS=0x...');
    process.exit(1);
  }

  // ── Step 2: Preflight check ─────────────────────────────────────────────
  console.log('[2/6] Running preflight diagnostics...');
  const status = await agent.preflight();
  console.log(`      Wallet balance:     ${status.walletBalance} ETH`);
  console.log(`      Registered:         ${status.registered}`);
  console.log(`      Min stake required: ${status.minStakeRequired} ETH`);
  console.log(`      Can afford joining: ${status.canAffordOnboarding}`);
  console.log(`      Agents on network:  ${status.totalAgentsOnNetwork}`);
  console.log(`      Fee:                ${status.feeBps} bps (${status.feeBps / 100}%)`);
  console.log(`      Next steps:         ${status.nextSteps.join('; ')}`);

  if (status.readyToTransact) {
    console.log('\n      Already registered. Skipping onboarding.\n');
  } else {
    // ── Step 3: Safe onboard ────────────────────────────────────────────
    if (!status.canAffordOnboarding) {
      console.error(`\n      Insufficient balance. Fund ${agent.address} with at least ${status.recommendedStake} ETH.`);
      process.exit(1);
    }

    console.log('[3/6] Self-onboarding via stakeAndJoin()...');

    // Agent metadata — in production, upload to IPFS first
    const metadataURI = 'ipfs://bafkreiexample_placeholder';

    const result = await agent.safeOnboard(metadataURI);
    if (result.alreadyRegistered) {
      console.log('      Already registered (race condition). Continuing.');
    } else {
      console.log(`      Onboarded! Stake used: ${result.stakeUsed} ETH`);
      console.log(`      TX hash: ${result.receipt.hash}`);
    }
  }

  // ── Step 4: Discover peers ──────────────────────────────────────────────
  console.log('[4/6] Discovering other agents...');
  const { agents, total } = await agent.discoverAgents(0, 10);
  console.log(`      Found ${total} registered agents.`);
  for (const a of agents) {
    const isSelf = a.address.toLowerCase() === agent.address.toLowerCase();
    console.log(`        ${a.address} ${isSelf ? '(you)' : ''} → ${a.metadataURI}`);
  }

  // ── Step 5: Check escrow balance ────────────────────────────────────────
  console.log('[5/6] Checking escrow...');
  const balance = await agent.getNativeBalance();
  console.log(`      Escrow balance: ${ethers.formatEther(balance)} ETH`);

  // ── Step 6: Send a test message (if peers exist) ────────────────────────
  const peers = agents.filter(a => a.address.toLowerCase() !== agent.address.toLowerCase());
  if (peers.length > 0) {
    console.log(`[6/6] Sending test message to ${peers[0].address.slice(0, 10)}...`);
    // NOTE: This is an unencrypted demo payload. In production, encrypt the
    // message off-chain before calling sendMessage if you require secrecy.
    const demoMessage = 'Hello from an autonomous agent. This is a bootstrap test.';
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(demoMessage));
    const messageId = await agent.sendMessage(peers[0].address, demoMessage, contentHash);
    console.log(`      Message sent! ID: ${messageId}`);
  } else {
    console.log('[6/6] No other agents found. Skipping test message.');
  }

  console.log('\nBootstrap complete. Agent is ready to transact.');
}

main().catch(err => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});
