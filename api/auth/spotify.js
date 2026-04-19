/**
 * Spotify OAuth backend — token exchange + refresh
 * POST /api/auth/spotify  body: { action: 'exchange'|'refresh'|'getToken', code?, redirectUri? }
 * GET  /api/auth/spotify  → { connected: bool }
 *
 * Required Vercel env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY
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
function encrypt(t) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([c.update(t, 'utf8'), c.final()]);
  return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + enc.toString('hex');
}
function decrypt(d) {
  try {
    const [ivH, tagH, encH] = d.split(':');
    const dc = createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivH, 'hex'));
    dc.setAuthTag(Buffer.from(tagH, 'hex'));
    return Buffer.concat([dc.update(Buffer.from(encH, 'hex')), dc.final()]).toString('utf8');
  } catch { return null; }
}

async function verifyUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Unauthorized');
  const d = await admin.auth().verifyIdToken(token);
  return d.uid;
}

const CID = process.env.SPOTIFY_CLIENT_ID || '';
const CSECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const tokenDoc = (uid) => db().collection('users').doc(uid).collection('integrations').doc('spotify');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let uid;
  try { uid = await verifyUser(req); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }

  if (req.method === 'GET') {
    const snap = await tokenDoc(uid).get();
    return res.status(200).json({ connected: snap.exists && snap.data()?.enabled === true });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { action, code, redirectUri } = req.body || {};

  if (action === 'exchange') {
    if (!code || !redirectUri) return res.status(400).json({ error: 'code and redirectUri required' });
    if (!CSECRET) return res.status(500).json({ error: 'SPOTIFY_CLIENT_SECRET not configured' });
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(CID + ':' + CSECRET).toString('base64') },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    const data = await r.json();
    if (!data.access_token) return res.status(400).json({ error: data.error_description || 'Exchange failed' });
    await tokenDoc(uid).set({
      accessToken:  encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      expiresAt:    Date.now() + data.expires_in * 1000,
      connectedAt:  admin.firestore.FieldValue.serverTimestamp(),
      enabled:      true,
    });
    return res.status(200).json({ ok: true });
  }

  if (action === 'getToken') {
    const snap = await tokenDoc(uid).get();
    if (!snap.exists || !snap.data().enabled) return res.status(404).json({ error: 'Not connected' });
    const d = snap.data();
    if (d.expiresAt < Date.now() + 60000 && d.refreshToken && CSECRET) {
      const rt = decrypt(d.refreshToken);
      if (rt) {
        const r = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(CID + ':' + CSECRET).toString('base64') },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt }),
        });
        const rd = await r.json();
        if (rd.access_token) {
          await tokenDoc(uid).update({ accessToken: encrypt(rd.access_token), expiresAt: Date.now() + rd.expires_in * 1000 });
          return res.status(200).json({ accessToken: rd.access_token });
        }
      }
    }
    const at = decrypt(d.accessToken);
    if (!at) return res.status(400).json({ error: 'Decrypt failed' });
    return res.status(200).json({ accessToken: at });
  }

  if (action === 'disconnect') {
    await tokenDoc(uid).set({ enabled: false }, { merge: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
