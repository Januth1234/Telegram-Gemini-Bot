
import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../translations';

// We use MathLive custom element, define types to avoid TS errors
const MathFieldTag = 'math-field' as any;

type MathCategory = 'General' | 'Algebra' | 'Geometry' | 'Trigonometry' | 'Calculus' | 'Discrete Math' | 'Logic' | 'Linear Algebra' | 'Statistics' | 'Financial Math' | 'Physics';

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
      { label: 'Quadratic', command: 'ax^2 + bx + c = 0', type: 'insert', desc: 'Quad' },
    ]
  },
  'Geometry': {
    icon: 'fa-draw-polygon',
    tools: [
      { label: 'Pythagoras', command: 'a^2 + b^2 = c^2', type: 'insert', desc: 'Right Tri' },
      { label: 'Circle Area', command: 'A = \\pi r^2', type: 'insert', desc: 'Area' },
      { label: 'Sphere Vol', command: 'V = \\frac{4}{3} \\pi r^3', type: 'insert', desc: 'Volume' },
      { label: 'Sine Rule', command: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B}', type: 'insert', desc: 'Triangle' },
    ]
  },
  'Trigonometry': {
    icon: 'fa-wave-square',
    tools: [
      { label: 'Sin', command: '\\sin(\\placeholder)', type: 'insert', desc: 'Sin' },
      { label: 'Cos', command: '\\cos(\\placeholder)', type: 'insert', desc: 'Cos' },
      { label: 'Tan', command: '\\tan(\\placeholder)', type: 'insert', desc: 'Tan' },
      { label: 'Identity', command: '\\sin^2 x + \\cos^2 x = 1', type: 'insert', desc: 'Identity' },
    ]
  },
  'Calculus': {
    icon: 'fa-infinity',
    tools: [
      { label: 'Diff', command: 'diff', type: 'action', desc: 'd/dx' },
      { label: 'Integral', command: 'integrate', type: 'action', desc: 'Integral' },
      { label: 'Limit', command: '\\lim_{x \\to \\placeholder}', type: 'insert', desc: 'Limit' },
      { label: 'Derivative', command: '\\frac{d}{dx}(\\placeholder)', type: 'insert', desc: 'd/dx' },
    ]
  },
  'Discrete Math': {
    icon: 'fa-network-wired',
    tools: [
      { label: 'Permutation', command: 'P(n, r) = \\frac{n!}{(n-r)!}', type: 'insert', desc: 'nPr' },
      { label: 'Combination', command: 'C(n, r) = \\frac{n!}{r!(n-r)!}', type: 'insert', desc: 'nCr' },
      { label: 'Factorial', command: 'n!', type: 'insert', desc: 'n!' },
      { label: 'Summation', command: '\\sum_{i=1}^{n} \\placeholder', type: 'insert', desc: 'Sum' },
    ]
  },
  'Logic': {
    icon: 'fa-microchip',
    tools: [
      { label: 'AND', command: '\\land', type: 'insert', desc: 'AND' },
      { label: 'OR', command: '\\lor', type: 'insert', desc: 'OR' },
      { label: 'NOT', command: '\\neg', type: 'insert', desc: 'NOT' },
      { label: 'Implies', command: '\\implies', type: 'insert', desc: 'If/Then' },
      { label: 'Truth Table', command: 'generate_truth_table', type: 'ai', desc: 'Logic Map' },
    ]
  },
  'Linear Algebra': {
    icon: 'fa-border-all',
    tools: [
      { label: 'Det', command: 'determinant', type: 'action', desc: '|A|' },
      { label: 'Invert', command: 'invert', type: 'action', desc: 'Inverse' },
      { label: 'Transpose', command: 'transpose', type: 'action', desc: 'A^T' },
    ]
  },
  'Statistics': {
    icon: 'fa-chart-bar',
    tools: [
      { label: 'Mean', command: 'mean', type: 'action', desc: 'Mean' },
      { label: 'Median', command: 'median', type: 'action', desc: 'Median' },
      { label: 'Variance', command: '\\sigma^2', type: 'insert', desc: 'Var' },
      { label: 'Std Dev', command: '\\sigma', type: 'insert', desc: 'SD' },
    ]
  },
  'Financial Math': {
    icon: 'fa-coins',
    tools: [
      { label: 'Compound', command: 'A = P(1 + \\frac{r}{n})^{nt}', type: 'insert', desc: 'Interest' },
      { label: 'Present Val', command: 'PV = \\frac{FV}{(1+i)^n}', type: 'insert', desc: 'PV' },
      { label: 'Annuity', command: 'PMT \\times \\frac{1-(1+i)^{-n}}{i}', type: 'insert', desc: 'Loan' },
    ]
  },
  'Physics': {
    icon: 'fa-atom',
    tools: [
      { label: 'Newton', command: 'F = m \\cdot a', type: 'insert', desc: 'Force' },
      { label: 'Einstein', command: 'E = m \\cdot c^2', type: 'insert', desc: 'Energy' },
      { label: 'Gravity', command: 'F = G\\frac{m_1 m_2}{r^2}', type: 'insert', desc: 'Gravity' },
    ]
  }
};

interface MathsModeProps {
  onClose: () => void; 
  lang: Language; 
  embedded?: boolean;
  messages: ChatMessage[];
  onSend: (text: string, file?: { data: string; mimeType: string; name: string }) => void;
  isTyping: boolean;
}

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const mfRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // MathLive Init
    if (mfRef.current) {
      mfRef.current.smartMode = true;
      mfRef.current.virtualKeyboardMode = "manual";
      // Ensure focus after mount
      setTimeout(() => mfRef.current.focus(), 300);
    }
  }, []);

  const handleAction = async (command: string) => {
    const rawLatex = mfRef.current?.value;
    
    // Construct Prompt for Gemini
    let prompt = "";
    if (command === 'ai_explain') {
        prompt = `Please solve this math problem step-by-step and provide a clear final answer: ${rawLatex || "the problem in the attached image"}`;
    } else if (command === 'generate_truth_table') {
        prompt = `Generate a truth table for this logical expression: ${rawLatex || "the expression in the attached image"}`;
    } else {
        prompt = `Execute "${command}" on this mathematical expression: ${rawLatex || "the expression in the attached image"}. Briefly summarize the result and provide any necessary steps.`;
    }
    
    onSend(prompt, selectedFile || undefined);
    setSelectedFile(null); // Clear file after sending, keep latex for reference
  };

  const insertSymbol = (cmd: string) => {
    if (mfRef.current) {
        mfRef.current.executeCommand(['insert', cmd]);
        mfRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => setSelectedFile({ 
        data: (r.result as string).split(',')[1], 
        mimeType: file.type, 
        name: file.name 
      });
      r.readAsDataURL(file);
    }
  };

  const clearCanvas = () => {
    if(mfRef.current) mfRef.current.value = "";
    setSelectedFile(null);
  }

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
                <span className="text-[8px] font-black text-cyan-600 uppercase tracking-widest mt-1">BETA v5.0</span>
              </div>
           </div>
           <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all active:scale-90"><i className="fa-solid fa-xmark text-xl"></i></button>
        </header>
      )}

      {/* Sidebar / Topbar for Categories */}
      <nav className="w-full md:w-64 bg-white/50 dark:bg-slate-900/20 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 p-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0 backdrop-blur-xl z-40">
          {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all min-w-max md:w-full border ${
                  activeCat === cat 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/10' 
                  : 'text-slate-500 hover:bg-white dark:hover:bg-white/5 border-transparent'
                }`}
              >
                <i className={`fa-solid ${CATEGORIES[cat].icon} text-sm opacity-70 w-5`}></i>
                {cat}
              </button>
          ))}
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 pb-40">
          
          <div className="max-w-4xl mx-auto space-y-6">
              {/* Input Area */}
              <div className="glass-panel rounded-[32px] p-6 border border-indigo-500/20 shadow-xl bg-white dark:bg-slate-900 relative transition-all ring-0 focus-within:ring-2 ring-indigo-500/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-pen-to-square"></i>
                        Visual Math Input
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={clearCanvas}
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                            title="Clear Input"
                        >
                            <i className="fa-solid fa-trash text-[10px]"></i>
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${selectedFile ? 'bg-emerald-500 text-white border-emerald-500' : 'text-slate-500 border-slate-200 dark:border-white/10 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-camera"></i>
                            {selectedFile ? 'Image Attached' : 'Photo'}
                        </button>
                    </div>
                </div>
                
                {selectedFile && (
                  <div className="mb-4 relative group w-fit">
                    <div className="absolute -top-2 -right-2 z-10">
                        <button onClick={() => setSelectedFile(null)} className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-90"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                    </div>
                    <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="h-20 rounded-xl border border-black/10 dark:border-white/10 shadow-sm" alt="Attached" />
                  </div>
                )}

                {/* MathLive Component */}
                <MathFieldTag 
                    ref={mfRef} 
                    className="w-full text-xl md:text-3xl p-4 bg-transparent text-slate-900 dark:text-white outline-none min-h-[60px]"
                    style={{ '--caret-color': '#4f46e5', '--selection-background-color': '#4f46e550' }}
                >
                </MathFieldTag>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
              
              {/* Dynamic Toolbar */}
              <div className="flex flex-wrap gap-2 animate-reveal">
                {CATEGORIES[activeCat].tools.map((tool, i) => (
                    <button
                      key={i}
                      onClick={() => (tool.type === 'action' || tool.type === 'ai') ? handleAction(tool.command) : insertSymbol(tool.command)}
                      disabled={isTyping}
                      className={`flex-1 min-w-[100px] px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 ${
                        tool.type === 'action' ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/20' : 
                        tool.type === 'ai' ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-600/20' :
                        'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-indigo-500/50'
                      }`}
                    >
                      <span className="opacity-90">{tool.label}</span>
                      <span className="text-[8px] opacity-60 font-medium normal-case">{tool.desc}</span>
                    </button>
                ))}
              </div>
          </div>

          {/* Results Area */}
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
              {messages.length > 0 && messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                    <div className={`max-w-[95%] md:max-w-[85%] p-6 md:p-8 rounded-[32px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                      <div className={`text-sm md:text-lg leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>
                          {msg.content}
                      </div>
                    </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 w-fit shadow-sm">
                    <div className="flex gap-1">
                    {[0, 150, 300].map(delay => <div key={delay} className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>)}
                    </div>
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Reasoning...</span>
                </div>
              )}
          </div>
      </main>
    </div>
  );
};

export default MathsMode;
