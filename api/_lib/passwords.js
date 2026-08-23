/**
 * Password hashing with Node's built-in scrypt — no extra dependencies.
 * Stored format: scrypt$N$r$p$saltHex$hashHex
 */
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Constant-time verify; returns false on any malformed input. */
export function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
    const [, n, r, p, saltHex, hashHex] = parts;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(String(password).normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length, {
      N: +n, r: +r, p: +p,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
