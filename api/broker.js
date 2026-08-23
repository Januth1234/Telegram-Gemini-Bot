/**
 * DEPRECATED — Cloud Broker queue (legacy).
 *
 * This second task queue never had a consumer: no agent ever polled
 * /api/broker/*, so tasks queued here were silently dropped. The PC pipeline
 * lives in /api/executor/* (executor_pairs / executor_jobs), and scheduled
 * tasks now flow through /api/task-router/dispatch → executor_jobs.
 *
 * Write routes return 410 with guidance. Read/status routes still work against
 * historical rows so old UI state doesn't break.
 */
import { db, requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

const GONE = {
  error: 'The broker queue is deprecated. Use POST /api/task-router/dispatch (routes to your paired PC) or POST /api/executor/execute.',
};

async function handler(req, res) {
  const decoded = await requireUser(req);
  const uid = decoded.uid;
  const path = (req.query.path || []).join('/');
  const ok = d => res.status(200).json(d);

  // ── Deprecated writes → explicit 410 ─────────────────────────────────────
  if ((path === 'queue' || path === 'schedule' || path === 'cancel' || path === 'result' || path === 'status') ) {
    throw httpError(410, GONE.error);
  }

  // ── Legacy reads (historical rows only) ──────────────────────────────────
  if (path === 'tasks' && req.method === 'GET') {
    const { deviceId, status } = req.query;
    let q = db().collection('broker_tasks').where('uid', '==', uid);
    if (deviceId) q = q.where('deviceId', '==', deviceId);
    if (status)   q = q.where('status',   '==', status);
    const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
    return ok({ tasks: snap.docs.map(d => d.data()), deprecated: true });
  }

  throw httpError(404, 'Unknown route');
}

export default apiHandler(handler);
