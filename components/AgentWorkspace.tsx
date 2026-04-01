import React, { useState, useRef, useEffect } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { translations } from '../translations';
import { Language, UserAccount } from '../types';
import { cacheService, CacheKey } from '../services/cacheService';

interface AgentWorkspaceProps {
  user: UserAccount | null;
  onClose: () => void;
  lang: Language;
  initialPrompt?: string;
}

interface Step {
  action: string;
  target?: string;
  value?: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ user, onClose, lang, initialPrompt = '' }) => {
  const t = translations[lang];
  const plan = user?.plan?.toLowerCase() ?? '';
  const isPro = plan === 'pro' || plan === 'pro_yearly';
  const isBasic = plan === 'basic' || plan === 'basic_yearly';
  const hasUsedOnce = cacheService.get<boolean>(CacheKey.AGENT_USED_ONCE, false);
  const canUseAgent = isPro || isBasic || !hasUsedOnce;

  const [task, setTask] = useState(initialPrompt);
  const [steps, setSteps] = useState<Step[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (initialPrompt) setTask(initialPrompt);
  }, [initialPrompt]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const planTask = async () => {
    if (!task.trim() || !canUseAgent) return;
    setError(null); setLoading(true); setSteps([]); setSummary(''); setLog([]); setCurrentStep(-1);
    if (!isPro && !isBasic) cacheService.set(CacheKey.AGENT_USED_ONCE, true);
    try {
      addLog('📋 Planning task...');
      const result = await geminiService.agentPlan(task.trim());
      setSummary(result.summary);
      setSteps(result.steps.map(s => ({ ...s, status: 'pending' })));
      addLog('✅ Plan ready: ' + result.steps.length + ' steps');
    } catch (e) {
      const msg = e instanceof AppError ? e.message : (e instanceof Error ? e.message : 'Planning failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const executeSteps = async () => {
    if (steps.length === 0) return;
    setRunning(true);
    stopRef.current = false;

    for (let i = 0; i < steps.length; i++) {
      if (stopRef.current) { addLog('⛔ Stopped by user'); break; }
      const step = steps[i];
      setCurrentStep(i);
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));
      addLog('▶ Step ' + (i + 1) + ': ' + step.description);

      try {
        await executeStep(step);
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
        addLog('✅ Done: ' + step.description);
      } catch (e: any) {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        addLog('❌ Error on step ' + (i + 1) + ': ' + e.message);
      }

      // Small delay between steps so user can see progress
      await new Promise(r => setTimeout(r, 600));
    }
    setRunning(false);
    setCurrentStep(-1);
    addLog('🏁 All steps complete');
  };

  const executeStep = async (step: Step) => {
    switch (step.action) {
      case 'navigate':
        if (step.target) {
          addLog('   🌐 Opening: ' + step.target);
          window.open(step.target, '_blank', 'noopener');
          await new Promise(r => setTimeout(r, 1000));
        }
        break;
      case 'search':
        const query = step.value || step.target || '';
        const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
        addLog('   🔍 Searching: ' + query);
        window.open(searchUrl, '_blank', 'noopener');
        await new Promise(r => setTimeout(r, 1000));
        break;
      case 'click':
        addLog('   👆 Click: ' + step.target + ' (manual: do this in the tab)');
        break;
      case 'type':
        addLog('   ⌨️ Type "' + step.value + '" into ' + step.target + ' (manual: do this in the tab)');
        break;
      case 'wait':
        addLog('   ⏳ Waiting...');
        await new Promise(r => setTimeout(r, 1500));
        break;
      case 'done':
        addLog('   🎉 ' + step.description);
        break;
      default:
        addLog('   ℹ️ ' + step.description);
    }
  };

  const stopExecution = () => { stopRef.current = true; };
  const reset = () => { setSteps([]); setSummary(''); setLog([]); setError(null); setCurrentStep(-1); setTask(''); };

  if (!user) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4">{t.connectToContinue}</p>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">{t.back}</button>
      </div>
    );
  }

  if (!canUseAgent && !isPro && !isBasic) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
          <i className="fa-solid fa-robot text-2xl text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{t.agent}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{t.agentProOnly}</p>
        <div className="flex gap-3">
          <button onClick={() => { window.location.hash = 'pricing'; }} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">{t.pricing}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-widest">{t.back}</button>
        </div>
      </div>
    );
  }

  const stepIcon = (s: Step) => {
    if (s.status === 'running') return <i className="fa-solid fa-circle-notch animate-spin text-indigo-500" />;
    if (s.status === 'done') return <i className="fa-solid fa-check text-green-500" />;
    if (s.status === 'error') return <i className="fa-solid fa-xmark text-red-500" />;
    return <i className="fa-regular fa-circle text-slate-300 dark:text-white/20" />;
  };

  const actionIcon = (action: string) => {
    const m: Record<string, string> = { navigate: 'fa-globe', search: 'fa-magnifying-glass', click: 'fa-arrow-pointer', type: 'fa-keyboard', wait: 'fa-hourglass-half', done: 'fa-flag-checkered' };
    return m[action] || 'fa-gear';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Agent</h1>
            <p className="text-[9px] text-slate-400">Auto-execute browser tasks</p>
          </div>
        </div>
        {steps.length > 0 && (
          <button onClick={reset} className="text-[9px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest">
            <i className="fa-solid fa-rotate-left mr-1" />Reset
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Task input */}
        {steps.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">
              Describe what you want to do. The agent will plan and open the right pages automatically.
            </p>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) planTask(); }}
              placeholder={t.agentTaskPlaceholder}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}
            <button
              onClick={planTask}
              disabled={loading || !task.trim()}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><i className="fa-solid fa-circle-notch animate-spin" />Planning...</> : <><i className="fa-solid fa-robot" />Plan Task</>}
            </button>
          </div>
        )}

        {/* Task summary + steps */}
        {steps.length > 0 && (
          <div className="space-y-3">
            {summary && (
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-robot" />Plan
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">{summary}</p>
              </div>
            )}

            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                  step.status === 'running' ? 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800' :
                  step.status === 'done' ? 'bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30' :
                  step.status === 'error' ? 'bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30' :
                  'bg-slate-50 dark:bg-white/5 border border-transparent'
                }`}>
                  <div className="mt-0.5 w-4 shrink-0 flex justify-center">{stepIcon(step)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <i className={`fa-solid ${actionIcon(step.action)} text-[9px] text-slate-400`} />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{step.action}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{step.description}</p>
                    {step.target && <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">{step.target}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Log */}
            {log.length > 0 && (
              <div ref={logRef} className="rounded-xl bg-slate-900 dark:bg-black/40 p-3 max-h-32 overflow-y-auto space-y-0.5">
                {log.map((l, i) => (
                  <p key={i} className="text-[10px] font-mono text-green-400">{l}</p>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {!running ? (
                <button onClick={executeSteps}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2">
                  <i className="fa-solid fa-play" />Run All Steps
                </button>
              ) : (
                <button onClick={stopExecution}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-colors flex items-center justify-center gap-2">
                  <i className="fa-solid fa-stop" />Stop
                </button>
              )}
              <button onClick={reset}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs font-black hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentWorkspace;
