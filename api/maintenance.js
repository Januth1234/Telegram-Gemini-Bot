/**
 * GET /api/maintenance — scheduled housekeeping (Vercel Cron, daily).
 * Purges data that would otherwise grow forever:
 *   - rate_limits        : windows past their expiry
 *   - executor_nonces    : replay-guard rows older than 7 days (window is 300 s)
 *   - executor_jobs      : FINISHED jobs (done/failed/error) older than 30 days
 *   - executor_pairs     : pair attempts still 'pending' after 24 h (handshake never completed)
 *   - broker_tasks       : legacy queue rows older than 90 days
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 * Also safe to trigger manually with the same header.
 *
 * Env: CRON_SECRET (set in Vercel; vercel.json wires the daily schedule).
 */
import { db, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

export const config = { maxDuration: 60 };

const BATCH = 400;

/** Deletes docs matching field < cutoff (optionally filtered in-memory), batched. */
async function purge(collection, field, cutoffDate, { maxBatches = 25, extraWhere = null, keep = null } = {}) {
  let deleted = 0;
  for (let i = 0; i < maxBatches; i++) {
    let q = db().collection(collection);
    if (extraWhere) q = q.where(...extraWhere);
    const snap = await q.where(field, '<', cutoffDate).limit(BATCH).get();
    if (snap.empty) break;
    const writer = db().bulkWriter();
    let batchDeleted = 0;
    snap.docs.forEach(doc => {
      if (keep && keep(doc.data())) return;
      writer.delete(doc.ref);
      batchDeleted++;
    });
    await writer.close();
    deleted += batchDeleted;
    if (snap.size < BATCH) break;
  }
  return deleted;
}

async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw httpError(500, 'CRON_SECRET not configured');
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${secret}`) throw httpError(401, 'Unauthorized');

  const now = Date.now();
  const d = (msAgo) => new Date(now - msAgo);
  const DAY = 24 * 3600_000;
  const report = {};

  report.rateLimits   = await purge('rate_limits',     'expiresAt', d(DAY));
  report.nonces       = await purge('executor_nonces', 'createdAt', d(7 * DAY));
  report.finishedJobs = await purge('executor_jobs',   'updatedAt', d(30 * DAY), {
    keep: (data) => !['done', 'failed', 'error'].includes(data.status),
  });
  // Pair attempts whose handshake never completed within 24h — ACTIVE ('paired')
  // pairs are never touched. Single-field query + in-memory filter avoids the
  // need for a composite index.
  let stalePairs = 0;
  {
    const snap = await db().collection('executor_pairs').where('status', '==', 'pending').limit(500).get();
    const cutoff = d(DAY);
    const writer = db().bulkWriter();
    snap.docs.forEach(doc => {
      const created = doc.data().createdAt?.toMillis?.() ?? 0;
      if (created > 0 && created < cutoff.getTime()) { writer.delete(doc.ref); stalePairs++; }
    });
    await writer.close();
  }
  report.stalePairs = stalePairs;
  report.legacyBroker = await purge('broker_tasks',   'createdAt', d(90 * DAY));

  return res.status(200).json({ ok: true, ranAt: new Date().toISOString(), purged: report });
}

export default apiHandler(handler);
