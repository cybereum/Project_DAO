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

  /** @private Extract a named arg from the first matching event in a receipt. */
  _extractEvent(receipt, eventName, argName) {
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed?.name === eventName) return parsed.args[argName];
      } catch { /* skip non-matching logs */ }
    }
    return null;
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
    const requestId = this._extractEvent(receipt, 'AgentPaymentRequestCreated', 'requestId');
    if (requestId == null) throw new Error('AgentPaymentRequestCreated event not found in receipt');
    return requestId;
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
    const projectId = this._extractEvent(receipt, 'EconomicProjectCreated', 'projectId');
    if (projectId == null) throw new Error('EconomicProjectCreated event not found in receipt');
    return projectId;
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

  // ─── Service Catalog ──────────────────────────────────────────────────

  /**
   * List a new service in the on-chain catalog.
   * @param {string} serviceType  Human-readable type (e.g. 'price-feed'). Hashed to bytes32.
   * @param {string} metadataURI  IPFS URI with service spec
   * @param {bigint|string} pricePerCallWei  Price per invocation in wei
   * @returns {bigint} serviceId
   */
  async listService(serviceType, metadataURI, pricePerCallWei) {
    const typeHash = ethers.id(serviceType);
    const tx = await this.contract.listService(typeHash, metadataURI, pricePerCallWei);
    const receipt = await tx.wait();
    const serviceId = this._extractEvent(receipt, 'ServiceListed', 'serviceId');
    if (serviceId == null) throw new Error('ServiceListed event not found in receipt');
    return serviceId;
  }

  /** Update an existing service listing. */
  async updateService(serviceId, metadataURI, pricePerCallWei) {
    const tx = await this.contract.updateServiceListing(serviceId, metadataURI, pricePerCallWei);
    return tx.wait();
  }

  /** Deactivate a service listing. */
  async deactivateService(serviceId) {
    const tx = await this.contract.deactivateService(serviceId);
    return tx.wait();
  }

  /**
   * Find services by type (paginated).
   * @param {string} serviceType  Human-readable type (e.g. 'price-feed')
   * @returns {{ services: Object[], total: bigint }}
   */
  async findServices(serviceType, offset = 0, limit = 50) {
    const typeHash = ethers.id(serviceType);
    const [page, total] = await this.contract.getServicesByType(typeHash, offset, limit);
    return {
      services: page.map(s => ({
        id: s.id, provider: s.provider, serviceType: s.serviceType,
        metadataURI: s.metadataURI, pricePerCall: s.pricePerCall,
        active: s.active, totalCalls: s.totalCalls, totalDisputes: s.totalDisputes,
        createdAt: s.createdAt,
      })),
      total,
    };
  }

  /** Get a single service listing. */
  async getService(serviceId) {
    const s = await this.contract.getServiceListing(serviceId);
    return {
      id: s.id, provider: s.provider, serviceType: s.serviceType,
      metadataURI: s.metadataURI, pricePerCall: s.pricePerCall,
      active: s.active, totalCalls: s.totalCalls, totalDisputes: s.totalDisputes,
      createdAt: s.createdAt,
    };
  }

  /** Get all service IDs for this agent. */
  async getMyServices() {
    return this.contract.getServicesByProvider(this.address);
  }

  /** Get total service listings count. */
  async getServiceCount() {
    return this.contract.getServiceCount();
  }

  // ─── Service Agreements ──────────────────────────────────────────────

  /**
   * Request a service by creating an escrow-backed agreement.
   * @param {bigint|number} serviceId
   * @param {string} requestURI  IPFS URI with request parameters
   * @param {{ expiresAt?: number, value?: bigint }} opts
   * @returns {bigint} agreementId
   */
  async requestService(serviceId, requestURI, { expiresAt, value } = {}) {
    if (!expiresAt) expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1h default
    if (value == null) {
      const svc = await this.getService(serviceId);
      value = svc.pricePerCall;
    }
    const tx = await this.contract.createServiceAgreement(serviceId, requestURI, expiresAt, { value });
    const receipt = await tx.wait();
    const agreementId = this._extractEvent(receipt, 'AgreementCreated', 'agreementId');
    if (agreementId == null) throw new Error('AgreementCreated event not found in receipt');
    return agreementId;
  }

  /** Fulfill a service agreement (provider submits response). */
  async fulfillService(agreementId, responseURI) {
    const tx = await this.contract.fulfillServiceAgreement(agreementId, responseURI);
    return tx.wait();
  }

  /** Confirm delivery and release escrow to provider. */
  async confirmDelivery(agreementId) {
    const tx = await this.contract.confirmServiceDelivery(agreementId);
    return tx.wait();
  }

  /** Dispute a fulfilled service. */
  async disputeService(agreementId, disputeURI) {
    const tx = await this.contract.disputeServiceAgreement(agreementId, disputeURI);
    return tx.wait();
  }

  /** Cancel an unfulfilled agreement and reclaim escrow. */
  async cancelAgreement(agreementId) {
    const tx = await this.contract.cancelServiceAgreement(agreementId);
    return tx.wait();
  }

  /** Reclaim escrow from an expired agreement. */
  async claimExpired(agreementId) {
    const tx = await this.contract.claimExpiredAgreement(agreementId);
    return tx.wait();
  }

  /** Get a service agreement by ID. */
  async getAgreement(agreementId) {
    const a = await this.contract.getServiceAgreement(agreementId);
    return {
      id: a.id, serviceId: a.serviceId, consumer: a.consumer, provider: a.provider,
      escrowAmount: a.escrowAmount, requestURI: a.requestURI, responseURI: a.responseURI,
      status: Number(a.status), createdAt: a.createdAt, expiresAt: a.expiresAt,
      settledAt: a.settledAt,
    };
  }

  /** Get provider reputation (completed, disputed, serviceCount). */
  async getReputation(address = this.address) {
    const [completed, disputed, serviceCount] = await this.contract.getProviderReputation(address);
    return { completed, disputed, serviceCount };
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

  /** Listen for incoming service requests (for providers). */
  onServiceRequested(callback) {
    this.contract.on('AgreementCreated', (agreementId, serviceId, consumer, provider, escrowAmount) => {
      if (provider === this.address) {
        callback({ agreementId, serviceId, consumer, provider, escrowAmount });
      }
    });
  }

  /** Listen for fulfilled agreements (for consumers). */
  onServiceFulfilled(callback) {
    this.contract.on('AgreementFulfilled', (agreementId, responseURI) => {
      callback({ agreementId, responseURI });
    });
  }

  /** Listen for settled agreements (for providers). */
  onServiceSettled(callback) {
    this.contract.on('AgreementSettled', (agreementId, provider, paidAmount) => {
      if (provider === this.address) {
        callback({ agreementId, provider, paidAmount });
      }
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
