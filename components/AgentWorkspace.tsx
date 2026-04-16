import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Language, UserAccount } from '../types';
import BrowserAgentWorkspace from './BrowserAgentWorkspace';
import BrowserAIWorkspace from './BrowserAIWorkspace';
import ExecutorControllerPage from './ExecutorControllerPage';
import { getAppShellKind } from '../services/appShellContext';

interface AgentWorkspaceProps {
  user: UserAccount | null;
  onClose: () => void;
  lang: Language;
  initialPrompt?: string;
}

type AgentPanel = 'browser' | 'desktop' | 'ai';

type LocalPcAgentStartResult = {
  ok: boolean;
  status?: string;
  detail?: string;
  error?: string;
};

declare global {
  interface Window {
    orinDesktop?: {
      version?: number;
      shell?: string;
      startLocalPcAgent?: () => Promise<LocalPcAgentStartResult>;
    };
  }
}

const getPanelFromHash = (): AgentPanel => {
  if (typeof window === 'undefined') return 'browser';
  const hashPart = window.location.hash.replace(/^#+/, '');
  const [, qs = ''] = hashPart.split('?', 2);
  const params = new URLSearchParams(qs);
  return params.get('panel') === 'desktop' ? 'desktop' : 'browser';
};

const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ user, onClose, lang, initialPrompt }) => {
  const [panel, setPanel] = useState<AgentPanel>(() => getPanelFromHash());
  const [localAgentState, setLocalAgentState] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [localAgentMessage, setLocalAgentMessage] = useState<string>('');
  const desktopActivationAttempted = useRef(false);

  const shell = getAppShellKind();

  const setHashPanel = useCallback((nextPanel: AgentPanel) => {
    if (typeof window === 'undefined') return;
    const nextHash = nextPanel === 'desktop' ? 'agent?panel=desktop' : 'agent';
    if (window.location.hash.replace(/^#+/, '') === nextHash) return;
    window.location.hash = nextHash;
  }, []);

  const ensureDesktopAgent = useCallback(async () => {
    if (shell !== 'desktop') return;
    if (desktopActivationAttempted.current) return;
    desktopActivationAttempted.current = true;
    const start = window.orinDesktop?.startLocalPcAgent;
    if (!start) {
      setLocalAgentState('error');
      setLocalAgentMessage('Desktop bridge unavailable. Run the desktop shell build that includes local agent startup.');
      return;
    }
    setLocalAgentState('starting');
    setLocalAgentMessage('Starting local Python agent...');
    try {
      const result = await start();
      if (result?.ok) {
        setLocalAgentState('ready');
        const statusText = result.status || 'running';
        setLocalAgentMessage(`Local Python agent is ${statusText}.`);
      } else {
        setLocalAgentState('error');
        setLocalAgentMessage(result?.error || result?.detail || 'Could not start local Python agent.');
      }
    } catch (err: any) {
      setLocalAgentState('error');
      setLocalAgentMessage(err?.message || 'Could not start local Python agent.');
    }
  }, [shell]);

  useEffect(() => {
    const onHash = () => setPanel(getPanelFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (panel === 'desktop') {
      ensureDesktopAgent();
    }
  }, [panel, ensureDesktopAgent]);

  const shellHint = useMemo(() => {
    if (shell === 'desktop') {
      return 'Desktop shell detected. Browser actions stay in-browser, and desktop commands run through your local Python PC agent.';
    }
    if (shell === 'mobile') {
      return 'Mobile shell detected. Use this as a controller and dispatch commands to a paired PC agent.';
    }
    return 'Web mode detected. You can run browser automation directly and send desktop commands to a paired PC from this browser too.';
  }, [shell]);

  const localAgentBadge = useMemo(() => {
    if (shell !== 'desktop' || panel !== 'desktop') return null;
    if (localAgentState === 'starting') return { cls: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300', text: localAgentMessage || 'Starting local Python agent...' };
    if (localAgentState === 'ready') return { cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', text: localAgentMessage || 'Local Python agent running' };
    if (localAgentState === 'error') return { cls: 'bg-red-500/10 text-red-700 dark:text-red-300', text: localAgentMessage || 'Local Python agent failed to start' };
    return { cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', text: 'Open Desktop Agent to initialize local Python runtime.' };
  }, [localAgentMessage, localAgentState, panel, shell]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white/90 text-slate-900 dark:bg-slate-900/95 dark:text-slate-100">
      <header className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="tap-target text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400"
          >
            {'<-'} Back
          </button>
          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Orin AI</div>
            <h1 className="text-sm font-black uppercase tracking-widest">Agents</h1>
          </div>
          <span className="w-12" />
        </div>
      </header>

      <div className="shrink-0 border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-white/10">
            <button
              type="button"
              onClick={() => {
                setPanel('browser');
                setHashPanel('browser');
              }}
              className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] transition-colors ${
                panel === 'browser' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900' : 'text-slate-500'
              }`}
            >
              Browser Agent
            </button>
            <button
              type="button"
              onClick={() => {
                setPanel('desktop');
                setHashPanel('desktop');
              }}
              className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] transition-colors ${
                panel === 'desktop' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900' : 'text-slate-500'
              }`}
            >
              Desktop Agent
            </button>
            <button
              type="button"
              onClick={() => { setPanel('ai'); setHashPanel('ai' as any); }}
              className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] transition-colors ${
                panel === 'ai' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900' : 'text-slate-500'
              }`}
            >
              Browser AI
            </button>
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-950 dark:text-indigo-100">
            {shellHint}
          </div>

          {localAgentBadge && (
            <div className={`rounded-2xl border border-transparent px-3 py-2 text-xs font-semibold ${localAgentBadge.cls}`}>
              {localAgentBadge.text}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {panel === 'browser' ? (
          <BrowserAgentWorkspace user={user} onClose={onClose} lang={lang} initialPrompt={initialPrompt} embedded />
        ) : panel === 'desktop' ? (
          <ExecutorControllerPage onClose={onClose} lang={lang} embedded onActivate={ensureDesktopAgent} />
        ) : (
          <BrowserAIWorkspace />
        )}
      </div>
    </div>
  );
};

export default AgentWorkspace;
