/**
 * Shared crypto helpers.
 * Token encryption (AES-256-GCM) FAILS CLOSED: TOKEN_ENCRYPTION_KEY must be a
 * 32-char env var. Never ship a fallback key — ciphertext in Firestore must not
 * be decryptable by anyone with repo access.
 * Also: HMAC signing helpers used by the executor agent protocol.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from 'crypto';

let _encKey = null;
function encKey() {
  if (_encKey) return _encKey;
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (raw.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set to at least 32 characters');
  }
  _encKey = Buffer.from(raw, 'utf8').subarray(0, 32);
  return _encKey;
}

/** Returns "iv:tag:ciphertext" (hex) or throws if encryption key is not configured. */
export function encryptToken(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

/** Returns plaintext, or null if data is malformed / key changed / tampered. */
export function decryptToken(data) {
  try {
    const [ivHex, tagHex, encHex] = String(data).split(':');
    if (!ivHex || !tagHex || !encHex) return null;
    const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function hmacHex(secret, payload) {
  return createHmac('sha256', Buffer.from(secret)).update(payload).digest('hex');
}

/** Timing-safe comparison of two hex digests. */
export function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function randomHex(bytes) {
  return randomBytes(bytes).toString('hex');
}

export { randomBytes };
