import crypto from 'crypto';

export function secureKeyMatch(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(String(provided));
  const expectedBuf = Buffer.from(String(expected));
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function normaliseWalletAddress(value) {
  const wallet = String(value || '').toLowerCase().trim();
  return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : '';
}
