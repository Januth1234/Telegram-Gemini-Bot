/**
 * TaskScheduler — create/view/manage scheduled PC tasks.
 * Stores in Firestore via executor API. Polls pair status.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { executorExecute, executorJobStatus } from '../services/executorAgentService';

interface ScheduledTask {
  id: string;
  label: string;
  task: string;
  params: Record<string, any>;
  status: string;
  scheduleTime: number;  // epoch ms
  recurrence: string;    // none|daily|weekly
  createdAt: number;
}

const STORE_KEY = 'orin_scheduled_tasks';

function loadTasks(): ScheduledTask[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function saveTasks(tasks: ScheduledTask[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
}

const TASK_OPTS = [
  { id:'create_ppt',  label:'Create Presentation' },
  { id:'create_doc',  label:'Create Document' },
  { id:'run_command', label:'Run Command' },
  { id:'open_app',    label:'Open App' },
  { id:'screenshot',  label:'Screenshot' },
  { id:'web_search',  label:'Web Search' },
  { id:'custom',      label:'Custom Code' },
];

const TaskScheduler: React.FC<{ pairId: string | null }> = ({ pairId }) => {
  const [tasks, setTasks]         = useState<ScheduledTask[]>(loadTasks);
  const [creating, setCreating]   = useState(false);
  const [taskType, setTaskType]   = useState('create_ppt');
  const [taskInput, setTaskInput] = useState('');
  const [scheduleTime, setST]     = useState('');
  const [recurrence, setRecur]    = useState<'none'|'daily'|'weekly'>('none');
  const [busy, setBusy]           = useState(false);

  // Dispatch due tasks
  useEffect(() => {
    if (!pairId) return;
    const tick = setInterval(async () => {
      const now = Date.now();
      const pending = loadTasks().filter(t => t.status === 'approved' && t.scheduleTime <= now);
      for (const t of pending) {
        try {
          const { job_id } = await executorExecute(pairId, t.task, t.params);
          updateTask(t.id, { status: 'queued', id: job_id });
        } catch {}
      }
    }, 30000); // check every 30s
    return () => clearInterval(tick);
  }, [pairId]);

  const updateTask = (id: string, patch: Partial<ScheduledTask>) => {
    const updated = loadTasks().map(t => t.id === id ? { ...t, ...patch } : t);
    saveTasks(updated); setTasks(updated);
  };

  const addTask = () => {
    if (!taskInput.trim() || !scheduleTime) return;
    setBusy(true);
    const t: ScheduledTask = {
      id: Math.random().toString(36).slice(2),
      label: `${TASK_OPTS.find(o=>o.id===taskType)?.label}: ${taskInput.slice(0,40)}`,
      task: taskType,
      params: taskType === 'run_command' ? { command: taskInput } :
              taskType === 'open_app'    ? { app: taskInput } :
              taskType === 'custom'      ? { code: taskInput } :
              taskType === 'web_search'  ? { query: taskInput } :
              taskType === 'screenshot'  ? {} :
              { title: taskInput },
      status: 'approved',
      scheduleTime: new Date(scheduleTime).getTime(),
      recurrence,
      createdAt: Date.now(),
    };
    const updated = [t, ...loadTasks()];
    saveTasks(updated); setTasks(updated);
    setCreating(false); setTaskInput(''); setST(''); setBusy(false);
  };

  const deleteTask = (id: string) => {
    const updated = loadTasks().filter(t => t.id !== id);
    saveTasks(updated); setTasks(updated);
  };

  const statusColor: Record<string, string> = {
    approved:'text-indigo-500', queued:'text-amber-500', running:'text-blue-500',
    done:'text-emerald-500', failed:'text-red-500', cancelled:'text-slate-400',
  };

  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle:'short', timeStyle:'short' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-slate-400">Schedule PC tasks to run at a specific time from any device.</p>
        <button onClick={() => setCreating(true)}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500">
          + New
        </button>
      </div>

      {!pairId && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-600 font-bold">
          ⚠️ Pair a PC first in the Desktop Agent tab to dispatch scheduled tasks.
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 space-y-3">
          <select value={taskType} onChange={e => setTaskType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400">
            {TASK_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <textarea value={taskInput} onChange={e => setTaskInput(e.target.value)}
            placeholder="Task description / command / topic..."
            rows={2} className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none" />
          <input type="datetime-local" value={scheduleTime} onChange={e => setST(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <div className="flex gap-2">
            {(['none','daily','weekly'] as const).map(r => (
              <button key={r} onClick={() => setRecur(r)}
                className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                  recurrence===r ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} disabled={busy}
              className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-50">
              Schedule
            </button>
            <button onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-500 text-[10px] font-black">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 && !creating && (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/3 border border-dashed border-slate-200 dark:border-white/10 text-center">
          <i className="fa-regular fa-clock text-2xl text-slate-300 dark:text-white/10 mb-2 block" />
          <p className="text-[10px] text-slate-400">No scheduled tasks</p>
        </div>
      )}
      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/10">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-white truncate">{t.label}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] font-black uppercase ${statusColor[t.status] || 'text-slate-400'}`}>{t.status}</span>
                <span className="text-[9px] text-slate-400">· {fmt(t.scheduleTime)}</span>
                {t.recurrence !== 'none' && <span className="text-[9px] text-indigo-400">{t.recurrence}</span>}
              </div>
            </div>
            <button onClick={() => deleteTask(t.id)} className="text-slate-300 hover:text-red-500 shrink-0 mt-0.5">
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskScheduler;
