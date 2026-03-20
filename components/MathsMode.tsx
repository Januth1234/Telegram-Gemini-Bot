
import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';

const MathFieldTag = 'math-field' as any;

type MathCategory = 'General' | 'Algebra' | 'Geometry' | 'Calculus' | 'Stats' | 'Physics';

const CATEGORIES: Record<MathCategory, { icon: string; tools: { label: string, cmd: string, type: 'insert' | 'action' }[] }> = {
  'General': { icon: 'fa-calculator', tools: [
    { label: 'Simplify', cmd: 'simplify', type: 'action' },
    { label: 'Fraction', cmd: '\\frac{\\placeholder}{\\placeholder}', type: 'insert' },
    { label: 'Sqrt', cmd: '\\sqrt{\\placeholder}', type: 'insert' },
    { label: 'Power', cmd: '^\\placeholder', type: 'insert' },
  ]},
  'Algebra': { icon: 'fa-x', tools: [
    { label: 'Solve', cmd: 'solve', type: 'action' },
    { label: 'Factor', cmd: 'factor', type: 'action' },
    { label: 'Expand', cmd: 'expand', type: 'action' },
  ]},
  'Geometry': { icon: 'fa-shapes', tools: [
    { label: 'Area', cmd: 'calculate area', type: 'action' },
    { label: 'Volume', cmd: 'calculate volume', type: 'action' },
    { label: 'Pi', cmd: '\\pi', type: 'insert' },
  ]},
  'Calculus': { icon: 'fa-infinity', tools: [
    { label: 'Derivative', cmd: 'find derivative', type: 'action' },
    { label: 'Integral', cmd: 'find integral', type: 'action' },
    { label: 'Limit', cmd: '\\lim_{x \\to \\infty}', type: 'insert' },
  ]},
  'Stats': { icon: 'fa-chart-bar', tools: [
    { label: 'Mean', cmd: 'calculate mean', type: 'action' },
    { label: 'Median', cmd: 'calculate median', type: 'action' },
    { label: 'Std Dev', cmd: 'standard deviation', type: 'action' },
  ]},
  'Physics': { icon: 'fa-atom', tools: [
    { label: 'Evaluate', cmd: 'evaluate', type: 'action' },
    { label: 'Force', cmd: 'F = ma', type: 'insert' },
    { label: 'Energy', cmd: 'E = mc^2', type: 'insert' },
  ]},
};

const MATHLIVE_SCRIPT = 'https://unpkg.com/mathlive';

interface MathsModeProps {
  onClose: () => void;
  lang: Language;
  embedded?: boolean;
  messages: ChatMessage[];
  onSend: (text: string, file?: { data: string; mimeType: string; name: string }) => void;
  isTyping: boolean;
}

interface AiMessage { id: string; content: string; isAI: boolean; }

function parseMethodBlocks(text: string): { name: string; steps: string[] }[] {
  const re = /---METHOD:\s*(.+?)\s*---\n([\s\S]*?)---ENDMETHOD---/gi;
  const out: { name: string; steps: string[] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ name: m[1].trim(), steps: m[2].trim().split('\n').filter(l => l.trim()) });
  }
  if (!out.length && text.trim()) {
    out.push({ name: 'Solution', steps: text.trim().split('\n').filter(l => l.trim()) });
  }
  return out;
}

const MathResultCard: React.FC<{ content: string }> = ({ content }) => {
  const methods = parseMethodBlocks(content);
  const [active, setActive] = useState(0);
  const m = methods[active];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-indigo-500/20 shadow-lg overflow-hidden w-full">
      {methods.length > 1 && (
        <div className="flex gap-2 p-3 border-b border-black/5 dark:border-white/5 flex-wrap">
          {methods.map((mm, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${active === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-50'}`}>
              {mm.name}
            </button>
          ))}
        </div>
      )}
      <div className="p-5 space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2 mb-3">
          <i className="fa-solid fa-list-check" />{m.name}
        </div>
        {m.steps.map((step, i) => {
          const isFinal = /^final answer/i.test(step);
          return (
            <div key={i} className={`flex gap-3 items-start ${isFinal ? 'pt-3 border-t border-indigo-200 dark:border-indigo-800 mt-2' : ''}`}>
              {!isFinal && <span className="text-[9px] font-black text-indigo-400 mt-0.5 shrink-0 w-5">{i + 1}.</span>}
              <span className={`text-sm leading-relaxed font-mono ${isFinal ? 'font-black text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [mathLiveReady, setMathLiveReady] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const mfRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (customElements.get('math-field')) { setMathLiveReady(true); return; }
    const existing = document.querySelector(`script[src="${MATHLIVE_SCRIPT}"]`);
    if (existing) { setMathLiveReady(true); return; }
    const script = document.createElement('script');
    script.src = MATHLIVE_SCRIPT; script.async = true;
    script.onload = () => setMathLiveReady(true);
    script.onerror = () => setMathLiveReady(false);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mathLiveReady || !mfRef.current) return;
    mfRef.current.smartMode = true;
    mfRef.current.virtualKeyboardMode = 'manual';
    setTimeout(() => mfRef.current?.focus(), 300);
  }, [mathLiveReady]);

  const handleAction = async (command: string) => {
    const rawLatex = mfRef.current?.value?.trim();
    if (!rawLatex && !selectedFile) return;
    setIsSolving(true);
    setStatusMsg('Generating step-by-step solution…');
    const fileData = selectedFile || undefined;
    try {
      let prompt: string;
      if (fileData && !rawLatex) {
        prompt = `Analyze this math problem image and ${command}. Show every step.`;
      } else if (fileData && rawLatex) {
        prompt = `Math image provided. Expression: ${rawLatex}. ${command}. Show every step.`;
      } else {
        prompt = `${command} the expression: ${rawLatex}`;
      }
      const result = await geminiService.solveMathWithAI({ prompt, fileData });
      const id = `m-${Date.now()}`;
      setAiMessages(prev => [...prev,
        { id: `${id}-q`, content: rawLatex || '(image)', isAI: false },
        { id: `${id}-a`, content: result, isAI: true },
      ]);
    } catch (err: any) {
      // Fallback to main chat (e.g. plan limit reached)
      const prompt = fileData ? `Solve this math problem. ${command}.` : `${command}: ${rawLatex}. Show full step-by-step working.`;
      onSend(prompt, fileData);
    } finally {
      setIsSolving(false);
      setStatusMsg(null);
      if (selectedFile) setSelectedFile(null);
    }
  };

  const insertSymbol = (cmd: string) => {
    if (mfRef.current) { mfRef.current.executeCommand(['insert', cmd]); mfRef.current.focus(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB).'); return; }
    const r = new FileReader();
    r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
    r.readAsDataURL(file);
    e.target.value = '';
  };

  const containerClass = embedded
    ? 'flex-1 flex flex-col md:flex-row overflow-hidden h-full bg-slate-50 dark:bg-slate-950 pb-20'
    : 'fixed inset-0 z-[120] bg-white dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden';

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
              <i className="fa-solid fa-square-root-variable text-lg" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">Math Solver</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-300">Beta</span>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </header>
      )}

      <nav className="w-full md:w-56 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 p-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
        {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-w-max md:w-full border ${
              activeCat === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-500 hover:bg-white dark:hover:bg-white/5 border-transparent'
            }`}>
            <i className={`fa-solid ${CATEGORIES[cat].icon} text-sm w-5 text-center`} />
            {cat}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-1 border border-indigo-500/20 shadow-xl relative transition-all ring-0 focus-within:ring-2 ring-indigo-500/20">
            <div className="flex items-center justify-between px-4 py-2 border-b border-black/5 dark:border-white/5">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square" />Equation Editor
              </div>
              <div className="flex gap-2">
                <button onClick={() => { if (mfRef.current) mfRef.current.value = ''; setSelectedFile(null); }}
                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors" title="Clear">
                  <i className="fa-solid fa-trash text-[10px]" />
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${selectedFile ? 'bg-emerald-500 text-white border-emerald-500' : 'text-slate-500 border-slate-200 dark:border-white/10 hover:bg-slate-50'}`}>
                  <i className="fa-solid fa-camera" />{selectedFile ? 'Image ✓' : 'Photo'}
                </button>
              </div>
            </div>

            {statusMsg && (
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-indigo-500 text-xs" />
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{statusMsg}</span>
              </div>
            )}

            {selectedFile && (
              <div className="p-4 bg-slate-50 dark:bg-black/20">
                <div className="relative w-fit">
                  <button onClick={() => setSelectedFile(null)} className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-90">
                    <i className="fa-solid fa-xmark text-[8px]" />
                  </button>
                  <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="h-24 rounded-lg border border-black/10 dark:border-white/10 shadow-sm" alt="Attached" />
                </div>
              </div>
            )}

            {mathLiveReady ? (
              <MathFieldTag ref={mfRef}
                className="w-full text-xl md:text-3xl p-6 bg-transparent text-slate-900 dark:text-white outline-none min-h-[80px]"
                style={{ '--caret-color': '#4f46e5', '--selection-background-color': '#4f46e550' }}
              />
            ) : (
              <div className="w-full min-h-[80px] p-6 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-500 text-sm">Loading math input…</div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="flex flex-wrap gap-2 animate-reveal">
            {CATEGORIES[activeCat].tools.map((tool, i) => (
              <button key={i}
                onClick={() => tool.type === 'action' ? handleAction(tool.cmd) : insertSymbol(tool.cmd)}
                disabled={isTyping || isSolving}
                className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${
                  tool.type === 'action' ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-indigo-500/50'
                }`}>
                {tool.label}
              </button>
            ))}
            <button onClick={() => handleAction('Solve and show all steps for')} disabled={isTyping || isSolving}
              className="flex-1 min-w-[120px] px-4 py-3 rounded-xl bg-cyan-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-cyan-500 shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {isSolving ? <><i className="fa-solid fa-circle-notch fa-spin mr-2" />Solving…</> : 'Solve With AI'}
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-6 pb-12">
          {aiMessages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles" />Step-by-Step Solution
                </span>
                <button onClick={() => setAiMessages([])} className="text-[9px] px-2 py-1 rounded-full border border-slate-200 dark:border-white/10 text-slate-400 hover:text-red-500">Clear</button>
              </div>
              {aiMessages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.isAI ? 'items-start' : 'items-end'} animate-reveal`}>
                  {msg.isAI
                    ? <MathResultCard content={msg.content} />
                    : <div className="bg-indigo-600 text-white px-5 py-3 rounded-[18px] rounded-tr-none text-sm font-mono max-w-full">{msg.content}</div>
                  }
                </div>
              ))}
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
              <div className={`max-w-full p-6 rounded-[24px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 w-fit shadow-sm">
              <div className="flex gap-1">{[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Calculating...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MathsMode;
