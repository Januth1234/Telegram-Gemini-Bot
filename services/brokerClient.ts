/**
 * brokerClient — frontend calls to /api/task-router.
 * (The legacy /api/broker queue was retired; PC tasks flow through the
 * task-router into real executor_jobs on the paired desktop agent.)
 */
import { firebaseService } from './firebaseService';

const ROUTER = '/api/task-router';

async function tok() {
  try { return await (firebaseService as any).getIdToken?.() ?? ''; } catch { return ''; }
}

/** Route + dispatch a task immediately or scheduled (returns a real executor jobId) */
export async function dispatchTask(opts: {
  task: string; params?: object; deviceId?: string;
  scheduleTime?: string; recurrence?: string; preferRoute?: string;
}) {
  const t = await tok();
  const r = await fetch(ROUTER + '/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(opts),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}
