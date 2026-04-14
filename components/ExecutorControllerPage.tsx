import React, { useCallback, useEffect, useState } from 'react';
import { Language } from '../types';
import {
  executorExecute,
  executorIdeas,
  executorJobStatus,
  executorPair,
  executorPairStatus,
  executorPlan,
  isExecutorConfigured,
  PlanOption,
} from '../services/executorAgentService';
import { getAppShellKind } from '../services/appShellContext';

interface ExecutorControllerPageProps {
  onClose: () => void;
  lang: Language;
  embedded?: boolean;
  onActivate?: () => void;
}

const ExecutorControllerPage: React.FC<ExecutorControllerPageProps> = ({ onClose, lang, embedded = false, onActivate }) => {
  const [topic, setTopic] = useState('AI trends');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);

  const configured = isExecutorConfigured();
  const shell = getAppShellKind();

  const loadIdeas = useCallback(async () => {
    setErr(null);
    setBusy(lang === 'si' ? 'ලෝඩ් වෙමින්…' : 'Loading…');
    try {
      const list = await executorIdeas(topic);
      setIdeas(list);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load ideas');
    } finally {
      setBusy(null);
    }
  }, [topic, lang]);

  const loadPlan = useCallback(async () => {
    setErr(null);
    setBusy(lang === 'si' ? 'සැලසුම් කරමින්…' : 'Planning…');
    try {
      const opts = await executorPlan(topic);
      setPlans(opts);
      setSelectedPlan(null);
    } catch (e: any) {
      setErr(e?.message || 'Failed to plan');
    } finally {
      setBusy(null);
    }
  }, [topic, lang]);

  const startPair = useCallback(async () => {
    setErr(null);
    setBusy(lang === 'si' ? 'යුගලනය…' : 'Pairing…');
    try {
      const p = await executorPair('pc');
      setPairId(p.pair_id);
      setPairCode(p.pair_code);
    } catch (e: any) {
      setErr(e?.message || 'Pair failed');
    } finally {
      setBusy(null);
    }
  }, [lang]);

  const sendExecute = useCallback(async () => {
    if (!pairId || !selectedPlan) {
      setErr('Pick a plan and pair a PC agent first.');
      return;
    }
    setErr(null);
    setBusy(lang === 'si' ? 'යවමින්…' : 'Sending…');
    try {
      const { job_id } = await executorExecute(pairId, 'create_ppt', {
        title: selectedPlan.title,
        subtitle: topic,
        points: [selectedPlan.desc, `Direction: ${selectedPlan.title}`],
      });
      setJobId(job_id);
      setJobStatus('queued');
    } catch (e: any) {
      setErr(e?.message || 'Execute failed');
    } finally {
      setBusy(null);
    }
  }, [pairId, selectedPlan, topic, lang]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await executorJobStatus(jobId);
        if (cancelled) return;
        setJobStatus(s.status);
        if (s.status === 'queued' || s.status === 'running') {
          window.setTimeout(tick, 2000);
        }
      } catch {
        if (!cancelled) window.setTimeout(tick, 4000);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (!pairId || !configured) {
      setAgentOnline(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const st = await executorPairStatus(pairId);
        if (cancelled) return;
        setAgentOnline(st.agent_online);
      } catch {
        if (!cancelled) setAgentOnline(null);
      }
    };
    poll();
    const id = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pairId, configured]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white/90 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100">
      {!embedded && <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 tap-target"
        >
          ← {lang === 'si' ? 'ආපසු' : 'Back'}
        </button>
        <h2 className="text-xs font-black uppercase tracking-widest">PC Agent</h2>
        <span className="w-10" />
      </header>}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-lg mx-auto w-full pb-24">
        {shell !== 'browser' && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-900 dark:text-indigo-100">
            {shell === 'desktop'
              ? 'Desktop app: this WebView is the live website. OS tasks use the PC agent + cloud broker; the browser extension is only for tasks inside the browser tab.'
              : 'Mobile app: controller only — execution runs on your paired PC through the broker queue.'}
          </div>
        )}

        {!configured && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
            Set <code className="text-xs">VITE_EXECUTOR_HTTP_BASE_URL</code> to your deployed{' '}
            <code className="text-xs">executorHttp</code> function URL, then rebuild the web app.
          </div>
        )}

        {err && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">{err}</div>
        )}
        {busy && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 animate-pulse">{busy}</p>}

        <section className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            placeholder="e.g. AI Trends"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadIdeas}
              disabled={!configured || !!busy}
              className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Inspiration
            </button>
            <button
              type="button"
              onClick={loadPlan}
              disabled={!configured || !!busy}
              className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Plan options
            </button>
          </div>
        </section>

        {ideas.length > 0 && (
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Ideas</h3>
            <ul className="space-y-1 text-sm">
              {ideas.map((idea, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="text-left w-full rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5"
                    onClick={() => setTopic(idea)}
                  >
                    {idea}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {plans.length > 0 && (
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Pick a direction</h3>
            <div className="space-y-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                    selectedPlan?.id === p.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-200 dark:border-white/10 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="font-bold text-sm">{p.title}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{p.desc}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2 rounded-2xl border border-slate-200 dark:border-white/10 p-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pair PC</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Run the Python agent on your computer, then enter the code it asks for (or enter this code in the agent after it shows the prompt).
          </p>
          <button
            type="button"
            onClick={startPair}
            disabled={!configured || !!busy}
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            Generate pair code
          </button>
          {pairCode && pairId && (
            <div className="mt-3 rounded-xl bg-slate-100 dark:bg-white/5 p-4 text-center space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Code for PC agent</div>
              <div className="text-3xl font-black tracking-[0.2em] font-mono">{pairCode}</div>
              <div className="text-[9px] text-slate-500 break-all">pair_id: {pairId}</div>
              {configured && agentOnline !== null && (
                <div
                  className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${agentOnline ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                  {agentOnline ? 'Agent online (broker)' : 'Agent offline — tasks will queue until the PC agent runs'}
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <button
            type="button"
            onClick={sendExecute}
            disabled={!configured || !pairId || !selectedPlan || !!busy}
            className="w-full py-3 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            Send to PC (create_ppt)
          </button>
          {jobId && (
            <p className="mt-2 text-center text-xs text-slate-600 dark:text-slate-400">
              Job <span className="font-mono">{jobId.slice(0, 8)}…</span> —{' '}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{jobStatus}</span>
            </p>
          )}
        </section>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          Browser extension automation is unchanged. This flow targets the desktop agent via the cloud queue. LAN direct mode can target the same signed payloads on a local Flask port in a future iteration.
        </p>
      </div>
    </div>
  );
};

export default ExecutorControllerPage;
