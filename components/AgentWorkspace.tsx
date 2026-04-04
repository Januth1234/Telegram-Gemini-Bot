/**
 * AgentWorkspace — AI agent that takes over browser tasks.
 * Plans steps with Gemini, executes them: opens tabs, copies values to clipboard,
 * takes screenshots via Screen Capture API, feeds them back to Gemini for next step.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService, AppError } from '../services/geminiService';
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
  instruction?: string; // what the user should do manually if needed
  status: 'pending' | 'running' | 'done' | 'error' | 'waiting';
  clipboardValue?: string; // auto-copied to clipboard
}

const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ user, onClose, lang, initialPrompt = '' }) => {
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
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [waitingForScreenshot, setWaitingForScreenshot] = useState(false);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);
  const screenshotResolveRef = useRef<((val: string | null) => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openedWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => { if (initialPrompt) setTask(initialPrompt); }, [initialPrompt]);

  const addLog = useCallback((msg: string) => setLog(prev => [...prev, msg]), []);

  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      const msg = `📋 ${label || 'Value'} copied to clipboard — paste it in the browser`;
      setClipboardToast(msg);
      addLog(msg);
      setTimeout(() => setClipboardToast(null), 4000);
      return true;
    } catch {
      addLog(`   ⚠️ Could not auto-copy. Manually type: ${text}`);
      return false;
    }
  };

  const openUrl = (url: string) => {
    addLog(`   🌐 Opening: ${url}`);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) openedWindowRef.current = w;
    return w;
  };

  // Wait for user to paste a screenshot
  const waitForScreenshot = (): Promise<string | null> => {
    setWaitingForScreenshot(true);
    return new Promise(resolve => {
      screenshotResolveRef.current = resolve;
    });
  };

  const handleScreenshotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const b64 = dataUrl.split(',')[1];
      setScreenshot(dataUrl);
      setWaitingForScreenshot(false);
      screenshotResolveRef.current?.(b64);
      screenshotResolveRef.current = null;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const skipScreenshot = () => {
    setWaitingForScreenshot(false);
    screenshotResolveRef.current?.(null);
    screenshotResolveRef.current = null;
    addLog('   ⏭️ Screenshot skipped — continuing without visual feedback');
  };

  const planTask = async () => {
    if (!task.trim() || !canUseAgent) return;
    setError(null); setLoading(true); setSteps([]); setSummary(''); setLog([]);
    setCurrentStep(-1); setScreenshot(null); setAgentReply(null);
    if (!isPro && !isBasic) cacheService.set(CacheKey.AGENT_USED_ONCE, true);
    try {
      addLog('🤖 Gemini is planning your task...');
      const result = await geminiService.agentPlan(task.trim());
      setSummary(result.summary);
      setSteps(result.steps.map(s => ({ ...s, status: 'pending' })));
      addLog(`✅ Plan ready — ${result.steps.length} steps`);
    } catch (e) {
      setError(e instanceof AppError ? e.message : (e instanceof Error ? e.message : 'Planning failed'));
    } finally { setLoading(false); }
  };

  const executeStep = async (step: Step): Promise<void> => {
    switch (step.action) {
      case 'navigate': {
        if (step.target) {
          openUrl(step.target);
          await new Promise(r => setTimeout(r, 800));
        }
        break;
      }
      case 'search': {
        const q = step.value || step.target || '';
        openUrl('https://www.google.com/search?q=' + encodeURIComponent(q));
        addLog(`   🔍 Searching Google for: ${q}`);
        await new Promise(r => setTimeout(r, 800));
        break;
      }
      case 'type': {
        if (step.value) {
          await copyToClipboard(step.value, `"${step.value.slice(0, 30)}${step.value.length > 30 ? '...' : ''}"`);
          addLog(`   ⌨️ Paste (Ctrl+V) into: ${step.target || 'the field'}`);
        }
        break;
      }
      case 'click': {
        addLog(`   👆 Click: ${step.target}`);
        if (step.instruction) addLog(`   💡 ${step.instruction}`);
        break;
      }
      case 'fill': {
        if (step.value) {
          await copyToClipboard(step.value, `Value for ${step.target || 'field'}`);
          addLog(`   📝 Fill "${step.target}" — value copied, paste it in`);
        }
        break;
      }
      case 'screenshot': {
        addLog('   📸 Take a screenshot of the browser tab and paste it below');
        const b64 = await waitForScreenshot();
        if (b64) {
          addLog('   ✅ Screenshot received — Gemini is analyzing...');
          // Feed screenshot to Gemini for guidance on next action
          try {
            const reply = await geminiService.computerUse({
              prompt: `The user is trying to: "${task}". They are on step: "${step.description}". Analyze this screenshot and tell them exactly what to do next. Be specific about what to click, type, or do. Keep it to 2-3 short sentences.`,
              screenshotBase64: b64,
              mimeType: 'image/png',
            });
            if (reply.text) {
              setAgentReply(reply.text);
              addLog(`   🤖 Gemini says: ${reply.text}`);
            }
          } catch { addLog('   ⚠️ Could not analyze screenshot'); }
        }
        break;
      }
      case 'copy': {
        if (step.value) await copyToClipboard(step.value, step.target || 'Value');
        break;
      }
      case 'wait': {
        addLog('   ⏳ Waiting 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
      case 'done': {
        addLog(`   🎉 ${step.description}`);
        break;
      }
      default: {
        addLog(`   ℹ️ ${step.description}`);
        if (step.instruction) addLog(`   💡 ${step.instruction}`);
      }
    }
  };

  const executeSteps = async () => {
    if (steps.length === 0) return;
    setRunning(true); stopRef.current = false;
    for (let i = 0; i < steps.length; i++) {
      if (stopRef.current) { addLog('⛔ Stopped'); break; }
      const step = steps[i];
      setCurrentStep(i);
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));
      addLog(`▶ [${i + 1}/${steps.length}] ${step.description}`);
      try {
        await executeStep(step);
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
      } catch (e: any) {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        addLog(`❌ Step ${i + 1} error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
    setRunning(false); setCurrentStep(-1);
    addLog('🏁 All steps done!');
  };

  const stopExecution = () => { stopRef.current = true; };
  const reset = () => {
    setSteps([]); setSummary(''); setLog([]); setError(null);
    setCurrentStep(-1); setTask(''); setScreenshot(null); setAgentReply(null);
    setWaitingForScreenshot(false);
  };

  const stepIcon = (s: Step) => {
    if (s.status === 'running') return <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-sm" />;
    if (s.status === 'done') return <i className="fa-solid fa-check-circle text-emerald-500 text-sm" />;
    if (s.status === 'error') return <i className="fa-solid fa-circle-xmark text-red-500 text-sm" />;
    if (s.status === 'waiting') return <i className="fa-solid fa-clock text-amber-500 text-sm" />;
    return <i className="fa-regular fa-circle text-slate-300 dark:text-white/15 text-sm" />;
  };

  const actionColor: Record<string, string> = {
    navigate: 'text-blue-500', search: 'text-indigo-500', type: 'text-amber-500',
    fill: 'text-amber-500', click: 'text-rose-500', screenshot: 'text-cyan-500',
    copy: 'text-purple-500', wait: 'text-slate-400', done: 'text-emerald-500',
  };
  const actionIcon: Record<string, string> = {
    navigate: 'fa-globe', search: 'fa-magnifying-glass', type: 'fa-keyboard',
    fill: 'fa-pen', click: 'fa-arrow-pointer', screenshot: 'fa-camera',
    copy: 'fa-copy', wait: 'fa-hourglass-half', done: 'fa-flag-checkered',
  };

  if (!user) return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center">
      <p className="text-sm font-bold text-slate-500 mb-4">Sign in to use Agent Mode</p>
      <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black">Back</button>
    </div>
  );

  if (!canUseAgent) return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-5">
        <i className="fa-solid fa-robot text-2xl text-amber-500" />
      </div>
      <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">Agent Mode</h2>
      <p className="text-sm text-slate-500 mb-6">Agent mode automates browser tasks. Available on Basic and Pro plans.</p>
      <button onClick={() => { window.location.hash = 'pricing'; }} className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">View Plans</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Clipboard Toast */}
      {clipboardToast && (
        <div className="absolute top-16 left-4 right-4 z-50 p-3 rounded-2xl bg-indigo-600 text-white text-xs font-black shadow-xl flex items-center gap-2 animate-slide-up">
          <i className="fa-solid fa-clipboard-check text-sm" />
          {clipboardToast}
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-colors">
            <i className="fa-solid fa-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-robot text-indigo-500" /> Agent Mode
            </h1>
            <p className="text-[9px] text-slate-400">AI takes over your browser tasks</p>
          </div>
        </div>
        {steps.length > 0 && !running && (
          <button onClick={reset} className="text-[9px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest flex items-center gap-1">
            <i className="fa-solid fa-rotate-left" /> New Task
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Task Input */}
        {steps.length === 0 && (
          <div className="p-4 space-y-4 max-w-xl mx-auto">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">How it works</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Tell the agent what to do. It will plan steps, automatically open websites, copy values to your clipboard for pasting, and guide you through every action. You can also paste screenshots so Gemini sees what's on screen.
              </p>
            </div>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) planTask(); }}
              placeholder="e.g. Book the cheapest bus from Colombo to Kandy for Friday, Search for Python developer jobs in Sri Lanka, Fill out a contact form on example.com..."
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}
            <button onClick={planTask} disabled={loading || !task.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg">
              {loading
                ? <><i className="fa-solid fa-circle-notch animate-spin" /> Gemini is planning...</>
                : <><i className="fa-solid fa-robot" /> Plan & Execute Task</>}
            </button>
          </div>
        )}

        {/* Steps + Execution */}
        {steps.length > 0 && (
          <div className="p-4 space-y-3 max-w-xl mx-auto">

            {/* Summary */}
            {summary && (
              <div className="p-3.5 rounded-2xl bg-slate-900 dark:bg-black/60 border border-white/10">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-robot" /> Gemini's Plan
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Steps List */}
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  step.status === 'running' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-700 shadow-sm' :
                  step.status === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' :
                  step.status === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30' :
                  step.status === 'waiting' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30' :
                  'bg-slate-50 dark:bg-white/3 border-transparent'
                }`}>
                  <div className="mt-0.5 w-5 shrink-0 flex justify-center">{stepIcon(step)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <i className={`fa-solid ${actionIcon[step.action] || 'fa-gear'} text-[9px] ${actionColor[step.action] || 'text-slate-400'}`} />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${actionColor[step.action] || 'text-slate-400'}`}>{step.action}</span>
                      {i === currentStep && step.status === 'running' && (
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">NOW</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{step.description}</p>
                    {step.target && step.action !== 'navigate' && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{step.target}</p>
                    )}
                    {step.value && (step.action === 'type' || step.action === 'fill' || step.action === 'copy') && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <code className="text-[10px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{step.value}</code>
                        <button onClick={() => copyToClipboard(step.value!, 'Value')}
                          className="text-[8px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest">Copy</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Screenshot wait */}
            {waitingForScreenshot && (
              <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 space-y-3">
                <p className="text-xs font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-camera" /> Gemini needs to see your screen
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  Take a screenshot of the browser tab (press PrtScn or use Snipping Tool) then upload it below. Gemini will analyze it and tell you exactly what to do next.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-black uppercase tracking-widest hover:bg-cyan-500 transition-colors flex items-center justify-center gap-1.5">
                    <i className="fa-solid fa-upload" /> Upload Screenshot
                  </button>
                  <button onClick={skipScreenshot}
                    className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-500 text-xs font-black hover:bg-slate-300 dark:hover:bg-white/20 transition-colors">
                    Skip
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotFile} />
              </div>
            )}

            {/* Gemini reply from screenshot analysis */}
            {agentReply && !waitingForScreenshot && (
              <div className="p-3.5 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-eye" /> Gemini sees this
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{agentReply}</p>
              </div>
            )}

            {/* Execution log */}
            {log.length > 0 && (
              <div ref={logRef} className="rounded-xl bg-slate-900 dark:bg-black/60 p-3 max-h-36 overflow-y-auto">
                {log.map((l, i) => (
                  <p key={i} className={`text-[10px] font-mono leading-5 ${
                    l.startsWith('❌') ? 'text-red-400' :
                    l.startsWith('✅') || l.startsWith('🏁') ? 'text-emerald-400' :
                    l.startsWith('🤖') || l.startsWith('▶') ? 'text-indigo-400' :
                    l.startsWith('📋') ? 'text-amber-400' :
                    'text-slate-400'
                  }`}>{l}</p>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {!running ? (
                <button onClick={executeSteps}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow">
                  <i className="fa-solid fa-play" /> Run All Steps
                </button>
              ) : (
                <button onClick={stopExecution}
                  className="flex-1 py-3.5 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-colors flex items-center justify-center gap-2">
                  <i className="fa-solid fa-stop" /> Stop Agent
                </button>
              )}
              <button onClick={reset} disabled={running}
                className="px-4 py-3.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 text-xs font-black hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-40">
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
