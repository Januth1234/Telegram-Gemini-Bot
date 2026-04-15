/**
 * ExecutorControllerPage — Phone/Mobile controller for the PC Desktop Agent.
 * User pairs their PC once using a 6-char code, then dispatches tasks from
 * any device (phone, tablet, other PC). The Python agent on their PC picks
 * up the queued job, executes it, and reports back status in real time.
 *
 * Supports: create_ppt, run_command, open_app, type_text, screenshot,
 *           web_search, create_doc, custom (free-form shell command)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Language } from '../types';
import {
  executorExecute, executorIdeas, executorJobStatus,
  executorPair, executorPairStatus, executorPlan,
  PlanOption,
} from '../services/executorAgentService';
import { getAppShellKind } from '../services/appShellContext';

interface ExecutorControllerPageProps {
  onClose: () => void;
  lang: Language;
  embedded?: boolean;
  onActivate?: () => void;
}

interface JobRecord {
  job_id: string;
  task: string;
  label: string;
  status: string;
  progress: number;
  result?: any;
  error?: string | null;
  createdAt: number;
}

const TASK_TYPES = [
  { id: 'create_ppt',  icon: 'fa-file-powerpoint', label: 'Create Presentation', color: 'text-orange-500', hint: 'AI creates a PowerPoint on your PC' },
  { id: 'create_doc',  icon: 'fa-file-word',       label: 'Create Document',    color: 'text-blue-500',   hint: 'Create a Word document with AI content' },
  { id: 'run_command', icon: 'fa-terminal',         label: 'Run Command',        color: 'text-green-500',  hint: 'Execute a terminal/shell command' },
  { id: 'open_app',    icon: 'fa-window-maximize',  label: 'Open App',           color: 'text-purple-500', hint: 'Launch any application on the PC' },
  { id: 'type_text',   icon: 'fa-keyboard',         label: 'Type Text',          color: 'text-cyan-500',   hint: 'Type text at the current cursor position' },
  { id: 'screenshot',  icon: 'fa-camera',           label: 'Screenshot',         color: 'text-rose-500',   hint: 'Take a screenshot and show it here' },
  { id: 'web_search',  icon: 'fa-magnifying-glass', label: 'Web Search',         color: 'text-indigo-500', hint: 'Search Google and open results on PC' },
  { id: 'custom',      icon: 'fa-code',             label: 'Custom Task',        color: 'text-amber-500',  hint: 'Run any Python command via the agent' },
] as const;

type TaskId = typeof TASK_TYPES[number]['id'];

const STATUS_COLORS: Record<string, string> = {
  queued:   'text-amber-500',
  running:  'text-indigo-500',
  done:     'text-emerald-500',
  error:    'text-red-500',
  failed:   'text-red-500',
};
const STATUS_ICONS: Record<string, string> = {
  queued:  'fa-clock',
  running: 'fa-circle-notch',
  done:    'fa-check-circle',
  error:   'fa-circle-xmark',
  failed:  'fa-circle-xmark',
};

const ExecutorControllerPage: React.FC<ExecutorControllerPageProps> = ({
  onClose, lang, embedded = false, onActivate,
}) => {
  // ── Pairing ──────────────────────────────────────────────────────────────
  const [pairId,    setPairId]    = useState<string | null>(() => localStorage.getItem('orin_exec_pair_id'));
  const [pairCode,  setPairCode]  = useState<string | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [pairing,   setPairing]   = useState(false);

  // ── Task dispatch ─────────────────────────────────────────────────────────
  const [taskType,  setTaskType]  = useState<TaskId>('create_ppt');
  const [taskInput, setTaskInput] = useState('');        // main text input
  const [busy,      setBusy]      = useState<string | null>(null);
  const [err,       setErr]       = useState<string | null>(null);

  // ── Creative AI helpers (for create_ppt / create_doc) ────────────────────
  const [ideas,        setIdeas]        = useState<string[]>([]);
  const [plans,        setPlans]        = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [showAI,       setShowAI]       = useState(false);

  // ── Job history ───────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const shell = getAppShellKind();

  // ── Pair status polling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!pairId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const st = await executorPairStatus(pairId);
        if (!cancelled) setAgentOnline(st.agent_online);
      } catch { if (!cancelled) setAgentOnline(null); }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pairId]);

  // ── Start pairing ─────────────────────────────────────────────────────────
  const startPair = useCallback(async () => {
    setPairing(true); setErr(null);
    try {
      const p = await executorPair('pc');
      setPairId(p.pair_id); setPairCode(p.pair_code);
      localStorage.setItem('orin_exec_pair_id', p.pair_id);
    } catch (e: any) { setErr(e?.message || 'Pairing failed'); }
    finally { setPairing(false); }
  }, []);

  const unpair = () => {
    setPairId(null); setPairCode(null); setAgentOnline(null);
    localStorage.removeItem('orin_exec_pair_id');
  };

  // ── Dispatch a task ───────────────────────────────────────────────────────
  const dispatch = useCallback(async () => {
    if (!pairId) { setErr('Pair your PC first.'); return; }
    if (!taskInput.trim() && taskType !== 'screenshot') { setErr('Enter a task description.'); return; }
    setErr(null); setBusy('Queuing task…');

    // Build params based on task type
    const params: Record<string, any> = {};
    switch (taskType) {
      case 'create_ppt':
        params.title    = taskInput || selectedPlan?.title || 'Presentation';
        params.subtitle = 'Created by Orin AI';
        params.points   = selectedPlan ? [selectedPlan.desc] : [taskInput];
        if (selectedPlan) params.direction = selectedPlan.title;
        break;
      case 'create_doc':
        params.title   = taskInput;
        params.content = selectedPlan?.desc || taskInput;
        break;
      case 'run_command':
        params.command = taskInput;
        break;
      case 'open_app':
        params.app = taskInput;
        break;
      case 'type_text':
        params.text = taskInput;
        break;
      case 'screenshot':
        params.filename = `screenshot-${Date.now()}.png`;
        break;
      case 'web_search':
        params.query = taskInput;
        break;
      case 'custom':
        params.code = taskInput;
        break;
    }

    try {
      const { job_id } = await executorExecute(pairId, taskType, params);
      const label = TASK_TYPES.find(t => t.id === taskType)?.label || taskType;
      const record: JobRecord = {
        job_id, task: taskType, label: `${label}: ${taskInput.slice(0,40) || taskType}`,
        status: 'queued', progress: 0, createdAt: Date.now(),
      };
      setJobs(prev => [record, ...prev]);
      setTaskInput(''); setSelectedPlan(null); setShowAI(false);
      pollJobStatus(job_id);
    } catch (e: any) { setErr(e?.message || 'Dispatch failed'); }
    finally { setBusy(null); }
  }, [pairId, taskType, taskInput, selectedPlan]);

  // ── Poll a specific job until done ────────────────────────────────────────
  const pollJobStatus = useCallback((jobId: string) => {
    const tick = async () => {
      try {
        const s = await executorJobStatus(jobId);
        setJobs(prev => prev.map(j => j.job_id === jobId ? {
          ...j, status: s.status, progress: s.progress ?? j.progress,
          result: s.result ?? j.result, error: s.error,
        } : j));
        if (s.status === 'queued' || s.status === 'running') {
          const t = setTimeout(tick, 2000);
          pollTimers.current.set(jobId, t);
        } else { pollTimers.current.delete(jobId); }
      } catch {
        const t = setTimeout(tick, 5000);
        pollTimers.current.set(jobId, t);
      }
    };
    tick();
  }, []);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, []);

  // ── AI helpers ────────────────────────────────────────────────────────────
  const loadIdeas = async () => {
    if (!taskInput.trim()) return;
    setBusy('Getting ideas…');
    try { setIdeas(await executorIdeas(taskInput)); } catch {}
    finally { setBusy(null); }
  };

  const loadPlans = async () => {
    if (!taskInput.trim()) return;
    setBusy('Planning…');
    try { setPlans(await executorPlan(taskInput)); } catch {}
    finally { setBusy(null); }
  };

  const taskDef = TASK_TYPES.find(t => t.id === taskType)!;
  const needsAI = taskType === 'create_ppt' || taskType === 'create_doc';

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">

      {/* Header */}
      {!embedded && (
        <header className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-white/10">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-colors">
            <i className="fa-solid fa-arrow-left text-sm" />
          </button>
          <div className="text-center">
            <h1 className="text-xs font-black uppercase tracking-widest">PC Agent</h1>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${agentOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-400'}`} />
              <p className="text-[9px] text-slate-400">{agentOnline ? 'PC online' : pairId ? 'Waiting for PC...' : 'Not paired'}</p>
            </div>
          </div>
          <div className="w-9" />
        </header>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 max-w-lg mx-auto pb-8">

          {err && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-bold">
              {err}
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
              <i className="fa-solid fa-circle-notch animate-spin" />{busy}
            </div>
          )}

          {/* ── PAIRING CARD ── */}
          {!pairId ? (
            <div className="p-5 rounded-2xl bg-slate-900 dark:bg-black/60 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center">
                  <i className="fa-solid fa-laptop text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Pair your PC</p>
                  <p className="text-[10px] text-slate-400">Run the Orin PC Agent on your computer</p>
                </div>
              </div>
              <ol className="space-y-2 text-xs text-slate-400 leading-relaxed">
                <li className="flex gap-2"><span className="text-indigo-400 font-black">1.</span> Download &amp; run <code className="text-indigo-300">orin-pc-agent.py</code> on your PC</li>
                <li className="flex gap-2"><span className="text-indigo-400 font-black">2.</span> Click "Generate code" below</li>
                <li className="flex gap-2"><span className="text-indigo-400 font-black">3.</span> Enter the 6-char code in the PC agent terminal</li>
                <li className="flex gap-2"><span className="text-indigo-400 font-black">4.</span> Your PC is paired — send tasks from anywhere</li>
              </ol>
              <div className="flex gap-2">
                <a href="/orin-pc-agent.py" download
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5">
                  <i className="fa-solid fa-download text-[10px]" /> Download Agent
                </a>
                <button onClick={startPair} disabled={pairing}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {pairing ? <><i className="fa-solid fa-circle-notch animate-spin" /> Pairing…</> : <><i className="fa-solid fa-link" /> Generate Code</>}
                </button>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border transition-all ${agentOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-50 dark:bg-white/3 border-slate-200 dark:border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 animate-pulse'}`} />
                  <p className={`text-xs font-black ${agentOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {agentOnline ? 'PC Agent online — ready' : 'Waiting for PC agent...'}
                  </p>
                </div>
                <button onClick={unpair} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest">Unpair</button>
              </div>
              {!agentOnline && (
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Run <code className="text-indigo-500">python orin-pc-agent.py</code> on your PC to connect.
                  Tasks you send will queue and run automatically when it comes online.
                </p>
              )}
              {pairCode && (
                <div className="mt-3 p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Enter this code in the PC agent</p>
                  <p className="text-2xl font-black font-mono tracking-[0.3em] text-slate-900 dark:text-white">{pairCode}</p>
                </div>
              )}
            </div>
          )}

          {/* ── TASK TYPE SELECTOR ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">What to do on your PC</p>
            <div className="grid grid-cols-4 gap-1.5">
              {TASK_TYPES.map(t => (
                <button key={t.id} onClick={() => { setTaskType(t.id); setShowAI(false); setPlans([]); setIdeas([]); setSelectedPlan(null); }}
                  title={t.hint}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
                    taskType === t.id
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/3 hover:border-slate-300'}`}>
                  <i className={`fa-solid ${t.icon} text-sm ${taskType === t.id ? t.color : 'text-slate-400'}`} />
                  <span className={`text-[8px] font-black uppercase leading-tight ${taskType === t.id ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {t.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-1.5 px-0.5">{taskDef.hint}</p>
          </div>

          {/* ── TASK INPUT ── */}
          {taskType !== 'screenshot' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {taskType === 'run_command' ? 'Command (e.g. notepad, calc, dir)' :
                 taskType === 'open_app' ? 'App name (e.g. Chrome, Spotify, Excel)' :
                 taskType === 'type_text' ? 'Text to type at cursor' :
                 taskType === 'web_search' ? 'Search query' :
                 taskType === 'custom' ? 'Python code to run on PC' :
                 'Topic or description'}
              </label>
              <div className="flex gap-2">
                <textarea
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) dispatch(); }}
                  placeholder={
                    taskType === 'create_ppt' ? 'e.g. AI in Healthcare, Climate Change, 2025 Marketing Strategy' :
                    taskType === 'create_doc' ? 'e.g. Business proposal for a coffee shop' :
                    taskType === 'run_command' ? 'e.g. notepad\ne.g. dir C:\\' :
                    taskType === 'open_app' ? 'e.g. Spotify\ne.g. Google Chrome' :
                    taskType === 'type_text' ? 'Text to type at the current cursor position...' :
                    taskType === 'web_search' ? 'e.g. latest AI news' :
                    taskType === 'custom' ? 'e.g. import webbrowser; webbrowser.open("https://orinai.org")' :
                    'Describe the task...'
                  }
                  rows={taskType === 'custom' ? 4 : 2}
                  className="flex-1 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* ── AI HELPERS (for presentation / doc) ── */}
          {needsAI && taskInput.trim() && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => { setShowAI(true); loadIdeas(); }}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5">
                  <i className="fa-solid fa-lightbulb text-amber-500" /> Ideas
                </button>
                <button onClick={() => { setShowAI(true); loadPlans(); }}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5">
                  <i className="fa-solid fa-wand-magic-sparkles" /> Plan with AI
                </button>
              </div>

              {showAI && ideas.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quick ideas — click to use</p>
                  {ideas.map((idea, i) => (
                    <button key={i} onClick={() => setTaskInput(idea)}
                      className="w-full text-left text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-slate-600 dark:text-slate-300">
                      {idea}
                    </button>
                  ))}
                </div>
              )}

              {showAI && plans.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pick a direction</p>
                  {plans.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlan(p)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedPlan?.id === p.id
                          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-white/10 hover:border-indigo-300'}`}>
                      <p className="text-xs font-black text-slate-900 dark:text-white">{p.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SEND BUTTON ── */}
          <button onClick={dispatch}
            disabled={!!busy || (!pairId) || (taskType !== 'screenshot' && !taskInput.trim())}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
            <i className={`fa-solid ${taskDef.icon}`} />
            {busy || `Send to PC — ${taskDef.label}`}
          </button>

          {/* ── JOB HISTORY ── */}
          {jobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <i className="fa-solid fa-list-check" /> Recent Jobs
              </p>
              {jobs.map(job => (
                <div key={job.job_id} className={`p-3 rounded-xl border ${
                  job.status === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' :
                  job.status === 'error' || job.status === 'failed' ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30' :
                  job.status === 'running' ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' :
                  'bg-slate-50 dark:bg-white/3 border-slate-200 dark:border-white/10'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{job.label}</p>
                      {job.result?.message && (
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{job.result.message}</p>
                      )}
                      {job.error && (
                        <p className="text-[10px] text-red-500 mt-0.5 truncate">{job.error}</p>
                      )}
                      {job.result?.screenshot_url && (
                        <img src={job.result.screenshot_url} alt="Screenshot" className="mt-2 w-full rounded-lg max-h-32 object-cover" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <i className={`fa-solid ${STATUS_ICONS[job.status] || 'fa-clock'} text-sm ${STATUS_COLORS[job.status] || 'text-slate-400'} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                      <span className={`text-[9px] font-black uppercase ${STATUS_COLORS[job.status] || 'text-slate-400'}`}>{job.status}</span>
                    </div>
                  </div>
                  {job.status === 'running' && job.progress > 0 && (
                    <div className="mt-2 h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── SHELL CONTEXT NOTE ── */}
          {shell !== 'browser' && (
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-[10px] text-indigo-700 dark:text-indigo-300">
              {shell === 'desktop' ? '🖥️ Desktop shell: browser tasks use the extension, OS tasks route through the PC agent.' :
               '📱 Mobile shell: you\'re the controller — tasks run on your paired PC.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutorControllerPage;
