
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import * as d3 from 'd3';

// Nerdamer & MathLive are loaded via index.html
declare const nerdamer: any;

// Use 'any' type for the custom element tag to bypass JSX.IntrinsicElements check issues
const MathFieldTag = 'math-field' as any;

interface MathsModeProps {
  onClose: () => void;
  lang: Language;
}

type MathCategory = 'General' | 'Algebra' | 'Calculus' | 'Linear Algebra' | 'Statistics' | 'Physics';

interface MathTool {
  label: string;
  command: string; // Internal command or LaTeX insertion
  type: 'insert' | 'action'; // Insert symbol OR trigger solve action
  desc: string;
}

// --- Configuration: The Mega Toolbox ---
const CATEGORIES: Record<MathCategory, { icon: string; tools: MathTool[] }> = {
  'General': {
    icon: 'fa-calculator',
    tools: [
      { label: 'Simplify', command: 'simplify', type: 'action', desc: 'Simplify Expression' },
      { label: 'Evaluate', command: 'evaluate', type: 'action', desc: 'Numeric Value' },
      { label: 'Fraction', command: '\\frac{\\placeholder}{\\placeholder}', type: 'insert', desc: 'a/b' },
      { label: 'Sqrt', command: '\\sqrt{\\placeholder}', type: 'insert', desc: 'Square Root' },
      { label: 'Power', command: '^\\placeholder', type: 'insert', desc: 'x^n' },
      { label: 'Pi', command: '\\pi', type: 'insert', desc: 'Pi' },
    ]
  },
  'Algebra': {
    icon: 'fa-x',
    tools: [
      { label: 'Solve for x', command: 'solve', type: 'action', desc: 'Find x' },
      { label: 'Factor', command: 'factor', type: 'action', desc: 'Factor Polynomial' },
      { label: 'Expand', command: 'expand', type: 'action', desc: 'Expand Brackets' },
      { label: 'Roots', command: 'roots', type: 'action', desc: 'Find Roots' },
      { label: 'Log', command: '\\log_{\\placeholder}(\\placeholder)', type: 'insert', desc: 'Logarithm' },
      { label: 'Ln', command: '\\ln(\\placeholder)', type: 'insert', desc: 'Natural Log' },
    ]
  },
  'Calculus': {
    icon: 'fa-infinity',
    tools: [
      { label: 'Differentiate', command: 'diff', type: 'action', desc: 'd/dx' },
      { label: 'Integrate', command: 'integrate', type: 'action', desc: 'Integral' },
      { label: 'Def. Integral', command: 'def_int', type: 'action', desc: 'Area under curve' },
      { label: 'Limit', command: '\\lim_{x \\to \\infty}', type: 'insert', desc: 'Limit' },
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
      { label: '3x3 Matrix', command: '\\begin{pmatrix}0&0&0\\\\0&0&0\\\\0&0&0\\end{pmatrix}', type: 'insert', desc: 'Insert 3x3' },
      { label: 'Vector', command: '\\begin{pmatrix}0\\\\0\\\\0\\end{pmatrix}', type: 'insert', desc: 'Column Vector' },
    ]
  },
  'Statistics': {
    icon: 'fa-chart-bar',
    tools: [
      { label: 'Mean', command: 'mean', type: 'action', desc: 'Average' },
      { label: 'Median', command: 'median', type: 'action', desc: 'Middle Value' },
      { label: 'Std Dev', command: 'stdev', type: 'action', desc: 'Standard Deviation' },
      { label: 'Data Set', command: '\\left[1, 2, 3, 4\\right]', type: 'insert', desc: 'List of numbers' },
    ]
  },
  'Physics': {
    icon: 'fa-atom',
    tools: [
      { label: 'kg to lbs', command: 'unit_mass', type: 'action', desc: 'Mass Convert' },
      { label: 'm to ft', command: 'unit_len', type: 'action', desc: 'Length Convert' },
      { label: 'C to F', command: 'unit_temp', type: 'action', desc: 'Temp Convert' },
      { label: 'Force (F=ma)', command: 'F=m*a', type: 'insert', desc: 'Newton II' },
      { label: 'Kinetic E', command: 'K=0.5*m*v^2', type: 'insert', desc: 'Energy' },
    ]
  }
};

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [isProcessing, setIsProcessing] = useState(false);
  const [solution, setSolution] = useState<{ 
    inputLatex: string; 
    resultLatex: string; 
    steps: string[];
    decimal?: string;
    graph?: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mfRef = useRef<any>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // -- LOGIC ENGINE --

  const LatexParser = {
    // Helper to find the matching closing brace index starting from a given index
    findClosingBrace: (str: string, startIndex: number): number => {
      let depth = 0;
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
          depth--;
          if (depth === 0) return i;
        }
      }
      return -1;
    },

    // Main parse function
    parse: (latex: string): string => {
      if (!latex) return '';
      let clean = latex;

      // 1. Basic Cleanup (Format removal)
      clean = clean.replace(/\\left/g, '').replace(/\\right/g, '');
      clean = clean.replace(/\\,/g, ''); 
      clean = clean.replace(/\\ /g, '');

      // 2. Matrices: \begin{matrix} ... \end{matrix}
      // Processed first to preserve internal structure before other replacements
      if (clean.includes('matrix')) {
         clean = clean.replace(/\\begin{[pb]?matrix}([\s\S]*?)\\end{[pb]?matrix}/g, (match, content) => {
            const rows = content.split('\\\\').map(r => {
               const cols = r.split('&').map(c => LatexParser.parse(c.trim()));
               return `[${cols.join(',')}]`;
            });
            return `matrix(${rows.join(',')})`;
         });
      }

      // 3. Recursive Command Processing (Fraction, Sqrt)
      // This handles nested commands like \frac{\frac{1}{2}}{3} correctly
      const processCommand = (str: string, cmd: string, replaceFn: (args: string[]) => string) => {
        let result = str;
        let loops = 0;
        // Limit iterations to prevent infinite loops on malformed latex
        while (result.includes(cmd) && loops++ < 50) {
          const startIdx = result.indexOf(cmd);
          const args: string[] = [];
          let currentIdx = startIdx + cmd.length;
          
          // Attempt to extract up to 2 arguments
          for (let i = 0; i < 2; i++) {
             if (currentIdx < result.length && result[currentIdx] === '{') {
                const closeIdx = LatexParser.findClosingBrace(result, currentIdx);
                if (closeIdx !== -1) {
                  args.push(result.substring(currentIdx + 1, closeIdx));
                  currentIdx = closeIdx + 1;
                } else break;
             } else {
                break;
             }
          }

          if (args.length > 0) {
             const parsedArgs = args.map(a => LatexParser.parse(a));
             const replacement = replaceFn(parsedArgs);
             result = result.substring(0, startIdx) + replacement + result.substring(currentIdx);
          } else {
             break; // Malformed or no args
          }
        }
        return result;
      };

      // Fractions
      clean = processCommand(clean, '\\frac', args => args.length === 2 ? `(${args[0]})/(${args[1]})` : `(${args[0]})`);
      
      // Sqrt
      clean = processCommand(clean, '\\sqrt', args => `sqrt(${args[0]})`);

      // 4. Superscripts ^{...}
      while (clean.includes('^{')) {
        const start = clean.indexOf('^{');
        const close = LatexParser.findClosingBrace(clean, start + 1);
        if (close === -1) break;
        const content = clean.substring(start + 2, close);
        clean = clean.substring(0, start) + '^(' + LatexParser.parse(content) + ')' + clean.substring(close + 1);
      }

      // 5. Symbol Mapping
      clean = clean
        .replace(/\\sin/g, 'sin')
        .replace(/\\cos/g, 'cos')
        .replace(/\\tan/g, 'tan')
        .replace(/\\csc/g, 'csc')
        .replace(/\\sec/g, 'sec')
        .replace(/\\cot/g, 'cot')
        .replace(/\\arcsin/g, 'asin')
        .replace(/\\arccos/g, 'acos')
        .replace(/\\arctan/g, 'atan')
        .replace(/\\ln/g, 'log')
        .replace(/\\log/g, 'log10')
        .replace(/\\pi/g, 'PI')
        .replace(/\\infty/g, 'Infinity')
        .replace(/\\cdot/g, '*')
        .replace(/\\times/g, '*')
        .replace(/\\div/g, '/')
        .replace(/{/g, '(').replace(/}/g, ')') // Grouping cleanup
        .replace(/\\/g, ''); // Remove stray backslashes

      // 6. Implicit Multiplication
      // 2x -> 2*x
      clean = clean.replace(/(\d)([a-zA-Z\(])/g, '$1*$2');
      // )x -> )*x or )( -> )*(
      clean = clean.replace(/(\))([a-zA-Z0-9\(])/g, '$1*$2');

      return clean;
    }
  };

  const handleAction = async (command: string) => {
    const rawLatex = mfRef.current?.value;
    if (!rawLatex) return;

    setIsProcessing(true);
    setError(null);
    setSolution(null);

    // Simulate "Thinking" delay
    await new Promise(r => setTimeout(r, 400));

    try {
      let parsed = LatexParser.parse(rawLatex);
      let result: any;
      let decimal: string | undefined;
      let graphData: any[] | null = null;
      let steps: string[] = [`Operation: ${command}`];

      // --- ENGINE ROUTING ---
      if (activeCat === 'Physics' && command.startsWith('unit_')) {
          // Custom Unit Engine (Requires specialized parsing for numbers)
          const val = parseFloat(parsed.match(/[\d.]+/)?.[0] || "0");
          if (isNaN(val)) throw new Error("Please enter a number for conversion.");
          
          if (command === 'unit_mass') {
             result = `${val} kg = ${(val * 2.20462).toFixed(2)} lbs`;
             steps.push("Formula: kg * 2.20462");
          } else if (command === 'unit_len') {
             result = `${val} meters = ${(val * 3.28084).toFixed(2)} feet`;
             steps.push("Formula: m * 3.28084");
          } else if (command === 'unit_temp') {
             result = `${val}°C = ${(val * 9/5 + 32).toFixed(1)}°F`;
             steps.push("Formula: (C * 9/5) + 32");
          }
      } 
      else if (activeCat === 'Statistics') {
          // Nerdamer Stats or Custom
          // Note: Matrix parsing in LatexParser converts [1,2,3] to [1,2,3], which matches what we need
          // But check if it parsed as a matrix( ) string
          const cleanStats = parsed.replace('matrix(', '').replace(')', '').replace('[', '').replace(']', '');
          const numbers = cleanStats.split(',').map(n => parseFloat(n));
          
          if (numbers.some(isNaN)) throw new Error("Enter a data set like [1, 2, 3]");
          
          if (command === 'mean') {
             const sum = numbers.reduce((a,b) => a+b, 0);
             const mean = sum / numbers.length;
             result = mean.toFixed(4);
             steps.push(`Sum: ${sum}`, `Count: ${numbers.length}`);
          } else if (command === 'median') {
             const sorted = numbers.sort((a,b) => a-b);
             const mid = Math.floor(sorted.length/2);
             result = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid-1] + sorted[mid])/2);
             steps.push(`Sorted: [${sorted.join(', ')}]`);
          } else if (command === 'stdev') {
             const mean = numbers.reduce((a,b) => a+b, 0) / numbers.length;
             const variance = numbers.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / numbers.length;
             result = Math.sqrt(variance).toFixed(4);
          }
      }
      else {
          // Main Nerdamer Engine
          switch (command) {
              case 'simplify': result = nerdamer(parsed).simplify(); break;
              case 'evaluate': result = nerdamer(parsed).evaluate(); break;
              case 'expand': result = nerdamer(parsed).expand(); break;
              case 'factor': result = nerdamer(parsed).factor(); break;
              case 'solve': result = nerdamer.solve(parsed, 'x'); break;
              case 'roots': result = nerdamer.roots(parsed); break;
              case 'diff': result = nerdamer(`diff(${parsed}, x)`); break;
              case 'integrate': result = nerdamer(`integrate(${parsed}, x)`); break;
              case 'def_int': result = nerdamer(`defint(${parsed}, 0, 10)`); steps.push("Assumed range [0, 10]"); break;
              case 'determinant': result = nerdamer(`determinant(${parsed})`); break;
              case 'invert': result = nerdamer(`invert(${parsed})`); break;
              case 'transpose': result = nerdamer(`transpose(${parsed})`); break;
              default: result = nerdamer(parsed);
          }
      }

      // Process Result
      let resultLatex = "";
      if (typeof result === 'object' && result.toTeX) resultLatex = result.toTeX();
      else if (Array.isArray(result)) resultLatex = result.map(r => r.toString()).join(', ');
      else resultLatex = result.toString();

      // Attempt Decimal
      try {
         if (command !== 'solve' && !resultLatex.includes('matrix')) {
            const d = nerdamer(result).evaluate().text('decimals');
            if (d !== resultLatex && !d.includes('i') && !d.includes('matrix')) decimal = d;
         }
      } catch (e) {}

      // Attempt Graphing
      if (['simplify', 'expand', 'factor', 'solve'].includes(command) || activeCat === 'General') {
          try {
             // Graph the INPUT expression if solving, or the RESULT if simplifying
             const exprToGraph = command === 'solve' ? parsed.split('=')[0] : result.toString();
             const func = nerdamer(exprToGraph).buildFunction(['x']);
             const points = [];
             for (let x = -10; x <= 10; x += 0.2) {
                 try {
                     const y = func(x);
                     if (isFinite(y) && Math.abs(y) < 20) points.push({ x, y });
                 } catch(e){}
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
      console.error(e);
      setError("Syntax Error. Please check your expression format.");
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

      const width = 600; 
      const height = 300;
      const margin = {top: 20, right: 20, bottom: 20, left: 40};
      
      const xExtent = d3.extent(data, d => d.x) as [number, number];
      const yExtent = d3.extent(data, d => d.y) as [number, number];
      
      const x = d3.scaleLinear().domain(xExtent).range([margin.left, width - margin.right]);
      const y = d3.scaleLinear().domain(yExtent).range([height - margin.bottom, margin.top]);

      const line = d3.line<{x: number, y: number}>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);

      // Axes
      const xAxis = (g: any) => g.attr("transform", `translate(0,${y(0)})`).call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));
      const yAxis = (g: any) => g.attr("transform", `translate(${x(0)},0)`).call(d3.axisLeft(y).ticks(height / 40));

      svg.append("g").call(xAxis).attr("class", "text-slate-400 opacity-50");
      svg.append("g").call(yAxis).attr("class", "text-slate-400 opacity-50");

      svg.append("path")
         .datum(data)
         .attr("fill", "none")
         .attr("stroke", "#06b6d4")
         .attr("stroke-width", 2.5)
         .attr("d", line);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md z-50">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
               <i className="fa-solid fa-square-root-variable"></i>
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Orin Math Engine <span className="text-indigo-500">v4.0</span></h2>
         </div>
         <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors">
            <i className="fa-solid fa-xmark"></i>
         </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
         {/* Sidebar Categories */}
         <nav className="w-full md:w-64 bg-slate-100 dark:bg-black/20 border-r border-black/5 dark:border-white/5 p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0 custom-scrollbar">
            {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
               <button
                 key={cat}
                 onClick={() => setActiveCat(cat)}
                 className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all min-w-max md:w-full ${
                    activeCat === cat 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm border border-black/5 dark:border-white/5' 
                    : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                 }`}
               >
                 <i className={`fa-solid ${CATEGORIES[cat].icon} w-5`}></i>
                 {cat}
               </button>
            ))}
         </nav>

         {/* Main Workspace */}
         <main className="flex-1 flex flex-col relative overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">
               
               {/* Input Section */}
               <div className="max-w-4xl mx-auto space-y-4">
                  <div className="glass-panel rounded-3xl p-1 border border-indigo-500/20 shadow-xl bg-white dark:bg-slate-900">
                     <MathFieldTag 
                        ref={mfRef} 
                        className="w-full text-2xl p-6 bg-transparent outline-none border-none text-slate-900 dark:text-white"
                        placeholder="Type equation here..."
                     ></MathFieldTag>
                  </div>
                  
                  {/* Context Toolbar */}
                  <div className="flex flex-wrap gap-2 animate-reveal">
                     {CATEGORIES[activeCat].tools.map((tool, i) => (
                        <button
                          key={i}
                          onClick={() => tool.type === 'action' ? handleAction(tool.command) : insertSymbol(tool.command)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                             tool.type === 'action'
                             ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
                             : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                          title={tool.desc}
                        >
                          {tool.type === 'action' && <i className="fa-solid fa-play mr-2 text-[8px]"></i>}
                          {tool.label}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Processing State */}
               {isProcessing && (
                  <div className="flex flex-col items-center justify-center py-12 animate-in fade-in">
                     <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                     <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-500">Computing...</p>
                  </div>
               )}

               {/* Error State */}
               {error && (
                  <div className="max-w-2xl mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-bounce-subtle">
                     <i className="fa-solid fa-triangle-exclamation"></i>
                     <span className="text-xs font-bold">{error}</span>
                  </div>
               )}

               {/* Solution Output */}
               {solution && !isProcessing && (
                  <div className="max-w-4xl mx-auto space-y-8 animate-reveal pb-24">
                     
                     {/* Result Card */}
                     <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-xl space-y-6">
                        <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 pb-4">
                           <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Result</h3>
                        </div>
                        
                        <div className="text-center py-4">
                           <div className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white overflow-x-auto no-scrollbar">
                              $${solution.resultLatex}$$
                           </div>
                           {solution.decimal && (
                              <div className="mt-4 inline-block px-4 py-1 bg-slate-100 dark:bg-white/10 rounded-full text-xs font-mono font-bold text-slate-500">
                                 ≈ {solution.decimal}
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Graph */}
                     {solution.graph && (
                        <div className="glass-panel p-6 rounded-[40px] border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 shadow-lg">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-2 h-6 bg-cyan-500 rounded-full"></div>
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Visual Plot</h3>
                           </div>
                           <div className="w-full bg-slate-50 dark:bg-black/30 rounded-3xl overflow-hidden relative">
                              <svg ref={graphRef} viewBox="0 0 600 300" className="w-full h-auto"></svg>
                           </div>
                        </div>
                     )}

                     {/* Steps */}
                     <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Process Log</h3>
                        <div className="space-y-4">
                           {solution.steps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-4">
                                 <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{idx + 1}</div>
                                 <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{step}</div>
                              </div>
                           ))}
                        </div>
                     </div>

                  </div>
               )}
            </div>
         </main>
      </div>
    </div>
  );
};

export default MathsMode;
