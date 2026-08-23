/**
 * Spotify OAuth backend — token exchange + refresh
 * POST /api/auth/spotify  body: { action: 'exchange'|'refresh'|'getToken'|'disconnect', code?, redirectUri? }
 * GET  /api/auth/spotify  → { connected: bool }
 *
 * Required env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY (32+ chars)
 */
import { db, TS, requireUser } from '../_lib/firebase.js';
import { apiHandler } from '../_lib/http.js';
import { encryptToken, decryptToken } from '../_lib/crypto.js';

export const config = { maxDuration: 30 };

const CID = process.env.SPOTIFY_CLIENT_ID || '';
const CSECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const tokenDoc = (uid) => db().collection('users').doc(uid).collection('integrations').doc('spotify');

async function handler(req, res) {
  const uid = await requireUser(req);

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
      accessToken:  encryptToken(data.access_token),
      refreshToken: data.refresh_token ? encryptToken(data.refresh_token) : null,
      expiresAt:    Date.now() + data.expires_in * 1000,
      connectedAt:  TS(),
      enabled:      true,
    });
    return res.status(200).json({ ok: true });
  }

  if (action === 'getToken') {
    const snap = await tokenDoc(uid).get();
    if (!snap.exists || !snap.data().enabled) return res.status(404).json({ error: 'Not connected' });
    const d = snap.data();
    if (d.expiresAt < Date.now() + 60000 && d.refreshToken && CSECRET) {
      const rt = decryptToken(d.refreshToken);
      if (rt) {
        const r = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(CID + ':' + CSECRET).toString('base64') },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt }),
        });
        const rd = await r.json();
        if (rd.access_token) {
          await tokenDoc(uid).update({ accessToken: encryptToken(rd.access_token), expiresAt: Date.now() + rd.expires_in * 1000 });
          return res.status(200).json({ accessToken: rd.access_token });
        }
      }
    }
    const at = decryptToken(d.accessToken);
    if (!at) return res.status(400).json({ error: 'Decrypt failed — was TOKEN_ENCRYPTION_KEY rotated?' });
    return res.status(200).json({ accessToken: at });
  }

  if (action === 'disconnect') {
    await tokenDoc(uid).set({ enabled: false }, { merge: true });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

export default apiHandler(handler);
