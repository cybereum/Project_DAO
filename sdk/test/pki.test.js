/**
 * SDK PKI / encryption unit tests.
 *
 * These tests exercise the input-validation helpers and EIP-712 signing
 * path added in the encrypt-smart-contracts branch. They do NOT require a
 * live chain — every assertion is either a pure validation call or an
 * ethers-local signing round-trip.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import crypto from 'node:crypto';
import { AgentClient } from '../index.js';

// Hardhat's deterministic Account #0 key — public knowledge, test-only.
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function makeClient() {
  const c = new AgentClient({
    rpcUrl: 'http://localhost:8545',
    contractAddress: '0x' + 'ab'.repeat(20),
    privateKey: TEST_PRIVATE_KEY,
    chainId: 31337,
  });
  c._chainVerified = true;
  return c;
}

// ─── AgentClient.deriveSecp256k1PublicKey (static) ─────────────────────────

describe('AgentClient.deriveSecp256k1PublicKey', () => {
  it('returns a 33-byte compressed hex public key', () => {
    const pub = AgentClient.deriveSecp256k1PublicKey(TEST_PRIVATE_KEY);
    assert.match(pub, /^0x[0-9a-fA-F]{66}$/);
  });

  it('works without the 0x prefix', () => {
    const pub = AgentClient.deriveSecp256k1PublicKey(TEST_PRIVATE_KEY.slice(2));
    assert.match(pub, /^0x[0-9a-fA-F]{66}$/);
  });

  it('is deterministic for the same private key', () => {
    const a = AgentClient.deriveSecp256k1PublicKey(TEST_PRIVATE_KEY);
    const b = AgentClient.deriveSecp256k1PublicKey(TEST_PRIVATE_KEY);
    assert.equal(a, b);
  });

  it('throws when privateKey is missing', () => {
    assert.throws(() => AgentClient.deriveSecp256k1PublicKey(), /privateKey is required/);
  });
});

// ─── _normalizePublicKey (private validator) ───────────────────────────────

describe('_normalizePublicKey', () => {
  const client = makeClient();

  it('accepts a 33-byte compressed secp256k1 hex key', () => {
    const pub = AgentClient.deriveSecp256k1PublicKey(TEST_PRIVATE_KEY);
    const out = client._normalizePublicKey(pub);
    assert.equal(out, pub);
  });

  it('accepts a hex key WITHOUT 0x prefix', () => {
    const pub = AgentClient.deriveSecp256k1PublicKey(TEST_PRIVATE_KEY);
    const out = client._normalizePublicKey(pub.slice(2));
    assert.equal(out.toLowerCase(), pub.toLowerCase());
  });

  it('accepts a Uint8Array', () => {
    const bytes = new Uint8Array(33).fill(0x11);
    const out = client._normalizePublicKey(bytes);
    assert.match(out, /^0x[0-9a-fA-F]{66}$/);
  });

  it('throws when publicKey is missing', () => {
    assert.throws(() => client._normalizePublicKey(), /publicKey is required/);
    assert.throws(() => client._normalizePublicKey(null), /publicKey is required/);
  });

  it('throws on non-hex string', () => {
    assert.throws(() => client._normalizePublicKey('0xgg'), /must be hex bytes/);
  });

  it('throws on odd-length hex', () => {
    assert.throws(() => client._normalizePublicKey('0x1'), /even length/);
  });

  it('throws when key is shorter than 32 bytes', () => {
    // 31 bytes (62 hex chars)
    assert.throws(
      () => client._normalizePublicKey('0x' + 'aa'.repeat(31)),
      /publicKey too short/
    );
  });

  it('throws when key is longer than 256 bytes', () => {
    // 257 bytes
    assert.throws(
      () => client._normalizePublicKey('0x' + 'aa'.repeat(257)),
      /publicKey too long/
    );
  });

  it('accepts exactly 32 bytes (x25519 boundary)', () => {
    const out = client._normalizePublicKey('0x' + 'aa'.repeat(32));
    assert.equal(out, '0x' + 'aa'.repeat(32));
  });

  it('accepts exactly 256 bytes (upper bound)', () => {
    const out = client._normalizePublicKey('0x' + 'bb'.repeat(256));
    assert.equal(out.length, 2 + 512);
  });

  it('throws on wrong type (number)', () => {
    assert.throws(() => client._normalizePublicKey(42), /must be a hex string or Uint8Array/);
  });
});

// ─── _validateCiphertext ───────────────────────────────────────────────────

describe('_validateCiphertext', () => {
  const client = makeClient();

  it('accepts a non-empty string within the length bound', () => {
    client._validateCiphertext('hello');
    client._validateCiphertext('a'.repeat(8192));
  });

  it('rejects an empty string', () => {
    assert.throws(() => client._validateCiphertext(''), /must be a non-empty string/);
  });

  it('rejects a non-string input', () => {
    assert.throws(() => client._validateCiphertext(null), /must be a non-empty string/);
    assert.throws(() => client._validateCiphertext(42), /must be a non-empty string/);
    assert.throws(() => client._validateCiphertext({}), /must be a non-empty string/);
  });

  it('rejects a string exceeding 8192 UTF-8 bytes', () => {
    assert.throws(
      () => client._validateCiphertext('a'.repeat(8193)),
      /too large .* max 8192/s
    );
  });

  it('uses the supplied label in the error message', () => {
    try {
      client._validateCiphertext('', 'payload-for-bob');
      assert.fail('expected throw');
    } catch (e) {
      assert.match(e.message, /payload-for-bob/);
    }
  });
});

// ─── _validateContentHash ──────────────────────────────────────────────────

describe('_validateContentHash', () => {
  const client = makeClient();

  it('accepts a proper 32-byte hex hash', () => {
    const hash = ethers.keccak256(ethers.toUtf8Bytes('anything'));
    client._validateContentHash(hash);
  });

  it('rejects a hash missing 0x prefix', () => {
    assert.throws(
      () => client._validateContentHash('a'.repeat(64)),
      /32-byte hex string/
    );
  });

  it('rejects a too-short hash', () => {
    assert.throws(
      () => client._validateContentHash('0x' + 'a'.repeat(63)),
      /32-byte hex string/
    );
  });

  it('rejects a too-long hash', () => {
    assert.throws(
      () => client._validateContentHash('0x' + 'a'.repeat(65)),
      /32-byte hex string/
    );
  });

  it('rejects undefined and null', () => {
    assert.throws(() => client._validateContentHash(), /32-byte hex string/);
    assert.throws(() => client._validateContentHash(null), /32-byte hex string/);
  });
});

// ─── _validateSignature ────────────────────────────────────────────────────

describe('_validateSignature', () => {
  const client = makeClient();

  it('accepts a 65-byte hex signature (130 hex chars)', () => {
    client._validateSignature('0x' + 'ab'.repeat(65));
  });

  it('rejects too short', () => {
    assert.throws(
      () => client._validateSignature('0x' + 'ab'.repeat(64)),
      /65-byte hex string/
    );
  });

  it('rejects too long', () => {
    assert.throws(
      () => client._validateSignature('0x' + 'ab'.repeat(66)),
      /65-byte hex string/
    );
  });

  it('rejects wrong type', () => {
    assert.throws(() => client._validateSignature(42), /65-byte hex string/);
    assert.throws(() => client._validateSignature(null), /65-byte hex string/);
  });

  it('uses the supplied label in the error message', () => {
    try {
      client._validateSignature('', 'forged-party-sig');
      assert.fail('expected throw');
    } catch (e) {
      assert.match(e.message, /forged-party-sig/);
    }
  });
});

// ─── EIP-712 signing (signAgreementTerms / signPaymentRequestTerms) ────────

describe('EIP-712 signing helpers', () => {
  it('signAgreementTerms produces a verifiable 65-byte signature', async () => {
    const client = makeClient();
    // Stub the network-dependent domain builder so we don't need RPC.
    client._cachedDomain = {
      name: 'Project_DAO',
      version: '1',
      chainId: 31337,
      verifyingContract: '0x' + 'ab'.repeat(20),
    };
    const hash = ethers.keccak256(ethers.toUtf8Bytes('terms-alpha'));
    const sig = await client.signAgreementTerms(42, hash);
    assert.match(sig, /^0x[0-9a-fA-F]{130}$/);

    // Independently recover the signer and confirm it matches the wallet.
    const recovered = ethers.verifyTypedData(
      client._cachedDomain,
      { AgreementTerms: [
          { name: 'agreementId', type: 'uint256' },
          { name: 'contentHash', type: 'bytes32' },
      ] },
      { agreementId: 42n, contentHash: hash },
      sig
    );
    assert.equal(recovered.toLowerCase(), client.address.toLowerCase());
  });

  it('signPaymentRequestTerms produces a verifiable signature', async () => {
    const client = makeClient();
    client._cachedDomain = {
      name: 'Project_DAO',
      version: '1',
      chainId: 31337,
      verifyingContract: '0x' + 'ab'.repeat(20),
    };
    const hash = ethers.keccak256(ethers.toUtf8Bytes('invoice-9'));
    const sig = await client.signPaymentRequestTerms(9, hash);
    assert.match(sig, /^0x[0-9a-fA-F]{130}$/);
    const recovered = ethers.verifyTypedData(
      client._cachedDomain,
      { PaymentRequestTerms: [
          { name: 'requestId', type: 'uint256' },
          { name: 'contentHash', type: 'bytes32' },
      ] },
      { requestId: 9n, contentHash: hash },
      sig
    );
    assert.equal(recovered.toLowerCase(), client.address.toLowerCase());
  });

  it('signAgreementTerms rejects a malformed contentHash', async () => {
    const client = makeClient();
    client._cachedDomain = {
      name: 'Project_DAO',
      version: '1',
      chainId: 31337,
      verifyingContract: '0x' + 'ab'.repeat(20),
    };
    await assert.rejects(
      client.signAgreementTerms(1, '0xnope'),
      /32-byte hex string/
    );
  });
});

// ─── Static method completeness guardrail ─────────────────────────────────

describe('PKI method surface', () => {
  it('AgentClient prototype exposes every PKI method the contract expects', () => {
    const expected = [
      'publishPublicKey',
      'revokePublicKey',
      'getPublicKey',
      'hasPublicKey',
      'attachEncryptedAgreementPayload',
      'attachEncryptedAgreementPayloadSigned',
      'getEncryptedAgreementPayload',
      'attachEncryptedPaymentRequestPayload',
      'attachEncryptedPaymentRequestPayloadSigned',
      'getEncryptedPaymentRequestPayload',
      'agreementTermsDigest',
      'paymentRequestTermsDigest',
      'signAgreementTerms',
      'signPaymentRequestTerms',
    ];
    for (const m of expected) {
      assert.equal(
        typeof AgentClient.prototype[m],
        'function',
        `AgentClient.${m} must be a function`
      );
    }
    assert.equal(
      typeof AgentClient.deriveSecp256k1PublicKey,
      'function',
      'AgentClient.deriveSecp256k1PublicKey must be a static function'
    );
  });
});

// ─── End-to-end ECIES with the SDK-derived key ─────────────────────────────

describe('SDK-derived key works with standard ECIES', () => {
  // Node-crypto reference ECIES (same construction the contract test
  // uses) — verifies the SDK helper is interoperable with external
  // ECIES libraries without needing any new dependencies.
  function eciesEncrypt(recipientPubKeyHex, plaintext) {
    const pub = Buffer.from(recipientPubKeyHex.replace(/^0x/, ''), 'hex');
    const eph = crypto.createECDH('secp256k1');
    eph.generateKeys();
    const ephPub = eph.getPublicKey(null, 'compressed');
    const shared = eph.computeSecret(pub);
    const aesKey = crypto.createHash('sha512').update(shared).digest().subarray(0, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return '0x' + Buffer.concat([ephPub, iv, ct, tag]).toString('hex');
  }
  function eciesDecrypt(privHex, ctHex) {
    const buf = Buffer.from(ctHex.replace(/^0x/, ''), 'hex');
    const ephPub = buf.subarray(0, 33);
    const iv = buf.subarray(33, 45);
    const tag = buf.subarray(buf.length - 16);
    const ct = buf.subarray(45, buf.length - 16);
    const me = crypto.createECDH('secp256k1');
    me.setPrivateKey(Buffer.from(privHex.replace(/^0x/, ''), 'hex'));
    const shared = me.computeSecret(ephPub);
    const aesKey = crypto.createHash('sha512').update(shared).digest().subarray(0, 32);
    const dec = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    dec.setAuthTag(tag);
    return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
  }

  it('encrypts to the SDK-derived key and decrypts with the wallet key', () => {
    const wallet = ethers.Wallet.createRandom();
    const pub = AgentClient.deriveSecp256k1PublicKey(wallet.privateKey);
    const plaintext = 'hello from the SDK round-trip test';
    const ct = eciesEncrypt(pub, plaintext);
    const back = eciesDecrypt(wallet.privateKey, ct);
    assert.equal(back, plaintext);
  });
});
