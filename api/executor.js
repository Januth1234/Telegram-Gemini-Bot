/**
 * POST/GET /api/executor/*
 * Executor Agent HTTP API — adapted from Firebase Functions to Vercel serverless.
 * Handles: pairing, creative planning (Gemini), job queue, broker relay.
 *
 * Routes (all prefixed with /api/executor):
 *   POST /pair              — start pairing
 *   POST /pair/confirm      — register agent pubkey
 *   POST /pair/agent-handshake — PC agent completes pairing
 *   POST /unpair
 *   GET  /ideas             — inspiration ideas
 *   POST /plan              — creative planning
 *   POST /execute           — dispatch task to PC agent queue
 *   GET  /status            — job status
 *   GET  /pair/status       — pair + online status
 *   POST /agent/ping        — PC agent keepalive
 *   POST /agent/jobs/next   — PC agent polls for next queued job
 *   POST /agent/jobs/complete — PC agent marks job done
 */
import crypto from 'crypto';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  admin.initializeApp(serviceAccount ? { credential: admin.credential.cert(serviceAccount) } : undefined);
}

const db = () => admin.firestore();

const MAX_TS_SKEW = 300;
const AGENT_TS_SKEW = 120;
const HANDSHAKE_ATTEMPTS = new Map();

function hmacHex(secret, payload) {
  return crypto.createHmac('sha256', Buffer.from(secret)).update(payload).digest('hex');
}
function timingSafeEq(a, b) {
  try {
    const ba = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch { return false; }
}
function randomId() { return crypto.randomBytes(16).toString('hex'); }
function randomPairCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => chars[crypto.randomInt(chars.length)]).join('');
}
function randomSecret() { return crypto.randomBytes(32).toString('hex'); }
function clientIp(req) {
  return ((req.headers['x-forwarded-for'] || '').split(',')[0]).trim() || 'unknown';
}
function rateLimitHS(ip) {
  const now = Date.now();
  let r = HANDSHAKE_ATTEMPTS.get(ip);
  if (!r || now > r.resetAt) { r = { n: 0, resetAt: now + 60000 }; HANDSHAKE_ATTEMPTS.set(ip, r); }
  return ++r.n <= 30;
}

async function verifyFirebaseToken(req) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  try { return await admin.auth().verifyIdToken(m[1]); }
  catch { throw Object.assign(new Error('Invalid token'), { code: 401 }); }
}

async function verifyAgentHmac(req, rawBody) {
  const ts = req.headers['x-timestamp'];
  const sig = req.headers['x-signature'];
  if (!ts || !sig) throw Object.assign(new Error('Missing headers'), { code: 401 });
  const tsNum = parseInt(ts, 10);
  if (!isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > AGENT_TS_SKEW)
    throw Object.assign(new Error('Stale timestamp'), { code: 401 });
  const pairId = req.body?.pair_id;
  if (!pairId) throw Object.assign(new Error('pair_id required'), { code: 400 });
  const snap = await db().collection('executor_pairs').doc(pairId).get();
  if (!snap.exists) throw Object.assign(new Error('Unknown pair'), { code: 404 });
  const data = snap.data();
  if (data.status !== 'paired') throw Object.assign(new Error('Pair not active'), { code: 403 });
  const expected = hmacHex(data.hmacSecret, `${tsNum}\n${rawBody}`);
  if (!timingSafeEq(String(sig).toLowerCase(), expected)) throw Object.assign(new Error('Invalid signature'), { code: 401 });
  return { pairId, pairDoc: data };
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return null;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' } }) }
  );
  if (!r.ok) return null;
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Timestamp, X-Signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.query.path || []).join('/');
  let rawBody = '';
  try { rawBody = JSON.stringify(req.body || {}); } catch {}

  const json = (status, data) => res.status(status).json(data);
  const ok = (data) => json(200, data);
  const err = (code, msg) => json(code, { error: msg });

  try {
    // ── Public routes ──────────────────────────────────────────────────────
    if (path === 'health') return ok({ status: 'healthy', service: 'executor-http' });

    if (path === 'pair/agent-handshake' && req.method === 'POST') {
      if (!rateLimitHS(clientIp(req))) return err(429, 'Too many attempts');
      const { pair_id: pairId, pair_code: pairCode } = req.body || {};
      if (!pairId || !pairCode) return err(400, 'pair_id and pair_code required');
      const ref = db().collection('executor_pairs').doc(pairId);
      await db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw Object.assign(new Error('nf'), { code: 404 });
        const d = snap.data();
        if (d.status !== 'pending') throw Object.assign(new Error('state'), { code: 409 });
        if (String(d.pairCode) !== String(pairCode).trim().toUpperCase())
          throw Object.assign(new Error('badcode'), { code: 403 });
        tx.update(ref, { status: 'paired', pairedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      const secret = (await ref.get()).data().hmacSecret;
      return ok({ status: 'paired', hmac_secret: secret });
    }

    // ── Agent HMAC routes ──────────────────────────────────────────────────
    if (path === 'agent/ping' && req.method === 'POST') {
      const { pairId } = await verifyAgentHmac(req, rawBody);
      await db().collection('executor_pairs').doc(pairId).update({
        lastAgentPing: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return ok({ ok: true });
    }

    if (path === 'agent/jobs/next' && req.method === 'POST') {
      const { pairId } = await verifyAgentHmac(req, rawBody);
      const q = await db().collection('executor_jobs')
        .where('pairId', '==', pairId).where('status', '==', 'queued').limit(10).get();
      if (q.empty) return ok({ job: null });
      const docs = q.docs.sort((a, b) =>
        (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0));
      const first = docs[0];
      await db().runTransaction(async tx => {
        const s = await tx.get(first.ref);
        if (!s.exists || s.data().status !== 'queued') throw new Error('race');
        tx.update(first.ref, { status: 'running', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      const d = (await first.ref.get()).data();
      return ok({ job: { job_id: first.ref.id, pair_id: pairId, task: d.task,
        params: d.params, nonce: d.nonce, timestamp: d.timestamp,
        canonical: d.canonical, signature: d.serverSig } });
    }

    if (path === 'agent/jobs/complete' && req.method === 'POST') {
      const { pairId } = await verifyAgentHmac(req, rawBody);
      const { job_id: jobId, status, progress, error: errMsg, result } = req.body || {};
      if (!jobId) return err(400, 'job_id required');
      const ref = db().collection('executor_jobs').doc(jobId);
      const snap = await ref.get();
      if (!snap.exists) return err(404, 'Not found');
      if (snap.data().pairId !== pairId) return err(403, 'Forbidden');
      await ref.update({ status: status || 'done', progress: progress ?? snap.data().progress,
        error: errMsg || null, result: result ?? snap.data().result,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return ok({ ok: true });
    }

    // ── Firebase user routes ───────────────────────────────────────────────
    const decoded = await verifyFirebaseToken(req);
    const uid = decoded.uid;

    if (path === 'pair' && req.method === 'POST') {
      const agentType = req.body?.agent_type || 'pc';
      if (!['pc','extension'].includes(agentType)) return err(400, 'agent_type must be pc or extension');
      const pairId = randomId(), pairCode = randomPairCode(), hmacSecret = randomSecret();
      await db().collection('executor_pairs').doc(pairId).set({
        userId: uid, agentType, pairCode, hmacSecret, status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return ok({ pair_id: pairId, pair_code: pairCode });
    }

    if (path === 'unpair' && req.method === 'POST') {
      const { pair_id: pairId } = req.body || {};
      if (!pairId) return err(400, 'pair_id required');
      const snap = await db().collection('executor_pairs').doc(pairId).get();
      if (!snap.exists) return err(404, 'Not found');
      if (snap.data().userId !== uid) return err(403, 'Forbidden');
      await db().collection('executor_pairs').doc(pairId)
        .update({ status: 'revoked', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return ok({ status: 'unpaired' });
    }

    if (path === 'ideas' && req.method === 'GET') {
      const topic = String(req.query.topic || 'creativity').slice(0, 200);
      const parsed = await callGemini(
        `Topic: "${topic}". Return JSON: {"ideas": string[]} with exactly 5 short inspiration titles (5-8 words each). No markdown.`);
      if (parsed?.ideas) return ok({ ideas: parsed.ideas.slice(0, 8) });
      return ok({ ideas: [`${topic}: bold opener`, `${topic}: story arc`, `${topic}: data angle`,
        `${topic}: contrarian take`, `${topic}: future scenario`] });
    }

    if (path === 'plan' && req.method === 'POST') {
      const topic = String(req.body?.topic || 'creative work').slice(0, 500);
      const parsed = await callGemini(
        `Creative planning for: ${topic}. Return JSON: {"options":[{"id":number,"title":string,"desc":string}]} with 4 directions. ids 1-4.`);
      if (parsed?.options) return ok({ options: parsed.options });
      return ok({ options: [
        { id:1, title:'Minimal', desc:'Clean structure, one key metaphor.' },
        { id:2, title:'Story-driven', desc:'Narrative beats with emotional hook.' },
        { id:3, title:'Technical', desc:'Evidence, diagrams, precise terms.' },
        { id:4, title:'Provocative', desc:'Strong thesis with counterarguments.' }] });
    }

    if (path === 'execute' && req.method === 'POST') {
      const { pair_id: pairId, task, params, nonce, timestamp } = req.body || {};
      if (!pairId || !task) return err(400, 'pair_id and task required');
      const ts = Number(timestamp);
      if (!isFinite(ts) || Math.abs(Date.now()/1000 - ts) > MAX_TS_SKEW)
        return err(400, 'Invalid or stale timestamp');
      if (!nonce || String(nonce).length < 8) return err(400, 'nonce required');
      const nonceKey = `${uid}_${nonce}`;
      const got = await db().collection('executor_nonces').doc(nonceKey).get();
      if (got.exists) return err(403, 'Replay detected');
      await db().collection('executor_nonces').doc(nonceKey)
        .set({ createdAt: admin.firestore.FieldValue.serverTimestamp(), uid });
      const psnap = await db().collection('executor_pairs').doc(pairId).get();
      if (!psnap.exists) return err(404, 'Unknown pair');
      const pdata = psnap.data();
      if (pdata.userId !== uid) return err(403, 'Forbidden');
      if (pdata.status !== 'paired') return err(409, 'Pair not ready');
      const jobId = randomId();
      const canonical = JSON.stringify({ pair_id: pairId, task, params: params || {},
        job_id: jobId, nonce, timestamp: ts });
      const serverSig = hmacHex(pdata.hmacSecret, canonical);
      await db().collection('executor_jobs').doc(jobId).set({
        userId: uid, pairId, task, params: params || {}, nonce, timestamp: ts,
        status: 'queued', progress: 0, canonical, serverSig,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return ok({ job_id: jobId, status: 'scheduled' });
    }

    if (path === 'status' && req.method === 'GET') {
      const jobId = String(req.query.job_id || '');
      if (!jobId) return err(400, 'job_id required');
      const snap = await db().collection('executor_jobs').doc(jobId).get();
      if (!snap.exists) return err(404, 'Not found');
      const d = snap.data();
      if (d.userId !== uid) return err(403, 'Forbidden');
      return ok({ job_id: jobId, status: d.status, progress: d.progress ?? 0,
        error: d.error || null, result: d.result || null });
    }

    if (path === 'pair/status' && req.method === 'GET') {
      const pairId = String(req.query.pair_id || '');
      if (!pairId) return err(400, 'pair_id required');
      const snap = await db().collection('executor_pairs').doc(pairId).get();
      if (!snap.exists) return err(404, 'Not found');
      const d = snap.data();
      if (d.userId !== uid) return err(403, 'Forbidden');
      const lastMs = d.lastAgentPing?.toMillis?.() ?? null;
      return ok({ pair_id: pairId, pair_status: d.status,
        agent_online: lastMs != null && Date.now() - lastMs < 90000,
        last_agent_ping_ms: lastMs });
    }

    return err(404, `Route not found: ${path}`);
  } catch (e) {
    if (e.code) return err(e.code, e.message);
    console.error('[executor]', e);
    return err(500, 'Internal error');
  }
}
