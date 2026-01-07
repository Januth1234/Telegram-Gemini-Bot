
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';
import * as d3 from 'd3';

interface MathsModeProps {
  onClose: () => void;
  lang: Language;
}

interface MathSymbol {
  label: string;
  tex: string;
  displayTex: string; // Used for rendering the button preview
  category: 'Arithmetic' | 'Calculus' | 'Matrices' | 'Variables';
}

const MATH_SYMBOLS: MathSymbol[] = [
  // Arithmetic
  { label: 'Fraction', tex: '\\frac{}{}', displayTex: '\\frac{a}{b}', category: 'Arithmetic' },
  { label: 'Square Root', tex: '\\sqrt{}', displayTex: '\\sqrt{x}', category: 'Arithmetic' },
  { label: 'Exponent', tex: '^{}', displayTex: 'x^{n}', category: 'Arithmetic' },
  { label: 'Parentheses', tex: '()', displayTex: '(x)', category: 'Arithmetic' },
  
  // Matrices
  { label: '2x2 Matrix', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', displayTex: '\\begin{pmatrix} \\cdot & \\cdot \\\\ \\cdot & \\cdot \\end{pmatrix}', category: 'Matrices' },
  { label: '3x3 Matrix', tex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', displayTex: '\\begin{pmatrix} \\cdot & \\cdot & \\cdot \\\\ \\cdot & \\cdot & \\cdot \\\\ \\cdot & \\cdot & \\cdot \\end{pmatrix}', category: 'Matrices' },
  { label: 'Determinant', tex: '|A|', displayTex: '|A|', category: 'Matrices' },

  // Calculus
  { label: 'Integral', tex: '\\int', displayTex: '\\int f(x)', category: 'Calculus' },
  { label: 'Derivative', tex: '\\frac{d}{dx}', displayTex: '\\frac{d}{dx}', category: 'Calculus' },
  { label: 'Limit', tex: '\\lim_{x \\to \\infty}', displayTex: '\\lim_{x \\to \\infty}', category: 'Calculus' },
  { label: 'Summation', tex: '\\sum_{}^{}', displayTex: '\\sum_{i=0}^{n}', category: 'Calculus' },

  // Variables & Symbols
  { label: 'Infinity', tex: '\\infty', displayTex: '\\infty', category: 'Variables' },
  { label: 'Pi', tex: '\\pi', displayTex: '\\pi', category: 'Variables' },
  { label: 'Theta', tex: '\\theta', displayTex: '\\theta', category: 'Variables' },
];

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [input, setInput] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<{ text: string; graph: any[] | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const graphRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const katexPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update KaTeX preview for the input field to show "real math" as the user types
  useEffect(() => {
    if (katexPreviewRef.current && (window as any).katex) {
      try {
        const cleanInput = input || ' ';
        (window as any).katex.render(cleanInput, katexPreviewRef.current, {
          throwOnError: false,
          displayMode: false
        });
      } catch (e) {
        if (katexPreviewRef.current) katexPreviewRef.current.innerText = input;
      }
    }
  }, [input]);

  // Render previews for each symbol button in the dropdown
  useEffect(() => {
    if (isDropdownOpen && (window as any).katex) {
      MATH_SYMBOLS.forEach((sym, idx) => {
        const el = document.getElementById(`sym-preview-${idx}`);
        if (el) {
          (window as any).katex.render(sym.displayTex, el, { throwOnError: false, fontSize: 0.9 });
        }
      });
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    if (solution || error || isSolving) {
      scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [solution, error, isSolving]);

  const insertSymbol = (tex: string) => {
    const start = inputRef.current?.selectionStart || 0;
    const end = inputRef.current?.selectionEnd || 0;
    const newVal = input.substring(0, start) + tex + input.substring(end);
    setInput(newVal);
    
    setTimeout(() => {
      inputRef.current?.focus();
      const bracePos = tex.indexOf('{}');
      const matrixPos = tex.indexOf('a'); 
      if (bracePos !== -1) {
        const newPos = start + bracePos + 1;
        inputRef.current?.setSelectionRange(newPos, newPos);
      } else if (matrixPos !== -1) {
        const newPos = start + matrixPos;
        inputRef.current?.setSelectionRange(newPos, newPos + 1);
      } else {
        const newPos = start + tex.length;
        inputRef.current?.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const solveMath = async () => {
    if (!input.trim()) return;
    setIsSolving(true);
    setError(null);
    setSolution(null);
    setSuggestion(null);

    const isLikelyPlain = !input.includes('\\') && (input.includes('/') || input.includes('^') || input.toLowerCase().includes('matrix'));
    if (isLikelyPlain) {
      setSuggestion(t.math.suggestStandard);
    }

    try {
      const prompt = `Solve this math problem. 
      If it involves a function (e.g., plot, graph, sin, cos, polynomial), include a JSON block with "graphData" (array of points).
      If it involves matrices, perform the requested calculation (multiplication, inverse, determinant, etc.) and show step-by-step reasoning.
      
      Structure your response:
      1. Step-by-step mathematical explanation using Standard LaTeX notation ($...$).
      2. The final result labeled clearly.
      3. A JSON block at the end if graphing is relevant.
      
      Problem: ${input}`;

      const res = await geminiService.chat(prompt, { useThinking: true });
      
      let graphData = null;
      let cleanText = res.text;
      
      try {
        const jsonMatch = res.text.match(/```json\s*([\s\S]*?)\s*```/) || res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const rawJson = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(rawJson);
          if (parsed.graphData) {
            graphData = parsed.graphData;
            cleanText = res.text.replace(jsonMatch[0], '').trim();
          } else if (Array.isArray(parsed)) {
            graphData = parsed;
            cleanText = res.text.replace(jsonMatch[0], '').trim();
          }
        }
      } catch (e) {}

      setSolution({ text: cleanText, graph: graphData });
      if (graphData) setTimeout(() => renderGraph(graphData), 300);
    } catch (e: any) {
      setError(e.message || "Neural calculation interrupted.");
    } finally {
      setIsSolving(false);
    }
  };

  const renderGraph = (data: {x: number, y: number}[]) => {
    if (!graphRef.current || !data.length) return;
    const svg = d3.select(graphRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const width = graphRef.current.parentElement?.clientWidth || 800;
    const height = 400;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];
    
    const x = d3.scaleLinear().domain([xExtent[0], xExtent[1]]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([yExtent[0], yExtent[1]]).range([innerHeight, 0]);

    // Grid lines
    g.append("g").attr("class", "opacity-5 dark:opacity-10").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat(() => ""));
    g.append("g").attr("class", "opacity-5 dark:opacity-10").call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""));
    
    // Axes labels
    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x)).attr("class", "text-[10px] text-slate-400 font-bold");
    g.append("g").call(d3.axisLeft(y)).attr("class", "text-[10px] text-slate-400 font-bold");

    const line = d3.line<{x: number, y: number}>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);
    
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#06b6d4")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("class", "drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]");
  };

  const categories = Array.from(new Set(MATH_SYMBOLS.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
      {/* Header - Aligned with other modes */}
      <header className="h-16 md:h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-[130]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl transition-transform hover:scale-110">
            <i className="fa-solid fa-calculator text-lg md:text-xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.math.title}</h2>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-cyan-500/20 animate-pulse">BETA</span>
            </div>
            <p className="hidden md:block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] opacity-60">{t.math.subtitle}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all duration-300">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      {/* Main Scroll Area for Solutions */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-12 relative">
        <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-40">
          {!solution && !isSolving && !error && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-8 opacity-20 animate-fade">
               <div className="w-32 h-32 rounded-[48px] border-4 border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-center">
                  <i className="fa-solid fa-square-root-variable text-6xl"></i>
               </div>
               <div className="space-y-3">
                 <p className="text-[14px] font-black uppercase tracking-[0.6em]">Neural Logic Gateway</p>
                 <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting mathematical stream</p>
               </div>
            </div>
          )}

          {isSolving && (
            <div className="flex flex-col items-center justify-center py-24 gap-8 animate-reveal">
               <div className="relative">
                 <div className="w-24 h-24 border-4 border-cyan-500/10 rounded-full animate-soft-pulse"></div>
                 <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-600 animate-pulse">{t.math.solving}</p>
            </div>
          )}

          {error && (
             <div className="px-8 py-5 bg-red-500/10 border border-red-500/20 rounded-[32px] animate-reveal flex items-center gap-6 text-red-500 shadow-sm">
                <i className="fa-solid fa-circle-exclamation text-lg"></i>
                <p className="text-[11px] font-black uppercase tracking-widest">{error}</p>
             </div>
          )}

          {solution && (
             <div className="space-y-12 animate-reveal">
                <div className="glass-panel p-8 md:p-16 rounded-[48px] md:rounded-[64px] border border-black/5 dark:border-white/5 shadow-sm space-y-14 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl">
                   <div className="space-y-10">
                      <div className="flex items-center gap-4">
                         <div className="w-2 h-8 bg-cyan-600 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.4)]"></div>
                         <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">{t.math.steps}</h3>
                      </div>
                      
                      <div className="prose prose-slate dark:prose-invert max-w-none">
                         <div 
                           className="text-slate-800 dark:text-slate-200 leading-relaxed space-y-8 text-base md:text-xl font-medium"
                           dangerouslySetInnerHTML={{ __html: solution.text.replace(/\n/g, '<br/>') }}
                           ref={(el) => {
                             if (el && (window as any).renderMathInElement) {
                               (window as any).renderMathInElement(el, {
                                 delimiters: [
                                   {left: '$$', right: '$$', display: true},
                                   {left: '$', right: '$', display: false}
                                 ],
                                 throwOnError: false
                               });
                             }
                           }}
                         />
                      </div>
                   </div>

                   {solution.graph && (
                     <div className="pt-16 border-t border-black/5 dark:border-white/5 space-y-10 animate-reveal">
                        <div className="flex items-center justify-between px-4">
                           <div className="flex items-center gap-4">
                              <div className="w-2 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)]"></div>
                              <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.5em]">{t.math.graphReady}</h3>
                           </div>
                        </div>
                        <div className="w-full bg-slate-100/50 dark:bg-black/40 rounded-[40px] md:rounded-[56px] p-4 md:p-14 border border-black/5 dark:border-white/5 overflow-hidden shadow-inner relative group">
                           <svg ref={graphRef} viewBox="0 0 800 400" className="w-full h-auto max-h-[500px]"></svg>
                           <div className="absolute bottom-6 right-8 text-[8px] font-black uppercase tracking-widest text-slate-400 opacity-40">Neural Rendering • D3.js Engine</div>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Bottom Input Area - Aligned with App UI Standards */}
      <div className="shrink-0 p-4 md:p-10 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/80 dark:via-slate-950/80 to-transparent z-[140]">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Symbol Toolbar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-6 w-full glass-panel rounded-[40px] md:rounded-[48px] border border-black/10 dark:border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] z-[150] p-6 md:p-10 animate-scale-in max-h-[50vh] overflow-y-auto custom-scrollbar backdrop-blur-3xl">
                <div className="space-y-12">
                  {categories.map(cat => (
                    <section key={cat} className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-600 px-2">{cat}</h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {MATH_SYMBOLS.filter(s => s.category === cat).map((sym, idx) => (
                          <button 
                            key={sym.label} 
                            onClick={() => insertSymbol(sym.tex)}
                            className="flex flex-col items-center justify-center gap-3 p-5 bg-slate-50 dark:bg-white/5 rounded-[24px] hover:bg-cyan-600 hover:text-white transition-all group border border-transparent hover:border-cyan-400/30"
                            title={sym.label}
                          >
                            <div id={`sym-preview-${idx}`} className="text-sm md:text-base transition-transform group-hover:scale-110"></div>
                            <span className="text-[7px] font-black uppercase truncate w-full text-center opacity-40 group-hover:opacity-100">{sym.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Suggestion Notification */}
          {suggestion && (
            <div className="px-8 py-3 bg-amber-500/10 border border-amber-500/20 rounded-full animate-reveal flex items-center gap-4 mx-auto w-fit backdrop-blur-md">
               <i className="fa-solid fa-lightbulb text-amber-500 text-xs animate-pulse"></i>
               <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">{suggestion}</p>
            </div>
          )}

          {/* Combined Input Field with Real Math Overlay */}
          <div className="relative">
            <div className="glass-panel p-2 md:p-3 rounded-[32px] md:rounded-[48px] shadow-2xl border border-slate-300 dark:border-white/10 flex items-center gap-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl transition-all duration-500 focus-within:ring-8 focus-within:ring-cyan-500/5 relative">
              
              {/* Toolbar Toggle Button */}
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-12 h-12 md:w-16 md:h-16 rounded-full transition-all flex items-center justify-center shrink-0 border ${isDropdownOpen ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-transparent hover:border-cyan-500/20'}`}
              >
                <i className={`fa-solid ${isDropdownOpen ? 'fa-keyboard' : 'fa-plus-minus'} text-lg md:text-xl`}></i>
              </button>

              <div className="flex-1 relative h-12 md:h-16 flex items-center overflow-hidden">
                {/* Real Math Formatting Overlay (KaTeX) */}
                <div 
                  ref={katexPreviewRef} 
                  className={`absolute inset-0 flex items-center px-4 pointer-events-none text-base md:text-2xl font-bold transition-opacity duration-200 ${input ? 'opacity-100' : 'opacity-0'} dark:text-white text-slate-900 z-10 whitespace-nowrap overflow-hidden`}
                ></div>

                {/* Actual Input - transparent to allow the KaTeX layer to show through */}
                <input 
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && solveMath()}
                  placeholder={input ? "" : t.placeholderMaths}
                  className={`absolute inset-0 w-full bg-transparent border-none focus:ring-0 text-base md:text-2xl py-4 px-4 font-mono transition-all caret-cyan-500 ${input ? 'text-transparent' : 'dark:text-slate-500 text-slate-400'} placeholder:text-slate-300 dark:placeholder:text-slate-800 z-20`}
                />
              </div>

              {/* Action Button */}
              <button 
                onClick={solveMath}
                disabled={isSolving || !input.trim()}
                className="w-12 h-12 md:w-16 md:h-16 rounded-[24px] md:rounded-[32px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shrink-0"
              >
                {isSolving ? <i className="fa-solid fa-circle-notch animate-spin text-lg md:text-xl"></i> : <i className="fa-solid fa-bolt-lightning text-lg md:text-xl"></i>}
              </button>
            </div>
            
            {/* Live Status Indicator */}
            {input && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-600/10 dark:bg-cyan-400/10 backdrop-blur-md rounded-full border border-cyan-500/20 opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                 <p className="text-[8px] font-black uppercase tracking-[0.4em] text-cyan-600 dark:text-cyan-400">Real-Time Neural Preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MathsMode;
