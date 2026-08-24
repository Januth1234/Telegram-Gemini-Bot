import React, { useCallback, useEffect, useRef, useState } from 'react';
import { firebaseService } from '../services/firebaseService';

interface RelayLogEntry { k: string; text: string; ts?: unknown }
interface RelayState {
  onlineAgeSec: number | null;
  frame: { jpeg: string; w: number; h: number } | null;
  log: RelayLogEntry[];
}

const POLL_MS = 2000;

/**
 * Chrome-Remote-Desktop-style view of your own PC, streamed by the Orin desktop app.
 * Left: live screen. Right: small chat — type what to do, the desktop agent does it.
 */
const ComputerRemote: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [state, setState] = useState<RelayState>({ onlineAgeSec: null, frame: null, log: [] });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const online = state.onlineAgeSec != null && state.onlineAgeSec < 45;

  const poll = useCallback(async () => {
    try {
      const token = await firebaseService.getIdToken();
      const res = await fetch('/api/cu-relay', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`relay ${res.status}`);
      setState(await res.json());
      setError(null);
    } catch {
      setError('Lost connection to the relay. Retrying…');
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(() => { void poll(); }, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.log.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!online) { setError('Your PC is not connected. Open the Orin desktop app and enable Remote access.'); return; }
    setSending(true);
    try {
      const token = await firebaseService.getIdToken();
      const res = await fetch('/api/cu-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'say', text }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to send');
      setInput('');
      void poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col animate-reveal">
      <header className="shrink-0 h-16 flex items-center justify-between px-5 md:px-8 border-b border-black/[0.05] dark:border-white/[0.05] bg-white/70 dark:bg-stone-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-stone-800 dark:text-white">My computer</h2>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
            online
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
              : 'bg-stone-500/10 text-stone-500 border-stone-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} aria-hidden />
            {online ? `PC connected · ${state.onlineAgeSec}s ago` : 'PC offline'}
          </span>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]" aria-label="Back"><i className="fa-solid fa-xmark" /></button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Screen */}
        <div className="flex-1 min-h-[40vh] bg-stone-950 relative flex items-center justify-center p-3 md:p-6 overflow-hidden">
          {state.frame ? (
            <img
              src={`data:image/jpeg;base64,${state.frame.jpeg}`}
              alt="Live screen from your PC"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
            />
          ) : (
            <div className="text-center px-8 max-w-md space-y-4">
              <i className="fa-solid fa-desktop text-5xl text-stone-700" aria-hidden />
              <p className="text-sm text-stone-400 font-semibold">
                {online
                  ? 'Connected — waiting for the first frame…'
                  : 'Your PC is not sharing yet.'}
              </p>
              {!online && (
                <ol className="text-xs text-stone-500 space-y-2 text-left list-none">
                  <li>1. Open the <span className="font-bold text-stone-300">Orin AI desktop app</span> on your PC</li>
                  <li>2. Sign in with the same Orin account</li>
                  <li>3. Go to <span className="font-bold text-stone-300">Computer Use → Remote access</span> and turn it on</li>
                </ol>
              )}
            </div>
          )}
          {error && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium backdrop-blur">
              {error}
            </div>
          )}
        </div>

        {/* Instruction chat */}
        <aside className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-black/[0.05] dark:border-white/[0.05] bg-stone-50 dark:bg-[#121110] flex flex-col h-[46vh] lg:h-auto">
          <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.05]">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Tell your PC what to do</span>
          </div>
          <div ref={transcriptRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 min-h-0">
            {state.log.length === 0 && (
              <p className="text-xs text-stone-400 dark:text-stone-500 p-3 leading-relaxed">
                Try: “open Chrome and search for weather in Colombo” — Orin will drive the mouse and keyboard on your PC and report back here.
              </p>
            )}
            {state.log.map((e, i) => <RelayBubble key={i} entry={e} />)}
          </div>
          <div className="p-3 border-t border-black/[0.05] dark:border-white/[0.05]">
            <div className="rounded-2xl bg-white dark:bg-stone-900 border border-black/[0.07] dark:border-white/[0.08] shadow-sm p-1.5 flex items-end gap-1.5">
              <textarea
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder={online ? 'e.g. open Notepad and type hello' : 'Waiting for your PC…'}
                disabled={!online}
                className="flex-1 resize-none max-h-28 bg-transparent outline-none px-2 py-1.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 custom-scrollbar disabled:opacity-50"
              />
              <button onClick={() => void send()} disabled={!online || sending || !input.trim()}
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 text-stone-950 disabled:opacity-30 transition-opacity" aria-label="Send instruction">
                {sending ? <i className="fa-solid fa-circle-notch fa-spin text-[11px]" /> : <i className="fa-solid fa-arrow-up text-xs" />}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

function RelayBubble({ entry }: { entry: RelayLogEntry }) {
  const mine = entry.k === 'user';
  const tone =
    entry.k === 'done' ? 'text-emerald-600 dark:text-emerald-400'
    : entry.k === 'error' ? 'text-red-500'
    : 'text-stone-600 dark:text-stone-300';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={
        mine
          ? 'max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-gradient-to-br from-amber-500 to-orange-500 text-stone-950 text-xs font-semibold shadow-sm'
          : `max-w-[92%] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-black/[0.05] dark:border-white/[0.06] text-xs leading-relaxed ${tone}`
      }>
        {!mine && (entry.k === 'action' || entry.k === 'status') && (
          <i className={`fa-solid ${entry.k === 'action' ? 'fa-hand-pointer' : 'fa-satellite-dish'} text-[9px] mr-1.5 opacity-60`} aria-hidden />
        )}
        {entry.text}
      </div>
    </div>
  );
}

export default ComputerRemote;
