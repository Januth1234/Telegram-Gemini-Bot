/**
 * BrowserAIWorkspace — Browser AI Mode (item 6)
 * Opens target AI site in the user's existing browser session (new tab),
 * copies prompt to clipboard, instructs user to paste + get result.
 * If extension connected: auto-navigate + extract response via DOM.
 */
import React, { useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { getDecryptedKey } from '../services/aiProviderService';

const AI_SITES = [
  { id: 'chatgpt',    name: 'ChatGPT',    url: 'https://chatgpt.com',         selector: '[data-message-author-role="assistant"]', icon: 'fa-robot',           color: 'text-emerald-500' },
  { id: 'gemini',     name: 'Gemini',     url: 'https://gemini.google.com',   selector: '.model-response-text',                  icon: 'fa-google',          color: 'text-blue-500' },
  { id: 'claude',     name: 'Claude',     url: 'https://claude.ai',           selector: '[data-is-streaming="false"] .prose',    icon: 'fa-c',               color: 'text-orange-500' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai',   selector: '.prose',                                icon: 'fa-magnifying-glass', color: 'text-cyan-500' },
] as const;

const EXT_KEY = 'orin_agent_ext_id';

async function extCmd(extId: string, action: string, data: Record<string,any> = {}) {
  return new Promise<any>(r => {
    if (!(window as any).chrome?.runtime?.sendMessage) { r({ error: 'no ext' }); return; }
    (window as any).chrome.runtime.sendMessage(extId, { action, data }, (resp: any) => {
      r((window as any).chrome.runtime.lastError ? { error: 'ext error' } : (resp || {}));
    });
  });
}

const BrowserAIWorkspace: React.FC = () => {
  const [prompt, setPrompt]   = useState('');
  const [target, setTarget]   = useState<typeof AI_SITES[number]['id']>('chatgpt');
  const [result, setResult]   = useState('');
  const [status, setStatus]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [mode, setMode]       = useState<'auto'|'manual'>('auto');

  const extId = localStorage.getItem(EXT_KEY);
  const hasExt = !!extId;

  const site = AI_SITES.find(s => s.id === target)!;

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setBusy(true); setResult(''); setStatus('');

    // First: try via user's own API key (fastest)
    const apiKey = getDecryptedKey(target);
    if (apiKey && ['chatgpt','openai'].includes(target as string)) {
      try {
        setStatus('Using OpenAI API key...');
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'gpt-4o', messages: [{ role:'user', content: prompt }], max_tokens: 2000 }),
        });
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) { setResult(text); setBusy(false); return; }
      } catch {}
    }

    if (mode === 'auto' && hasExt) {
      // Auto mode: use extension to navigate + extract
      try {
        setStatus(`Opening ${site.name}...`);
        await extCmd(extId!, 'navigate', { url: site.url });
        await new Promise(r => setTimeout(r, 3000));

        // Find and click the input
        setStatus('Finding input...');
        const typeR = await extCmd(extId!, 'type', { fieldHint: 'message', value: prompt });
        await new Promise(r => setTimeout(r, 500));

        // Press Enter
        await extCmd(extId!, 'press-key', { key: 'Enter' });
        setStatus('Waiting for response...');

        // Poll for response (up to 30s)
        let response = '';
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const content = await extCmd(extId!, 'get-page-content');
          const text = content?.content?.text || '';
          // Look for response after our prompt
          const idx = text.indexOf(prompt.slice(0, 30));
          if (idx > -1) {
            const after = text.slice(idx + prompt.length).trim().slice(0, 2000);
            if (after.length > 50) { response = after; break; }
          }
        }

        if (response) {
          setResult(response);
          setStatus('');
        } else {
          // Fallback: take screenshot + ask Gemini to read the answer
          setStatus('Reading response via screenshot...');
          const ss = await extCmd(extId!, 'screenshot');
          if (ss?.screenshot) {
            const v = await geminiService.computerUse({
              prompt: `Extract the AI's response to this prompt: "${prompt.slice(0,100)}". Return only the response text.`,
              screenshotBase64: ss.screenshot, mimeType: 'image/png',
            });
            setResult(v.text || 'Could not extract response.');
          }
          setStatus('');
        }
      } catch (e: any) {
        setStatus('Auto mode failed — switching to manual');
        setMode('manual');
      }
    } else {
      // Manual mode: copy prompt to clipboard + open site
      await navigator.clipboard.writeText(prompt).catch(() => {});
      window.open(site.url, '_blank', 'noopener');
      setStatus(`✅ Prompt copied to clipboard! Paste into ${site.name} (Ctrl+V)`);
    }
    setBusy(false);
  }, [prompt, target, mode, hasExt, extId, site]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-200 dark:border-white/5">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-wand-sparkles text-indigo-500" /> Browser AI Mode
        </h2>
        <p className="text-[9px] text-slate-400 mt-0.5">Route to ChatGPT, Gemini, Claude etc. using your logged-in session.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-xl mx-auto w-full">
        {/* Target selector */}
        <div className="grid grid-cols-4 gap-1.5">
          {AI_SITES.map(s => (
            <button key={s.id} onClick={() => setTarget(s.id)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
                target===s.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/3'}`}>
              <i className={`fa-brands ${s.icon} text-base ${target===s.id ? s.color : 'text-slate-400'}`} />
              <span className={`text-[8px] font-black uppercase ${target===s.id ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{s.name}</span>
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] text-slate-400">Mode</span>
          <div className="flex gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-white/5">
            {(['auto','manual'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  mode===m ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                {m === 'auto' ? `⚡ Auto${hasExt ? '' : ' (needs ext)'}` : '📋 Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && e.ctrlKey) run(); }}
          placeholder={`Ask ${site.name} anything...`}
          rows={4} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />

        <button onClick={run} disabled={busy || !prompt.trim()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
          {busy ? <><i className="fa-solid fa-circle-notch animate-spin" />{status || 'Working...'}</> :
            <><i className={`fa-brands ${site.icon}`} />Send to {site.name}</>}
        </button>

        {!busy && status && (
          <p className="text-[10px] text-slate-500 px-1">{status}</p>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Response from {site.name}</p>
              <button onClick={() => navigator.clipboard?.writeText(result)}
                className="text-[9px] font-black text-indigo-500 hover:text-indigo-600">Copy</button>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 dark:bg-black/50 border border-white/10">
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{result}</p>
            </div>
            {/* Send to Gemini for refinement */}
            <button onClick={async () => {
              setBusy(true);
              const v = await geminiService.chat(`Refine and improve this response:\n\n${result}`, { isPrivate: true });
              setResult(typeof v === 'string' ? v : (v as any)?.text || result);
              setBusy(false);
            }} disabled={busy}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40">
              <i className="fa-solid fa-rotate mr-1.5" />Refine with Gemini
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserAIWorkspace;
