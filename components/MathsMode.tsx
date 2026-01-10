
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';
import * as d3 from 'd3';

// Nerdamer & MathLive are loaded via index.html
declare const nerdamer: any;

// Use 'any' type for the custom element tag to bypass JSX.IntrinsicElements check issues
const MathFieldTag = 'math-field' as any;

interface MathsModeProps {
  onClose: () => void;
  lang: Language;
}

type MathCategory = 'General' | 'Algebra' | 'Trigonometry' | 'Calculus' | 'Linear Algebra' | 'Statistics' | 'Physics';

interface MathTool {
  label: string;
  command: string; // Internal command or LaTeX insertion
  type: 'insert' | 'action' | 'ai'; // Insert symbol, trigger local solver, or trigger AI explanation
  desc: string;
}

// --- Configuration: The Mega Toolbox ---
const CATEGORIES: Record<MathCategory, { icon: string; tools: MathTool[] }> = {
  'General': {
    icon: 'fa-calculator',
    tools: [
      { label: 'Simplify', command: 'simplify', type: 'action', desc: 'Simplify Expression' },
      { label: 'Evaluate', command: 'evaluate', type: 'action', desc: 'Numeric Value' },
      { label: 'AI Step-by-Step', command: 'ai_explain', type: 'ai', desc: 'Full AI Explanation' },
      { label: 'Fraction', command: '\\frac{\\placeholder}{\\placeholder}', type: 'insert', desc: 'a/b' },
      { label: 'Sqrt', command: '\\sqrt{\\placeholder}', type: 'insert', desc: 'Square Root' },
      { label: 'Power', command: '^\\placeholder', type: 'insert', desc: 'x^n' },
    ]
  },
  'Algebra': {
    icon: 'fa-x',
    tools: [
      { label: 'Solve for x', command: 'solve', type: 'action', desc: 'Find x' },
      { label: 'AI Analysis', command: 'ai_explain', type: 'ai', desc: 'AI Step-by-Step' },
      { label: 'Factor', command: 'factor', type: 'action', desc: 'Factor Polynomial' },
      { label: 'Expand', command: 'expand', type: 'action', desc: 'Expand Brackets' },
      { label: 'Roots', command: 'roots', type: 'action', desc: 'Find Roots' },
    ]
  },
  'Trigonometry': {
    icon: 'fa-wave-square',
    tools: [
      { label: 'Sin', command: '\\sin(\\placeholder)', type: 'insert', desc: 'Sine' },
      { label: 'Cos', command: '\\cos(\\placeholder)', type: 'insert', desc: 'Cosine' },
      { label: 'Tan', command: '\\tan(\\placeholder)', type: 'insert', desc: 'Tangent' },
      { label: 'Deg to Rad', command: 'deg_to_rad', type: 'action', desc: 'Degrees to Radians' },
    ]
  },
  'Calculus': {
    icon: 'fa-infinity',
    tools: [
      { label: 'Differentiate', command: 'diff', type: 'action', desc: 'd/dx' },
      { label: 'Integrate', command: 'integrate', type: 'action', desc: 'Integral' },
      { label: 'AI Solver', command: 'ai_explain', type: 'ai', desc: 'AI-Powered Steps' },
      { label: 'Sum', command: '\\sum_{n=0}^{\\infty}', type: 'insert', desc: 'Summation' },
    ]
  },
  'Linear Algebra': {
    icon: 'fa-border-all',
    tools: [
      { label: 'Determinant', command: 'determinant', type: 'action', desc: '|A|' },
      { label: 'Invert', command: 'invert', type: 'action', desc: 'Inverse Matrix' },
      { label: 'Transpose', command: 'transpose', type: 'action', desc: 'Swap Rows/Cols' },
      { label: '2x2 Matrix', command: '\\begin{pmatrix}0&0\\\\0&0\\end{pmatrix}', type: 'insert', desc: 'Insert 2x2' },
    ]
  },
  'Statistics': {
    icon: 'fa-chart-bar',
    tools: [
      { label: 'Mean', command: 'mean', type: 'action', desc: 'Average' },
      { label: 'Median', command: 'median', type: 'action', desc: 'Middle Value' },
      { label: 'Std Dev', command: 'stdev', type: 'action', desc: 'Standard Deviation' },
    ]
  },
  'Physics': {
    icon: 'fa-atom',
    tools: [
      { label: 'AI Physics Lab', command: 'ai_explain', type: 'ai', desc: 'AI Physics Analysis' },
      { label: 'Mass: kg ↔ lbs', command: 'unit_mass', type: 'action', desc: 'Mass Conversion' },
      { label: 'Len: m ↔ ft', command: 'unit_len', type: 'action', desc: 'Length Conversion' },
      { label: 'Temp: C ↔ F', command: 'unit_temp', type: 'action', desc: 'Temp Conversion' },
      { label: 'Force (F=ma)', command: 'F = m \\cdot a', type: 'insert', desc: 'Newton II' },
      { label: 'Energy (E=mc²)', command: 'E = m \\cdot c^2', type: 'insert', desc: 'Einstein' },
      { label: 'Ohm Law (V=IR)', command: 'V = I \\cdot R', type: 'insert', desc: 'Ohm Law' },
    ]
  }
};

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [solution, setSolution] = useState<{ 
    inputLatex: string; 
    resultLatex: string; 
    steps: string[];
    decimal?: string;
    graph?: any[];
    aiExplanation?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mfRef = useRef<any>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize MathField
  useEffect(() => {
    if (mfRef.current) {
      mfRef.current.smartMode = true;
      mfRef.current.virtualKeyboardMode = "manual";
      setTimeout(() => mfRef.current.focus(), 100);
    }
  }, []);

  // Graph Rendering
  useEffect(() => {
    if (solution?.graph && graphRef.current) {
      renderGraph(solution.graph);
    }
  }, [solution]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const latex = await geminiService.convertMathImageToLatex(base64Data, file.type);
        if (mfRef.current) {
          mfRef.current.setValue(latex);
        }
      } catch (err: any) {
        setError(err.message || "Failed to read math from image.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAction = async (command: string) => {
    const rawLatex = mfRef.current?.value;
    if (!rawLatex) return;

    setIsProcessing(true);
    setError(null);
    setSolution(null);

    // If AI explanation requested
    if (command === 'ai_explain') {
        try {
            const prompt = `Explain the following mathematical or physics problem step-by-step with clear reasoning: ${rawLatex}`;
            const res = await geminiService.chat(prompt, { useThinking: true });
            setSolution({
                inputLatex: rawLatex,
                resultLatex: "Calculated by AI",
                steps: ["AI Analysis Completed"],
                aiExplanation: res.text
            });
        } catch (e: any) {
            setError(e.message || "AI Analysis failed.");
        } finally {
            setIsProcessing(false);
        }
        return;
    }

    // Local Logic (Simplified)
    await new Promise(r => setTimeout(r, 400));

    try {
      let parsed = LatexParser.parse(rawLatex);
      let result: any;
      let decimal: string | undefined;
      let graphData: any[] | null = null;
      let steps: string[] = [`Operation: ${command}`];

      if (activeCat === 'Physics' && command.startsWith('unit_')) {
          const val = parseFloat(parsed.match(/[\d.]+/)?.[0] || "0");
          if (isNaN(val)) throw new Error("Please enter a numeric value.");
          
          if (command === 'unit_mass') {
             result = `${val} kg = ${(val * 2.20462).toFixed(2)} lbs`;
             steps.push("Conversion: kg -> lbs (x 2.204)");
          } else if (command === 'unit_len') {
             result = `${val} meters = ${(val * 3.28084).toFixed(2)} feet`;
             steps.push("Conversion: m -> ft (x 3.28)");
          } else if (command === 'unit_temp') {
             result = `${val}°C = ${(val * 9/5 + 32).toFixed(1)}°F`;
             steps.push("Conversion: (C * 9/5) + 32");
          }
      } 
      else {
          try {
            switch (command) {
                case 'simplify': result = nerdamer(parsed).simplify(); break;
                case 'evaluate': result = nerdamer(parsed).evaluate(); break;
                case 'expand': result = nerdamer(parsed).expand(); break;
                case 'factor': result = nerdamer(parsed).factor(); break;
                case 'solve': result = nerdamer.solve(parsed, 'x'); break;
                case 'roots': result = nerdamer.roots(parsed); break;
                case 'diff': result = nerdamer(`diff(${parsed}, x)`); break;
                case 'integrate': result = nerdamer(`integrate(${parsed}, x)`); break;
                case 'determinant': result = nerdamer(`determinant(${parsed})`); break;
                case 'invert': result = nerdamer(`invert(${parsed})`); break;
                case 'transpose': result = nerdamer(`transpose(${parsed})`); break;
                case 'deg_to_rad': {
                    const val = parseFloat(parsed.match(/[\d.]+/)?.[0] || "0");
                    result = `${(val * Math.PI / 180).toFixed(4)} rad`;
                    break;
                }
                default: result = nerdamer(parsed);
            }
          } catch (nerdError: any) {
            if (nerdError.message?.includes("Division by zero")) throw new Error("Division by zero not allowed!");
            throw nerdError;
          }
      }

      if (result.toString() === 'Infinity') throw new Error("Result is infinite.");

      let resultLatex = "";
      if (typeof result === 'object' && result.toTeX) resultLatex = result.toTeX();
      else if (Array.isArray(result)) resultLatex = result.map(r => r.toString()).join(', ');
      else resultLatex = result.toString();

      try {
         const d = nerdamer(result).evaluate().text('decimals');
         if (d !== resultLatex && !d.includes('i')) decimal = d;
      } catch (e) {}

      if (['simplify', 'evaluate', 'expand'].includes(command)) {
          try {
             const func = nerdamer(result.toString()).buildFunction(['x']);
             const points = [];
             for (let x = -10; x <= 10; x += 0.5) {
                 const y = func(x);
                 if (isFinite(y) && Math.abs(y) < 50) points.push({ x, y });
             }
             if (points.length > 5) graphData = points;
          } catch (e) {}
      }

      setSolution({
          inputLatex: rawLatex,
          resultLatex,
          steps,
          decimal,
          graph: graphData
      });

    } catch (e: any) {
      setError(e.message || "Calculation Error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const insertSymbol = (cmd: string) => {
    if (mfRef.current) {
        mfRef.current.executeCommand(['insert', cmd]);
        mfRef.current.focus();
    }
  };

  const renderGraph = (data: {x: number, y: number}[]) => {
      if (!graphRef.current) return;
      const svg = d3.select(graphRef.current);
      svg.selectAll("*").remove();
      const width = 600; const height = 300; const margin = {top: 20, right: 20, bottom: 20, left: 40};
      const x = d3.scaleLinear().domain(d3.extent(data, d => d.x) as [number, number]).range([margin.left, width - margin.right]);
      const y = d3.scaleLinear().domain(d3.extent(data, d => d.y) as [number, number]).range([height - margin.bottom, margin.top]);
      const line = d3.line<{x: number, y: number}>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);
      svg.append("g").attr("transform", `translate(0,${y(0)})`).call(d3.axisBottom(x).ticks(10)).attr("class", "opacity-30");
      svg.append("g").attr("transform", `translate(${x(0)},0)`).call(d3.axisLeft(y).ticks(5)).attr("class", "opacity-30");
      svg.append("path").datum(data).attr("fill", "none").attr("stroke", "#6366f1").attr("stroke-width", 2).attr("d", line);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden font-sans">
      <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md z-50">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
               <i className="fa-solid fa-square-root-variable"></i>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{t.math.title}</h2>
         </div>
         <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors">
            <i className="fa-solid fa-xmark"></i>
         </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
         <nav className="w-full md:w-64 bg-slate-100 dark:bg-black/20 border-r border-black/5 dark:border-white/5 p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0 custom-scrollbar">
            {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
               <button
                 key={cat}
                 onClick={() => setActiveCat(cat)}
                 className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all min-w-max md:w-full ${
                    activeCat === cat ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm border border-black/5 dark:border-white/5' : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                 }`}
               >
                 <i className={`fa-solid ${CATEGORIES[cat].icon} w-5`}></i>
                 {cat}
               </button>
            ))}
         </nav>

         <main className="flex-1 flex flex-col relative overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">
               <div className="max-w-4xl mx-auto space-y-4">
                  <div className="glass-panel rounded-3xl p-1 border border-indigo-500/20 shadow-xl bg-white dark:bg-slate-900 relative">
                     <MathFieldTag ref={mfRef} className="w-full text-2xl p-6 bg-transparent outline-none border-none text-slate-900 dark:text-white"></MathFieldTag>
                     <div className="absolute top-4 left-4 z-20 flex gap-2">
                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileUpload} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all"><i className={`fa-solid ${isUploading ? 'fa-circle-notch animate-spin' : 'fa-camera'}`}></i></button>
                     </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 animate-reveal">
                     {CATEGORIES[activeCat].tools.map((tool, i) => (
                        <button
                          key={i}
                          onClick={() => (tool.type === 'action' || tool.type === 'ai') ? handleAction(tool.command) : insertSymbol(tool.command)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
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

               {isProcessing && (
                  <div className="flex flex-col items-center justify-center py-12">
                     <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                     <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-500">Computing solution...</p>
                  </div>
               )}

               {error && (
                  <div className="max-w-2xl mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-bounce-subtle">
                     <i className="fa-solid fa-triangle-exclamation"></i>
                     <span className="text-xs font-bold">{error}</span>
                  </div>
               )}

               {solution && !isProcessing && (
                  <div className="max-w-4xl mx-auto space-y-8 animate-reveal pb-24">
                     <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-xl space-y-6">
                        <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 pb-4">
                           <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{t.math.answer}</h3>
                        </div>
                        <div className="text-center py-4">
                           <div className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white overflow-x-auto no-scrollbar">
                              $${solution.resultLatex}$$
                           </div>
                           {solution.decimal && <div className="mt-4 inline-block px-4 py-1 bg-slate-100 dark:bg-white/10 rounded-full text-xs font-mono font-bold text-slate-500">≈ {solution.decimal}</div>}
                        </div>
                     </div>

                     {solution.aiExplanation && (
                        <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 bg-cyan-50/30 dark:bg-cyan-900/10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 mb-6">AI STEP-BY-STEP ANALYSIS</h3>
                            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                {solution.aiExplanation}
                            </div>
                        </div>
                     )}

                     {solution.graph && (
                        <div className="glass-panel p-6 rounded-[40px] border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-900/60">
                           <div className="flex items-center gap-3 mb-4"><div className="w-2 h-6 bg-cyan-500 rounded-full"></div><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Graph Plot</h3></div>
                           <div className="w-full bg-slate-50 dark:bg-black/30 rounded-3xl overflow-hidden"><svg ref={graphRef} viewBox="0 0 600 300" className="w-full h-auto"></svg></div>
                        </div>
                     )}
                  </div>
               )}
            </div>
         </main>
      </div>
    </div>
  );
};

const LatexParser = {
    parse: (latex: string): string => {
      let clean = latex.replace(/\\left/g, '').replace(/\\right/g, '').replace(/\\,/g, '').replace(/\\ /g, '');
      clean = clean.replace(/\\frac{([^{}]+)}{([^{}]+)}/g, '($1)/($2)');
      clean = clean.replace(/\\sqrt{([^{}]+)}/g, 'sqrt($1)');
      clean = clean.replace(/\^{([^{}]+)}/g, '^($1)');
      clean = clean.replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan').replace(/\\pi/g, 'PI').replace(/\\cdot/g, '*').replace(/\\times/g, '*').replace(/{/g, '(').replace(/}/g, ')').replace(/\\/g, '');
      clean = clean.replace(/(\d)([a-zA-Z\(])/g, '$1*$2').replace(/(\))([a-zA-Z0-9\(])/g, '$1*$2');
      return clean;
    }
};

export default MathsMode;
