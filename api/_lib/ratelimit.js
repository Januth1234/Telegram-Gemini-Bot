/**
 * Firestore-backed fixed-window rate limiting.
 * Survives serverless cold starts (an in-memory Map does not).
 * Usage: if (!(await rateLimit('login:ip:'+ip, 30, 3600_000))) throw httpError(429, ...);
 * Returns true when the action is allowed.
 */
import { db } from './firebase.js';

export async function rateLimit(key, limit, windowMs) {
  const docId = key.replace(/[/\\#?*[\]]/g, '_').slice(0, 400);
  const ref = db().collection('rate_limits').doc(docId);
  try {
    const allowed = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      let count = 0, windowStart = now;
      if (snap.exists) {
        const d = snap.data();
        windowStart = Number(d.windowStart) || now;
        // Window expired → start a fresh one
        count = now - windowStart >= windowMs ? 0 : Number(d.count) || 0;
        if (count === 0) windowStart = now;
      }
      count += 1;
      tx.set(ref, { count, windowStart, expiresAt: new Date(windowStart + windowMs) });
      return count <= limit;
    });
    return allowed;
  } catch (e) {
    // Fail open on rate-limit infrastructure errors, but log loudly.
    console.error('[ratelimit] failed for', key, e.message);
    return true;
  }
}
