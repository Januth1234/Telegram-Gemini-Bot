/**
 * Cloud Broker — queue + relay + scheduler
 * POST /api/broker/queue   — enqueue task
 * POST /api/broker/schedule — schedule task (future time)
 * GET  /api/broker/tasks   — list tasks for device
 * POST /api/broker/cancel  — cancel/pause task
 * POST /api/broker/result  — PC agent posts result back
 * GET  /api/broker/status  — task status
 */
import admin from 'firebase-admin';
if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
  admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : undefined);
}
const db = () => admin.firestore();
const TS = () => admin.firestore.FieldValue.serverTimestamp();

async function verifyUser(req) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  const d = await admin.auth().verifyIdToken(m[1]);
  return d.uid;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.query.path || []).join('/');
  const ok = d => res.status(200).json(d);
  const err = (c, m) => res.status(c).json({ error: m });

  try {
    const uid = await verifyUser(req);

    // ── queue ─────────────────────────────────────────────────────────────
    if (path === 'queue' && req.method === 'POST') {
      const { deviceId, task, params, route = 'pc' } = req.body || {};
      if (!deviceId || !task) return err(400, 'deviceId + task required');
      const id = db().collection('broker_tasks').doc().id;
      await db().collection('broker_tasks').doc(id).set({
        id, uid, deviceId, task, params: params || {}, route,
        status: 'queued', scheduleTime: null, recurrence: null,
        createdAt: TS(), updatedAt: TS(), result: null, error: null,
      });
      return ok({ taskId: id, status: 'queued' });
    }

    // ── schedule ──────────────────────────────────────────────────────────
    if (path === 'schedule' && req.method === 'POST') {
      const { deviceId, task, params, scheduleTime, recurrence = 'none', route = 'pc' } = req.body || {};
      if (!deviceId || !task || !scheduleTime) return err(400, 'deviceId + task + scheduleTime required');
      const id = db().collection('broker_tasks').doc().id;
      await db().collection('broker_tasks').doc(id).set({
        id, uid, deviceId, task, params: params || {}, route,
        status: 'scheduled', scheduleTime: new Date(scheduleTime), recurrence,
        createdAt: TS(), updatedAt: TS(), result: null, error: null,
      });
      return ok({ taskId: id, status: 'scheduled' });
    }

    // ── list tasks ────────────────────────────────────────────────────────
    if (path === 'tasks' && req.method === 'GET') {
      const { deviceId, status } = req.query;
      let q = db().collection('broker_tasks').where('uid', '==', uid);
      if (deviceId) q = q.where('deviceId', '==', deviceId);
      if (status)   q = q.where('status',   '==', status);
      const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
      return ok({ tasks: snap.docs.map(d => d.data()) });
    }

    // ── cancel / pause ────────────────────────────────────────────────────
    if (path === 'cancel' && req.method === 'POST') {
      const { taskId, action = 'cancelled' } = req.body || {};
      if (!taskId) return err(400, 'taskId required');
      const ref = db().collection('broker_tasks').doc(taskId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().uid !== uid) return err(403, 'Forbidden');
      await ref.update({ status: action, updatedAt: TS() });
      return ok({ status: action });
    }

    // ── result (PC agent posts back) ──────────────────────────────────────
    if (path === 'result' && req.method === 'POST') {
      const { taskId, status, result, error: errMsg, progress } = req.body || {};
      if (!taskId) return err(400, 'taskId required');
      const ref = db().collection('broker_tasks').doc(taskId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().uid !== uid) return err(403, 'Forbidden');
      const update = { status: status || 'done', result: result || null, error: errMsg || null, updatedAt: TS() };
      if (progress != null) update.progress = progress;

      // Handle recurrence — reschedule if recurring
      const data = snap.data();
      if (status === 'done' && data.recurrence && data.recurrence !== 'none' && data.scheduleTime) {
        const next = new Date(data.scheduleTime.toDate());
        if (data.recurrence === 'daily')  next.setDate(next.getDate() + 1);
        if (data.recurrence === 'weekly') next.setDate(next.getDate() + 7);
        update.scheduleTime = next;
        update.status = 'scheduled';
      }

      await ref.update(update);
      return ok({ ok: true });
    }

    // ── status ────────────────────────────────────────────────────────────
    if (path === 'status' && req.method === 'GET') {
      const { taskId } = req.query;
      const snap = await db().collection('broker_tasks').doc(taskId).get();
      if (!snap.exists || snap.data().uid !== uid) return err(404, 'Not found');
      return ok(snap.data());
    }

    return err(404, 'Unknown route');
  } catch (e) {
    if (e.code) return res.status(e.code).json({ error: e.message });
    console.error('[broker]', e);
    return err(500, 'Internal error');
  }
}
