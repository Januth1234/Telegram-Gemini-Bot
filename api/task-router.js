/**
 * POST /api/task-router/dispatch
 * Routes a task and, for PC-routed tasks, enqueues a REAL executor job so the
 * paired desktop agent picks it up (previously this only wrote a log entry and
 * nothing ever executed the task).
 *
 * Routes:
 *   browser  → handled by the browser extension (page-driven); logged here
 *   research → handled client-side; logged here
 *   pc       → executor_jobs queue consumed by the paired Python agent
 */
import crypto from 'crypto';
import { db, TS, requireUser, httpError } from './_lib/firebase.js';
import { apiHandler } from './_lib/http.js';

// Route classification
const ROUTES = {
  browser: ['click','type','navigate','scroll','screenshot','extract','fill','search_dom'],
  pc: ['create_ppt','create_doc','run_command','open_app','type_text','spotify','custom','create_file','screenshot_desktop'],
  research: ['web_research','summarize','compare_ai','deep_search'],
};

function classify(task) {
  for (const [route, tasks] of Object.entries(ROUTES)) {
    if (tasks.includes(task)) return route;
  }
  return 'pc'; // default
}

async function handler(req, res) {
  if (req.method !== 'POST') throw httpError(405, 'POST only');

  const decoded = await requireUser(req);
  const uid = decoded.uid;
  const { task, params = {}, deviceId, scheduleTime, recurrence, preferRoute } = req.body || {};
  if (!task) throw httpError(400, 'task required');

  const route = preferRoute || classify(task);
  const dispatchRef = db().collection('task_dispatch').doc();

  const result = {
    jobId: dispatchRef.id,
    route,
    status: scheduleTime ? 'scheduled' : 'dispatched',
    message: `Task routed to: ${route}`,
  };

  // ── PC route → enqueue on the real executor pipeline ────────────────────────
  let executorJobId = null;
  if (route === 'pc' && deviceId) {
    const pairSnap = await db().collection('executor_pairs').doc(String(deviceId)).get();
    if (!pairSnap.exists) throw httpError(404, 'Unknown device pair');
    const pair = pairSnap.data();
    if (pair.userId !== uid) throw httpError(403, 'Forbidden');
    if (pair.status !== 'paired') throw httpError(409, 'Device is not paired/active');

    executorJobId = crypto.randomBytes(16).toString('hex');
    await db().collection('executor_jobs').doc(executorJobId).set({
      userId: uid,
      pairId: String(deviceId),
      task,
      params: params || {},
      nonce: null,            // server-initiated dispatch; replay window applies at API level
      timestamp: Math.floor(Date.now() / 1000),
      notBefore: scheduleTime ? new Date(scheduleTime) : null,  // agent skips until due
      recurrence: recurrence || 'none',
      source: 'task-router',
      status: 'queued',
      progress: 0,
      canonical: null,
      serverSig: null,
      createdAt: TS(),
      updatedAt: TS(),
    });
    result.jobId = executorJobId;
    result.executorJobId = executorJobId;
    result.status = 'queued';
  }

  // Audit log of the dispatch decision
  await dispatchRef.set({
    jobId: dispatchRef.id,
    executorJobId,
    uid, task, params, route,
    deviceId: deviceId || null,
    scheduleTime: scheduleTime ? new Date(scheduleTime) : null,
    recurrence: recurrence || 'none',
    status: scheduleTime ? 'scheduled' : 'dispatched',
    createdAt: TS(),
  });

  return res.status(200).json(result);
}

export default apiHandler(handler);
