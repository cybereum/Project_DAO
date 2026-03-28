/**
 * SDK unit tests — validates constructor, input validation, retry logic,
 * and method contracts without requiring a live blockchain.
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AgentClient, PROJECT_DAO_ABI } from '../index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Hardhat's deterministic Account #0 key. Publicly known — DO NOT use in production.
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/** Minimal mock provider/contract for unit testing (no live chain). */
function makeMockClient(overrides = {}) {
  const client = new AgentClient({
    rpcUrl: 'http://localhost:8545',
    contractAddress: '0x' + 'ab'.repeat(20),
    privateKey: TEST_PRIVATE_KEY,
    chainId: 31337,
  });
  // Bypass chain verification for unit tests
  client._chainVerified = true;
  Object.assign(client, overrides);
  return client;
}

// ─── Constructor Tests ───────────────────────────────────────────────────────

describe('AgentClient constructor', () => {
  it('throws if rpcUrl is missing', () => {
    assert.throws(
      () => new AgentClient({ contractAddress: '0x' + 'ab'.repeat(20), privateKey: TEST_PRIVATE_KEY }),
      /rpcUrl is required/
    );
  });

  it('throws if contractAddress is missing', () => {
    assert.throws(
      () => new AgentClient({ rpcUrl: 'http://localhost:8545', privateKey: TEST_PRIVATE_KEY }),
      /contractAddress is required/
    );
  });

  it('throws if privateKey is missing', () => {
    assert.throws(
      () => new AgentClient({ rpcUrl: 'http://localhost:8545', contractAddress: '0x' + 'ab'.repeat(20) }),
      /privateKey is required/
    );
  });

  it('sets expected properties', () => {
    const client = makeMockClient();
    assert.ok(client.address, 'should have an address');
    assert.ok(client.contract, 'should have a contract');
    assert.ok(client.provider, 'should have a provider');
    assert.equal(client._expectedChainId, 31337);
  });
});

// ─── Address Validation ──────────────────────────────────────────────────────

describe('_validateAddress', () => {
  const client = makeMockClient();

  it('accepts valid checksummed address', () => {
    const addr = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Hardhat account #0
    const result = client._validateAddress(addr, 'test');
    assert.ok(result, 'should return checksummed address');
  });

  it('throws on invalid address', () => {
    assert.throws(() => client._validateAddress('0xinvalid', 'test'), /Invalid test address/);
  });

  it('throws on empty string', () => {
    assert.throws(() => client._validateAddress('', 'test'), /Invalid test address/);
  });
});

// ─── Input Validation on Methods ─────────────────────────────────────────────

describe('discoverAgents input validation', () => {
  const client = makeMockClient();

  it('rejects negative offset', () => {
    assert.rejects(() => client.discoverAgents(-1, 10), /offset must be non-negative/);
  });

  it('rejects zero limit', () => {
    assert.rejects(() => client.discoverAgents(0, 0), /limit must be between 1 and 1000/);
  });

  it('rejects limit > 1000', () => {
    assert.rejects(() => client.discoverAgents(0, 1001), /limit must be between 1 and 1000/);
  });
});

describe('depositNative input validation', () => {
  const client = makeMockClient();

  it('rejects zero amount', () => {
    assert.rejects(() => client.depositNative('0'), /Deposit amount must be greater than zero/);
  });
});

describe('transferNative input validation', () => {
  const client = makeMockClient();

  it('rejects invalid recipient address', () => {
    assert.rejects(
      () => client.transferNative('0xbad', 1000n, 'test'),
      /Invalid recipient address/
    );
  });
});

describe('createPaymentRequest input validation', () => {
  const client = makeMockClient();

  it('rejects invalid payer address', () => {
    assert.rejects(
      () => client.createPaymentRequest('0xbad', 1000n),
      /Invalid payer address/
    );
  });
});

describe('getConversation input validation', () => {
  const client = makeMockClient();

  it('rejects negative offset', () => {
    assert.rejects(
      () => client.getConversation('0x' + 'ab'.repeat(20), -1, 10),
      /offset must be non-negative/
    );
  });

  it('rejects invalid limit', () => {
    assert.rejects(
      () => client.getConversation('0x' + 'ab'.repeat(20), 0, 0),
      /limit must be between 1 and 1000/
    );
  });
});

describe('approveContributor input validation', () => {
  const client = makeMockClient();

  it('rejects invalid contributor address', () => {
    assert.rejects(
      () => client.approveContributor(1, '0xbad', 5000),
      /Invalid contributor address/
    );
  });

  it('rejects sharesBps > 10000', () => {
    assert.rejects(
      () => client.approveContributor(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 10001),
      /sharesBps must be between 0 and 10000/
    );
  });

  it('rejects negative sharesBps', () => {
    assert.rejects(
      () => client.approveContributor(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', -1),
      /sharesBps must be between 0 and 10000/
    );
  });
});

describe('batchTransferNative input validation', () => {
  const client = makeMockClient();

  it('rejects empty array', () => {
    assert.rejects(() => client.batchTransferNative([]), /transfers must be a non-empty array/);
  });

  it('rejects non-array', () => {
    assert.rejects(() => client.batchTransferNative(null), /transfers must be a non-empty array/);
  });
});

describe('batchSettlePaymentRequests input validation', () => {
  const client = makeMockClient();

  it('rejects empty array', () => {
    assert.rejects(() => client.batchSettlePaymentRequests([]), /requestIds must be a non-empty array/);
  });
});

// ─── Retry Logic ─────────────────────────────────────────────────────────────

describe('_write retry logic', () => {
  it('retries on transient network errors', async () => {
    const client = makeMockClient();
    let attempts = 0;
    const fn = () => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('ETIMEDOUT'));
      return Promise.resolve('success');
    };
    const result = await client._write(fn, { retries: 2, timeoutMs: 5000 });
    assert.equal(result, 'success');
    assert.equal(attempts, 3);
  });

  it('does not retry on non-transient errors', async () => {
    const client = makeMockClient();
    let attempts = 0;
    const fn = () => {
      attempts++;
      return Promise.reject(new Error('insufficient funds'));
    };
    await assert.rejects(() => client._write(fn, { retries: 2, timeoutMs: 5000 }), /insufficient funds/);
    assert.equal(attempts, 1, 'should not retry on business logic errors');
  });

  it('gives up after max retries', async () => {
    const client = makeMockClient();
    let attempts = 0;
    const fn = () => {
      attempts++;
      return Promise.reject(new Error('ECONNREFUSED'));
    };
    await assert.rejects(() => client._write(fn, { retries: 1, timeoutMs: 5000 }), /ECONNREFUSED/);
    assert.equal(attempts, 2, 'should have tried twice (initial + 1 retry)');
  });
});

describe('_withTimeout', () => {
  it('resolves fast promises normally', async () => {
    const client = makeMockClient();
    const result = await client._withTimeout(Promise.resolve(42), 1000);
    assert.equal(result, 42);
  });

  it('rejects on timeout', async () => {
    const client = makeMockClient();
    const slow = new Promise(r => setTimeout(r, 5000));
    await assert.rejects(
      () => client._withTimeout(slow, 50),
      /Transaction timed out/
    );
  });
});

// ─── ABI Export ──────────────────────────────────────────────────────────────

describe('ABI export', () => {
  it('exports a non-empty ABI array', () => {
    assert.ok(Array.isArray(PROJECT_DAO_ABI));
    assert.ok(PROJECT_DAO_ABI.length > 50, `ABI has ${PROJECT_DAO_ABI.length} entries`);
  });

  it('includes core agent functions', () => {
    const abiStr = PROJECT_DAO_ABI.join('\n');
    assert.ok(abiStr.includes('registerAgent'), 'missing registerAgent');
    assert.ok(abiStr.includes('depositNativeToEscrow'), 'missing depositNativeToEscrow');
    assert.ok(abiStr.includes('transferNativeBetweenAgents'), 'missing transferNativeBetweenAgents');
    assert.ok(abiStr.includes('createAgentPaymentRequest'), 'missing createAgentPaymentRequest');
    assert.ok(abiStr.includes('sendDirectMessage'), 'missing sendDirectMessage');
    assert.ok(abiStr.includes('stakeAndJoin'), 'missing stakeAndJoin');
  });

  it('includes economic project functions', () => {
    const abiStr = PROJECT_DAO_ABI.join('\n');
    assert.ok(abiStr.includes('createEconomicProject'), 'missing createEconomicProject');
    assert.ok(abiStr.includes('approveContributor'), 'missing approveContributor');
    assert.ok(abiStr.includes('completeProject'), 'missing completeProject');
    assert.ok(abiStr.includes('cancelProject'), 'missing cancelProject');
    assert.ok(abiStr.includes('refundProjectFunder'), 'missing refundProjectFunder');
  });

  it('includes reputation engine functions', () => {
    const abiStr = PROJECT_DAO_ABI.join('\n');
    assert.ok(abiStr.includes('getAgentReputation'), 'missing getAgentReputation');
    assert.ok(abiStr.includes('getReputationLeaderboard'), 'missing getReputationLeaderboard');
    assert.ok(abiStr.includes('refreshReputation'), 'missing refreshReputation');
  });

  it('includes commerce blackhole functions', () => {
    const abiStr = PROJECT_DAO_ABI.join('\n');
    assert.ok(abiStr.includes('getBlackholeMetrics'), 'missing getBlackholeMetrics');
    assert.ok(abiStr.includes('batchTransferNative'), 'missing batchTransferNative');
    assert.ok(abiStr.includes('batchSettlePaymentRequests'), 'missing batchSettlePaymentRequests');
  });
});

// ─── Static discover() ──────────────────────────────────────────────────────

describe('AgentClient.discover()', () => {
  it('throws if privateKey missing', () => {
    assert.rejects(
      () => AgentClient.discover({ chainId: 8453 }),
      /privateKey is required/
    );
  });

  it('throws if chainId missing', () => {
    assert.rejects(
      () => AgentClient.discover({ privateKey: TEST_PRIVATE_KEY }),
      /chainId is required/
    );
  });

  it('throws if chain not in registry', () => {
    assert.rejects(
      () => AgentClient.discover({ privateKey: TEST_PRIVATE_KEY, chainId: 99999 }),
      /Chain 99999 not in deployment registry/
    );
  });
});

// ─── Withdraw/Transfer Amount Validation ────────────────────────────────────

describe('withdrawNative input validation', () => {
  const client = makeMockClient();

  it('rejects zero amount', () => {
    assert.rejects(() => client.withdrawNative(0n), /Withdraw amount must be greater than zero/);
  });

  it('rejects negative amount', () => {
    assert.rejects(() => client.withdrawNative(-1n), /Withdraw amount must be greater than zero/);
  });
});

describe('transferNative amount validation', () => {
  const client = makeMockClient();

  it('rejects zero amount', () => {
    assert.rejects(
      () => client.transferNative('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 0n, 'test'),
      /Transfer amount must be greater than zero/
    );
  });
});

describe('withdrawToken input validation', () => {
  const client = makeMockClient();

  it('rejects zero amount', () => {
    assert.rejects(
      () => client.withdrawToken('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 0n),
      /Withdraw amount must be greater than zero/
    );
  });
});

describe('transferToken amount validation', () => {
  const client = makeMockClient();

  it('rejects zero amount', () => {
    assert.rejects(
      () => client.transferToken(
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        0n,
        'test'
      ),
      /Transfer amount must be greater than zero/
    );
  });
});

// ─── sendMessage Validation ─────────────────────────────────────────────────

describe('sendMessage input validation', () => {
  const client = makeMockClient();

  it('rejects empty encryptedContent', () => {
    assert.rejects(
      () => client.sendMessage('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '', '0x' + 'ab'.repeat(32)),
      /encryptedContent must be a non-empty string/
    );
  });

  it('rejects invalid contentHash format', () => {
    assert.rejects(
      () => client.sendMessage('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'hello', '0xinvalid'),
      /contentHash must be a 32-byte hex string/
    );
  });

  it('rejects contentHash without 0x prefix', () => {
    assert.rejects(
      () => client.sendMessage('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'hello', 'ab'.repeat(32)),
      /contentHash must be a 32-byte hex string/
    );
  });

  it('rejects short contentHash', () => {
    assert.rejects(
      () => client.sendMessage('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'hello', '0x' + 'ab'.repeat(16)),
      /contentHash must be a 32-byte hex string/
    );
  });
});

// ─── Method existence checks ─────────────────────────────────────────────────

describe('method completeness', () => {
  const client = makeMockClient();

  const expectedMethods = [
    // Identity
    'register', 'updateMetadata', 'getProfile', 'isRegistered',
    // Discovery
    'getAgentCount', 'discoverAgents',
    // Fees
    'previewFee', 'getFeeConfig',
    // Native escrow
    'depositNative', 'withdrawNative', 'transferNative', 'getNativeBalance',
    // Token escrow
    'depositToken', 'withdrawToken', 'transferToken', 'getTokenBalance',
    // Payment requests
    'createPaymentRequest', 'settlePaymentRequest', 'cancelPaymentRequest', 'getPaymentRequest',
    // Onboarding
    'stakeAndJoin', 'leaveDAO', 'getMinStake',
    // Projects
    'createProject', 'fundProject', 'applyToProject', 'approveContributor',
    'completeProject', 'cancelProject', 'claimProjectShare', 'refundProjectFunder', 'getProject',
    // Messaging
    'sendMessage', 'markMessageRead', 'getMessage', 'getConversation', 'getInbox',
    // Commerce
    'getBlackholeMetrics', 'getAgentCommerceMetrics', 'previewExitFee',
    'batchTransferNative', 'batchSettlePaymentRequests',
    // Reputation
    'getAgentReputation', 'getReputationLeaderboard', 'refreshReputation',
    // Events
    'onPaymentRequest', 'onPaymentRequestCreated', 'onTransferReceived', 'onDirectMessage', 'onBroadcast',
    'onReputationUpdated', 'removeAllListeners',
    // Lifecycle
    'verifyChain', 'preflight', 'safeOnboard',
  ];

  for (const method of expectedMethods) {
    it(`has method: ${method}()`, () => {
      assert.equal(typeof client[method], 'function', `missing method ${method}`);
    });
  }
});
