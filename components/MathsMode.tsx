
import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../translations';

declare const nerdamer: any;
const MathFieldTag = 'math-field' as any;

type MathCategory = 'General' | 'Algebra' | 'Trigonometry' | 'Calculus' | 'Linear Algebra' | 'Statistics' | 'Physics';

interface MathTool {
  label: string;
  command: string; 
  type: 'insert' | 'action' | 'ai'; 
  desc: string;
}

const CATEGORIES: Record<MathCategory, { icon: string; tools: MathTool[] }> = {
  'General': {
    icon: 'fa-calculator',
    tools: [
      { label: 'Simplify', command: 'simplify', type: 'action', desc: 'Simplify' },
      { label: 'Evaluate', command: 'evaluate', type: 'action', desc: 'Numeric' },
      { label: 'AI Explain', command: 'ai_explain', type: 'ai', desc: 'Steps' },
      { label: 'Fraction', command: '\\frac{\\placeholder}{\\placeholder}', type: 'insert', desc: 'a/b' },
      { label: 'Sqrt', command: '\\sqrt{\\placeholder}', type: 'insert', desc: 'Root' },
      { label: 'Power', command: '^\\placeholder', type: 'insert', desc: 'x^n' },
    ]
  },
  'Algebra': {
    icon: 'fa-x',
    tools: [
      { label: 'Solve for x', command: 'solve', type: 'action', desc: 'Find x' },
      { label: 'Factor', command: 'factor', type: 'action', desc: 'Factor' },
      { label: 'Expand', command: 'expand', type: 'action', desc: 'Expand' },
    ]
  },
  'Trigonometry': {
    icon: 'fa-wave-square',
    tools: [
      { label: 'Sin', command: '\\sin(\\placeholder)', type: 'insert', desc: 'Sin' },
      { label: 'Cos', command: '\\cos(\\placeholder)', type: 'insert', desc: 'Cos' },
      { label: 'Tan', command: '\\tan(\\placeholder)', type: 'insert', desc: 'Tan' },
    ]
  },
  'Calculus': {
    icon: 'fa-infinity',
    tools: [
      { label: 'Diff', command: 'diff', type: 'action', desc: 'd/dx' },
      { label: 'Integral', command: 'integrate', type: 'action', desc: 'Integral' },
    ]
  },
  'Linear Algebra': {
    icon: 'fa-border-all',
    tools: [
      { label: 'Det', command: 'determinant', type: 'action', desc: '|A|' },
      { label: 'Invert', command: 'invert', type: 'action', desc: 'Inverse' },
    ]
  },
  'Statistics': {
    icon: 'fa-chart-bar',
    tools: [
      { label: 'Mean', command: 'mean', type: 'action', desc: 'Mean' },
      { label: 'Median', command: 'median', type: 'action', desc: 'Median' },
    ]
  },
  'Physics': {
    icon: 'fa-atom',
    tools: [
      { label: 'Newton', command: 'F = m \\cdot a', type: 'insert', desc: 'Force' },
      { label: 'Einstein', command: 'E = m \\cdot c^2', type: 'insert', desc: 'Energy' },
    ]
  }
};

interface MathsModeProps {
  onClose: () => void; 
  lang: Language; 
  embedded?: boolean;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isTyping: boolean;
}

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const mfRef = useRef<any>(null);

  useEffect(() => {
    if (mfRef.current) {
      mfRef.current.smartMode = true;
      mfRef.current.virtualKeyboardMode = "manual";
      setTimeout(() => mfRef.current.focus(), 200);
    }
  }, []);

  const handleAction = async (command: string) => {
    const rawLatex = mfRef.current?.value;
    if (!rawLatex) return;
    
    if (command === 'ai_explain') {
        onSend(`Please solve this math problem step-by-step and provide a clear final answer: ${rawLatex}`);
        return;
    }
    
    onSend(`Execute ${command} on this mathematical expression: ${rawLatex}. Briefly summarize the result and provide any necessary steps.`);
  };

  const insertSymbol = (cmd: string) => {
    if (mfRef.current) {
        mfRef.current.executeCommand(['insert', cmd]);
        mfRef.current.focus();
    }
  };

  const containerClass = embedded 
    ? "flex-1 flex flex-col md:flex-row overflow-hidden h-full bg-slate-50/50 dark:bg-slate-950/50" 
    : "fixed inset-0 z-[120] bg-white dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden";

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-20 shrink-0 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50 sticky top-0">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                 <i className="fa-solid fa-square-root-variable text-xl"></i>
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">{t.math.title}</h2>
                <span className="text-[8px] font-black text-cyan-600 uppercase tracking-widest mt-1">BETA v4.0</span>
              </div>
           </div>
           <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all active:scale-90"><i className="fa-solid fa-xmark text-xl"></i></button>
        </header>
      )}

      <nav className="w-full md:w-64 bg-white/50 dark:bg-slate-900/20 border-r border-black/5 dark:border-white/5 p-4 flex md:flex-col gap-2 overflow-x-auto no-scrollbar shrink-0 backdrop-blur-xl">
          {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all min-w-max md:w-full border ${
                  activeCat === cat 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/10' 
                  : 'text-slate-500 hover:bg-white dark:hover:bg-white/5 border-transparent'
                }`}
              >
                <i className={`fa-solid ${CATEGORIES[cat].icon} text-sm opacity-70`}></i>
                {cat}
              </button>
          ))}
      </nav>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8 pb-40">
          <div className="max-w-4xl mx-auto space-y-6">
              <div className="glass-panel rounded-[32px] p-6 border border-indigo-500/20 shadow-xl bg-white dark:bg-slate-900 relative">
                <div className="absolute top-4 left-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Visual Math Input</div>
                <MathFieldTag ref={mfRef} className="w-full text-xl md:text-2xl p-4 bg-transparent text-slate-900 dark:text-white outline-none mt-4"></MathFieldTag>
              </div>
              
              <div className="flex flex-wrap gap-2 animate-reveal">
                {CATEGORIES[activeCat].tools.map((tool, i) => (
                    <button
                      key={i}
                      onClick={() => (tool.type === 'action' || tool.type === 'ai') ? handleAction(tool.command) : insertSymbol(tool.command)}
                      disabled={isTyping}
                      className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 disabled:opacity-50 ${
                        tool.type === 'action' ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/10' : 
                        tool.type === 'ai' ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-600/10' :
                        'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50'
                      }`}
                    >
                      {tool.label}
                    </button>
                ))}
              </div>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
              {messages.length > 0 && messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                    <div className={`max-w-[95%] md:max-w-[85%] p-6 md:p-10 rounded-[40px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                      <div className={`text-sm md:text-lg leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                    </div>
                </div>
              ))}
              {isTyping && (
              <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 w-fit shadow-sm">
                <div className="flex gap-1">
                  {[0, 150, 300].map(delay => <div key={delay} className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>)}
                </div>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Solving Engine Active...</span>
              </div>
              )}
          </div>
      </main>
    </div>
  );
};

export default MathsMode;
