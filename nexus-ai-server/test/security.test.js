import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseWalletAddress, secureKeyMatch } from '../lib/security.js';

test('secureKeyMatch returns true for exact matches', () => {
  assert.equal(secureKeyMatch('super-secret', 'super-secret'), true);
});

test('secureKeyMatch returns false for mismatched values', () => {
  assert.equal(secureKeyMatch('super-secret', 'super-secret-2'), false);
});

test('secureKeyMatch returns false when either value is missing', () => {
  assert.equal(secureKeyMatch('', 'super-secret'), false);
  assert.equal(secureKeyMatch('super-secret', ''), false);
});

test('normaliseWalletAddress canonicalizes valid EVM addresses', () => {
  const input = ' 0xAbCdEfABcdefABcDEfAbCdefabCDEfAbCdEFAbCd ';
  assert.equal(
    normaliseWalletAddress(input),
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
  );
});

test('normaliseWalletAddress rejects malformed values', () => {
  assert.equal(normaliseWalletAddress('not-a-wallet'), '');
  assert.equal(normaliseWalletAddress('0x1234'), '');
  assert.equal(normaliseWalletAddress('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'), '');
});
