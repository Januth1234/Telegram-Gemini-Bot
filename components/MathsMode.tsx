
import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../translations';

// We use MathLive custom element, define types to avoid TS errors
const MathFieldTag = 'math-field' as any;

type MathCategory = 'General' | 'Algebra' | 'Geometry' | 'Calculus' | 'Stats' | 'Physics';

const CATEGORIES: Record<MathCategory, { icon: string; tools: { label: string, cmd: string, type: 'insert' | 'action' }[] }> = {
  'General': {
    icon: 'fa-calculator',
    tools: [
      { label: 'Simplify', cmd: 'simplify', type: 'action' },
      { label: 'Fraction', cmd: '\\frac{\\placeholder}{\\placeholder}', type: 'insert' },
      { label: 'Sqrt', cmd: '\\sqrt{\\placeholder}', type: 'insert' },
      { label: 'Power', cmd: '^\\placeholder', type: 'insert' },
    ]
  },
  'Algebra': {
    icon: 'fa-x',
    tools: [
      { label: 'Solve x', cmd: 'solve for x', type: 'action' },
      { label: 'Factor', cmd: 'factor', type: 'action' },
      { label: 'Expand', cmd: 'expand', type: 'action' },
    ]
  },
  'Geometry': {
    icon: 'fa-shapes',
    tools: [
      { label: 'Area', cmd: 'calculate area', type: 'action' },
      { label: 'Volume', cmd: 'calculate volume', type: 'action' },
      { label: 'Pi', cmd: '\\pi', type: 'insert' },
    ]
  },
  'Calculus': {
    icon: 'fa-infinity',
    tools: [
      { label: 'Derive', cmd: 'find derivative', type: 'action' },
      { label: 'Integrate', cmd: 'find integral', type: 'action' },
      { label: 'Limit', cmd: '\\lim_{x \\to \\infty}', type: 'insert' },
    ]
  },
  'Stats': {
    icon: 'fa-chart-bar',
    tools: [
      { label: 'Mean', cmd: 'calculate mean', type: 'action' },
      { label: 'Median', cmd: 'calculate median', type: 'action' },
      { label: 'Std Dev', cmd: 'standard deviation', type: 'action' },
    ]
  },
  'Physics': {
    icon: 'fa-atom',
    tools: [
      { label: 'Force', cmd: 'F = ma', type: 'insert' },
      { label: 'Energy', cmd: 'E = mc^2', type: 'insert' },
      { label: 'Explain', cmd: 'explain physics concept', type: 'action' },
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

const MATHLIVE_SCRIPT = 'https://unpkg.com/mathlive';

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [mathLiveReady, setMathLiveReady] = useState(false);
  const mfRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load MathLive only when Maths mode is opened so the custom element is defined before first render (avoids "Params are not set")
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (customElements.get('math-field')) {
      setMathLiveReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${MATHLIVE_SCRIPT}"]`);
    if (existing) {
      setMathLiveReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = MATHLIVE_SCRIPT;
    script.async = true;
    script.onload = () => setMathLiveReady(true);
    script.onerror = () => setMathLiveReady(false);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mathLiveReady || !mfRef.current) return;
    mfRef.current.smartMode = true;
    mfRef.current.virtualKeyboardMode = "manual";
    setTimeout(() => mfRef.current?.focus(), 300);
  }, [mathLiveReady]);

  const handleAction = async (command: string) => {
    const rawLatex = mfRef.current?.value;
    
    // Construct Prompt for Gemini
    let prompt = "";
    if (selectedFile) {
        prompt = `Analyze this image containing a math problem. ${command === 'ai_explain' ? 'Solve it step-by-step.' : 'Perform: ' + command}`;
    } else {
        prompt = `Mathematical Request: ${command}. Expression: ${rawLatex}. Provide step-by-step solution.`;
    }
    
    onSend(prompt, selectedFile || undefined);
    setSelectedFile(null); 
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
    ? "flex-1 flex flex-col md:flex-row overflow-hidden h-full bg-slate-50 dark:bg-slate-950 pb-20" 
    : "fixed inset-0 z-[120] bg-white dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden";

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50 sticky top-0">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                 <i className="fa-solid fa-square-root-variable text-lg"></i>
              </div>
              <h2 className="text-base font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">Math Solver</h2>
           </div>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>
      )}

      {/* Sidebar Categories */}
      <nav className="w-full md:w-56 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 p-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
          {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-w-max md:w-full border ${
                  activeCat === cat 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                  : 'text-slate-500 hover:bg-white dark:hover:bg-white/5 border-transparent'
                }`}
              >
                <i className={`fa-solid ${CATEGORIES[cat].icon} text-sm w-5 text-center`}></i>
                {cat}
              </button>
          ))}
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
          
          <div className="max-w-3xl mx-auto space-y-6">
              {/* Input Area */}
              <div className="bg-white dark:bg-slate-900 rounded-[24px] p-1 border border-indigo-500/20 shadow-xl relative transition-all ring-0 focus-within:ring-2 ring-indigo-500/20">
                <div className="flex items-center justify-between px-4 py-2 border-b border-black/5 dark:border-white/5">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-pen-to-square"></i>
                        Equation Editor
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={clearCanvas}
                            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                            title="Clear Input"
                        >
                            <i className="fa-solid fa-trash text-[10px]"></i>
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${selectedFile ? 'bg-emerald-500 text-white border-emerald-500' : 'text-slate-500 border-slate-200 dark:border-white/10 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-camera"></i>
                            {selectedFile ? 'Image Added' : 'Photo'}
                        </button>
                    </div>
                </div>
                
                {selectedFile && (
                  <div className="p-4 bg-slate-50 dark:bg-black/20">
                    <div className="relative group w-fit">
                        <div className="absolute -top-2 -right-2 z-10">
                            <button onClick={() => setSelectedFile(null)} className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-90"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                        </div>
                        <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="h-24 rounded-lg border border-black/10 dark:border-white/10 shadow-sm" alt="Attached" />
                    </div>
                  </div>
                )}

                {/* MathLive Component - only mount after script has loaded to avoid "Params are not set" */}
                {mathLiveReady ? (
                <MathFieldTag 
                    ref={mfRef} 
                    className="w-full text-xl md:text-3xl p-6 bg-transparent text-slate-900 dark:text-white outline-none min-h-[80px]"
                    style={{ '--caret-color': '#4f46e5', '--selection-background-color': '#4f46e550' }}
                >
                </MathFieldTag>
                ) : (
                <div className="w-full min-h-[80px] p-6 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-sm">Loading math input…</div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
              
              {/* Dynamic Toolbar */}
              <div className="flex flex-wrap gap-2 animate-reveal">
                {CATEGORIES[activeCat].tools.map((tool, i) => (
                    <button
                      key={i}
                      onClick={() => tool.type === 'action' ? handleAction(tool.cmd) : insertSymbol(tool.cmd)}
                      disabled={isTyping}
                      className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 ${
                        tool.type === 'action' ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500' : 
                        'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-indigo-500/50'
                      }`}
                    >
                      {tool.label}
                    </button>
                ))}
                {/* Global Solve Button */}
                <button 
                    onClick={() => handleAction('Solve and Explain')} 
                    disabled={isTyping}
                    className="flex-1 min-w-[120px] px-4 py-3 rounded-xl bg-cyan-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-cyan-500 shadow-lg active:scale-95 transition-all"
                >
                    Solve With AI
                </button>
              </div>
          </div>

          {/* Results Area */}
          <div className="max-w-3xl mx-auto space-y-6 pb-12">
              {messages.length > 0 && messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                    <div className={`max-w-full p-6 rounded-[24px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                      <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>
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
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Calculating...</span>
                </div>
              )}
          </div>
      </main>
    </div>
  );
};

export default MathsMode;
