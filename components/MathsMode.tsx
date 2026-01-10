
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';
import * as d3 from 'd3';

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
      { label: 'AI Analysis', command: 'ai_explain', type: 'ai', desc: 'Steps' },
    ]
  },
  'Trigonometry': {
    icon: 'fa-wave-square',
    tools: [
      { label: 'Sin', command: '\\sin(\\placeholder)', type: 'insert', desc: 'Sin' },
      { label: 'Cos', command: '\\cos(\\placeholder)', type: 'insert', desc: 'Cos' },
      { label: 'Tan', command: '\\tan(\\placeholder)', type: 'insert', desc: 'Tan' },
      { label: 'Deg to Rad', command: 'deg_to_rad', type: 'action', desc: 'Convert' },
    ]
  },
  'Calculus': {
    icon: 'fa-infinity',
    tools: [
      { label: 'Diff', command: 'diff', type: 'action', desc: 'd/dx' },
      { label: 'Integral', command: 'integrate', type: 'action', desc: 'Integral' },
      { label: 'AI Solver', command: 'ai_explain', type: 'ai', desc: 'Steps' },
    ]
  },
  'Linear Algebra': {
    icon: 'fa-border-all',
    tools: [
      { label: 'Det', command: 'determinant', type: 'action', desc: '|A|' },
      { label: 'Invert', command: 'invert', type: 'action', desc: 'Inverse' },
      { label: 'Transpose', command: 'transpose', type: 'action', desc: 'Swap' },
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
      { label: 'Mass Conv', command: 'unit_mass', type: 'action', desc: 'kg/lb' },
    ]
  }
};

const MathsMode: React.FC<{ onClose: () => void; lang: Language }> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [solution, setSolution] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const mfRef = useRef<any>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setIsProcessing(true);
    setError(null);
    setSolution(null);
    if (command === 'ai_explain') {
        try {
            const res = await geminiService.chat(`Explain: ${rawLatex}`, { useThinking: true });
            setSolution({ resultLatex: "AI Analysis", aiExplanation: res.text });
        } catch (e: any) { setError(e.message); } finally { setIsProcessing(false); }
        return;
    }
    try {
      let parsed = rawLatex.replace(/\\/g, '').replace(/{/g, '(').replace(/}/g, ')'); 
      let result = nerdamer(parsed).simplify();
      setSolution({ resultLatex: result.toTeX(), steps: ["Calculated"] });
    } catch (e: any) { setError(e.message); } finally { setIsProcessing(false); }
  };

  const insertSymbol = (cmd: string) => {
    if (mfRef.current) {
        mfRef.current.executeCommand(['insert', cmd]);
        mfRef.current.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-white dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
      <header className="h-20 shrink-0 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
               <i className="fa-solid fa-square-root-variable text-xl"></i>
            </div>
            <h2 className="text-lg font-black uppercase tracking-tighter text-slate-800 dark:text-white">{t.math.title}</h2>
         </div>
         <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all active:scale-90">
            <i className="fa-solid fa-xmark text-xl"></i>
         </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
         <nav className="w-full md:w-72 bg-slate-50 dark:bg-black/20 border-r border-black/5 dark:border-white/5 p-6 flex md:flex-col gap-3 overflow-x-auto no-scrollbar shrink-0">
            {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
               <button
                 key={cat}
                 onClick={() => setActiveCat(cat)}
                 className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all min-w-max md:w-full ${
                    activeCat === cat ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-white/5'
                 }`}
               >
                 <i className={`fa-solid ${CATEGORIES[cat].icon} text-sm`}></i>
                 {cat}
               </button>
            ))}
         </nav>

         <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-10">
            <div className="max-w-4xl mx-auto space-y-6">
               <div className="glass-panel rounded-[40px] p-4 border-2 border-indigo-500/20 shadow-2xl bg-white dark:bg-slate-900 relative">
                  <MathFieldTag ref={mfRef} className="w-full text-2xl p-6 bg-transparent text-slate-900 dark:text-white outline-none"></MathFieldTag>
                  <div className="absolute top-6 left-6 z-20">
                     <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all border border-black/5">
                        <i className={`fa-solid ${isUploading ? 'fa-circle-notch animate-spin' : 'fa-camera'} text-lg`}></i>
                     </button>
                     <input type="file" ref={fileInputRef} accept="image/*" onChange={(e) => {/* OCR handle */}} className="hidden" />
                  </div>
               </div>
               
               <div className="flex flex-wrap gap-3 animate-reveal">
                  {CATEGORIES[activeCat].tools.map((tool, i) => (
                     <button
                       key={i}
                       onClick={() => (tool.type === 'action' || tool.type === 'ai') ? handleAction(tool.command) : insertSymbol(tool.command)}
                       className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 ${
                          tool.type === 'action' ? 'bg-indigo-600 text-white border-indigo-600' : 
                          tool.type === 'ai' ? 'bg-cyan-600 text-white border-cyan-600' :
                          'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                       }`}
                     >
                       {tool.label}
                     </button>
                  ))}
               </div>
            </div>

            {solution && (
               <div className="max-w-4xl mx-auto space-y-8 animate-reveal pb-32">
                  <div className="glass-panel p-10 rounded-[56px] bg-white/60 dark:bg-slate-900/60 shadow-2xl space-y-6 border border-black/5">
                     <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">{t.math.answer}</h3>
                     <div className="text-3xl md:text-6xl font-black text-slate-900 dark:text-white overflow-x-auto no-scrollbar py-4">
                        $${solution.resultLatex}$$
                     </div>
                  </div>
                  {solution.aiExplanation && (
                     <div className="prose prose-slate dark:prose-invert max-w-none text-base leading-relaxed p-10 bg-cyan-500/5 rounded-[48px] border border-cyan-500/10">
                        {solution.aiExplanation}
                     </div>
                  )}
               </div>
            )}
         </main>
      </div>
    </div>
  );
};

export default MathsMode;
