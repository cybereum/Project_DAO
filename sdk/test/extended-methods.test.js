/**
 * Extended SDK input-validation tests for methods with zero coverage.
 * Uses Node's built-in test runner — run with: node --test sdk/test/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentClient } from '../index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const VALID_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

function makeMockClient() {
  const client = new AgentClient({
    rpcUrl: 'http://localhost:8545',
    contractAddress: '0x' + 'ab'.repeat(20),
    privateKey: TEST_PRIVATE_KEY,
    chainId: 31337,
  });
  client._chainVerified = true;
  return client;
}

// ─── createServiceAgreement ─────────────────────────────────────────────────

describe('createServiceAgreement input validation', () => {
  const client = makeMockClient();

  it('rejects invalid provider address', () => {
    assert.rejects(
      () => client.createServiceAgreement({ provider: '0xbad', amount: 1000n, deadline: 9999999999, description: 'svc' }),
      /Invalid provider address/
    );
  });

  it('rejects empty description', () => {
    assert.rejects(
      () => client.createServiceAgreement({ provider: VALID_ADDR, amount: 1000n, deadline: 9999999999, description: '' }),
      /description is required/
    );
  });

  it('rejects missing description', () => {
    assert.rejects(
      () => client.createServiceAgreement({ provider: VALID_ADDR, amount: 1000n, deadline: 9999999999 }),
      /description is required/
    );
  });

  it('rejects invalid arbiter address when provided', () => {
    assert.rejects(
      () => client.createServiceAgreement({ provider: VALID_ADDR, arbiter: 'not-an-addr', amount: 1000n, deadline: 9999999999, description: 'svc' }),
      /Invalid arbiter address/
    );
  });
});

// ─── createPaymentStream ────────────────────────────────────────────────────

describe('createPaymentStream input validation', () => {
  const client = makeMockClient();

  it('rejects invalid recipient address', () => {
    assert.rejects(
      () => client.createPaymentStream({ recipient: '0xbad', totalDepositEth: '1.0', startTime: 1000, stopTime: 2000 }),
      /Invalid recipient address/
    );
  });

  it('rejects missing deposit amount', () => {
    assert.rejects(
      () => client.createPaymentStream({ recipient: VALID_ADDR, startTime: 1000, stopTime: 2000 }),
      /One of totalDepositEth, totalDepositWei, or totalDeposit is required/
    );
  });

  it('rejects conflicting deposit parameters', () => {
    assert.rejects(
      () => client.createPaymentStream({ recipient: VALID_ADDR, totalDepositEth: '1.0', totalDepositWei: 1000n, startTime: 1000, stopTime: 2000 }),
      /Specify exactly one of/
    );
  });
});

// ─── stakeAndJoinWithReferral ───────────────────────────────────────────────

describe('stakeAndJoinWithReferral input validation', () => {
  const client = makeMockClient();

  it('rejects empty metadataURI', () => {
    assert.rejects(
      () => client.stakeAndJoinWithReferral('', VALID_ADDR, '0.1'),
      /metadataURI must be a non-empty string/
    );
  });

  it('rejects null metadataURI', () => {
    assert.rejects(
      () => client.stakeAndJoinWithReferral(null, VALID_ADDR, '0.1'),
      /metadataURI must be a non-empty string/
    );
  });

  it('rejects whitespace-only metadataURI', () => {
    assert.rejects(
      () => client.stakeAndJoinWithReferral('   ', VALID_ADDR, '0.1'),
      /metadataURI must be a non-empty string/
    );
  });
});

// ─── endorseAgent ───────────────────────────────────────────────────────────

describe('endorseAgent input validation', () => {
  const client = makeMockClient();

  // endorseAgent has no client-side validation — it delegates directly to
  // the contract call. Verify the method exists and is callable (it will
  // fail at the RPC layer, not with a validation error).
  it('is a callable method', () => {
    assert.equal(typeof client.endorseAgent, 'function');
  });
});

// ─── sendMessage (address validation) ───────────────────────────────────────

describe('sendMessage recipient validation', () => {
  const client = makeMockClient();
  const validHash = '0x' + 'ab'.repeat(32);

  it('rejects invalid recipient address', () => {
    assert.rejects(
      () => client.sendMessage('0xbad', 'encrypted-payload', validHash),
      /Invalid recipient address/
    );
  });

  it('rejects null content', () => {
    assert.rejects(
      () => client.sendMessage(VALID_ADDR, null, validHash),
      /encryptedContent must be a non-empty string/
    );
  });

  it('rejects non-string content', () => {
    assert.rejects(
      () => client.sendMessage(VALID_ADDR, 12345, validHash),
      /encryptedContent must be a non-empty string/
    );
  });
});
