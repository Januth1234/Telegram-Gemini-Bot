
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';
// Fix: Added missing d3 import to resolve "Cannot find name 'd3'" errors.
import * as d3 from 'd3';

interface MathsModeProps {
  onClose: () => void;
  lang: Language;
}

const MATH_SYMBOLS = [
  { label: 'Fraction', tex: '\\frac{}{}', icon: 'fa-divide' },
  { label: 'Square Root', tex: '\\sqrt{}', icon: 'fa-square-root-variable' },
  { label: 'Exponent', tex: '^{}', icon: 'fa-superscript' },
  { label: 'Subscript', tex: '_{}', icon: 'fa-subscript' },
  { label: 'Parentheses', tex: '()', icon: 'fa-brackets-curly' },
  { label: 'Integral', tex: '\\int', icon: 'fa-integral' },
  { label: 'Sum', tex: '\\sum', icon: 'fa-sigma' },
  { label: 'Infinity', tex: '\\infty', icon: 'fa-infinity' },
  { label: 'Pi', tex: '\\pi', icon: 'fa-pi' },
  { label: 'Delta', tex: '\\Delta', icon: 'fa-triangle' },
];

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [input, setInput] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  
  const graphRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const insertSymbol = (tex: string) => {
    const start = inputRef.current?.selectionStart || 0;
    const end = inputRef.current?.selectionEnd || 0;
    const newVal = input.substring(0, start) + tex + input.substring(end);
    setInput(newVal);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = start + tex.indexOf('{}');
      if (pos > start) {
        inputRef.current?.setSelectionRange(pos + 1, pos + 1);
      }
    }, 10);
  };

  const solveMath = async () => {
    if (!input.trim()) return;
    setIsSolving(true);
    setError(null);
    setSolution(null);
    setSuggestion(null);

    // Simple heuristic to detect "non-standard" notation if they haven't used any backslashes or curly braces for complex stuff
    const hasComplexNeed = /fraction|sqrt|sum|integral|root/i.test(input) || /\/|\^/.test(input);
    const usesStandard = /\\/.test(input) || /\{/.test(input);
    
    if (hasComplexNeed && !usesStandard) {
      setSuggestion(t.math.suggestStandard);
    }

    try {
      const prompt = `Solve this math problem. If it involves a function that can be graphed, return a JSON object with a "graphData" key containing an array of {x, y} points for d3.js plotting. 
      Return the solution steps and the final answer. 
      IMPORTANT: Format all mathematical symbols using standard LaTeX notation so I can render them perfectly.
      Problem: ${input}`;

      const res = await geminiService.chat(prompt, { useThinking: true });
      
      // Try to extract JSON if it exists for the graph
      let graphData = null;
      let cleanText = res.text;
      try {
        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.graphData) {
            graphData = parsed.graphData;
            cleanText = res.text.replace(jsonMatch[0], '');
          }
        }
      } catch(e) { /* ignore */ }

      setSolution({ text: cleanText, graph: graphData });
      
      if (graphData) {
        setTimeout(() => renderGraph(graphData), 100);
      }
    } catch (e: any) {
      setError(e.message || "Failed to solve.");
    } finally {
      setIsSolving(false);
    }
  };

  const renderGraph = (data: {x: number, y: number}[]) => {
    if (!graphRef.current) return;
    const svg = d3.select(graphRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = graphRef.current.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().rangeRound([0, width]);
    const y = d3.scaleLinear().rangeRound([height, 0]);

    x.domain(d3.extent(data, d => d.x) as [number, number]);
    y.domain(d3.extent(data, d => d.y) as [number, number]);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr("class", "dark:text-white opacity-50");

    g.append("g")
      .call(d3.axisLeft(y))
      .attr("class", "dark:text-white opacity-50");

    const line = d3.line<{x: number, y: number}>()
      .x(d => x(d.x))
      .y(d => y(d.y))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#06b6d4")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 3)
      .attr("d", line);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
      <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-calculator text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.math.title}</h2>
            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">{t.math.subtitle}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar flex flex-col gap-10">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.math.dropdownLabel}</span>
             </div>
             <div className="flex flex-wrap gap-2">
                {MATH_SYMBOLS.map(sym => (
                  <button 
                    key={sym.label} 
                    onClick={() => insertSymbol(sym.tex)}
                    className="px-4 py-2.5 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 hover:text-white transition-all shadow-sm"
                  >
                    <i className={`fa-solid ${sym.icon} mr-2`}></i>
                    {sym.label}
                  </button>
                ))}
             </div>
          </div>

          <div className="glass-panel p-4 rounded-[32px] border border-black/5 dark:border-white/10 shadow-2xl flex items-center gap-4">
             <input 
               ref={inputRef}
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && solveMath()}
               placeholder={t.placeholderMaths}
               className="flex-1 bg-transparent border-none focus:ring-0 text-lg py-4 px-4 dark:text-white font-mono"
             />
             <button 
               onClick={solveMath}
               disabled={isSolving || !input.trim()}
               className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
             >
                {isSolving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
             </button>
          </div>

          {suggestion && (
            <div className="px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-reveal flex items-center gap-4">
               <i className="fa-solid fa-lightbulb text-amber-500"></i>
               <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                  {suggestion}
               </p>
            </div>
          )}

          {error && (
             <div className="px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-reveal flex items-center gap-4 text-red-500">
                <i className="fa-solid fa-circle-exclamation"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
             </div>
          )}

          {solution && (
             <div className="space-y-8 animate-reveal">
                <div className="glass-panel p-10 rounded-[48px] border border-black/5 dark:border-white/5 shadow-sm space-y-10">
                   <div className="space-y-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">{t.math.steps}</h3>
                      <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                         {/* Render solution text with KaTeX support via auto-render or direct rendering */}
                         <div 
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
                     <div className="pt-10 border-t border-black/5 dark:border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                           <h3 className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{t.math.graphReady}</h3>
                        </div>
                        <div className="w-full bg-slate-50 dark:bg-black/20 rounded-[32px] p-6 border border-black/5 dark:border-white/5 overflow-hidden">
                           <svg ref={graphRef} className="w-full h-[300px]"></svg>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          )}

          {isSolving && !solution && (
            <div className="flex flex-col items-center justify-center py-20 gap-6 animate-reveal">
               <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-600">{t.math.solving}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MathsMode;
