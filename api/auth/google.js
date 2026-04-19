/**
 * Google OAuth backend — token exchange + refresh + status
 * POST /api/auth/google  body: { action: 'exchange'|'refresh'|'getToken'|'disable', code?, verifier?, module?, redirectUri? }
 * GET  /api/auth/google  → { connected: bool, modules: { gmail: bool, ... } }
 *
 * Tokens stored AES-256-GCM encrypted in Firestore: users/{uid}/google_tokens/{module}
 * Required Vercel env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY
 */
import admin from 'firebase-admin';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : null;
  admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : undefined);
}
const db = () => admin.firestore();

export const config = { maxDuration: 30 };

const ENC_KEY = Buffer.from(
  (process.env.TOKEN_ENCRYPTION_KEY || 'orin_default_enc_key_change_me!!').padEnd(32).slice(0, 32)
);

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(data) {
  try {
    const [ivHex, tagHex, encHex] = data.split(':');
    const decipher = createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch { return null; }
}

async function verifyUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  const d = await admin.auth().verifyIdToken(token);
  return d.uid;
}

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || process.env.VITE_GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let uid;
  try { uid = await verifyUser(req); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const tokensCol = () => db().collection('users').doc(uid).collection('google_tokens');

  // ── GET: connection status ───────────────────────────────────────────────
  if (req.method === 'GET') {
    const snap = await tokensCol().get();
    const modules = {};
    snap.docs.forEach(d => { modules[d.id] = d.data().enabled === true; });
    return res.status(200).json({ connected: Object.values(modules).some(Boolean), modules });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET/POST only' });

  const { action, code, verifier, module, redirectUri } = req.body || {};

  // ── exchange ─────────────────────────────────────────────────────────────
  if (action === 'exchange') {
    if (!code || !verifier || !module) return res.status(400).json({ error: 'code, verifier, module required' });
    if (!CLIENT_SECRET) return res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET not configured' });

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    const data = await r.json();
    if (!data.access_token) return res.status(400).json({ error: data.error_description || 'Token exchange failed' });

    await tokensCol().doc(module).set({
      accessToken:   encrypt(data.access_token),
      refreshToken:  data.refresh_token ? encrypt(data.refresh_token) : null,
      expiresAt:     Date.now() + (data.expires_in || 3600) * 1000,
      grantedScopes: (data.scope || '').split(' '),
      connectedAt:   admin.firestore.FieldValue.serverTimestamp(),
      enabled:       true,
    });
    return res.status(200).json({ ok: true, module });
  }

  // ── getToken (auto-refreshes if expired) ─────────────────────────────────
  if (action === 'getToken') {
    if (!module) return res.status(400).json({ error: 'module required' });
    const snap = await tokensCol().doc(module).get();
    if (!snap.exists || !snap.data().enabled) return res.status(404).json({ error: 'Not connected' });
    const d = snap.data();

    if (d.expiresAt < Date.now() + 60000 && d.refreshToken && CLIENT_SECRET) {
      const rt = decrypt(d.refreshToken);
      if (rt) {
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }),
        });
        const rd = await r.json();
        if (rd.access_token) {
          await tokensCol().doc(module).update({ accessToken: encrypt(rd.access_token), expiresAt: Date.now() + (rd.expires_in || 3600) * 1000 });
          return res.status(200).json({ accessToken: rd.access_token });
        }
      }
    }
    const at = decrypt(d.accessToken);
    if (!at) return res.status(400).json({ error: 'Token decrypt failed' });
    return res.status(200).json({ accessToken: at });
  }

  // ── refresh ───────────────────────────────────────────────────────────────
  if (action === 'refresh') {
    if (!module) return res.status(400).json({ error: 'module required' });
    if (!CLIENT_SECRET) return res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET not configured' });
    const snap = await tokensCol().doc(module).get();
    if (!snap.exists || !snap.data().refreshToken) return res.status(400).json({ error: 'No refresh token' });
    const rt = decrypt(snap.data().refreshToken);
    if (!rt) return res.status(400).json({ error: 'Decrypt failed' });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }),
    });
    const data = await r.json();
    if (!data.access_token) return res.status(400).json({ error: 'Refresh failed' });
    await tokensCol().doc(module).update({ accessToken: encrypt(data.access_token), expiresAt: Date.now() + (data.expires_in || 3600) * 1000 });
    return res.status(200).json({ ok: true });
  }

  // ── disable ───────────────────────────────────────────────────────────────
  if (action === 'disable') {
    if (!module) return res.status(400).json({ error: 'module required' });
    await tokensCol().doc(module).set({ enabled: false }, { merge: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
