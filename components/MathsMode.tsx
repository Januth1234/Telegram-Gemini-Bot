
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
  icon: string;
  category: 'Arithmetic' | 'Calculus' | 'Matrices' | 'Variables';
}

const MATH_SYMBOLS: MathSymbol[] = [
  // Arithmetic
  { label: 'Fraction', tex: '\\frac{}{}', icon: 'fa-divide', category: 'Arithmetic' },
  { label: 'Square Root', tex: '\\sqrt{}', icon: 'fa-square-root-variable', category: 'Arithmetic' },
  { label: 'Exponent', tex: '^{}', icon: 'fa-superscript', category: 'Arithmetic' },
  { label: 'Parentheses', tex: '()', icon: 'fa-brackets-curly', category: 'Arithmetic' },
  
  // Matrices
  { label: '2x2 Matrix', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', icon: 'fa-table-cells', category: 'Matrices' },
  { label: '3x3 Matrix', tex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', icon: 'fa-table-cells-large', category: 'Matrices' },
  { label: 'Determinant', tex: '|A|', icon: 'fa-grip-lines-vertical', category: 'Matrices' },
  { label: 'Square Brackets', tex: '[]', icon: 'fa-brackets-square', category: 'Matrices' },

  // Calculus
  { label: 'Integral', tex: '\\int', icon: 'fa-integral', category: 'Calculus' },
  { label: 'Derivative', tex: '\\frac{d}{dx}', icon: 'fa-signature', category: 'Calculus' },
  { label: 'Limit', tex: '\\lim_{x \\to \\infty}', icon: 'fa-arrows-to-line', category: 'Calculus' },
  { label: 'Summation', tex: '\\sum_{}^{}', icon: 'fa-sigma', category: 'Calculus' },

  // Variables & Symbols
  { label: 'Infinity', tex: '\\infty', icon: 'fa-infinity', category: 'Variables' },
  { label: 'Pi', tex: '\\pi', icon: 'fa-pi', category: 'Variables' },
  { label: 'Theta', tex: '\\theta', icon: 'fa-circle-dot', category: 'Variables' },
  { label: 'Delta', tex: '\\Delta', icon: 'fa-triangle', category: 'Variables' },
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

  const insertSymbol = (tex: string) => {
    const start = inputRef.current?.selectionStart || 0;
    const end = inputRef.current?.selectionEnd || 0;
    const newVal = input.substring(0, start) + tex + input.substring(end);
    setInput(newVal);
    
    setTimeout(() => {
      inputRef.current?.focus();
      // Logic to place cursor inside the first set of braces or matrix entries
      const bracePos = tex.indexOf('{}');
      const matrixPos = tex.indexOf('a'); // For matrix templates
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

    // Heuristic check: Encourage standard notation usage
    const isLikelyPlain = !input.includes('\\') && (input.includes('/') || input.includes('^') || input.toLowerCase().includes('matrix'));
    if (isLikelyPlain) {
      setSuggestion(t.math.suggestStandard);
    }

    try {
      const prompt = `Solve this math problem. 
      If it involves a function (e.g., plot, graph), include a JSON block with "graphData" (array of points).
      If it involves matrices, perform the requested calculation (addition, multiplication, inverse, determinant, etc.) and show steps.
      
      Structure your response:
      1. Step-by-step mathematical explanation using Standard LaTeX notation for clear rendering.
      2. The final result labeled clearly.
      3. A JSON block at the end if graphing is required.
      
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
      } catch (e) { /* silent */ }

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
    const height = 450;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];
    
    const x = d3.scaleLinear().domain([xExtent[0] * 1.1, xExtent[1] * 1.1]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([yExtent[0] * 1.1, yExtent[1] * 1.1]).range([innerHeight, 0]);

    g.append("g")
      .attr("class", "grid opacity-5 dark:opacity-10")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat(() => ""));

    g.append("g")
      .attr("class", "grid opacity-5 dark:opacity-10")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""));

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(10))
      .attr("class", "text-slate-500 font-bold text-[10px]");

    g.append("g")
      .call(d3.axisLeft(y).ticks(10))
      .attr("class", "text-slate-500 font-bold text-[10px]");

    const line = d3.line<{x: number, y: number}>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#06b6d4")
      .attr("stroke-width", 3.5)
      .attr("d", line)
      .attr("class", "drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]");
  };

  const categories = Array.from(new Set(MATH_SYMBOLS.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
      <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-calculator text-xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.math.title}</h2>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-cyan-500/20 animate-pulse">BETA</span>
            </div>
            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">{t.math.subtitle}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all duration-300">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar flex flex-col gap-10">
        <div className="max-w-5xl mx-auto w-full space-y-10">
          
          <div className="relative" ref={dropdownRef}>
            <div className="glass-panel p-4 rounded-[40px] border border-black/5 dark:border-white/10 shadow-2xl flex items-center gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl transition-all duration-500 focus-within:ring-4 focus-within:ring-cyan-500/10">
               <div className="relative">
                 <button 
                   onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                   className={`w-14 h-14 rounded-2xl transition-all flex items-center justify-center shrink-0 border ${isDropdownOpen ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-transparent hover:border-cyan-500/20'}`}
                 >
                   <i className={`fa-solid ${isDropdownOpen ? 'fa-xmark' : 'fa-plus-minus'} text-xl`}></i>
                 </button>
                 
                 {isDropdownOpen && (
                   <div className="absolute top-full left-0 mt-6 w-[320px] md:w-[600px] glass-panel rounded-[48px] border border-black/10 dark:border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] z-[60] p-8 animate-scale-in max-h-[70vh] overflow-y-auto no-scrollbar">
                      <div className="space-y-10">
                        {categories.map(cat => (
                          <section key={cat} className="space-y-4">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-600 px-1">{cat}</h4>
                             <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
                               {MATH_SYMBOLS.filter(s => s.category === cat).map(sym => (
                                 <button 
                                   key={sym.label} 
                                   onClick={() => insertSymbol(sym.tex)}
                                   className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-cyan-600 hover:text-white transition-all group border border-transparent hover:border-cyan-400/30"
                                   title={sym.label}
                                 >
                                   <i className={`fa-solid ${sym.icon} text-lg mb-2`}></i>
                                   <span className="text-[7px] font-black uppercase truncate w-full text-center opacity-60 group-hover:opacity-100">{sym.label}</span>
                                 </button>
                               ))}
                             </div>
                          </section>
                        ))}
                      </div>
                   </div>
                 )}
               </div>

               <input 
                 ref={inputRef}
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && solveMath()}
                 placeholder={t.placeholderMaths}
                 className="flex-1 bg-transparent border-none focus:ring-0 text-lg md:text-2xl py-6 px-2 dark:text-white font-mono placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-all"
               />

               <button 
                 onClick={solveMath}
                 disabled={isSolving || !input.trim()}
                 className="w-16 h-16 rounded-[28px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shrink-0"
               >
                  {isSolving ? <i className="fa-solid fa-circle-notch animate-spin text-xl"></i> : <i className="fa-solid fa-paper-plane text-xl"></i>}
               </button>
            </div>
          </div>

          {suggestion && (
            <div className="px-8 py-5 bg-amber-500/10 border border-amber-500/20 rounded-[32px] animate-reveal flex items-center gap-6">
               <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                  <i className="fa-solid fa-lightbulb text-lg"></i>
               </div>
               <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest leading-relaxed">
                  {suggestion}
               </p>
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
                <div className="glass-panel p-10 md:p-16 rounded-[64px] border border-black/5 dark:border-white/5 shadow-sm space-y-14 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl">
                   <div className="space-y-10">
                      <div className="flex items-center gap-4">
                         <div className="w-2 h-8 bg-cyan-600 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                         <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">{t.math.steps}</h3>
                      </div>
                      
                      <div className="prose prose-slate dark:prose-invert max-w-none">
                         <div 
                           className="text-slate-800 dark:text-slate-200 leading-relaxed space-y-8 text-base md:text-xl font-medium"
                           dangerouslySetInnerHTML={{ 
                             __html: solution.text.replace(/\n/g, '<br/>') 
                           }}
                           ref={(el) => {
                             if (el && (window as any).renderMathInElement) {
                               (window as any).renderMathInElement(el, {
                                 delimiters: [
                                   {left: '$$', right: '$$', display: true},
                                   {left: '$', right: '$', display: false},
                                   {left: '\\(', right: '\\)', display: false},
                                   {left: '\\[', right: '\\]', display: true}
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
                              <div className="w-2 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                              <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.5em]">{t.math.graphReady}</h3>
                           </div>
                           <button 
                             onClick={() => renderGraph(solution.graph!)}
                             className="text-[10px] font-black uppercase text-cyan-600 hover:text-cyan-400 transition-colors tracking-widest"
                           >
                             Recalibrate Viewport
                           </button>
                        </div>
                        <div className="w-full bg-slate-100/50 dark:bg-black/40 rounded-[56px] p-8 md:p-14 border border-black/5 dark:border-white/5 overflow-hidden shadow-inner relative group">
                           <svg ref={graphRef} viewBox="0 0 800 450" className="w-full h-auto max-h-[500px]"></svg>
                           <div className="absolute bottom-8 right-12 text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                             Neural Visualization Engine • Powered by D3.js
                           </div>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          )}

          {isSolving && !solution && (
            <div className="flex flex-col items-center justify-center py-32 gap-12 animate-reveal">
               <div className="relative">
                 <div className="w-32 h-32 border-4 border-cyan-500/10 rounded-full animate-soft-pulse"></div>
                 <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                 <div className="absolute inset-4 border-2 border-indigo-500/20 border-b-indigo-500 rounded-full animate-spin-reverse"></div>
               </div>
               <div className="text-center space-y-3">
                 <p className="text-[12px] font-black uppercase tracking-[0.6em] text-cyan-600 animate-pulse">{t.math.solving}</p>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">Synchronizing neural calculation pathways...</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MathsMode;
