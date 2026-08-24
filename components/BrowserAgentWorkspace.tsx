/**
 * AgentWorkspace — Autonomous AI agent with Chrome extension.
 * DEALS MODE: Given a query, searches multiple sites, extracts listings,
 * opens the best results as new tabs for user review.
 * TASK MODE: Executes any browser task step by step with full takeover.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { Language, UserAccount } from '../types';
import { cacheService, CacheKey } from '../services/cacheService';

const EXT_ID_KEY = 'orin_agent_ext_id';

interface BrowserAgentWorkspaceProps {
  user: UserAccount | null;
  onClose: () => void;
  lang: Language;
  initialPrompt?: string;
  embedded?: boolean;
}

interface Step {
  action: string; target?: string; value?: string;
  description: string; instruction?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

interface Deal {
  name: string; price?: string; url?: string; snippet?: string; site?: string;
}

async function extCmd(extId: string, action: string, data: Record<string, any> = {}): Promise<any> {
  return new Promise(resolve => {
    if (!(window as any).chrome?.runtime?.sendMessage) {
      resolve({ error: 'Chrome extension API unavailable' }); return;
    }
    (window as any).chrome.runtime.sendMessage(extId, { action, data }, (resp: any) => {
      const err = (window as any).chrome?.runtime?.lastError;
      resolve(err ? { error: err.message } : (resp || { ok: true }));
    });
  });
}

const BrowserAgentWorkspace: React.FC<BrowserAgentWorkspaceProps> = ({ user, onClose, lang, initialPrompt = '', embedded = false }) => {
  const plan = user?.plan?.toLowerCase() ?? '';
  const isPro = plan === 'pro' || plan === 'pro_yearly';
  const isBasic = plan === 'basic' || plan === 'basic_yearly';

  const [agentMode, setAgentMode] = useState<'deals' | 'task'>('deals');
  const [extStatus, setExtStatus] = useState<'detecting' | 'connected' | 'none'>('detecting');
  const [extId, setExtId] = useState('');
  const [extIdInput, setExtIdInput] = useState('');

  const [task, setTask] = useState(initialPrompt);
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [steps, setSteps] = useState<Step[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [openedTabs, setOpenedTabs] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [thought, setThought] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [clipToast, setClipToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => { if (initialPrompt) setTask(initialPrompt); }, [initialPrompt]);

  useEffect(() => {
    let detected = false;

    // Method 1: Listen for content script announcement (auto, no copy-paste needed)
    const onReady = (e: Event) => {
      const id = (e as CustomEvent).detail?.extId;
      if (id && !detected) {
        detected = true;
        localStorage.setItem(EXT_ID_KEY, id);
        setExtId(id); setExtStatus('connected');
      }
    };
    window.addEventListener('orin-agent-ready', onReady);

    // Method 2: Read from DOM attribute (set by content script)
    const attrId = document.documentElement.getAttribute('data-orin-agent-id');
    if (attrId && !detected) {
      detected = true;
      localStorage.setItem(EXT_ID_KEY, attrId);
      setExtId(attrId); setExtStatus('connected');
    }

    // Method 3: Ping saved ID
    const saved = localStorage.getItem(EXT_ID_KEY);
    if (saved && !detected) {
      extCmd(saved, 'ping').then(r => {
        if (r?.ok && !detected) { detected = true; setExtId(saved); setExtStatus('connected'); }
        else if (!detected) { localStorage.removeItem(EXT_ID_KEY); setExtStatus('none'); }
      });
    } else if (!attrId) {
      // Ask content script to re-announce (in case it loaded before we started listening)
      window.dispatchEvent(new CustomEvent('orin-agent-ping'));
      setTimeout(() => { if (!detected) setExtStatus('none'); }, 1000);
    }

    return () => window.removeEventListener('orin-agent-ready', onReady);
  }, []); // eslint-disable-line

  const addLog = useCallback((msg: string) => setLog(p => [...p, msg]), []);

  const clip = async (text: string, label = 'Value') => {
    try {
      await navigator.clipboard.writeText(text);
      setClipToast(`📋 "${label}" copied — Ctrl+V to paste`);
      setTimeout(() => setClipToast(null), 3500);
      addLog(`📋 Copied: ${label}`);
    } catch { addLog(`⚠️ Auto-copy failed. Type: ${text}`); }
  };

  const screenshot = async (tabId?: number): Promise<string | null> => {
    if (extStatus !== 'connected') return null;
    const r = await extCmd(extId, 'screenshot', tabId ? { tabId } : {});
    if (r?.screenshot) { setScreenshotPreview('data:image/png;base64,' + r.screenshot); return r.screenshot; }
    return null;
  };

  // ── DEALS MODE ────────────────────────────────────────────────────────────────
  const runDealsMode = async () => {
    if (!task.trim()) return;
    setState('running'); stopRef.current = false;
    setDeals([]); setOpenedTabs([]); setLog([]); setThought(null); setScreenshotPreview(null);
    if (!isPro && !isBasic) cacheService.set(CacheKey.AGENT_USED_ONCE, true);

    addLog('🤖 Gemini is planning where to search...');

    // Ask Gemini what sites to search
    let searchSites: { name: string; url: string; dealSelector?: string }[] = [];
    try {
      const r = await geminiService.computerUse({
        prompt: `The user wants to find deals/listings for: "${task}"
Return a JSON array of 4-6 best websites to search, with search URLs.
Format: [{"name":"Site Name","url":"https://site.com/search?q=...","dealSelector":"optional CSS selector for result cards"}]
Use real sites like Amazon, eBay, ikman.lk, riyasewana.com, daraz.lk, Craigslist, Google Shopping, etc.
Choose sites most relevant to the query. For Sri Lankan queries use ikman.lk, riyasewana.com, daraz.lk.
Output ONLY valid JSON array, no explanation.`,
        screenshotBase64: undefined,
      });
      const text = r.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      searchSites = JSON.parse(clean);
      addLog(`✅ Found ${searchSites.length} sites to check`);
    } catch {
      // Fallback search sites
      const q = encodeURIComponent(task);
      searchSites = [
        { name: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${q}` },
        { name: 'ikman.lk', url: `https://ikman.lk/en/ads/sri-lanka?q=${q}` },
        { name: 'Daraz.lk', url: `https://www.daraz.lk/catalog/?q=${q}` },
      ];
    }

    const allDeals: Deal[] = [];

    for (let i = 0; i < searchSites.length; i++) {
      if (stopRef.current) { addLog('⛔ Stopped'); break; }
      const site = searchSites[i];
      addLog(`\n🔍 [${i+1}/${searchSites.length}] Checking ${site.name}...`);

      if (extStatus === 'connected') {
        // Use extension: navigate, wait, extract
        await extCmd(extId, 'navigate', { url: site.url });
        addLog(`   → Navigated to ${site.name}`);
        await new Promise(r => setTimeout(r, 1500));

        // Take screenshot + extract deals
        const b64 = await screenshot();
        if (b64) {
          addLog(`   📸 Captured page`);
          try {
            // Ask Gemini to analyze the screenshot for deals
            const vision = await geminiService.computerUse({
              prompt: `Looking for deals/listings for: "${task}" on ${site.name}.
From this screenshot, identify up to 5 specific products/listings with their prices and links.
Return JSON: [{"name":"product name","price":"$XX","url":"https://...","snippet":"brief description"}]
If you can't see prices or listings clearly, return [].
ONLY valid JSON array.`,
              screenshotBase64: b64,
              mimeType: 'image/png',
            });
            const visText = vision.text?.replace(/```json|```/g, '').trim() || '[]';
            try {
              const found: Deal[] = JSON.parse(visText);
              found.forEach(d => { d.site = site.name; allDeals.push(d); });
              addLog(`   ✅ Found ${found.length} deals on ${site.name}`);
            } catch {}
          } catch {}
        }

        // Also extract via DOM
        const domResult = await extCmd(extId, 'extract-deals', { query: task });
        if (domResult?.deals?.length) {
          domResult.deals.forEach((d: Deal) => {
            if (d.name && !allDeals.some(x => x.name === d.name)) {
              allDeals.push({ ...d, site: site.name });
            }
          });
        }
      } else {
        // No extension: open in new tab + inform user
        window.open(site.url, '_blank', 'noopener');
        addLog(`   🌐 Opened ${site.name} in new tab`);
        allDeals.push({ name: site.name + ' — see new tab', site: site.name, url: site.url });
      }

      setDeals([...allDeals]);
    }

    if (allDeals.length === 0) {
      addLog('\n⚠️ No structured deals found. Opening top search sites as tabs...');
      searchSites.slice(0, 3).forEach(s => window.open(s.url, '_blank', 'noopener'));
    } else {
      addLog(`\n✅ Found ${allDeals.length} total deals across ${searchSites.length} sites`);

      // Sort by price ascending (rough)
      const withPrice = allDeals.filter(d => d.price);
      const noPrice = allDeals.filter(d => !d.price);
      setDeals([...withPrice, ...noPrice]);

      // Ask Gemini to pick the top deals and open them
      addLog('\n🤖 Gemini selecting top deals to open...');
      try {
        const pickR = await geminiService.computerUse({
          prompt: `User wants: "${task}". Here are the deals found:
${allDeals.slice(0, 12).map((d, i) => `${i+1}. ${d.name} ${d.price || ''} - ${d.site} - ${d.url || ''}`).join('\n')}

Pick the top 4-5 most relevant deals with valid URLs. Return JSON: [{"url":"https://...","reason":"why it's good"}]
Only include deals with real http/https URLs.`,
          screenshotBase64: undefined,
        });
        const pickText = pickR.text?.replace(/```json|```/g, '').trim() || '[]';
        const picks: { url: string; reason: string }[] = JSON.parse(pickText);
        const validUrls = picks.filter(p => p.url?.startsWith('http')).map(p => p.url);

        if (validUrls.length > 0) {
          addLog(`\n📂 Opening ${validUrls.length} best deals as new tabs...`);
          if (extStatus === 'connected') {
            await extCmd(extId, 'open-multiple-tabs', { urls: validUrls });
          } else {
            validUrls.forEach(url => window.open(url, '_blank', 'noopener'));
          }
          setOpenedTabs(validUrls);
          setThought(picks.map(p => `• ${p.reason}`).join('\n'));
          addLog('✅ Tabs opened — check your browser!');
        }
      } catch { /* best effort */ }
    }

    addLog('\n🏁 Done! Review the opened tabs.');
    setState('done');
  };

  // ── TASK MODE (step by step) ──────────────────────────────────────────────────
  const runTaskMode = async () => {
    if (!task.trim()) return;
    setState('running'); stopRef.current = false;
    setSteps([]); setLog([]); setThought(null); setScreenshotPreview(null);
    if (!isPro && !isBasic) cacheService.set(CacheKey.AGENT_USED_ONCE, true);

    addLog('🤖 Planning your task...');
    let plan: { summary: string; steps: Step[] };
    try {
      const r = await geminiService.agentPlan(task);
      plan = { summary: r.summary, steps: r.steps.map(s => ({ ...s, status: 'pending' })) };
      setSteps(plan.steps);
      addLog(`✅ Plan: ${plan.summary}`);
    } catch (e: any) {
      setError(e.message); setState('idle'); return;
    }

    for (let i = 0; i < plan.steps.length; i++) {
      if (stopRef.current) { addLog('⛔ Stopped'); break; }
      const step = plan.steps[i];
      setCurrentIdx(i);
      setSteps(p => p.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));
      addLog(`▶ [${i+1}/${plan.steps.length}] ${step.description}`);

      try {
        await execStep(step);
        setSteps(p => p.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
      } catch (e: any) {
        setSteps(p => p.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        addLog(`❌ Error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
    addLog('🏁 Done!'); setState('done'); setCurrentIdx(-1);
  };

  const execStep = async (step: Step) => {
    const ext = extStatus === 'connected';
    switch (step.action) {
      case 'navigate':
        if (ext && step.target) { await extCmd(extId, 'navigate', { url: step.target }); addLog(`   🌐 ${step.target}`); }
        else if (step.target) { window.open(step.target, '_blank', 'noopener'); addLog(`   🌐 ${step.target}`); }
        await new Promise(r => setTimeout(r, 1200));
        break;
      case 'search':
        const q = step.value || step.target || '';
        const su = 'https://www.google.com/search?q=' + encodeURIComponent(q);
        if (ext) await extCmd(extId, 'navigate', { url: su }); else window.open(su, '_blank');
        addLog(`   🔍 ${q}`); await new Promise(r => setTimeout(r, 1200));
        break;
      case 'click':
        if (ext) { const r = await extCmd(extId, 'click', { text: step.target }); addLog(`   👆 ${step.target} → ${r?.result}`); }
        else { addLog(`   👆 MANUAL: Click "${step.target}"${step.instruction ? ' — ' + step.instruction : ''}`); }
        await new Promise(r => setTimeout(r, 600));
        break;
      case 'type': case 'fill':
        if (ext && step.value) { await extCmd(extId, 'type', { fieldHint: step.target, value: step.value }); addLog(`   ⌨️ Typed into "${step.target}"`); }
        else if (step.value) { await clip(step.value, step.target || 'Value'); addLog(`   ⌨️ Paste into "${step.target}"`); }
        await new Promise(r => setTimeout(r, 500));
        break;
      case 'screenshot': { const b64 = await screenshot(); if (b64) addLog(`   📸 Screenshot taken`); break; }
      case 'scroll': if (ext) await extCmd(extId, 'scroll', { y: 400 }); addLog(`   ↕️ Scrolled`); break;
      case 'wait': addLog(`   ⏳ Waiting...`); await new Promise(r => setTimeout(r, 2000)); break;
      case 'done': addLog(`   🎉 ${step.target || 'Complete!'}`); break;
      default: addLog(`   ℹ️ ${step.description}`);
    }
    // Vision check after navigation
    if (['navigate','search','click'].includes(step.action) && extStatus === 'connected') {
      await new Promise(r => setTimeout(r, 400));
      const b64 = await screenshot();
      if (b64) {
        try {
          const v = await geminiService.computerUse({ prompt: `Task:"${task}". Did step "${step.description}" succeed? One sentence. Say "OK" if fine.`, screenshotBase64: b64, mimeType:'image/png' });
          if (v.text && !v.text.includes('OK')) { setThought(v.text); addLog(`   🧠 ${v.text.slice(0,100)}`); }
        } catch {}
      }
    }
  };

  const connectExt = () => {
    const id = extIdInput.trim();
    if (!id) return;
    extCmd(id, 'ping').then(r => {
      if (r?.ok) { localStorage.setItem(EXT_ID_KEY, id); setExtId(id); setExtStatus('connected'); addLog('✅ Extension connected!'); }
      else setError('Extension not found. Check the ID in chrome://extensions');
    });
  };

  const stop = () => stopRef.current = true;
  const reset = () => { setState('idle'); setSteps([]); setDeals([]); setLog([]); setError(null); setThought(null); setScreenshotPreview(null); setOpenedTabs([]); setTask(''); };

  const run = () => agentMode === 'deals' ? runDealsMode() : runTaskMode();

  if (!user) return <div className="flex flex-col h-full items-center justify-center p-8 text-center"><p className="text-sm font-bold text-slate-500 mb-4">Sign in to use Agent Mode</p><button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black">Back</button></div>;

  const statusColor = extStatus === 'connected' ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm' : 'bg-slate-500';

  return (
    <div className={`flex flex-col h-full overflow-hidden ${embedded ? 'bg-transparent' : 'bg-white dark:bg-slate-900'}`}>
      {clipToast && <div className="absolute top-16 left-4 right-4 z-50 p-3 rounded-2xl bg-amber-500 text-white text-xs font-black shadow-2xl flex items-center gap-2"><i className="fa-solid fa-clipboard-check" />{clipToast}</div>}

      {!embedded && (
        <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-colors">
              <i className="fa-solid fa-arrow-left text-sm" />
            </button>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-robot text-indigo-500" /> Agent Mode</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                <p className="text-[9px] text-slate-400">{extStatus === 'connected' ? '✓ Extension connected' : 'No extension — limited mode'}</p>
              </div>
            </div>
          </div>
          {state !== 'idle' && <button onClick={reset} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest flex items-center gap-1"><i className="fa-solid fa-rotate-left" /> New</button>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* IDLE — Setup */}
        {state === 'idle' && (
          <div className="p-4 space-y-4 max-w-xl mx-auto">

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5">
              {(['deals','task'] as const).map(m => (
                <button key={m} onClick={() => setAgentMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${agentMode===m ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                  {m === 'deals' ? <><i className="fa-solid fa-tags mr-1.5" />Find Deals</> : <><i className="fa-solid fa-robot mr-1.5" />Do Task</>}
                </button>
              ))}
            </div>

            {/* Extension card */}
            <div className={`p-4 rounded-2xl border ${extStatus==='connected' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' : 'bg-slate-50 dark:bg-white/3 border-slate-200 dark:border-white/10'}`}>
              <p className={`text-xs font-black mb-1 ${extStatus==='connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {extStatus==='connected' ? '✅ Extension connected — full control' : extStatus==='detecting' ? '⏳ Detecting...' : '⚡ Extension not connected'}
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                {extStatus==='connected' ? 'Orin can click, type, screenshot, and open tabs automatically.' : 'Install the extension for full autonomous control.'}
              </p>
              {extStatus !== 'connected' && (
                <>
                  <a href="/orin-agent-extension.zip" download className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors mb-2">
                    <i className="fa-solid fa-puzzle-piece" /> Download Extension (v2.0)
                  </a>
                  <p className="text-[9px] text-slate-400 text-center mb-3">Unzip → chrome://extensions → Developer Mode ON → Load Unpacked → Copy ID below</p>
                  <p className="text-[9px] text-emerald-500 font-black text-center">
                    ✓ Once installed, Orin AI detects the extension automatically — no ID needed.
                  </p>
                </>
              )}
            </div>

            {/* Task input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                {agentMode === 'deals' ? 'What are you looking for?' : 'What should the agent do?'}
              </label>
              <textarea value={task} onChange={e => setTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
                placeholder={agentMode === 'deals'
                  ? 'e.g. Used iPhone 13 under LKR 100,000\ne.g. Cheap laptop for students in Sri Lanka\ne.g. Gaming chair deals under $200'
                  : 'e.g. Book the cheapest bus from Colombo to Kandy for Friday\ne.g. Find the CEO of Apple on LinkedIn\ne.g. Search for Python jobs in Colombo and open the top 3'}
                rows={4} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}
            </div>

            <button onClick={run} disabled={!task.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
              <i className={`fa-solid ${agentMode==='deals' ? 'fa-tags' : 'fa-robot'}`} />
              {agentMode === 'deals' ? 'Find Deals' : 'Run Agent'}
            </button>
          </div>
        )}

        {/* RUNNING / DONE */}
        {(state === 'running' || state === 'done') && (
          <div className="p-4 space-y-3 max-w-xl mx-auto">

            {/* Deals results */}
            {agentMode === 'deals' && deals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><i className="fa-solid fa-tags text-indigo-500" /> {deals.length} Deals Found</p>
                  {openedTabs.length > 0 && <span className="text-[9px] font-black text-emerald-500 flex items-center gap-1"><i className="fa-solid fa-external-link-alt" /> {openedTabs.length} tabs opened</span>}
                </div>
                {deals.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-xs font-black text-indigo-600 dark:text-indigo-400">{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">{d.name}</p>
                      {d.price && <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{d.price}</p>}
                      {d.site && <p className="text-[9px] text-slate-400 mt-0.5">{d.site}</p>}
                    </div>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs hover:bg-indigo-500 transition-colors opacity-0 group-hover:opacity-100">
                        <i className="fa-solid fa-arrow-up-right-from-square" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Task steps */}
            {agentMode === 'task' && steps.length > 0 && (
              <div className="space-y-1.5">
                {steps.map((s, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
                    s.status==='running' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700' :
                    s.status==='done' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' :
                    s.status==='error' ? 'bg-red-50 dark:bg-red-950/20 border-red-200' :
                    'bg-slate-50 dark:bg-white/3 border-transparent opacity-60'}`}>
                    <div className="mt-0.5 w-4 shrink-0 flex justify-center text-sm">
                      {s.status==='running' ? <i className="fa-solid fa-circle-notch animate-spin text-indigo-500" /> :
                       s.status==='done' ? <i className="fa-solid fa-check-circle text-emerald-500" /> :
                       s.status==='error' ? <i className="fa-solid fa-circle-xmark text-red-500" /> :
                       <i className="fa-regular fa-circle text-slate-300 dark:text-white/10" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 dark:text-slate-300">{s.description}</p>
                      {s.value && ['type','fill'].includes(s.action) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <code className="text-[9px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded max-w-[180px] truncate text-slate-600 dark:text-slate-300">{s.value}</code>
                          <button onClick={() => clip(s.value!, s.target)} className="text-[8px] font-black text-indigo-400 hover:text-indigo-500">Copy</button>
                        </div>
                      )}
                    </div>
                    {i === currentIdx && s.status === 'running' && <span className="text-[7px] font-black text-white bg-indigo-500 px-1.5 py-0.5 rounded-full shrink-0">NOW</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Gemini's analysis */}
            {thought && (
              <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><i className="fa-solid fa-eye" /> Gemini's analysis</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{thought}</p>
              </div>
            )}

            {/* Screenshot */}
            {screenshotPreview && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
                <div className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Last Screen Capture</span>
                </div>
                <img src={screenshotPreview} alt="" className="w-full max-h-48 object-contain bg-black" />
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div ref={logRef} className="rounded-xl bg-slate-900 dark:bg-black/60 p-3 max-h-40 overflow-y-auto border border-white/5">
                {log.map((l, i) => (
                  <p key={i} className={`text-[10px] font-mono leading-5 ${
                    l.startsWith('❌') ? 'text-red-400' : l.startsWith('✅') || l.startsWith('🏁') ? 'text-emerald-400' :
                    l.startsWith('🤖') || l.startsWith('▶') ? 'text-indigo-400' : l.startsWith('📋') ? 'text-amber-400' :
                    l.startsWith('📸') || l.startsWith('🧠') ? 'text-cyan-400' : l.startsWith('⛔') ? 'text-red-400' : 'text-slate-400'
                  }`}>{l}</p>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2 pt-1">
              {state === 'running' ? (
                <button onClick={stop} className="flex-1 py-3.5 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-stop" /> Stop
                </button>
              ) : (
                <button onClick={reset} className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-rotate-left" /> New Search
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserAgentWorkspace;
