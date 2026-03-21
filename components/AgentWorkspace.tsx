import React, { useState, useRef } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { translations } from '../translations';
import { Language, UserAccount } from '../types';

interface AgentWorkspaceProps {
  user: UserAccount | null;
  onClose: () => void;
  lang: Language;
  /** When opening Agent from the bar with a prompt, pre-fill the task input. */
  initialPrompt?: string;
}

type ContentTurn = { role: 'user' | 'model'; parts: unknown[] };

const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ user, onClose, lang, initialPrompt = '' }) => {
  const t = translations[lang];
  const plan = user?.plan?.toLowerCase() ?? '';
  const isPro = plan === 'pro' || plan === 'pro_yearly';

  const [task, setTask] = useState(initialPrompt);
  const [contents, setContents] = useState<ContentTurn[]>([]);
  const [lastText, setLastText] = useState('');
  const [lastCalls, setLastCalls] = useState<Array<{ name: string; args: Record<string, unknown> }>>([]);
  const [safetyDecisions, setSafetyDecisions] = useState<Array<{ explanation?: string; decision?: string }>>([]);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      setScreenshotBase64(base64 || null);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startAgent = async () => {
    if (!task.trim() || !isPro) return;
    setError(null);
    setLoading(true);
    setLastText('');
    setLastCalls([]);
    setContents([]);
    try {
      const result = await geminiService.computerUse({ prompt: task.trim() });
      setLastText(result.text);
      setLastCalls(result.functionCalls);
      setSafetyDecisions(result.safetyDecisions);
      setContents([
        { role: 'user', parts: [{ text: task.trim() }] },
        {
          role: 'model',
          parts: [
            ...(result.text ? [{ text: result.text }] : []),
            ...result.functionCalls.map(fc => ({ functionCall: { name: fc.name, args: fc.args } })),
          ].filter(Boolean),
        },
      ]);
    } catch (e) {
      const msg = e instanceof AppError ? e.message : (e instanceof Error ? e.message : 'Request failed');
      setError(msg);
      if (e instanceof AppError && e.type === 'plan_required') setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const runNextStep = async () => {
    if (!screenshotBase64 || contents.length === 0 || lastCalls.length === 0 || !isPro) return;
    setError(null);
    setLoading(true);
    const functionResponses = lastCalls.map(fc => ({
      name: fc.name,
      response: { url: typeof window !== 'undefined' ? window.location.href : '' },
      parts: [{ inlineData: { data: screenshotBase64, mimeType: 'image/png' } }],
    }));
    const nextContents: ContentTurn[] = [
      ...contents,
      {
        role: 'user',
        parts: functionResponses.map(fr => ({ functionResponse: fr })),
      },
    ];
    try {
      const result = await geminiService.computerUse({ contents: nextContents });
      setLastText(result.text);
      setLastCalls(result.functionCalls);
      setSafetyDecisions(result.safetyDecisions);
      setContents([
        ...nextContents,
        {
          role: 'model',
          parts: [
            ...(result.text ? [{ text: result.text }] : []),
            ...result.functionCalls.map(fc => ({ functionCall: { name: fc.name, args: fc.args } })),
          ].filter(Boolean),
        },
      ]);
      setScreenshotBase64(null);
      setScreenshotName('');
    } catch (e) {
      const msg = e instanceof AppError ? e.message : (e instanceof Error ? e.message : 'Request failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4">{t.connectToContinue}</p>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">
          {t.back}
        </button>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
          <i className="fa-solid fa-robot text-2xl text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{t.agent}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{t.agentProOnly}</p>
        <div className="flex gap-3">
          <button onClick={() => { window.location.hash = 'pricing'; }} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest">
            {t.pricing}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-widest">
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500" aria-label={t.back}>
            <i className="fa-solid fa-arrow-left" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{t.agent}</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Computer Use • Pro</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {contents.length === 0 && !loading && (
          <div className="max-w-xl mx-auto text-center py-12">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Describe a browser task. Orin will suggest clicks, typing, and navigation. Paste a screenshot after each step to continue.</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
            {error}
          </div>
        )}

        {lastText && (
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">{t.analyst}</p>
            <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{lastText}</p>
          </div>
        )}

        {safetyDecisions.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">Confirmation suggested</p>
            {safetyDecisions.map((s, i) => (
              <p key={i} className="text-xs text-amber-800 dark:text-amber-200">{s.explanation || s.decision}</p>
            ))}
          </div>
        )}

        {lastCalls.length > 0 && (
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-[10px] font-black text-cyan-700 dark:text-indigo-400 uppercase tracking-widest mb-2">{t.agentSuggestedActions}</p>
            <ul className="space-y-2">
              {lastCalls.map((fc, i) => (
                <li key={i} className="text-xs font-mono text-slate-800 dark:text-slate-200">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{fc.name}</span>
                  {Object.keys(fc.args).length > 0 && <span className="text-slate-500"> {JSON.stringify(fc.args)}</span>}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">Paste a screenshot below and click &quot;{t.agentNextStep}&quot; to continue.</p>
          </div>
        )}

        {lastCalls.length === 0 && lastText && contents.length >= 2 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{t.agentDone}</p>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-slate-200 dark:border-white/5 space-y-3">
        {contents.length === 0 ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && startAgent()}
              placeholder={t.agentTaskPlaceholder}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button
              onClick={startAgent}
              disabled={loading || !task.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-play" />}
              {t.agentStart}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <i className="fa-solid fa-image" />
                {screenshotName || t.agentPasteScreenshot}
              </button>
              {screenshotBase64 && (
                <button
                  onClick={runNextStep}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-forward" />}
                  {t.agentNextStep}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AgentWorkspace;
