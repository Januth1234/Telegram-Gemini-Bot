/**
 * Task Router — selects execution mode per task type.
 * POST /api/task-router/dispatch
 * Routes: dom/web → browser ext | os/file → PC agent | remote/offline → broker | research → browser AI
 */
import admin from 'firebase-admin';
if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : null;
  admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : undefined);
}
const db = () => admin.firestore();
const TS = () => admin.firestore.FieldValue.serverTimestamp();

// Route classification
const ROUTES = {
  // Browser extension (DOM tasks)
  browser: ['click','type','navigate','scroll','screenshot','extract','fill','search_dom'],
  // PC agent (OS/file tasks)
  pc: ['create_ppt','create_doc','run_command','open_app','type_text','spotify','custom','create_file','screenshot_desktop'],
  // Research / complex thinking
  research: ['web_research','summarize','compare_ai','deep_search'],
};

function classify(task) {
  for (const [route, tasks] of Object.entries(ROUTES)) {
    if (tasks.includes(task)) return route;
  }
  return 'pc'; // default
}

async function verifyUser(req) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  return (await admin.auth().verifyIdToken(m[1])).uid;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const uid = await verifyUser(req);
    const { task, params = {}, deviceId, scheduleTime, recurrence, preferRoute } = req.body || {};
    if (!task) return res.status(400).json({ error: 'task required' });

    const route = preferRoute || classify(task);
    const jobId = db().collection('task_dispatch').doc().id;

    // Log the dispatch
    await db().collection('task_dispatch').doc(jobId).set({
      jobId, uid, task, params, route, deviceId: deviceId || null,
      scheduleTime: scheduleTime ? new Date(scheduleTime) : null,
      recurrence: recurrence || 'none',
      status: scheduleTime ? 'scheduled' : 'dispatched',
      createdAt: TS(),
    });

    // If scheduled — push to broker
    if (scheduleTime && deviceId) {
      await fetch(`${process.env.VERCEL_URL || 'https://orinai.org'}/api/broker/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
        body: JSON.stringify({ deviceId, task, params, scheduleTime, recurrence, route }),
      }).catch(() => {});
    }

    return res.status(200).json({ jobId, route, status: scheduleTime ? 'scheduled' : 'dispatched',
      message: `Task routed to: ${route}` });
  } catch (e) {
    if (e.code) return res.status(e.code).json({ error: e.message });
    console.error('[task-router]', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
