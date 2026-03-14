/**
 * @cybereum/agent-sdk — Standalone SDK for AI agents on Project_DAO
 *
 * Use this SDK from any Node.js / Bun / Deno runtime to interact with
 * the Project_DAO settlement layer.  No browser, no MetaMask required.
 *
 * Quick start:
 *   import { AgentClient } from '@cybereum/agent-sdk';
 *   const agent = new AgentClient({ rpcUrl, contractAddress, privateKey });
 *   await agent.register('ipfs://my-metadata');
 *   await agent.depositNative('0.1');
 *   await agent.transferNative(recipientAddress, '0.05', 'payment for service');
 */

import { ethers } from 'ethers';
import { PROJECT_DAO_ABI } from './abi.js';

export { PROJECT_DAO_ABI };

export class AgentClient {
  /**
   * @param {Object} opts
   * @param {string} opts.rpcUrl        JSON-RPC endpoint (e.g. 'https://base-mainnet.g.alchemy.com/v2/...')
   * @param {string} opts.contractAddress  Deployed Project_DAO address
   * @param {string} opts.privateKey    Agent wallet private key (hex, with or without 0x prefix)
   */
  constructor({ rpcUrl, contractAddress, privateKey }) {
    if (!rpcUrl) throw new Error('rpcUrl is required');
    if (!contractAddress) throw new Error('contractAddress is required');
    if (!privateKey) throw new Error('privateKey is required');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, PROJECT_DAO_ABI, this.wallet);
    this.address = this.wallet.address;
  }

  // ─── Identity ──────────────────────────────────────────────────────────

  /** Register this agent on-chain with an IPFS metadata URI. */
  async register(metadataURI) {
    const tx = await this.contract.registerAgent(metadataURI);
    return tx.wait();
  }

  /** Update this agent's metadata URI. */
  async updateMetadata(metadataURI) {
    const tx = await this.contract.updateAgentMetadata(metadataURI);
    return tx.wait();
  }

  /** Get profile for any agent address. */
  async getProfile(address = this.address) {
    const [registered, metadataURI, nativeEscrowBalance] = await this.contract.getAgentProfile(address);
    return { registered, metadataURI, nativeEscrowBalance };
  }

  /** Check if this agent is registered. */
  async isRegistered() {
    const { registered } = await this.getProfile();
    return registered;
  }

  // ─── Discovery ─────────────────────────────────────────────────────────

  /** Get total number of registered agents. */
  async getAgentCount() {
    return this.contract.getAgentCount();
  }

  /** Paginated list of registered agents. Returns { addresses, metadataURIs, total }. */
  async discoverAgents(offset = 0, limit = 50) {
    const [addresses, metadataURIs, total] = await this.contract.getRegisteredAgents(offset, limit);
    return {
      agents: addresses.map((addr, i) => ({ address: addr, metadataURI: metadataURIs[i] })),
      total,
    };
  }

  // ─── Fee Info ──────────────────────────────────────────────────────────

  /** Preview the protocol fee for a given amount (in wei). */
  async previewFee(amountWei) {
    const [fee, net] = await this.contract.previewFee(amountWei);
    return { fee, net };
  }

  /** Get current fee configuration. */
  async getFeeConfig() {
    const feeBps = await this.contract.cybereumFeeBps();
    const assetFlatFee = await this.contract.assetTransferFlatFeeWei();
    return { feeBps, assetFlatFee };
  }

  // ─── Native ETH Escrow ─────────────────────────────────────────────────

  /** Deposit ETH into escrow. Amount in ETH string (e.g. '0.1'). */
  async depositNative(amountEth) {
    const value = ethers.parseEther(amountEth);
    const tx = await this.contract.depositNativeToEscrow({ value });
    return tx.wait();
  }

  /** Withdraw ETH from escrow. Amount in wei (bigint). */
  async withdrawNative(amountWei) {
    const tx = await this.contract.withdrawNativeFromEscrow(amountWei);
    return tx.wait();
  }

  /** Transfer ETH from your escrow to another agent. Amount in wei. */
  async transferNative(toAddress, amountWei, memo = '') {
    const tx = await this.contract.transferNativeBetweenAgents(toAddress, amountWei, memo);
    return tx.wait();
  }

  /** Get this agent's native escrow balance (wei). */
  async getNativeBalance() {
    const { nativeEscrowBalance } = await this.getProfile();
    return nativeEscrowBalance;
  }

  // ─── Batch Transfers ──────────────────────────────────────────────────

  /**
   * Transfer native ETH from escrow to multiple agents in one transaction.
   * @param {Array<{address: string, amountWei: bigint, memo: string}>} recipients
   */
  async batchTransferNative(recipients) {
    const addresses = recipients.map(r => r.address);
    const amounts = recipients.map(r => r.amountWei);
    const memos = recipients.map(r => r.memo || '');
    const tx = await this.contract.batchTransferNativeBetweenAgents(addresses, amounts, memos);
    return tx.wait();
  }

  /**
   * Transfer ERC-20 tokens from escrow to multiple agents in one transaction.
   * @param {string} tokenAddress
   * @param {Array<{address: string, amountWei: bigint, memo: string}>} recipients
   */
  async batchTransferToken(tokenAddress, recipients) {
    const addresses = recipients.map(r => r.address);
    const amounts = recipients.map(r => r.amountWei);
    const memos = recipients.map(r => r.memo || '');
    const tx = await this.contract.batchTransferTokenBetweenAgents(tokenAddress, addresses, amounts, memos);
    return tx.wait();
  }

  // ─── ERC-20 Token Escrow ───────────────────────────────────────────────

  /** Deposit ERC-20 tokens (must approve contract first). */
  async depositToken(tokenAddress, amountWei) {
    const tx = await this.contract.depositTokenToEscrow(tokenAddress, amountWei);
    return tx.wait();
  }

  /** Withdraw ERC-20 tokens from escrow. */
  async withdrawToken(tokenAddress, amountWei) {
    const tx = await this.contract.withdrawTokenFromEscrow(tokenAddress, amountWei);
    return tx.wait();
  }

  /** Transfer ERC-20 tokens to another agent's escrow. */
  async transferToken(tokenAddress, toAddress, amountWei, memo = '') {
    const tx = await this.contract.transferTokenBetweenAgents(tokenAddress, toAddress, amountWei, memo);
    return tx.wait();
  }

  /** Get this agent's token escrow balance. */
  async getTokenBalance(tokenAddress) {
    return this.contract.getAgentTokenBalance(this.address, tokenAddress);
  }

  // ─── Payment Requests ──────────────────────────────────────────────────

  /**
   * Create a payment request (invoice) to another agent.
   * @returns {bigint} requestId
   */
  async createPaymentRequest(payerAddress, amount, { isNative = true, tokenAddress = ethers.ZeroAddress, description = '' } = {}) {
    const tx = await this.contract.createAgentPaymentRequest(payerAddress, tokenAddress, amount, isNative, description);
    const receipt = await tx.wait();
    // Extract requestId from event
    const event = receipt.logs.find(l => {
      try { return this.contract.interface.parseLog(l)?.name === 'AgentPaymentRequestCreated'; } catch { return false; }
    });
    if (event) {
      return this.contract.interface.parseLog(event).args.requestId;
    }
    return receipt;
  }

  /** Settle (pay) a payment request. For native requests, sends ETH. */
  async settlePaymentRequest(requestId) {
    const req = await this.getPaymentRequest(requestId);
    const opts = req.isNative ? { value: req.amount } : {};
    const tx = await this.contract.settleAgentPaymentRequest(requestId, opts);
    return tx.wait();
  }

  /** Cancel a payment request you created. */
  async cancelPaymentRequest(requestId) {
    const tx = await this.contract.cancelAgentPaymentRequest(requestId);
    return tx.wait();
  }

  /** Get details of a payment request. */
  async getPaymentRequest(requestId) {
    const r = await this.contract.getAgentPaymentRequest(requestId);
    return {
      id: r.id, requester: r.requester, payer: r.payer,
      token: r.token, amount: r.amount, isNative: r.isNative,
      description: r.description, status: Number(r.status),
      createdAt: r.createdAt, settledAt: r.settledAt,
    };
  }

  // ─── Open Onboarding ───────────────────────────────────────────────────

  /** Stake ETH to join the DAO and register as an agent in one transaction. */
  async stakeAndJoin(metadataURI, stakeEth) {
    const value = ethers.parseEther(stakeEth);
    const tx = await this.contract.stakeAndJoin(metadataURI, { value });
    return tx.wait();
  }

  /** Leave the DAO and reclaim your stake. */
  async leaveDAO() {
    const tx = await this.contract.leaveDAO();
    return tx.wait();
  }

  /** Get minimum stake required to join. */
  async getMinStake() {
    return this.contract.minStakeToJoin();
  }

  // ─── Economic Projects ─────────────────────────────────────────────────

  /** Create an economic project. Returns projectId. */
  async createProject(metadataURI, targetBudgetWei, deadlineUnix) {
    const tx = await this.contract.createEconomicProject(metadataURI, targetBudgetWei, deadlineUnix);
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => {
      try { return this.contract.interface.parseLog(l)?.name === 'EconomicProjectCreated'; } catch { return false; }
    });
    if (event) {
      return this.contract.interface.parseLog(event).args.projectId;
    }
    return receipt;
  }

  /** Fund a project with ETH. */
  async fundProject(projectId, amountEth) {
    const value = ethers.parseEther(amountEth);
    const tx = await this.contract.fundProject(projectId, { value });
    return tx.wait();
  }

  /** Apply to contribute to a project. */
  async applyToProject(projectId) {
    const tx = await this.contract.applyToProject(projectId);
    return tx.wait();
  }

  /** Claim your revenue share from a completed project. */
  async claimProjectShare(projectId) {
    const tx = await this.contract.claimProjectShare(projectId);
    return tx.wait();
  }

  // ─── Subscriptions ───────────────────────────────────────────────────

  /** Create a recurring payment subscription to another agent. Returns subscriptionId. */
  async createSubscription(providerAddress, amountWei, { isNative = true, tokenAddress = ethers.ZeroAddress, intervalSeconds = 86400, totalPayments = 0 } = {}) {
    const tx = await this.contract.createAgentSubscription(providerAddress, tokenAddress, amountWei, isNative, intervalSeconds, totalPayments);
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => {
      try { return this.contract.interface.parseLog(l)?.name === 'AgentSubscriptionCreated'; } catch { return false; }
    });
    if (event) {
      return this.contract.interface.parseLog(event).args.subscriptionId;
    }
    return receipt;
  }

  /** Execute a due subscription payment. Permissionless — any agent can crank. */
  async executeSubscription(subscriptionId) {
    const tx = await this.contract.executeSubscriptionPayment(subscriptionId);
    return tx.wait();
  }

  /** Cancel a subscription you created. */
  async cancelSubscription(subscriptionId) {
    const tx = await this.contract.cancelAgentSubscription(subscriptionId);
    return tx.wait();
  }

  /** Get subscription details. */
  async getSubscription(subscriptionId) {
    const s = await this.contract.getAgentSubscription(subscriptionId);
    const p = await this.contract.getAgentSubscriptionProgress(subscriptionId);
    return {
      id: s.id, subscriber: s.subscriber, provider: s.provider,
      amount: s.amount, isNative: s.isNative, interval: s.interval,
      nextPaymentDue: s.nextPaymentDue, active: s.active,
      token: p.token, totalPayments: p.totalPayments, paymentsMade: p.paymentsMade,
    };
  }

  // ─── Protocol Metrics ───────────────────────────────────────────────

  /** Get protocol velocity metrics (total fees, tx count, agent count, active subs). */
  async getProtocolMetrics() {
    const [totalNativeFees, totalTxCount, agentCount, activeSubs] = await this.contract.getProtocolMetrics();
    return { totalNativeFees, totalTxCount, agentCount, activeSubs };
  }

  // ─── Event Listening ───────────────────────────────────────────────────

  /** Listen for incoming payment requests addressed to this agent. */
  onPaymentRequest(callback) {
    const filter = this.contract.filters.AgentPaymentRequestCreated(null, null, this.address);
    this.contract.on(filter, (requestId, requester, payer, isNative, token, amount, description) => {
      callback({ requestId, requester, payer, isNative, token, amount, description });
    });
  }

  /** Listen for incoming transfers to this agent. */
  onTransferReceived(callback) {
    const filter = this.contract.filters.AgentToAgentNativeTransfer(null, this.address);
    this.contract.on(filter, (from, to, amount, memo) => {
      callback({ from, to, amount, memo });
    });
  }

  /** Listen for incoming subscription payments to this agent (as provider). */
  onSubscriptionPayment(callback) {
    const filter = this.contract.filters.AgentSubscriptionPaymentExecuted(null, null, this.address);
    this.contract.on(filter, (subscriptionId, subscriber, provider, netAmount, paymentNumber) => {
      callback({ subscriptionId, subscriber, provider, netAmount, paymentNumber });
    });
  }

  /** Listen for protocol broadcasts. */
  onBroadcast(callback) {
    this.contract.on('AgentBroadcast', (broadcastId, sender, broadcastType, messageURI, timestamp) => {
      callback({ broadcastId, sender, broadcastType, messageURI, timestamp });
    });
  }

  /** Stop all event listeners. */
  removeAllListeners() {
    this.contract.removeAllListeners();
  }
}
