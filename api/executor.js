/**
 * POST/GET /api/executor/*
 * Executor Agent HTTP API — pairing + HMAC-signed job queue for the desktop agent.
 *
 * Routes (all prefixed with /api/executor):
 *   GET  health                 — liveness probe
 *   POST pair                   — start pairing (user, Bearer auth)
 *   POST pair/agent-handshake   — PC agent completes pairing (public, rate-limited)
 *   POST unpair                 — revoke a pair (user)
 *   GET  ideas                  — inspiration ideas (user)
 *   POST plan                   — creative planning (user)
 *   POST execute                — dispatch task to PC agent queue (user)
 *   GET  status?job_id=         — job status (user)
 *   GET  pair/status?pair_id=   — pair + online status (user)
 *   POST agent/ping             — keepalive (HMAC)
 *   POST agent/jobs/next        — claim next queued job (HMAC; skips notBefore-scheduled jobs)
 *   POST agent/jobs/complete    — report job result (HMAC)
 */
import crypto from 'crypto';
import { db, TS, requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';
import { hmacHex, safeEqualHex, randomHex } from './_lib/crypto.js';
import { rateLimit } from './_lib/ratelimit.js';

export const config = { maxDuration: 60 };

const MAX_TS_SKEW = 300;
const AGENT_TS_SKEW = 120;

function randomPairCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => chars[crypto.randomInt(chars.length)]).join('');
}

function clientIp(req) {
  return ((req.headers['x-forwarded-for'] || '').split(',')[0]).trim() || 'unknown';
}

async function verifyAgentHmac(req, rawBody) {
  const ts = req.headers['x-timestamp'];
  const sig = req.headers['x-signature'];
  if (!ts || !sig) throw httpError(401, 'Missing signature headers');
  const tsNum = parseInt(ts, 10);
  if (!isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > AGENT_TS_SKEW)
    throw httpError(401, 'Stale timestamp');
  const pairId = req.body?.pair_id;
  if (!pairId) throw httpError(400, 'pair_id required');
  const snap = await db().collection('executor_pairs').doc(String(pairId)).get();
  if (!snap.exists) throw httpError(404, 'Unknown pair');
  const data = snap.data();
  if (data.status !== 'paired') throw httpError(403, 'Pair not active');
  const expected = hmacHex(data.hmacSecret, `${tsNum}\n${rawBody}`);
  if (!safeEqualHex(String(sig).toLowerCase(), expected)) throw httpError(401, 'Invalid signature');
  return { pairId: String(pairId), pairDoc: data };
}

async function callOpenRouter(prompt) {
  const key = process.env.OPENROUTER_API_KEY || '';
  if (!key) return null;
  // Route through the Orin router instance (OmniRoute) when configured — same
  // OpenAI-compatible shape; direct OpenRouter is the fallback.
  const routerBase = (process.env.ROUTER_BASE_URL || '').replace(/\/+$/, '');
  const url = routerBase ? `${routerBase}/v1/chat/completions` : "https://openrouter.ai/api/v1/chat/completions";
  const authKey = routerBase ? (process.env.ROUTER_API_KEY || key) : key;

  const doFetch = (u, k) => fetch(u, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${k}`,
      'HTTP-Referer': 'https://orinai.org',
      'X-Title': 'Orin AI Executor'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  let r = await doFetch(url, authKey);
  if (!r.ok && routerBase) {
    console.error(`[executor] router ${r.status}; failing over to OpenRouter direct`);
    r = await doFetch("https://openrouter.ai/api/v1/chat/completions", key);
  }
  if (!r.ok) return null;
  const j = await r.json();
  const text = j.choices?.[0]?.message?.content;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function handler(req, res) {
  const path = (req.query.path || []).join('/');
  // NOTE: signature covers the re-serialized body. Clients MUST send compact JSON
  // matching JSON.stringify output (the Python client uses separators=(',', ':')).
  let rawBody = '';
  try { rawBody = JSON.stringify(req.body || {}); } catch {}

  const json = (status, data) => res.status(status).json(data);
  const ok = (data) => json(200, data);

  // ── Public routes ──────────────────────────────────────────────────────
  if (path === 'health') return ok({ status: 'healthy', service: 'executor-http' });

  if (path === 'pair/agent-handshake' && req.method === 'POST') {
    const ip = clientIp(req);
    if (!(await rateLimit(`executor-handshake:${ip}`, 30, 60_000))) return json(429, { error: 'Too many attempts' });
    const { pair_id: pairId, pair_code: pairCode } = req.body || {};
    if (!pairId || !pairCode) return json(400, { error: 'pair_id and pair_code required' });
    const ref = db().collection('executor_pairs').doc(String(pairId));
    await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw httpError(404, 'Unknown pair');
      const d = snap.data();
      if (d.status !== 'pending') throw httpError(409, 'Pair already used or revoked');
      if (String(d.pairCode) !== String(pairCode).trim().toUpperCase())
        throw httpError(403, 'Invalid pair code');
      tx.update(ref, { status: 'paired', pairedAt: TS(), updatedAt: TS() });
    });
    const secret = (await ref.get()).data().hmacSecret;
    return ok({ status: 'paired', hmac_secret: secret });
  }

  // ── Agent HMAC routes ──────────────────────────────────────────────────
  if (path === 'agent/ping' && req.method === 'POST') {
    const { pairId } = await verifyAgentHmac(req, rawBody);
    await db().collection('executor_pairs').doc(pairId).update({
      lastAgentPing: TS(), updatedAt: TS() });
    return ok({ ok: true });
  }

  if (path === 'agent/jobs/next' && req.method === 'POST') {
    const { pairId } = await verifyAgentHmac(req, rawBody);
    // Long-poll: agents may pass wait (seconds, max 25) to hold the request open
    // until a job is due. Slashes idle polling ~8x; legacy clients that omit
    // `wait` behave exactly as before.
    const waitSec = Math.min(Math.max(parseInt(req.body?.wait, 10) || 0, 0), 25);
    const deadline = Date.now() + waitSec * 1000;

    while (true) {
      const q = await db().collection('executor_jobs')
        .where('pairId', '==', pairId).where('status', '==', 'queued').limit(10).get();
      const nowMs = Date.now();
      const dueDocs = q.docs
        .filter(d => {
          const nb = d.data().notBefore;
          const nbMs = nb?.toMillis?.() ?? (typeof nb === 'number' ? nb : 0);
          return !nb || nbMs <= nowMs;   // skip scheduled jobs that aren't due yet
        })
        .sort((a, b) =>
          (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0));

      if (!dueDocs.length) {
        if (Date.now() >= deadline) return ok({ job: null });
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const first = dueDocs[0];
      await db().runTransaction(async tx => {
        const s = await tx.get(first.ref);
        if (!s.exists || s.data().status !== 'queued') throw new Error('race');
        tx.update(first.ref, { status: 'running', updatedAt: TS() });
      });
      const d = (await first.ref.get()).data();
      return ok({ job: { job_id: first.ref.id, pair_id: pairId, task: d.task,
        params: d.params, nonce: d.nonce, timestamp: d.timestamp,
        canonical: d.canonical, signature: d.serverSig } });
    }
  }

  if (path === 'agent/jobs/complete' && req.method === 'POST') {
    const { pairId } = await verifyAgentHmac(req, rawBody);
    const { job_id: jobId, status, progress, error: errMsg, result } = req.body || {};
    if (!jobId) return json(400, { error: 'job_id required' });
    const ref = db().collection('executor_jobs').doc(String(jobId));
    const snap = await ref.get();
    if (!snap.exists) return json(404, { error: 'Not found' });
    if (snap.data().pairId !== pairId) return json(403, { error: 'Forbidden' });

    const update = {
      status: status || 'done',
      progress: progress ?? snap.data().progress,
      error: errMsg || null,
      result: result ?? snap.data().result,
      completedAt: TS(),
      updatedAt: TS(),
    };

    // Recurring dispatches (from task-router) re-arm as a fresh queued job
    const done = update.status === 'done';
    const recurrence = snap.data().recurrence;
    const source = snap.data().source;
    if (done && recurrence && recurrence !== 'none' && source === 'task-router') {
      const prevNb = snap.data().notBefore?.toMillis?.() ?? Date.now();
      const step = recurrence === 'weekly' ? 7 * 86400_000 : 86400_000;
      await db().collection('executor_jobs').add({
        ...snap.data(),
        notBefore: new Date(prevNb + step),
        status: 'queued', progress: 0, result: null, error: null,
        createdAt: TS(), updatedAt: TS(),
      });
    }

    await ref.update(update);
    return ok({ ok: true });
  }

  // ── Firebase user routes ───────────────────────────────────────────────
  const decoded = await requireUser(req);
  const uid = decoded.uid;

  if (path === 'pair' && req.method === 'POST') {
    const agentType = req.body?.agent_type || 'pc';
    if (!['pc','extension'].includes(agentType)) return json(400, { error: 'agent_type must be pc or extension' });
    const pairId = randomHex(16), pairCode = randomPairCode(), hmacSecret = randomHex(32);
    await db().collection('executor_pairs').doc(pairId).set({
      userId: uid, agentType, pairCode, hmacSecret, status: 'pending',
      createdAt: TS(), updatedAt: TS() });
    return ok({ pair_id: pairId, pair_code: pairCode });
  }

  if (path === 'unpair' && req.method === 'POST') {
    const { pair_id: pairId } = req.body || {};
    if (!pairId) return json(400, { error: 'pair_id required' });
    const snap = await db().collection('executor_pairs').doc(String(pairId)).get();
    if (!snap.exists) return json(404, { error: 'Not found' });
    if (snap.data().userId !== uid) return json(403, { error: 'Forbidden' });
    await db().collection('executor_pairs').doc(String(pairId))
      .update({ status: 'revoked', updatedAt: TS() });
    return ok({ status: 'unpaired' });
  }

  if (path === 'ideas' && req.method === 'GET') {
    const topic = String(req.query.topic || 'creativity').slice(0, 200);
    const parsed = await callOpenRouter(
      `Topic: "${topic}". Return JSON: {"ideas": string[]} with exactly 5 short inspiration titles (5-8 words each). No markdown.`);
    if (parsed?.ideas) return ok({ ideas: parsed.ideas.slice(0, 8) });
    return ok({ ideas: [`${topic}: bold opener`, `${topic}: story arc`, `${topic}: data angle`,
      `${topic}: contrarian take`, `${topic}: future scenario`] });
  }

  if (path === 'plan' && req.method === 'POST') {
    const topic = String(req.body?.topic || 'creative work').slice(0, 500);
    const parsed = await callOpenRouter(
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
    if (!pairId || !task) return json(400, { error: 'pair_id and task required' });
    const ts = Number(timestamp);
    if (!isFinite(ts) || Math.abs(Date.now()/1000 - ts) > MAX_TS_SKEW)
      return json(400, { error: 'Invalid or stale timestamp' });
    if (!nonce || String(nonce).length < 8) return json(400, { error: 'nonce required' });
    const nonceKey = `${uid}_${String(nonce)}`;
    const got = await db().collection('executor_nonces').doc(nonceKey).get();
    if (got.exists) return json(403, { error: 'Replay detected' });
    await db().collection('executor_nonces').doc(nonceKey).set({ createdAt: TS(), uid });
    const psnap = await db().collection('executor_pairs').doc(String(pairId)).get();
    if (!psnap.exists) return json(404, { error: 'Unknown pair' });
    const pdata = psnap.data();
    if (pdata.userId !== uid) return json(403, { error: 'Forbidden' });
    if (pdata.status !== 'paired') return json(409, { error: 'Pair not ready' });
    const jobId = randomHex(16);
    const canonical = JSON.stringify({ pair_id: pairId, task, params: params || {},
      job_id: jobId, nonce, timestamp: ts });
    const serverSig = hmacHex(pdata.hmacSecret, canonical);
    await db().collection('executor_jobs').doc(jobId).set({
      userId: uid, pairId, task, params: params || {}, nonce, timestamp: ts,
      notBefore: null, recurrence: 'none', source: 'web',
      status: 'queued', progress: 0, canonical, serverSig,
      createdAt: TS(), updatedAt: TS() });
    return ok({ job_id: jobId, status: 'scheduled' });
  }

  if (path === 'status' && req.method === 'GET') {
    const jobId = String(req.query.job_id || '');
    if (!jobId) return json(400, { error: 'job_id required' });
    const snap = await db().collection('executor_jobs').doc(jobId).get();
    if (!snap.exists) return json(404, { error: 'Not found' });
    const d = snap.data();
    if (d.userId !== uid) return json(403, { error: 'Forbidden' });
    return ok({ job_id: jobId, status: d.status, progress: d.progress ?? 0,
      error: d.error || null, result: d.result || null });
  }

  if (path === 'pair/status' && req.method === 'GET') {
    const pairId = String(req.query.pair_id || '');
    if (!pairId) return json(400, { error: 'pair_id required' });
    const snap = await db().collection('executor_pairs').doc(pairId).get();
    if (!snap.exists) return json(404, { error: 'Not found' });
    const d = snap.data();
    if (d.userId !== uid) return json(403, { error: 'Forbidden' });
    const lastMs = d.lastAgentPing?.toMillis?.() ?? null;
    return ok({ pair_id: pairId, pair_status: d.status,
      agent_online: lastMs != null && Date.now() - lastMs < 90000,
      last_agent_ping_ms: lastMs });
  }

  return json(404, { error: `Route not found: ${path}` });
}

export default apiHandler(handler, { headers: ['X-Timestamp', 'X-Signature'] });
