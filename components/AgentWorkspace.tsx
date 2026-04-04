/**
 * AgentWorkspace — TRUE autonomous browser agent.
 *
 * TWO MODES:
 * 1. EXTENSION MODE (full takeover): Detects the Orin Agent Chrome extension.
 *    Sends commands (navigate/click/type/screenshot) via chrome.runtime.sendMessage.
 *    Extension executes them in ANY tab, returns screenshots automatically.
 *    Loop: task → plan → [screenshot → Gemini Vision → action] × N → done
 *
 * 2. SCREEN CAPTURE MODE (no extension): Uses getDisplayMedia() to capture the
 *    screen, takes frames automatically every 3s, feeds to Gemini Vision.
 *    Values auto-copied to clipboard. User follows Gemini's instructions.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { Language, UserAccount } from '../types';
import { cacheService, CacheKey } from '../services/cacheService';

// Replace with your actual published extension ID after publishing to Chrome Web Store
// For sideloaded/developer mode: get from chrome://extensions
const EXTENSION_ID_KEY = 'orin_agent_ext_id';

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
  instruction?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

// Send a command to the Chrome extension
async function extCmd(extId: string, action: string, data: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve) => {
    if (!(window as any).chrome?.runtime?.sendMessage) {
      resolve({ error: 'Chrome extension API not available' });
      return;
    }
    (window as any).chrome.runtime.sendMessage(extId, { action, data }, (response: any) => {
      const err = (window as any).chrome.runtime.lastError;
      if (err) resolve({ error: err.message });
      else resolve(response || { ok: true });
    });
  });
}

async function detectExtension(): Promise<string | null> {
  // Check if user manually saved extension ID
  const saved = localStorage.getItem(EXTENSION_ID_KEY);
  if (saved) {
    const resp = await extCmd(saved, 'ping');
    if (resp?.ok) return saved;
    localStorage.removeItem(EXTENSION_ID_KEY);
  }
  return null;
}

const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ user, onClose, lang, initialPrompt = '' }) => {
  const plan = user?.plan?.toLowerCase() ?? '';
  const isPro = plan === 'pro' || plan === 'pro_yearly';
  const isBasic = plan === 'basic' || plan === 'basic_yearly';
  const hasUsedOnce = cacheService.get<boolean>(CacheKey.AGENT_USED_ONCE, false);
  const canUseAgent = isPro || isBasic || !hasUsedOnce;

  const [mode, setMode] = useState<'idle' | 'setup' | 'running' | 'done'>('idle');
  const [extMode, setExtMode] = useState<'detecting' | 'found' | 'none'>('detecting');
  const [extId, setExtId] = useState('');
  const [extIdInput, setExtIdInput] = useState('');

  const [task, setTask] = useState(initialPrompt);
  const [steps, setSteps] = useState<Step[]>([]);
  const [summary, setSummary] = useState('');
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null); // last screenshot b64
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [agentThought, setAgentThought] = useState<string | null>(null);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const [totalStepsDone, setTotalStepsDone] = useState(0);

  // Screen capture
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => { if (initialPrompt) setTask(initialPrompt); }, [initialPrompt]);
  useEffect(() => {
    detectExtension().then(id => {
      if (id) { setExtId(id); setExtMode('found'); }
      else setExtMode('none');
    });
  }, []);

  const addLog = useCallback((msg: string) => setLog(prev => [...prev, msg]), []);

  const copyToClipboard = async (text: string, label = 'Value') => {
    try {
      await navigator.clipboard.writeText(text);
      const msg = `📋 "${label}" copied — paste it (Ctrl+V) in the browser`;
      setClipboardToast(msg);
      setTimeout(() => setClipboardToast(null), 4000);
      addLog(msg);
    } catch { addLog(`⚠️ Could not auto-copy "${label}". Type manually: ${text}`); }
  };

  // ── Take screenshot (extension or screen capture) ──────────────────────────
  const takeScreenshot = async (): Promise<string | null> => {
    if (extMode === 'found' && extId) {
      const resp = await extCmd(extId, 'screenshot');
      if (resp?.screenshot) {
        setScreenshot(resp.screenshot);
        setScreenshotPreview('data:image/png;base64,' + resp.screenshot);
        return resp.screenshot;
      }
      addLog('⚠️ Extension screenshot failed: ' + (resp?.error || 'unknown'));
    }
    // Fallback: capture from screen stream
    if (screenStream && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      const b64 = dataUrl.replace('data:image/png;base64,', '');
      setScreenshot(b64);
      setScreenshotPreview(dataUrl);
      return b64;
    }
    return null;
  };

  // ── Execute one action (extension or manual) ────────────────────────────────
  const executeAction = async (action: string, target?: string, value?: string, instruction?: string) => {
    const ext = extMode === 'found' && extId;

    switch (action) {
      case 'navigate': {
        if (ext && target) {
          const resp = await extCmd(extId, 'navigate', { url: target });
          addLog(resp?.ok ? `   🌐 Opened: ${target}` : `   ⚠️ Navigate failed: ${resp?.error}`);
        } else if (target) {
          window.open(target, '_blank', 'noopener');
          addLog(`   🌐 Opened in new tab: ${target}`);
        }
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
      case 'search': {
        const q = value || target || '';
        const url = 'https://www.google.com/search?q=' + encodeURIComponent(q);
        if (ext) await extCmd(extId, 'navigate', { url });
        else window.open(url, '_blank', 'noopener');
        addLog(`   🔍 Searched: ${q}`);
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
      case 'click': {
        if (ext) {
          const resp = await extCmd(extId, 'click', { text: target, selector: target?.startsWith('.') || target?.startsWith('#') ? target : undefined });
          addLog(resp?.ok ? `   👆 Clicked: ${target}` : `   ⚠️ Click failed: ${resp?.error}`);
        } else {
          addLog(`   👆 MANUAL: Click "${target}"${instruction ? ` — ${instruction}` : ''}`);
        }
        await new Promise(r => setTimeout(r, 800));
        break;
      }
      case 'type':
      case 'fill': {
        if (ext && value) {
          const resp = await extCmd(extId, 'type', { selector: null, text: target, value });
          addLog(resp?.ok ? `   ⌨️ Typed into "${target}"` : `   ⚠️ Type failed — copying to clipboard`);
          if (!resp?.ok) await copyToClipboard(value, target || 'Value');
        } else if (value) {
          await copyToClipboard(value, target || 'Value');
          addLog(`   ⌨️ MANUAL: Paste (Ctrl+V) into "${target}"`);
        }
        await new Promise(r => setTimeout(r, 600));
        break;
      }
      case 'scroll': {
        if (ext) await extCmd(extId, 'scroll', { y: 400 });
        addLog(`   ↕️ Scrolled down`);
        await new Promise(r => setTimeout(r, 500));
        break;
      }
      case 'press-enter': {
        if (ext) await extCmd(extId, 'press-key', { key: 'Enter' });
        else addLog(`   ↩️ MANUAL: Press Enter`);
        await new Promise(r => setTimeout(r, 800));
        break;
      }
      case 'copy': {
        if (value) await copyToClipboard(value, target || 'Result');
        break;
      }
      case 'wait': {
        addLog(`   ⏳ Waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
      case 'done': {
        addLog(`   🎉 ${target || 'Task complete!'}`);
        break;
      }
    }
  };

  // ── Main autonomous loop ────────────────────────────────────────────────────
  const runAgent = async () => {
    if (!task.trim()) return;
    setMode('running'); stopRef.current = false;
    setLog([]); setSteps([]); setSummary(''); setError(null);
    setTotalStepsDone(0); setAgentThought(null); setScreenshotPreview(null);
    if (!isPro && !isBasic) cacheService.set(CacheKey.AGENT_USED_ONCE, true);

    addLog('🤖 Gemini is planning your task...');
    let plan: { summary: string; steps: Step[] };
    try {
      const result = await geminiService.agentPlan(task);
      plan = { summary: result.summary, steps: result.steps.map(s => ({ ...s, status: 'pending' })) };
      setSummary(plan.summary);
      setSteps(plan.steps);
      addLog(`✅ Plan ready — ${plan.steps.length} steps`);
    } catch (e: any) {
      setError(e instanceof AppError ? e.message : e.message || 'Planning failed');
      setMode('idle');
      return;
    }

    // Execute each step
    for (let i = 0; i < plan.steps.length; i++) {
      if (stopRef.current) { addLog('⛔ Stopped by user'); break; }
      const step = plan.steps[i];
      setCurrentStepIdx(i);
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));
      addLog(`▶ [${i + 1}/${plan.steps.length}] ${step.description}`);

      try {
        await executeAction(step.action, step.target, step.value, step.instruction);

        // After key actions, take a screenshot and ask Gemini what happened
        const needsVision = ['navigate', 'search', 'click', 'press-enter'].includes(step.action);
        if (needsVision && i < plan.steps.length - 1) {
          await new Promise(r => setTimeout(r, 500));
          const b64 = await takeScreenshot();
          if (b64) {
            addLog(`   📸 Checking screen...`);
            try {
              // Get page context if extension is available
              let pageCtx = '';
              if (extMode === 'found' && extId) {
                const ctx = await extCmd(extId, 'get-page-content');
                if (ctx?.content) {
                  pageCtx = `\nPage: ${ctx.content.title} (${ctx.content.url})\nVisible text: ${ctx.content.text?.slice(0, 500)}\nButtons: ${ctx.content.buttons?.join(', ')}\nInputs: ${ctx.content.inputs?.map((f: any) => f.placeholder || f.name).join(', ')}`;
                }
              }
              const vision = await geminiService.computerUse({
                prompt: `Task: "${task}"\nJust did: "${step.description}"\nNext planned step: "${plan.steps[i + 1]?.description || 'done'}"\n${pageCtx}\n\nLook at this screenshot and tell me in ONE sentence: did the last action succeed? If there's an error or unexpected state, describe it briefly so I can adapt. If all is fine, just say "OK, proceed."`,
                screenshotBase64: b64,
                mimeType: 'image/png',
              });
              if (vision.text && !vision.text.includes('OK, proceed')) {
                setAgentThought(vision.text);
                addLog(`   🧠 Gemini: ${vision.text.slice(0, 120)}`);
              } else {
                setAgentThought(null);
              }
            } catch { /* vision is best-effort */ }
          }
        }

        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
        setTotalStepsDone(i + 1);
      } catch (e: any) {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        addLog(`❌ Step ${i + 1} error: ${e.message || String(e)}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Final screenshot
    const finalShot = await takeScreenshot();
    if (finalShot) {
      addLog('📸 Final screenshot taken');
      try {
        const final = await geminiService.computerUse({
          prompt: `Task was: "${task}". Based on this final screenshot, in 2 sentences: was the task completed successfully? What was the outcome?`,
          screenshotBase64: finalShot,
          mimeType: 'image/png',
        });
        if (final.text) {
          setAgentThought(final.text);
          addLog(`🤖 Result: ${final.text}`);
        }
      } catch {}
    }

    addLog('🏁 Agent finished!');
    setMode('done');
    setCurrentStepIdx(-1);
  };

  // ── Start screen capture ────────────────────────────────────────────────────
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      setScreenStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      addLog('📺 Screen capture started');
      stream.getTracks()[0].onended = () => {
        setScreenStream(null);
        addLog('📺 Screen capture ended');
      };
    } catch (e: any) {
      addLog('⚠️ Screen capture failed: ' + (e.message || 'Permission denied'));
    }
  };

  const stopAgent = () => { stopRef.current = true; };
  const reset = () => {
    setMode('idle'); setSteps([]); setSummary(''); setLog([]); setError(null);
    setCurrentStepIdx(-1); setTask(''); setAgentThought(null); setScreenshotPreview(null);
    setTotalStepsDone(0);
    if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); }
  };

  const saveExtId = () => {
    const id = extIdInput.trim();
    if (!id) return;
    extCmd(id, 'ping').then(resp => {
      if (resp?.ok) {
        localStorage.setItem(EXTENSION_ID_KEY, id);
        setExtId(id); setExtMode('found');
        addLog('✅ Extension connected! ID: ' + id);
      } else {
        setError('Extension not found or not responding. Check the ID.');
      }
    });
  };

  const stepColor: Record<string, string> = {
    navigate: 'text-blue-400', search: 'text-indigo-400', type: 'text-amber-400',
    fill: 'text-amber-400', click: 'text-rose-400', screenshot: 'text-cyan-400',
    copy: 'text-purple-400', wait: 'text-slate-400', done: 'text-emerald-400',
    scroll: 'text-teal-400', 'press-enter': 'text-orange-400',
  };
  const stepIcon: Record<string, string> = {
    navigate: 'fa-globe', search: 'fa-magnifying-glass', type: 'fa-keyboard',
    fill: 'fa-pen', click: 'fa-arrow-pointer', screenshot: 'fa-camera',
    copy: 'fa-copy', wait: 'fa-hourglass-half', done: 'fa-flag-checkered',
    scroll: 'fa-down-long', 'press-enter': 'fa-corner-down-left',
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
      <p className="text-sm text-slate-500 mb-6">Automates browser tasks. Available on Basic and Pro plans.</p>
      <button onClick={() => { window.location.hash = 'pricing'; }} className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">View Plans</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      {/* Clipboard toast */}
      {clipboardToast && (
        <div className="absolute top-16 left-4 right-4 z-50 p-3 rounded-2xl bg-amber-500 text-white text-xs font-black shadow-2xl flex items-center gap-2">
          <i className="fa-solid fa-clipboard-check" />{clipboardToast}
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-colors">
            <i className="fa-solid fa-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-robot text-indigo-500" /> Agent Mode
            </h1>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${extMode === 'found' ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : screenStream ? 'bg-amber-500' : 'bg-slate-400'}`} />
              <p className="text-[9px] text-slate-400">
                {extMode === 'found' ? '✓ Extension connected — full control' : screenStream ? 'Screen capture active' : 'No extension — clipboard mode'}
              </p>
            </div>
          </div>
        </div>
        {mode !== 'idle' && (
          <button onClick={reset} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-1">
            <i className="fa-solid fa-rotate-left" /> Reset
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── SETUP / IDLE ── */}
        {mode === 'idle' && (
          <div className="p-4 space-y-4 max-w-xl mx-auto">

            {/* Extension status card */}
            <div className={`p-4 rounded-2xl border ${extMode === 'found' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-white/3 border-slate-200 dark:border-white/10'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-black ${extMode === 'found' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {extMode === 'found' ? '✅ Orin Agent Extension Connected' : extMode === 'detecting' ? '⏳ Detecting extension...' : '⚡ Extension not connected'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    {extMode === 'found'
                      ? 'Full browser control: clicks, typing, screenshots — all automatic.'
                      : 'Install the extension for full takeover. Or use Screen Capture mode.'}
                  </p>
                </div>
                {extMode === 'found' && <i className="fa-solid fa-plug text-emerald-500 text-lg" />}
              </div>

              {extMode === 'none' && (
                <div className="mt-3 space-y-2">
                  <a href="/orin-agent-extension.zip" download
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors">
                    <i className="fa-solid fa-puzzle-piece" /> Download Orin Agent Extension
                  </a>
                  <p className="text-[9px] text-slate-400 text-center">
                    Unzip → Chrome://extensions → Enable Developer Mode → Load Unpacked
                  </p>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={extIdInput}
                      onChange={e => setExtIdInput(e.target.value)}
                      placeholder="Paste Extension ID from chrome://extensions"
                      className="flex-1 px-3 py-2 rounded-xl text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button onClick={saveExtId} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black hover:bg-indigo-500">Connect</button>
                  </div>
                </div>
              )}
            </div>

            {/* Screen capture option */}
            {extMode !== 'found' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-black text-amber-600 dark:text-amber-400 mb-1.5">📺 Screen Capture Mode (no extension needed)</p>
                <p className="text-[10px] text-slate-500 mb-3">Orin watches your screen and guides you with instructions. Values auto-copied to clipboard.</p>
                {!screenStream
                  ? <button onClick={startScreenCapture} className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-colors flex items-center justify-center gap-2">
                      <i className="fa-solid fa-display" /> Start Screen Share
                    </button>
                  : <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                      <i className="fa-solid fa-circle text-emerald-500 animate-pulse" /> Screen capture active
                    </div>
                }
              </div>
            )}

            {/* Task input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">What should the agent do?</label>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAgent(); }}
                placeholder="e.g. Search for Python developer jobs in Colombo on LinkedIn and open the top 3 results&#10;e.g. Go to Wikipedia and find the population of Sri Lanka&#10;e.g. Search Amazon for wireless earbuds under $50 and find the best rated one"
                rows={4}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}
            </div>

            <button onClick={runAgent} disabled={!task.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
              <i className="fa-solid fa-robot" /> Start Agent
            </button>
          </div>
        )}

        {/* ── RUNNING / DONE ── */}
        {(mode === 'running' || mode === 'done') && (
          <div className="p-4 space-y-3 max-w-xl mx-auto">

            {/* Summary */}
            {summary && (
              <div className="p-3.5 rounded-2xl bg-slate-900 dark:bg-black/60 border border-white/10">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-robot" />Gemini's Plan
                </p>
                <p className="text-xs text-slate-300">{summary}</p>
                {mode === 'done' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400 font-black">
                    <i className="fa-solid fa-check-circle" /> {totalStepsDone}/{steps.length} steps completed
                  </div>
                )}
              </div>
            )}

            {/* Steps */}
            <div className="space-y-1.5">
              {steps.map((step, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
                  step.status === 'running' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm' :
                  step.status === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' :
                  step.status === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' :
                  'bg-slate-50 dark:bg-white/3 border-transparent opacity-60'
                }`}>
                  <div className="mt-0.5 w-4 shrink-0 flex justify-center text-sm">
                    {step.status === 'running' ? <i className="fa-solid fa-circle-notch animate-spin text-indigo-500" /> :
                     step.status === 'done' ? <i className="fa-solid fa-check-circle text-emerald-500" /> :
                     step.status === 'error' ? <i className="fa-solid fa-circle-xmark text-red-500" /> :
                     <i className="fa-regular fa-circle text-slate-300 dark:text-white/10" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <i className={`fa-solid ${stepIcon[step.action] || 'fa-gear'} text-[8px] ${stepColor[step.action] || 'text-slate-400'}`} />
                      <span className={`text-[8px] font-black uppercase tracking-widest ${stepColor[step.action] || 'text-slate-400'}`}>{step.action}</span>
                      {i === currentStepIdx && step.status === 'running' && (
                        <span className="text-[7px] font-black text-white bg-indigo-500 px-1.5 py-0.5 rounded-full">RUNNING</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">{step.description}</p>
                    {step.value && ['type','fill','copy'].includes(step.action) && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <code className="text-[9px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 max-w-[180px] truncate">{step.value}</code>
                        <button onClick={() => copyToClipboard(step.value!, step.target)}
                          className="text-[8px] font-black text-indigo-400 hover:text-indigo-500 uppercase">Copy</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Gemini's real-time analysis */}
            {agentThought && (
              <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-eye" /> Gemini sees
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">{agentThought}</p>
              </div>
            )}

            {/* Live screenshot preview */}
            {screenshotPreview && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-white/5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live Screen</span>
                  <span className="text-[8px] text-slate-400">Last capture</span>
                </div>
                <img src={screenshotPreview} alt="Screen" className="w-full max-h-48 object-contain bg-black" />
              </div>
            )}

            {/* Live screen stream (screen capture mode) */}
            {screenStream && (
              <div className="rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30">
                  <i className="fa-solid fa-circle text-amber-500 animate-pulse text-[8px]" />
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Live Screen Feed</span>
                </div>
                <video ref={videoRef} muted autoPlay playsInline className="w-full max-h-48 object-contain bg-black" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div ref={logRef} className="rounded-xl bg-slate-900 dark:bg-black/60 p-3 max-h-40 overflow-y-auto border border-white/5">
                {log.map((l, i) => (
                  <p key={i} className={`text-[10px] font-mono leading-5 ${
                    l.startsWith('❌') ? 'text-red-400' :
                    l.startsWith('✅') || l.startsWith('🏁') ? 'text-emerald-400' :
                    l.startsWith('🤖') || l.startsWith('▶') ? 'text-indigo-400' :
                    l.startsWith('📋') ? 'text-amber-400' :
                    l.startsWith('📸') || l.startsWith('🧠') ? 'text-cyan-400' :
                    l.startsWith('⛔') ? 'text-red-400' :
                    'text-slate-400'
                  }`}>{l}</p>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2 pt-1">
              {mode === 'running' ? (
                <button onClick={stopAgent}
                  className="flex-1 py-3.5 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-stop" /> Stop Agent
                </button>
              ) : (
                <button onClick={reset}
                  className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-rotate-left" /> New Task
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentWorkspace;
