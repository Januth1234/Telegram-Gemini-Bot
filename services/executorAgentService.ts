/**
 * executorAgentService — client-side calls to the Executor HTTP API.
 * Base URL comes from VITE_EXECUTOR_HTTP_BASE_URL env var.
 * All user routes require a Firebase ID token (fetched from firebaseService).
 */
import { firebaseService } from './firebaseService';

export interface PlanOption {
  id: number;
  title: string;
  desc: string;
}

const BASE = (() => {
  const raw = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_EXECUTOR_HTTP_BASE_URL) || '';
  return raw.replace(/\/$/, '');
})();

export function isExecutorConfigured(): boolean {
  return BASE.length > 0;
}

async function idToken(): Promise<string> {
  try {
    return await (firebaseService as any).getIdToken?.() ?? '';
  } catch { return ''; }
}

async function post<T = any>(path: string, body: object): Promise<T> {
  const token = await idToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function get<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await idToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? '?' + qs : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Start a pairing handshake — returns pair_id and pair_code to show the user */
export async function executorPair(agentType: 'pc' | 'extension' = 'pc') {
  return post<{ pair_id: string; pair_code: string }>('/pair', { agent_type: agentType });
}

/** Check if a paired PC agent is online */
export async function executorPairStatus(pairId: string) {
  return get<{ pair_id: string; pair_status: string; agent_online: boolean; last_agent_ping_ms: number | null }>(
    '/pair/status', { pair_id: pairId }
  );
}

/** Get creative idea suggestions for a topic */
export async function executorIdeas(topic: string): Promise<string[]> {
  const data = await get<{ ideas: string[] }>('/ideas', { topic });
  return data.ideas ?? [];
}

/** Get plan options for a topic */
export async function executorPlan(topic: string): Promise<PlanOption[]> {
  const data = await post<{ options: PlanOption[] }>('/plan', { topic });
  return data.options ?? [];
}

/** Dispatch a task to the PC agent via the cloud queue */
export async function executorExecute(
  pairId: string,
  task: string,
  params: Record<string, any> = {}
): Promise<{ job_id: string; status: string }> {
  const nonce = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
  const timestamp = Math.floor(Date.now() / 1000);
  return post('/execute', { pair_id: pairId, task, params, nonce, timestamp });
}

/** Poll job status */
export async function executorJobStatus(jobId: string) {
  return get<{ job_id: string; status: string; progress: number; error: string | null; result: any }>(
    '/status', { job_id: jobId }
  );
}
