import React, { useEffect, useState } from 'react';

export interface Artifact {
  title: string;
  language: string;
  code: string;
}

/**
 * Claude-style artifact viewer: slides in beside the conversation showing one
 * substantial piece of content (code file, document) with copy/download/edit.
 */
const ArtifactPanel: React.FC<{ artifact: Artifact | null; onClose: () => void }> = ({ artifact, onClose }) => {
  const [wrap, setWrap] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (artifact) {
      setDraft(artifact.code);
      setEditing(false);
      setCopied(false);
    }
  }, [artifact]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!artifact) return null;
  const lines = draft.split('\n');
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(artifact.title)?.[1]) ||
    ({ javascript: 'js', typescript: 'ts', python: 'py', html: 'html', css: 'css', json: 'json', bash: 'sh' } as Record<string, string>)[artifact.language] || 'txt';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const download = () => {
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.title.includes('.') ? artifact.title : `${artifact.title}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Scrim (mobile) */}
      <div className="fixed inset-0 z-[180] bg-black/40 lg:hidden animate-fade" onClick={onClose} aria-hidden />
      <aside className="fixed z-[190] inset-x-0 bottom-0 top-16 lg:inset-y-0 lg:left-auto lg:w-[min(760px,58vw)] flex flex-col bg-white dark:bg-stone-950 border-l border-t lg:border-t-0 border-black/[0.07] dark:border-white/[0.08] shadow-2xl animate-slide-in-right">
        {/* Header */}
        <header className="shrink-0 flex items-center gap-3 px-4 md:px-5 h-14 border-b border-black/[0.05] dark:border-white/[0.06]">
          <i className="fa-solid fa-file-code text-cyan-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate">{artifact.title}</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {artifact.language || 'text'} · {lines.length} lines
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors" aria-label="Close artifact">
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-black/[0.05] dark:border-white/[0.06] overflow-x-auto no-scrollbar">
          <PanelButton onClick={copy} icon={copied ? 'fa-check' : 'fa-copy'} label={copied ? 'Copied' : 'Copy'} />
          <PanelButton onClick={download} icon="fa-download" label="Download" />
          <PanelButton onClick={() => setWrap(w => !w)} icon="fa-arrows-left-right-to-line" label={wrap ? 'No wrap' : 'Wrap'} active={wrap} />
          <PanelButton
            onClick={() => {
              if (editing) setDraft(artifact.code);
              setEditing(e => !e);
            }}
            icon={editing ? 'fa-rotate-left' : 'fa-pen'}
            label={editing ? 'Reset' : 'Edit'}
            active={editing}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-stone-50 dark:bg-[#0b0a09]">
          {editing ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-full resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-stone-800 dark:text-stone-200 outline-none"
            />
          ) : (
            <pre className={`p-4 font-mono text-xs leading-relaxed text-stone-800 dark:text-stone-200 ${wrap ? 'whitespace-pre-wrap break-all' : ''}`}>
              {lines.map((line, i) => (
                <div key={i} className="flex hover:bg-cyan-500/[0.06] rounded px-1 -mx-1">
                  <span className="select-none w-10 shrink-0 text-right pr-3 text-stone-300 dark:text-stone-600 tabular-nums">{i + 1}</span>
                  <span className="flex-1">{line || ' '}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </aside>
    </>
  );
};

const PanelButton: React.FC<{ onClick: () => void; icon: string; label: string; active?: boolean }> = ({ onClick, icon, label, active }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
      active
        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
        : 'border-stone-200 dark:border-white/10 text-stone-500 hover:text-stone-800 dark:hover:text-stone-100'
    }`}
  >
    <i className={`fa-solid ${icon} text-[9px]`} aria-hidden /> {label}
  </button>
);

export default ArtifactPanel;
