/**
 * @cybereum/agent-sdk — Standalone SDK for AI agents on Project_DAO
 *
 * Use this SDK from any Node.js / Bun / Deno runtime to interact with
 * the Project_DAO settlement layer.  No browser, no MetaMask required.
 *
 * Quick start (manual):
 *   import { AgentClient } from '@cybereum/agent-sdk';
 *   const agent = new AgentClient({ rpcUrl, contractAddress, privateKey });
 *   await agent.register('ipfs://my-metadata');
 *   await agent.depositNative('0.1');
 *   await agent.transferNative(recipientAddress, '0.05', 'payment for service');
 *
 * Autonomous start (auto-discover contract):
 *   import { AgentClient } from '@cybereum/agent-sdk';
 *   const agent = await AgentClient.discover({ privateKey, chainId: 8453 });
 *   await agent.safeOnboard('ipfs://my-metadata');
 */

import { ethers } from 'ethers';
import { PROJECT_DAO_ABI } from './abi.js';
import { deployments } from './deployments.js';

export { PROJECT_DAO_ABI };

export class AgentClient {
  /**
   * @param {Object} opts
   * @param {string} opts.rpcUrl          JSON-RPC endpoint (e.g. 'https://base-mainnet.g.alchemy.com/v2/...')
   * @param {string} opts.contractAddress Deployed Project_DAO address
   * @param {string} opts.privateKey      Agent wallet private key (hex, with or without 0x prefix)
   * @param {number} [opts.chainId]       Expected chain ID. If set, SDK verifies the RPC matches before any transaction.
   */
  constructor({ rpcUrl, contractAddress, privateKey, chainId }) {
    if (!rpcUrl) throw new Error('rpcUrl is required');
    if (!contractAddress) throw new Error('contractAddress is required');
    if (!privateKey) throw new Error('privateKey is required');

    // Validate contract address format (reuses _validateAddress logic at construction time)
    ethers.getAddress(contractAddress); // throws TypeError on invalid address

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, PROJECT_DAO_ABI, this.wallet);
    this.address = this.wallet.address;
    this._expectedChainId = chainId ? Number(chainId) : null;
    this._chainVerified = false;
  }

  /**
   * Verify the RPC is connected to the expected chain.
   * Called automatically before the first write transaction.
   * @throws {Error} if chainId doesn't match the expected value.
   */
  async verifyChain() {
    if (this._chainVerified || !this._expectedChainId) return;
    const network = await this.provider.getNetwork();
    const actual = Number(network.chainId);
    if (actual !== this._expectedChainId) {
      throw new Error(
        `Chain ID mismatch: RPC is on chain ${actual} but expected ${this._expectedChainId}. ` +
        `Check your rpcUrl or chainId parameter.`
      );
    }
    this._chainVerified = true;
  }

  /**
   * Auto-discover the contract from the deployment registry.
   * Agents call this instead of manually providing contractAddress + rpcUrl.
   *
   * @param {Object} opts
   * @param {string}  opts.privateKey  Agent wallet private key
   * @param {number}  opts.chainId     Target chain ID (e.g. 8453 for Base)
   * @param {string}  [opts.rpcUrl]    Override RPC URL (optional — uses registry hint if omitted)
   * @returns {Promise<AgentClient>}
   *
   * @example
   *   const agent = await AgentClient.discover({ privateKey: process.env.KEY, chainId: 8453 });
   */
  static async discover({ privateKey, chainId, rpcUrl }) {
    if (!privateKey) throw new Error('privateKey is required');
    if (!chainId) throw new Error('chainId is required for auto-discovery');

    const registry = deployments;
    if (!registry) {
      throw new Error('Deployment registry not found. Use manual constructor instead.');
    }

    const network = registry.networks[String(chainId)];
    if (!network) {
      const available = Object.entries(deployments.networks).map(([id, n]) => `${n.name} (${id})`).join(', ');
      throw new Error(`Chain ${chainId} not in deployment registry. Available: ${available}`);
    }

    if (!network.contractAddress) {
      throw new Error(
        `Contract not yet deployed on ${network.name} (chain ${chainId}). Status: ${network.status}. ` +
        `Check the deployment registry for updates.`
      );
    }

    const resolvedRpc = rpcUrl || network.rpcHints?.[0];
    if (!resolvedRpc) {
      throw new Error(`No RPC URL provided and no hints in registry for ${network.name}.`);
    }

    const agent = new AgentClient({
      rpcUrl: resolvedRpc,
      contractAddress: network.contractAddress,
      privateKey,
      chainId,
    });
    await agent.verifyChain();
    return agent;
  }

  /**
   * Safe onboarding: checks minimum stake, adds fee buffer, and joins in one call.
   * Handles the full autonomous flow an agent needs to go from zero to registered.
   *
   * @param {string} metadataURI  IPFS URI to agent metadata JSON
   * @param {string} [overrideStakeEth]  Optional: override stake amount in ETH. If omitted, uses minStake + 10% fee buffer.
   * @returns {Promise<{receipt: Object, stakeUsed: string}>}
   */
  async safeOnboard(metadataURI, overrideStakeEth) {
    this._validateMetadataURI(metadataURI);
    await this.verifyChain();

    // Check if already registered
    const profile = await this.getProfile();
    if (profile.registered) {
      return { receipt: null, stakeUsed: '0', alreadyRegistered: true };
    }

    // Query minimum stake
    const minStake = await this.getMinStake();

    let stakeWei;
    if (overrideStakeEth) {
      stakeWei = ethers.parseEther(overrideStakeEth);
    } else if (minStake === 0n) {
      // No minimum set — stake a small default (0.001 ETH)
      stakeWei = ethers.parseEther('0.001');
    } else {
      // Add 10% buffer to cover the protocol fee
      stakeWei = minStake + (minStake * 10n / 100n);
    }

    // Check wallet balance (include gas buffer: ~200k gas at 1 gwei = 0.0002 ETH conservative estimate)
    const gasBuffer = ethers.parseEther('0.0005');
    const totalNeeded = stakeWei + gasBuffer;
    const balance = await this.provider.getBalance(this.address);
    if (balance < totalNeeded) {
      const needed = ethers.formatEther(totalNeeded);
      const have = ethers.formatEther(balance);
      throw new Error(
        `Insufficient balance to onboard. Need ~${needed} ETH (stake + fee buffer + gas), have ${have} ETH.`
      );
    }

    const receipt = await this.stakeAndJoin(metadataURI, ethers.formatEther(stakeWei));
    return { receipt, stakeUsed: ethers.formatEther(stakeWei), alreadyRegistered: false };
  }

  /**
   * Preflight check: returns a diagnostic object telling an agent what it needs to do.
   * Useful for autonomous agents to plan their onboarding steps.
   *
   * @returns {Promise<Object>} Diagnostic status
   */
  async preflight() {
    await this.verifyChain();
    const [profile, minStake, feeConfig, agentCount, balance] = await Promise.all([
      this.getProfile().catch(() => ({ registered: false, metadataURI: '', nativeEscrowBalance: 0n })),
      this.getMinStake().catch(() => 0n),
      this.getFeeConfig().catch(() => ({ feeBps: 5n, assetFlatFee: 1000000000000n })),
      this.getAgentCount().catch(() => 0n),
      this.provider.getBalance(this.address),
    ]);

    const gasBuffer = ethers.parseEther('0.0005');
    const stakeNeeded = minStake === 0n ? ethers.parseEther('0.001') : minStake + (minStake * 10n / 100n);
    const totalNeeded = stakeNeeded + gasBuffer;
    return {
      address: this.address,
      chainId: this._expectedChainId,
      registered: profile.registered,
      metadataURI: profile.metadataURI,
      escrowBalance: profile.nativeEscrowBalance.toString(),
      walletBalance: ethers.formatEther(balance),
      minStakeRequired: ethers.formatEther(minStake),
      recommendedStake: ethers.formatEther(totalNeeded),
      canAffordOnboarding: balance >= totalNeeded,
      feeBps: Number(feeConfig.feeBps),
      totalAgentsOnNetwork: Number(agentCount),
      readyToTransact: profile.registered,
      nextSteps: profile.registered
        ? ['Agent is registered and ready to transact.']
        : [
            balance >= stakeNeeded
              ? `Call safeOnboard(metadataURI) to join. Recommended stake: ${ethers.formatEther(stakeNeeded)} ETH.`
              : `Fund wallet with at least ${ethers.formatEther(stakeNeeded)} ETH, then call safeOnboard(metadataURI).`,
          ],
    };
  }

  /**
   * @private
   * Enforces chain verification before executing any write transaction.
   * Includes retry logic with exponential backoff for transient failures.
   * @template T
   * @param {() => Promise<T>} fn  Function that submits the transaction.
   * @param {Object} [opts]
   * @param {number} [opts.retries=2]       Max retries on transient errors.
   * @param {number} [opts.timeoutMs=120000] Timeout per attempt in ms.
   * @returns {Promise<T>}
   */
  async _write(fn, { retries = 2, timeoutMs = 120_000 } = {}) {
    await this.verifyChain();

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this._withTimeout(fn(), timeoutMs);
        return result;
      } catch (err) {
        lastError = err;
        const msg = err?.message || '';
        const isTransient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|SERVER_ERROR|NETWORK_ERROR|noNetwork|timeout/i.test(msg);
        if (!isTransient || attempt === retries) throw err;
        const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * @private
   * Wrap a promise with a timeout. Uses a settled flag to prevent
   * race conditions between the timeout and the promise resolution.
   */
  _withTimeout(promise, ms) {
    if (!ms || ms <= 0) return promise;
    let settled = false;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Transaction timed out after ${ms}ms`));
        }
      }, ms);
      promise.then(
        val => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } },
        err => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } }
      );
    });
  }

  /** @private Wait for a transaction with timeout protection. */
  _waitForTx(tx, ms = 120_000) {
    return this._withTimeout(tx.wait(), ms);
  }

  /** Extract a named arg from a transaction receipt's event logs. */
  _extractEventArg(receipt, eventName, argName) {
    const log = receipt.logs.find(l => {
      try { return this.contract.interface.parseLog(l)?.name === eventName; } catch { return false; }
    });
    if (log) return this.contract.interface.parseLog(log).args[argName];
    return null;
  }

  /**
   * @private
   * Validate an Ethereum address using ethers.getAddress (checksums it).
   * @param {string} addr       The address to validate.
   * @param {string} paramName  Human-readable parameter name for error messages.
   * @returns {string} The checksummed address.
   */
  _validateAddress(addr, paramName) {
    try {
      return ethers.getAddress(addr);
    } catch {
      throw new Error(`Invalid ${paramName} address: ${addr}`);
    }
  }

  /**
   * @private
   * Validate a metadata URI string (must be non-empty, <= 512 chars, matching contract limits).
   * @param {string} uri The metadata URI to validate.
   */
  _validateMetadataURI(uri) {
    if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
      throw new Error('metadataURI must be a non-empty string');
    }
    if (uri.length > 512) {
      throw new Error(`metadataURI too long (${uri.length} chars, max 512). Use an IPFS CID instead of inline data.`);
    }
  }

  // ─── Identity ──────────────────────────────────────────────────────────

  /** Register this agent on-chain with an IPFS metadata URI. */
  async register(metadataURI) {
    this._validateMetadataURI(metadataURI);
    const tx = await this._write(() => this.contract.registerAgent(metadataURI));
    return this._waitForTx(tx);
  }

  /** Update this agent's metadata URI. */
  async updateMetadata(metadataURI) {
    this._validateMetadataURI(metadataURI);
    const tx = await this._write(() => this.contract.updateAgentMetadata(metadataURI));
    return this._waitForTx(tx);
  }

  /** Get profile for any agent address. */
  async getProfile(address = this.address) {
    if (address !== this.address) this._validateAddress(address, 'agent');
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
    if (offset < 0) throw new Error('offset must be non-negative');
    if (limit <= 0 || limit > 1000) throw new Error('limit must be between 1 and 1000');
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
    if (value <= 0n) throw new Error('Deposit amount must be greater than zero');
    const tx = await this._write(() => this.contract.depositNativeToEscrow({ value }));
    return this._waitForTx(tx);
  }

  /** Withdraw ETH from escrow. Amount in wei (bigint). */
  async withdrawNative(amountWei) {
    if (!amountWei || BigInt(amountWei) <= 0n) throw new Error('Withdraw amount must be greater than zero');
    const tx = await this._write(() => this.contract.withdrawNativeFromEscrow(amountWei));
    return this._waitForTx(tx);
  }

  /** Transfer ETH from your escrow to another agent. Amount in wei. */
  async transferNative(toAddress, amountWei, memo = '') {
    this._validateAddress(toAddress, 'recipient');
    if (!amountWei || BigInt(amountWei) <= 0n) throw new Error('Transfer amount must be greater than zero');
    const tx = await this._write(() => this.contract.transferNativeBetweenAgents(toAddress, amountWei, memo));
    return this._waitForTx(tx);
  }

  /** Get this agent's native escrow balance (wei). */
  async getNativeBalance() {
    const { nativeEscrowBalance } = await this.getProfile();
    return nativeEscrowBalance;
  }

  // ─── ERC-20 Token Escrow ───────────────────────────────────────────────

  /** Deposit ERC-20 tokens (must approve contract first). */
  async depositToken(tokenAddress, amountWei) {
    this._validateAddress(tokenAddress, 'token');
    const tx = await this._write(() => this.contract.depositTokenToEscrow(tokenAddress, amountWei));
    return this._waitForTx(tx);
  }

  /** Withdraw ERC-20 tokens from escrow. */
  async withdrawToken(tokenAddress, amountWei) {
    this._validateAddress(tokenAddress, 'token');
    if (!amountWei || BigInt(amountWei) <= 0n) throw new Error('Withdraw amount must be greater than zero');
    const tx = await this._write(() => this.contract.withdrawTokenFromEscrow(tokenAddress, amountWei));
    return this._waitForTx(tx);
  }

  /** Transfer ERC-20 tokens to another agent's escrow. */
  async transferToken(tokenAddress, toAddress, amountWei, memo = '') {
    this._validateAddress(tokenAddress, 'token');
    this._validateAddress(toAddress, 'recipient');
    if (!amountWei || BigInt(amountWei) <= 0n) throw new Error('Transfer amount must be greater than zero');
    const tx = await this._write(() => this.contract.transferTokenBetweenAgents(tokenAddress, toAddress, amountWei, memo));
    return this._waitForTx(tx);
  }

  /** Get this agent's token escrow balance. */
  async getTokenBalance(tokenAddress) {
    this._validateAddress(tokenAddress, 'token');
    return this.contract.getAgentTokenBalance(this.address, tokenAddress);
  }

  // ─── Payment Requests ──────────────────────────────────────────────────

  /**
   * Create a payment request (invoice) to another agent.
   * @returns {bigint} requestId
   */
  async createPaymentRequest(payerAddress, amount, { isNative = true, tokenAddress = ethers.ZeroAddress, description = '' } = {}) {
    this._validateAddress(payerAddress, 'payer');
    const tx = await this._write(() => this.contract.createAgentPaymentRequest(payerAddress, tokenAddress, amount, isNative, description));
    const receipt = await this._waitForTx(tx);
    return this._extractEventArg(receipt, 'AgentPaymentRequestCreated', 'requestId') ?? receipt;
  }

  /** Settle (pay) a payment request. For native requests, sends ETH. */
  async settlePaymentRequest(requestId) {
    const req = await this.getPaymentRequest(requestId);
    if (!req) throw new Error(`Payment request ${requestId} not found`);
    const opts = req.isNative ? { value: req.amount } : {};
    const tx = await this._write(() => this.contract.settleAgentPaymentRequest(requestId, opts));
    return this._waitForTx(tx);
  }

  /** Cancel a payment request you created. */
  async cancelPaymentRequest(requestId) {
    const tx = await this._write(() => this.contract.cancelAgentPaymentRequest(requestId));
    return this._waitForTx(tx);
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
    this._validateMetadataURI(metadataURI);
    const value = ethers.parseEther(stakeEth);
    if (value <= 0n) throw new Error('Stake amount must be greater than zero');
    const tx = await this._write(() => this.contract.stakeAndJoin(metadataURI, { value }));
    return this._waitForTx(tx);
  }

  /** Leave the DAO and reclaim your stake. */
  async leaveDAO() {
    const tx = await this._write(() => this.contract.leaveDAO());
    return this._waitForTx(tx);
  }

  /** Get minimum stake required to join. */
  async getMinStake() {
    return this.contract.minStakeToJoin();
  }

  // ─── Economic Projects ─────────────────────────────────────────────────

  /** Create an economic project. Returns projectId. */
  async createProject(metadataURI, targetBudgetWei, deadlineUnix) {
    const tx = await this._write(() => this.contract.createEconomicProject(metadataURI, targetBudgetWei, deadlineUnix));
    const receipt = await this._waitForTx(tx);
    return this._extractEventArg(receipt, 'EconomicProjectCreated', 'projectId') ?? receipt;
  }

  /** Fund a project with ETH. */
  async fundProject(projectId, amountEth) {
    const value = ethers.parseEther(amountEth);
    if (value <= 0n) throw new Error('Amount must be greater than zero');
    const tx = await this._write(() => this.contract.fundProject(projectId, { value }));
    return this._waitForTx(tx);
  }

  /** Apply to contribute to a project. */
  async applyToProject(projectId) {
    const tx = await this._write(() => this.contract.applyToProject(projectId));
    return this._waitForTx(tx);
  }

  /** Approve a contributor for a project with a revenue share (in bps, 0-10000). */
  async approveContributor(projectId, contributorAddress, sharesBps) {
    this._validateAddress(contributorAddress, 'contributor');
    const sharesBpsNum = Number(sharesBps);
    if (!Number.isFinite(sharesBpsNum) || !Number.isInteger(sharesBpsNum)) {
      throw new Error('sharesBps must be a finite integer');
    }
    if (sharesBpsNum < 0 || sharesBpsNum > 10000) {
      throw new Error('sharesBps must be between 0 and 10000');
    }
    const tx = await this._write(() => this.contract.approveContributor(projectId, contributorAddress, sharesBpsNum));
    return this._waitForTx(tx);
  }

  /** Mark a project as completed (proposer only). */
  async completeProject(projectId) {
    const tx = await this._write(() => this.contract.completeProject(projectId));
    return this._waitForTx(tx);
  }

  /** Cancel a project (proposer only). */
  async cancelProject(projectId) {
    const tx = await this._write(() => this.contract.cancelProject(projectId));
    return this._waitForTx(tx);
  }

  /** Claim your revenue share from a completed project. */
  async claimProjectShare(projectId) {
    const tx = await this._write(() => this.contract.claimProjectShare(projectId));
    return this._waitForTx(tx);
  }

  /** Refund a funder from a cancelled project. */
  async refundProjectFunder(projectId) {
    const tx = await this._write(() => this.contract.refundProjectFunder(projectId));
    return this._waitForTx(tx);
  }

  /** Get details of an economic project. */
  async getProject(projectId) {
    const p = await this.contract.getEconomicProject(projectId);
    return {
      id: p.id, proposer: p.proposer, metadataURI: p.metadataURI,
      targetBudget: p.targetBudget, totalFunded: p.totalFunded,
      deadline: p.deadline, status: Number(p.status),
      createdAt: p.createdAt, contributorCount: Number(p.contributorCount),
      funderCount: Number(p.funderCount),
    };
  }

  // ─── Secure Direct Messaging ───────────────────────────────────────────

  /**
   * Send an encrypted direct message to another registered agent.
   * @param {string} toAddress       Recipient agent address.
   * @param {string} encryptedContent  Encrypted payload (ECIES / x25519 / IPFS CID to encrypted blob).
   * @param {string} contentHash     keccak256 hash of the plaintext (hex, 32 bytes). Use ethers.keccak256(ethers.toUtf8Bytes(plaintext)).
   */
  async sendMessage(toAddress, encryptedContent, contentHash) {
    this._validateAddress(toAddress, 'recipient');
    if (!encryptedContent || typeof encryptedContent !== 'string' || encryptedContent.length === 0) {
      throw new Error('encryptedContent must be a non-empty string');
    }
    if (!contentHash || !/^0x[0-9a-fA-F]{64}$/.test(contentHash)) {
      throw new Error('contentHash must be a 32-byte hex string (0x + 64 hex chars)');
    }
    const tx = await this._write(() => this.contract.sendDirectMessage(toAddress, encryptedContent, contentHash));
    const receipt = await this._waitForTx(tx);
    return this._extractEventArg(receipt, 'DirectMessageSent', 'messageId') ?? receipt;
  }

  /** Mark a received message as read. */
  async markMessageRead(messageId) {
    const tx = await this._write(() => this.contract.markMessageRead(messageId));
    return this._waitForTx(tx);
  }

  /**
   * Read a direct message by ID. Only sender or recipient can read.
   * @returns {{ id, sender, recipient, contentHash, encryptedContent, timestamp, readByRecipient }}
   */
  async getMessage(messageId) {
    const m = await this.contract.getDirectMessage(messageId);
    return {
      id: m.id, sender: m.sender, recipient: m.recipient,
      contentHash: m.contentHash, encryptedContent: m.encryptedContent,
      timestamp: m.timestamp, readByRecipient: m.readByRecipient,
    };
  }

  /**
   * Get the conversation thread with another agent (paginated).
   * @returns {{ messageIds: bigint[], total: bigint }}
   */
  async getConversation(otherAgent, offset = 0, limit = 50) {
    if (offset < 0) throw new Error('offset must be non-negative');
    if (limit <= 0 || limit > 1000) throw new Error('limit must be between 1 and 1000');
    this._validateAddress(otherAgent, 'otherAgent');
    const [messageIds, total] = await this.contract.getConversation(otherAgent, offset, limit);
    return { messageIds, total };
  }

  /**
   * Get this agent's inbox — IDs of received messages (paginated).
   * @returns {{ messageIds: bigint[], total: bigint }}
   */
  async getInbox(offset = 0, limit = 50) {
    if (offset < 0) throw new Error('offset must be non-negative');
    if (limit <= 0 || limit > 1000) throw new Error('limit must be between 1 and 1000');
    const [messageIds, total] = await this.contract.getInbox(offset, limit);
    return { messageIds, total };
  }

  // ─── Commerce Blackhole ─────────────────────────────────────────────────

  /**
   * Get commerce blackhole configuration (fees only, no volume data).
   * Lighter alternative to getBlackholeMetrics for agents that only need fee info.
   * @returns {Promise<Object>} { feeBps, exitFeeBps, messagingFeeWei, assetTransferFlatFeeWei }
   */
  async getBlackholeConfig() {
    const [feeBps, exitFee, msgFee, assetFee] = await Promise.all([
      this.contract.cybereumFeeBps(),
      this.contract.exitFeeBps(),
      this.contract.messagingFeeWei(),
      this.contract.assetTransferFlatFeeWei(),
    ]);
    return {
      feeBps: Number(feeBps),
      exitFeeBps: Number(exitFee),
      messagingFeeWei: msgFee,
      assetTransferFlatFeeWei: assetFee,
    };
  }

  /**
   * Get protocol-wide commerce blackhole metrics.
   * @returns {Promise<Object>} { totalCommerceVolume, totalFeesCollected, agentCount, feeBps, exitFeeBps, messagingFeeWei, aiServiceFeeWei, assetTransferFlatFeeWei }
   */
  async getBlackholeMetrics() {
    const m = await this.contract.getBlackholeMetrics();
    return {
      totalCommerceVolume: m._totalCommerceVolume,
      totalFeesCollected: m._totalFeesCollected,
      agentCount: Number(m._agentCount),
      feeBps: Number(m._feeBps),
      exitFeeBps: Number(m._exitFeeBps),
      messagingFeeWei: m._messagingFeeWei,
      aiServiceFeeWei: m._aiServiceFeeWei,
      assetTransferFlatFeeWei: m._assetTransferFlatFeeWei,
    };
  }

  /**
   * Get commerce metrics for a specific agent.
   * @returns {Promise<Object>} { volume, feesPaid, escrowBalance, registered }
   */
  async getAgentCommerceMetrics(address = this.address) {
    if (address !== this.address) this._validateAddress(address, 'agent');
    const m = await this.contract.getAgentCommerceMetrics(address);
    return {
      volume: m.volume,
      feesPaid: m.feesPaid,
      escrowBalance: m.escrowBalance,
      registered: m.registered,
    };
  }

  /**
   * Preview exit fee for a given amount (in wei).
   * @returns {Promise<{fee: bigint, net: bigint}>}
   */
  async previewExitFee(amountWei) {
    const [fee, net] = await this.contract.previewExitFee(amountWei);
    return { fee, net };
  }

  /**
   * Batch transfer native ETH to multiple agents from escrow.
   * Each transfer collects a protocol fee.
   * @param {Array<{address: string, amount: bigint, memo: string}>} transfers
   */
  async batchTransferNative(transfers) {
    if (!Array.isArray(transfers) || transfers.length === 0) throw new Error('transfers must be a non-empty array');
    const recipients = transfers.map(t => this._validateAddress(t.address, 'recipient'));
    const amounts = transfers.map(t => t.amount);
    const memos = transfers.map(t => t.memo || '');
    const tx = await this._write(() => this.contract.batchTransferNative(recipients, amounts, memos));
    return this._waitForTx(tx);
  }

  /**
   * Batch settle multiple native payment requests in one tx.
   * @param {bigint[]} requestIds  Array of payment request IDs.
   * @param {bigint}   totalValue  Total ETH to send (sum of all request amounts).
   */
  async batchSettlePaymentRequests(requestIds, totalValue) {
    if (!Array.isArray(requestIds) || requestIds.length === 0) throw new Error('requestIds must be a non-empty array');
    const tx = await this._write(() => this.contract.batchSettlePaymentRequests(requestIds, { value: totalValue }));
    return this._waitForTx(tx);
  }

  // ─── Reputation Engine ──────────────────────────────────────────────────

  /**
   * Get full reputation profile for an agent.
   * @returns {Promise<{score, tier, transactionCount, lastActiveAt, registeredAt, messagingFeeDiscount}>}
   */
  async getAgentReputation(address = this.address) {
    if (address !== this.address) this._validateAddress(address, 'agent');
    const r = await this.contract.getAgentReputation(address);
    return {
      score: Number(r.score),
      tier: Number(r.tier),
      transactionCount: Number(r.transactionCount),
      lastActiveAt: Number(r.lastActiveAt),
      registeredAt: Number(r.registeredAt),
      messagingFeeDiscount: Number(r.messagingFeeDiscount),
    };
  }

  /**
   * Get paginated reputation leaderboard.
   * @returns {Promise<{agents: Array<{address, score, tier}>, total}>}
   */
  async getReputationLeaderboard(offset = 0, limit = 50) {
    const [agents_, scores, tiers, registered, total] = await this.contract.getReputationLeaderboard(offset, limit);
    return {
      agents: agents_.map((addr, i) => ({
        address: addr,
        score: Number(scores[i]),
        tier: Number(tiers[i]),
        registered: registered[i],
      })),
      total: Number(total),
    };
  }

  /**
   * Manually trigger reputation refresh for an agent (applies decay).
   */
  async refreshReputation(address) {
    this._validateAddress(address, 'agent');
    const tx = await this._write(() => this.contract.refreshReputation(address));
    return this._waitForTx(tx);
  }

  /** Listen for reputation updates. */
  onReputationUpdated(callback) {
    this.contract.on('ReputationUpdated', (agent, oldScore, newScore, tier) => {
      callback({ agent, oldScore: Number(oldScore), score: Number(newScore), tier: Number(tier) });
    });
  }

  // ─── Event Listening ───────────────────────────────────────────────────

  /** Listen for incoming payment requests where this agent is the payer. */
  onPaymentRequest(callback) {
    const filter = this.contract.filters.AgentPaymentRequestCreated(null, null, this.address);
    this.contract.on(filter, (requestId, requester, payer, isNative, token, amount, description) => {
      callback({ requestId, requester, payer, isNative, token, amount, description });
    });
  }

  /** Listen for payment requests created by this agent (as requester). */
  onPaymentRequestCreated(callback) {
    const filter = this.contract.filters.AgentPaymentRequestCreated(null, this.address);
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

  /** Listen for incoming direct messages to this agent. */
  onDirectMessage(callback) {
    const filter = this.contract.filters.DirectMessageSent(null, null, this.address);
    this.contract.on(filter, (messageId, sender, recipient, contentHash, timestamp) => {
      callback({ messageId, sender, recipient, contentHash, timestamp });
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
