/**
 * brokerClient — frontend calls to /api/broker + /api/task-router
 */
import { firebaseService } from './firebaseService';

const BASE = '/api/broker';
const ROUTER = '/api/task-router';

async function tok() {
  try { return await (firebaseService as any).getIdToken?.() ?? ''; } catch { return ''; }
}
async function post(url: string, body: object) {
  const t = await tok();
  const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ...(t?{Authorization:`Bearer ${t}`}:{}) }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(()=>({}))).error || `HTTP ${r.status}`);
  return r.json();
}
async function get(url: string, params: Record<string,string> = {}) {
  const t = await tok();
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${url}${qs?'?'+qs:''}`, { headers: t ? { Authorization:`Bearer ${t}` } : {} });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Route + dispatch a task immediately or scheduled */
export async function dispatchTask(opts: {
  task: string; params?: object; deviceId?: string;
  scheduleTime?: string; recurrence?: string; preferRoute?: string;
}) {
  return post(ROUTER + '/dispatch', opts);
}

/** Queue a task directly to broker (for PC agent polling) */
export async function queueTask(deviceId: string, task: string, params: object = {}) {
  return post(BASE + '/queue', { deviceId, task, params });
}

/** Schedule a task via broker */
export async function scheduleTask(deviceId: string, task: string, params: object, scheduleTime: string, recurrence = 'none') {
  return post(BASE + '/schedule', { deviceId, task, params, scheduleTime, recurrence });
}

/** List tasks for device */
export async function listTasks(deviceId?: string, status?: string) {
  return get(BASE + '/tasks', { ...(deviceId?{deviceId}:{}), ...(status?{status}:{}) });
}

/** Cancel or pause a task */
export async function cancelTask(taskId: string, action: 'cancelled'|'paused' = 'cancelled') {
  return post(BASE + '/cancel', { taskId, action });
}

/** Poll task status */
export async function getTaskStatus(taskId: string) {
  return get(BASE + '/status', { taskId });
}
