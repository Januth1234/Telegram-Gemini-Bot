/**
 * POST /api/auth/password — Orin AI first-party accounts.
 * Sign in / register with Name + (Email OR Phone) + password. No SMS OTP:
 * the phone number is a login identifier, not a verified channel.
 *
 * body: { action: 'register' | 'login' | 'set-password', ... }
 *   register:     { name, identifier, password }
 *   login:        { identifier, password }
 *   set-password: {} — Bearer auth required; lets Google users add a password
 *
 * Returns { customToken } — the client signs in via signInWithCustomToken so
 * every existing Firebase-ID-token-protected endpoint and Firestore rule works
 * unchanged.
 *
 * Design notes:
 * - Passwords are hashed with scrypt in _lib/passwords.js; hashes + lookup
 *   indexes live in password_credentials/auth_identifiers collections that
 *   clients can never read or write (firestore.rules deny all).
 * - Firebase Auth users get an unusable random password: all password checks
 *   flow through THIS endpoint where rate limiting applies. Firebase's own
 *   Email/Password provider is not used for sign-in.
 */
import crypto from 'crypto';
import { initAdmin, db, TS, requireUser, httpError } from '../_lib/firebase.js';
import { apiHandler } from '../_lib/http.js';
import { hashPassword, verifyPassword } from '../_lib/passwords.js';
import { normalizeIdentifier, identifierKey, passwordPolicyError, namePolicyError } from '../_lib/identity.js';
import { rateLimit } from '../_lib/ratelimit.js';

export const config = { maxDuration: 30 };

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_ATTEMPTS_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60_000;
const IP_ATTEMPTS_LIMIT = 30;

function clientIp(req) {
  return ((req.headers['x-forwarded-for'] || '').split(',')[0]).trim() || 'unknown';
}

/** Creates users/{uid} profile doc if missing (mirrors syncUserSession defaults). */
async function ensureProfile(uid, { name, email, phone }) {
  const ref = db().collection('users').doc(uid);
  await ref.set({
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    lastUpdated: TS(),
  }, { merge: true });
}

async function issueCustomToken(uid) {
  return initAdmin().auth().createCustomToken(uid);
}

async function handler(req, res) {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const { action } = req.body || {};

  // ── REGISTER ─────────────────────────────────────────────────────────────
  if (action === 'register') {
    if (!(await rateLimit('auth-register:' + clientIp(req), 10, 60 * 60_000)))
      throw httpError(429, 'Too many signup attempts. Try again later.');

    const { name, identifier, password } = req.body || {};
    const nameErr = namePolicyError(name);
    if (nameErr) throw httpError(400, nameErr);
    const norm = normalizeIdentifier(identifier);
    if (!norm) throw httpError(400, 'Enter a valid email address or phone number.');
    const pwErr = passwordPolicyError(password);
    if (pwErr) throw httpError(400, pwErr);

    const key = identifierKey(norm);
    const lookupRef = db().collection('auth_identifiers').doc(key);
    const lookupSnap = await lookupRef.get();
    if (lookupSnap.exists) {
      // Distinguish "Google account exists" from "full account exists" for better UX
      const existingUid = lookupSnap.data().uid;
      let isGoogleOnly = false;
      try {
        const fbUser = await initAdmin().auth().getUser(existingUid);
        isGoogleOnly = !!fbUser.email && !(await hasPasswordCredential(existingUid));
      } catch { /* user record vanished; fall through to generic message */ }
      if (isGoogleOnly) {
        throw httpError(409, 'An Orin account with this email already exists via Google sign-in. Sign in with Google, then add a password in Account Settings.');
      }
      throw httpError(409, norm.type === 'email'
        ? 'An account with this email already exists.'
        : 'An account with this phone number already exists.');
    }

    // Create the Firebase Auth user
    let fbUser;
    try {
      if (norm.type === 'email') {
        fbUser = await initAdmin().auth().createUser({
          email: norm.value,
          password: crypto.randomBytes(32).toString('hex'), // unusable — logins go through this endpoint
          displayName: String(name).trim(),
          emailVerified: false,
        });
      } else {
        fbUser = await initAdmin().auth().createUser({
          displayName: String(name).trim(),
        });
      }
    } catch (e) {
      if (e?.code === 'auth/email-already-exists' || e?.code?.includes('email-already-exists')) {
        throw httpError(409, 'An Orin account with this email already exists. Sign in with Google, then add a password in Account Settings.');
      }
      throw e;
    }

    try {
      const uid = fbUser.uid;
      const credRef = db().collection('password_credentials').doc(uid);
      await credRef.set({
        hash: hashPassword(password),
        identifierType: norm.type,
        email: norm.type === 'email' ? norm.value : null,
        phone: norm.type === 'phone' ? norm.value : null,
        createdAt: TS(),
        updatedAt: TS(),
      });
      // Two lookup docs when both channels known? We only know one at registration.
      await lookupRef.set({ uid, type: norm.type, createdAt: TS() });

      await ensureProfile(uid, {
        name: String(name).trim(),
        email: norm.type === 'email' ? norm.value : null,
        phone: norm.type === 'phone' ? norm.value : null,
      });

      const customToken = await issueCustomToken(uid);
      return res.status(200).json({
        customToken,
        user: {
          id: uid,
          name: String(name).trim(),
          email: norm.type === 'email' ? norm.value : '',
          phone: norm.type === 'phone' ? norm.value : '',
        },
      });
    } catch (e) {
      // Roll back the half-created Auth user rather than leave an orphan
      try { await initAdmin().auth().deleteUser(fbUser.uid); } catch {}
      throw e;
    }
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const ip = clientIp(req);
    if (!(await rateLimit('auth-login-ip:' + ip, IP_ATTEMPTS_LIMIT, IP_WINDOW_MS)))
      throw httpError(429, 'Too many attempts from this network. Try again later.');

    const { identifier, password } = req.body || {};
    const norm = normalizeIdentifier(identifier);
    if (!norm || typeof password !== 'string') throw httpError(400, 'Email/phone and password are required.');

    const idKey = 'auth-login-id:' + identifierKey(norm);
    if (!(await rateLimit(idKey, LOGIN_ATTEMPTS_LIMIT, LOGIN_WINDOW_MS)))
      throw httpError(429, 'Too many failed attempts. Try again in 15 minutes.');

    const key = identifierKey(norm);
    const lookupSnap = await db().collection('auth_identifiers').doc(key).get();
    if (!lookupSnap.exists) throw httpError(401, 'Invalid credentials');
    const uid = lookupSnap.data().uid;

    const credSnap = await db().collection('password_credentials').doc(String(uid)).get();
    if (!credSnap.exists || !verifyPassword(password, credSnap.data().hash)) {
      throw httpError(401, 'Invalid credentials');
    }

    const profileSnap = await db().collection('users').doc(String(uid)).get();
    const p = profileSnap.data() || {};
    const customToken = await issueCustomToken(String(uid));
    return res.status(200).json({
      customToken,
      user: {
        id: uid,
        name: p.name || '',
        email: p.email || credSnap.data().email || '',
        phone: p.phone || credSnap.data().phone || '',
      },
    });
  }

  // ── SET-PASSWORD (authenticated; for Google users adding a password) ─────
  if (action === 'set-password') {
    const decoded = await requireUser(req);
    const uid = decoded.uid;
    const { password } = req.body || {};
    const pwErr = passwordPolicyError(password);
    if (pwErr) throw httpError(400, pwErr);

    const email = decoded.email ? decoded.email.toLowerCase() : null;

    // If their email is claimed by ANOTHER uid's credential, don't steal it.
    if (email) {
      const claimSnap = await db().collection('auth_identifiers').doc('email:' + email).get();
      if (claimSnap.exists && claimSnap.data().uid !== uid) {
        throw httpError(409, 'This email is already used for another Orin account\'s sign-in.');
      }
    }

    const credRef = db().collection('password_credentials').doc(uid);
    const existing = await credRef.get();
    await credRef.set({
      hash: hashPassword(password),
      identifierType: email ? 'email' : 'unknown',
      email,
      ...(existing.exists ? {} : { createdAt: TS() }),
      updatedAt: TS(),
    }, { merge: true });
    if (email) {
      await db().collection('auth_identifiers').doc('email:' + email)
        .set({ uid, type: 'email', createdAt: existing.exists ? existing.data().createdAt ?? TS() : TS() });
    }
    return res.status(200).json({ ok: true });
  }

  throw httpError(400, 'Unknown action. Use register, login, or set-password.');
}

async function hasPasswordCredential(uid) {
  return (await db().collection('password_credentials').doc(String(uid)).get()).exists;
}

export default apiHandler(handler);
