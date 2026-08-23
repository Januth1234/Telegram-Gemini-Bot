/**
 * Shared Firebase Admin bootstrap + ID-token verification for all /api endpoints.
 * Env: FIREBASE_SERVICE_ACCOUNT (stringified JSON; FIREBASE_SERVICE_ACCOUNT_JSON accepted as legacy alias).
 * Falls back to Application Default Credentials when unset.
 */
import admin from 'firebase-admin';

export function initAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
      || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      || '';
    let credential;
    if (raw) {
      try {
        credential = admin.credential.cert(typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch (e) {
        console.error('[firebase] Invalid service-account JSON:', e.message);
      }
    }
    admin.initializeApp(credential ? { credential } : undefined);
  }
  return admin;
}

export const db = () => initAdmin().firestore();
export const TS = () => admin.firestore.FieldValue.serverTimestamp();

export function httpError(code, message) {
  return Object.assign(new Error(message), { code });
}

function bearerToken(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
}

/** Returns uid or null — never throws. For endpoints where auth is optional. */
export async function verifyUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    return (await initAdmin().auth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

/** Returns the decoded ID token or throws { code: 401 }. For endpoints where auth is required. */
export async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Unauthorized');
  try {
    return await initAdmin().auth().verifyIdToken(token);
  } catch {
    throw httpError(401, 'Invalid or expired token');
  }
}
