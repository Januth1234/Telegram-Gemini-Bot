
import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage, GraphDefinition, MathHistoryItem, MathExtractResult, MathOperation } from '../types';
import { translations } from '../translations';
import Graphs from './Graphs';
import HandwritingCanvas from './HandwritingCanvas';
import VoiceToMathModal from './VoiceToMathModal';
import { parseSolutionMethods, isMathSolution, parseMathResponse } from '../services/solutionParser';
import { geminiService } from '../services/geminiService';
import { casService, matrixToPmatrix } from '../services/casService';
import KatexBlock from './KatexBlock';
import { cacheService, CacheKey } from '../services/cacheService';

// We use MathLive custom element, define types to avoid TS errors
const MathFieldTag = 'math-field' as any;
declare const Desmos: any;

type MathCategory = 'General' | 'Algebra' | 'Geometry' | 'Calculus' | 'Stats' | 'Physics' | 'Matrix' | 'Number' | 'Graphs';

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
      { label: 'Evaluate', cmd: 'evaluate with units', type: 'action' },
      { label: 'Force', cmd: 'F = ma', type: 'insert' },
      { label: 'Energy', cmd: 'E = mc^2', type: 'insert' },
      { label: 'Explain', cmd: 'explain physics concept', type: 'action' },
    ]
  },
  'Matrix': {
    icon: 'fa-table-cells',
    tools: [
      { label: 'Determinant', cmd: 'matrix det', type: 'action' },
      { label: 'Inverse', cmd: 'matrix inv', type: 'action' },
      { label: 'Eigenvalues', cmd: 'matrix eigs', type: 'action' },
      { label: 'Rank', cmd: 'matrix rank', type: 'action' },
      { label: 'RREF', cmd: 'matrix rref', type: 'action' },
    ]
  },
  'Number': {
    icon: 'fa-hashtag',
    tools: [
      { label: 'Prime factors', cmd: 'number prime', type: 'action' },
      { label: 'GCD', cmd: 'number gcd', type: 'action' },
      { label: 'LCM', cmd: 'number lcm', type: 'action' },
      { label: 'a mod m', cmd: 'number mod', type: 'action' },
      { label: 'To binary', cmd: 'number to binary', type: 'action' },
      { label: 'To hex', cmd: 'number to hex', type: 'action' },
      { label: 'To octal', cmd: 'number to octal', type: 'action' },
      { label: 'To decimal', cmd: 'number to decimal', type: 'action' },
    ]
  },
  'Graphs': {
    icon: 'fa-chart-line',
    tools: [
      { label: 'Open Graphs', cmd: 'open graphs', type: 'action' },
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
const DESMOS_SCRIPT = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=b3a6bd693b2740f9a2fff51731e27d61';

const MathSolutionCard: React.FC<{ content: string }> = ({ content }) => {
  const parsed = parseMathResponse(content);
  const [openMethod, setOpenMethod] = useState(0);

  const hasMethods = parsed.methods && parsed.methods.length > 0;
  const active = hasMethods ? parsed.methods[openMethod] : undefined;

  return (
    <div className="space-y-4 w-full">
      {parsed.preamble && (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {parsed.preamble}
        </p>
      )}

      {parsed.methods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {parsed.methods.map((m, i) => (
            <button
              key={i}
              onClick={() => setOpenMethod(i)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                openMethod === i
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-50'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-500/20 p-5 space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
            {active.name}
          </h4>
          {active.steps
            .split('\n')
            .filter(line => line.trim())
            .map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-[9px] font-black text-indigo-400 mt-1 shrink-0 min-w-[20px]">
                  {i + 1}.
                </span>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                  {step.trim()}
                </span>
              </div>
            ))}
        </div>
      )}

      {parsed.verification && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">
            Verification
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
            {parsed.verification}
          </p>
        </div>
      )}

      {parsed.methods.length > 1 && (
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          {parsed.methods.length} solution methods found
        </p>
      )}
    </div>
  );
};

/** Renders assistant solution: multiple methods as tabs with full steps, or single block. */
const SolutionMessageContent: React.FC<{ content: string }> = ({ content }) => {
  if (isMathSolution(content)) {
    return <MathSolutionCard content={content} />;
  }

  const methods = parseSolutionMethods(content);
  const [activeTab, setActiveTab] = useState(0);

  if (methods && methods.length > 1) {
    return (
      <div className="w-full">
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
          {methods.map((m, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                activeTab === i
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-500/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div
          className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${
            /[^\u0000-\u007F]/.test(methods[activeTab].content) ? 'sinhala-text' : ''
          }`}
        >
          {methods[activeTab].content}
        </div>
      </div>
    );
  }

  const displayContent =
    methods && methods.length === 1 ? methods[0].content : content;
  return (
    <div
      className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${
        /[^\u0000-\u007F]/.test(displayContent) ? 'sinhala-text' : ''
      }`}
    >
      {displayContent}
    </div>
  );
};

const MathsMode: React.FC<MathsModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const t = translations[lang];
  const [activeCat, setActiveCat] = useState<MathCategory>('General');
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [mathLiveReady, setMathLiveReady] = useState(false);
  const [desmosReady, setDesmosReady] = useState(false);
  const [graphExpression, setGraphExpression] = useState<string | null>(null);
  const [showGraphs, setShowGraphs] = useState(false);
  const [graphSource, setGraphSource] = useState<'manual' | 'question' | null>(null);
  const [currentGraph, setCurrentGraph] = useState<GraphDefinition | null>(null);
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [handwritingRecognizing, setHandwritingRecognizing] = useState(false);
  const [showVoiceMath, setShowVoiceMath] = useState(false);
  const [equationCount, setEquationCount] = useState(1);
  const [unitsMode, setUnitsMode] = useState(false);
  const [matrixRows, setMatrixRows] = useState(2);
  const [matrixCols, setMatrixCols] = useState(2);
  const [matrixGrid, setMatrixGrid] = useState<number[][]>([[0, 0], [0, 0]]);
  const [matrixResult, setMatrixResult] = useState<{
    op: string;
    latex?: string;
    scalar?: number;
    text?: string;
    error?: string;
  } | null>(null);
  const [localStepsResult, setLocalStepsResult] = useState<{
    kind: 'derivative' | 'integral' | 'solve' | 'units' | 'number';
    title: string;
    steps: string[];
    result: string;
    resultLatex?: string;
    input: string;
  } | null>(null);
  const [inputMode, setInputMode] = useState<'math' | 'text'>('math');
  const [textInput, setTextInput] = useState('');
  const [mathHistory, setMathHistory] = useState<MathHistoryItem[]>(
    () => cacheService.get<MathHistoryItem[]>(CacheKey.MATH_HISTORY, []),
  );
  const [isSolving, setIsSolving] = useState(false);
  const equationRefs = useRef<(any)[]>([]);
  const focusedMathFieldRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const desmosContainerRef = useRef<HTMLDivElement | null>(null);
  const desmosCalcRef = useRef<any>(null);
  const handwritingClosedByUserRef = useRef(false);

  // Persist math history
  useEffect(() => {
    cacheService.set(CacheKey.MATH_HISTORY, mathHistory);
  }, [mathHistory]);

  const appendMathHistory = (item: Omit<MathHistoryItem, 'id' | 'createdAt'>) => {
    const entry: MathHistoryItem = {
      id: `math-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...item,
    };
    setMathHistory(prev => {
      const next = [entry, ...prev];
      return next.slice(0, 50);
    });
  };

  // Resize matrix grid when rows/cols change
  useEffect(() => {
    if (activeCat !== 'Matrix') return;
    setMatrixGrid(prev => {
      const next = Array.from({ length: matrixRows }, (_, r) =>
        Array.from({ length: matrixCols }, (_, c) => prev[r]?.[c] ?? 0)
      );
      return next;
    });
  }, [matrixRows, matrixCols, activeCat]);

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

  // Load Desmos graphing calculator once and mark ready.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if ((window as any).Desmos) {
      setDesmosReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${DESMOS_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setDesmosReady(true), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = DESMOS_SCRIPT;
    script.async = true;
    script.onload = () => setDesmosReady(true);
    script.onerror = () => setDesmosReady(false);
    document.head.appendChild(script);
  }, []);

  // Initialize Desmos calculator only when inline graph is shown (not when full Graphs panel is open) to avoid two instances.
  useEffect(() => {
    if (showGraphs) {
      if (desmosCalcRef.current) {
        try { desmosCalcRef.current.destroy(); } catch { /* ignore */ }
        desmosCalcRef.current = null;
      }
      return;
    }
    if (!desmosReady || !desmosContainerRef.current || desmosCalcRef.current) return;
    try {
      desmosCalcRef.current = (window as any).Desmos
        ? (window as any).Desmos.GraphingCalculator(desmosContainerRef.current, {
            expressions: true,
            keypad: true,
            graphpaper: true,
          })
        : null;
    } catch {
      desmosCalcRef.current = null;
    }
    return () => {
      if (desmosCalcRef.current) {
        try { desmosCalcRef.current.destroy(); } catch { /* ignore */ }
        desmosCalcRef.current = null;
      }
    };
  }, [desmosReady, showGraphs]);

  // Read any pending graph expression that other modes left for us.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const pending = window.sessionStorage.getItem('pendingGraphExpression');
      if (pending && pending.trim()) {
        setGraphExpression(pending.trim());
        setCurrentGraph({
          id: 'graph-from-question',
          type: 'function',
          expressionLatex: pending.trim(),
          xDomain: { min: -10, max: 10 },
        });
        setGraphSource('question');
        setShowGraphs(true);
        window.sessionStorage.removeItem('pendingGraphExpression');
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  // Whenever we have a graph expression and a Desmos instance, plot it and add analysis overlay (legacy inline graph).
  useEffect(() => {
    if (!desmosCalcRef.current || !graphExpression) return;
    try {
      const calc = desmosCalcRef.current;
      calc.setExpression({ id: 'main', latex: graphExpression });
      if (graphExpression.includes('=')) {
        const analysis = casService.functionAnalysis(graphExpression);
        analysis.roots.forEach((x, i) => {
          try { calc.setExpression({ id: `analysis_root_${i}`, latex: `(${x}, 0)`, showLabel: true, label: 'Root' }); } catch { /* ignore */ }
        });
        if (analysis.yIntercept != null) {
          try { calc.setExpression({ id: 'analysis_yint', latex: `(0, ${analysis.yIntercept})`, showLabel: true, label: 'y-intercept' }); } catch { /* ignore */ }
        }
        analysis.criticalPoints.forEach((x, i) => {
          const y = casService.evaluateRHSAt(graphExpression, x);
          if (y != null) try { calc.setExpression({ id: `analysis_crit_${i}`, latex: `(${x}, ${y})`, showLabel: true, label: 'Extremum' }); } catch { /* ignore */ }
        });
        analysis.verticalAsymptotes.forEach((x, i) => {
          try { calc.setExpression({ id: `analysis_asymp_${i}`, latex: `x = ${x}` }); } catch { /* ignore */ }
        });
      }
    } catch {
      // Ignore plotting errors; UI will simply show an empty graph.
    }
  }, [graphExpression]);

  useEffect(() => {
    if (!mathLiveReady) return;
    const first = equationRefs.current[0];
    if (first) {
      first.smartMode = true;
      first.virtualKeyboardMode = 'manual';
      setTimeout(() => first?.focus(), 300);
    }
  }, [mathLiveReady, equationCount]);

  const getEquations = (): string[] => {
    if (inputMode === 'text') {
      const s = textInput.trim();
      return s ? [s] : [];
    }
    return equationRefs.current
      .slice(0, equationCount)
      .map(r => r?.value?.trim())
      .filter((s): s is string => Boolean(s)) as string[];
  };

  const handleAction = async (command: string) => {
    // If user typed plain text, first extract math via Gemini then feed into local CAS.
    if (inputMode === 'text') {
      const rawText = textInput.trim();
      if (!rawText) return;
      try {
        setIsSolving(true);
        const extracted = await geminiService.extractMathFromInput(rawText);
        if (extracted.unreadable) {
          alert('Could not understand the problem. Please rephrase.');
          return;
        }
        const expr =
          typeof extracted.latexExpression === 'string' &&
          extracted.latexExpression.trim()
            ? extracted.latexExpression.trim()
            : String(extracted.expression || '').trim();
        if (!expr) {
          alert('No mathematical expression detected.');
          return;
        }
        const op: MathOperation =
          extracted.operation ?? commandToOperation(command);
        const variable = extracted.variable || 'x';

        // Route to existing CAS step solvers so results stay local.
        if (op === 'differentiate') {
          const out = casService.derivativeWithSteps(expr, variable);
          if (out && out.steps.length > 0) {
            setLocalStepsResult({
              kind: 'derivative',
              title: 'Step-by-step derivative',
              steps: out.steps,
              result: out.result,
              resultLatex: out.resultLatex,
              input: expr,
            });
          }
          return;
        }
        if (op === 'integrate') {
          const out = casService.integralWithSteps(expr, variable);
          if (out && out.steps.length > 0) {
            setLocalStepsResult({
              kind: 'integral',
              title: 'Step-by-step integral',
              steps: out.steps,
              result: out.result,
              resultLatex: out.resultLatex,
              input: expr,
            });
          }
          return;
        }
        if (op === 'simplify') {
          const simplified = casService.simplify(expr);
          setLocalStepsResult({
            kind: 'solve',
            title: 'Simplified expression',
            steps: [`${expr} = ${simplified}`],
            result: simplified,
            input: expr,
          });
          return;
        }
        if (op === 'solve') {
          const out = casService.solveEquationWithSteps(expr, variable);
          if (out && out.steps.length > 0) {
            setLocalStepsResult({
              kind: 'solve',
              title: 'Step-by-step solution',
              steps: out.steps,
              result:
                out.roots?.length && out.roots.length > 0
                  ? out.roots.join(', ')
                  : out.steps[out.steps.length - 1] || '',
              input: expr,
            });
          }
          return;
        }
        // Fallback to existing flow for factor/expand or unknown operations.
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(msg || 'Math extraction failed. Try again.');
        return;
      } finally {
        setIsSolving(false);
      }
    }

    const equations = getEquations();
    const rawLatex = equations.length === 1 ? equations[0] : equations.join(' ; ');
    const isSolveCommand = /solve|Solve/i.test(command);
    const isDerivativeCommand = /derivative|derive|differentiat/i.test(command);
    const isIntegralCommand = /integral|integrate/i.test(command);
    const isEvaluateUnitsCommand = /evaluate with units/i.test(command);

    // Matrix operations (use current matrix grid)
    if (/matrix\s+(det|inv|eigs|rank|rref)/i.test(command)) {
      const grid = matrixGrid.map(row => row.map(Number));
      const op = command.replace(/matrix\s+/i, '').toLowerCase();
      if (op === 'det') {
        const out = casService.matrixDet(grid);
        if (out.error) setMatrixResult({ op: 'Determinant', error: out.error });
        else {
          setMatrixResult({ op: 'Determinant', scalar: out.value, latex: matrixToPmatrix(grid) });
          appendMathHistory({
            kind: 'expression',
            inputLatex: `det(${matrixToPmatrix(grid)})`,
            result: String(out.value),
            graph: null,
          });
        }
        return;
      }
      if (op === 'inv') {
        const out = casService.matrixInv(grid);
        if (out.error) setMatrixResult({ op: 'Inverse', error: out.error });
        else {
          const latex = matrixToPmatrix(out.matrix!);
          setMatrixResult({ op: 'Inverse', latex });
          appendMathHistory({
            kind: 'expression',
            inputLatex: `A^{-1}`,
            result: latex,
            graph: null,
          });
        }
        return;
      }
      if (op === 'eigs') {
        const out = casService.matrixEigs(grid);
        if (out.error) setMatrixResult({ op: 'Eigenvalues', error: out.error });
        else {
          const vals = out.values!.map(v => (Math.abs(v) < 1e-10 ? 0 : v));
          setMatrixResult({
            op: 'Eigenvalues',
            text: `\\lambda = ${vals.join(', ')}`,
            latex: matrixToPmatrix(grid),
          });
          appendMathHistory({
            kind: 'expression',
            inputLatex: matrixToPmatrix(grid),
            result: `λ = ${vals.join(', ')}`,
            graph: null,
          });
        }
        return;
      }
      if (op === 'rank') {
        const out = casService.matrixRank(grid);
        if (out.error) setMatrixResult({ op: 'Rank', error: out.error });
        else {
          setMatrixResult({ op: 'Rank', scalar: out.rank, latex: matrixToPmatrix(grid) });
          appendMathHistory({
            kind: 'expression',
            inputLatex: matrixToPmatrix(grid),
            result: `rank = ${out.rank}`,
            graph: null,
          });
        }
        return;
      }
      if (op === 'rref') {
        const out = casService.matrixRref(grid);
        if (out.error) setMatrixResult({ op: 'RREF', error: out.error });
        else {
          const latex = matrixToPmatrix(out.matrix!);
          setMatrixResult({ op: 'RREF', latex });
          appendMathHistory({
            kind: 'expression',
            inputLatex: matrixToPmatrix(grid),
            result: latex,
            graph: null,
          });
        }
        return;
      }
    }

    // Number theory (Number category)
    if (/^number\s+/i.test(command) && !selectedFile && equations.length >= 1) {
      const raw = (equations[0] || '').replace(/\\cdot|\\times/g, '').replace(/\\mod|\\bmod/g, ' mod ').replace(/\s+/g, ' ').trim();
      const input = raw || '';
      const cmd = command.replace(/^number\s+/i, '').toLowerCase();
      let title = '';
      let result = '';
      let error: string | undefined;
      if (cmd === 'prime') {
        const n = parseInt(input.replace(/,/g, ''), 10);
        const out = casService.primeFactors(n);
        title = 'Prime factorisation';
        if (out.error) error = out.error;
        else result = out.result!;
      } else if (cmd === 'gcd') {
        const parts = input.split(/[,;\s]+/).map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
        const out = parts.length >= 2 ? casService.gcd(parts[0], parts[1]) : { error: 'Enter two integers (e.g. 12, 18)' };
        title = 'GCD';
        if (out.error) error = out.error;
        else result = String(out.value);
      } else if (cmd === 'lcm') {
        const parts = input.split(/[,;\s]+/).map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
        const out = parts.length >= 2 ? casService.lcm(parts[0], parts[1]) : { error: 'Enter two integers (e.g. 4, 6)' };
        title = 'LCM';
        if (out.error) error = out.error;
        else result = String(out.value);
      } else if (cmd === 'mod') {
        const modMatch = input.match(/^(.+?)\s+mod\s+(\d+)$/i) || input.split(/[,;\s]+/).map(s => s.trim());
        const a = modMatch[2] != null ? parseFloat(modMatch[1]) : parseFloat(modMatch[0]);
        const m = modMatch[2] != null ? parseInt(modMatch[2], 10) : parseInt(modMatch[1], 10);
        const out = Number.isFinite(a) && Number.isFinite(m) ? casService.mod(a, m) : { error: 'Enter a mod m (e.g. 17 mod 5 or 17, 5)' };
        title = 'a mod m';
        if (out.error) error = out.error;
        else result = String(out.value);
      } else if (/^to\s+(binary|hex|octal|decimal)$/i.test(cmd)) {
        const toBase = cmd.includes('binary') ? 2 : cmd.includes('hex') ? 16 : cmd.includes('octal') ? 8 : 10;
        const out = casService.baseConvert(input, toBase as 2 | 8 | 10 | 16);
        title = `Base conversion → ${toBase === 2 ? 'binary' : toBase === 16 ? 'hex' : toBase === 8 ? 'octal' : 'decimal'}`;
        if (out.error) error = out.error;
        else result = out.value!;
      }
      if (title) {
        setLocalStepsResult({
          kind: 'number',
          title,
          steps: error ? [error] : [],
          result,
          input: raw,
        });
        if (!error) {
          appendMathHistory({
            kind: 'expression',
            inputLatex: raw,
            result,
            graph: null,
          });
        }
        setSelectedFile(null);
        return;
      }
    }

    // Unit-aware evaluation (Physics)
    if (!selectedFile && isEvaluateUnitsCommand && equations.length >= 1) {
      const input = (equations[0] || '').trim();
      if (input) {
        const out = casService.evaluateWithUnits(input);
        if (out.error) {
          setLocalStepsResult({
            kind: 'units',
            title: 'Unit calculation',
            steps: [`Error: ${out.error}`],
            result: '',
            input,
          });
        } else {
          setLocalStepsResult({
            kind: 'units',
            title: 'Result',
            steps: [],
            result: out.result,
            input,
          });
          appendMathHistory({
            kind: 'expression',
            inputLatex: input,
            result: out.result,
            graph: null,
          });
        }
        setSelectedFile(null);
        return;
      }
    }

    // Try local step-by-step for single expression (differentiation, integration, solve)
    if (!selectedFile && equations.length === 1 && equations[0]?.trim()) {
      const input = equations[0].trim();
      if (isDerivativeCommand) {
        const out = casService.derivativeWithSteps(input, 'x');
        if (out && out.steps.length > 0) {
          setLocalStepsResult({
            kind: 'derivative',
            title: 'Step-by-step derivative',
            steps: out.steps,
            result: out.result,
            resultLatex: out.resultLatex,
            input,
          });
          setSelectedFile(null);
          return;
        }
      }
      if (isIntegralCommand) {
        const out = casService.integralWithSteps(input, 'x');
        if (out && out.steps.length > 0) {
          setLocalStepsResult({
            kind: 'integral',
            title: 'Step-by-step integral',
            steps: out.steps,
            result: out.result,
            resultLatex: out.resultLatex,
            input,
          });
          setSelectedFile(null);
          return;
        }
      }
      if (isSolveCommand && equations.length === 1) {
        const out = casService.solveEquationWithSteps(input, 'x');
        if (out && out.steps.length > 0) {
          setLocalStepsResult({
            kind: 'solve',
            title: 'Step-by-step solution',
            steps: out.steps,
            result: out.roots?.length ? out.roots.join(', ') : out.steps[out.steps.length - 1] || '',
            input,
          });
          setSelectedFile(null);
          return;
        }
      }
    }

    let systemSolution: string | undefined;
    if (equations.length > 1 && isSolveCommand) {
      const result = casService.solveEquations(equations);
      if (result.solution) systemSolution = result.solution;
    }

    const multiMethodInstruction = `
If this problem can be solved in MORE THAN ONE way (e.g. substitution, completing the square, quadratic formula, graphical, by factoring), you MUST give EVERY possible solution method.
For each method use this exact format:
---METHOD: [Short method name] ---
[Then list EVERY step in full. Do not summarize. Show all algebraic steps, substitutions, and final answer.]
---ENDMETHOD---
If there is only one standard method, still use one ---METHOD: ... --- ... ---ENDMETHOD--- block with full steps and no summarization.`;

    let prompt = '';
    if (selectedFile) {
      prompt = `Analyze this image containing a math problem. ${command === 'ai_explain' ? 'Solve it step-by-step.' : 'Perform: ' + command}. ${multiMethodInstruction}`;
    } else {
      prompt = `Mathematical Request: ${command}. ${equations.length > 1 ? `System of equations: ${equations.join(', ')}.` : `Expression: ${rawLatex}.`}${systemSolution ? `\n\nLocal solution: ${systemSolution}.` : ''} Provide a step-by-step solution. ${multiMethodInstruction}`;
    }

    onSend(prompt, selectedFile || undefined);
    setSelectedFile(null);
  };

  const insertSymbol = (cmd: string) => {
    const target = focusedMathFieldRef.current ?? equationRefs.current[0];
    if (target) {
      target.executeCommand(['insert', cmd]);
      target.focus();
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
    if (inputMode === 'text') {
      setTextInput('');
    } else {
      equationRefs.current.slice(0, equationCount).forEach(mf => { if (mf) mf.value = ''; });
    }
    setSelectedFile(null);
  };

  const commandToOperation = (cmd: string): MathOperation => {
    const lower = cmd.toLowerCase();
    if (lower.includes('deriv')) return 'differentiate';
    if (lower.includes('integr')) return 'integrate';
    if (lower.includes('simplif')) return 'simplify';
    if (lower.includes('factor')) return 'factor';
    if (lower.includes('expand')) return 'expand';
    return 'solve';
  };

  const HANDWRITING_PROMPT = 'This image shows a handwritten mathematical equation. Extract it and return ONLY the LaTeX code, nothing else. No explanation, no markdown, no backticks—just the raw LaTeX (e.g. x^2+3x+2 or \\frac{1}{2}).';

  const handleHandwritingRecognize = async (imageDataUrl: string, mimeType: string, base64Data: string) => {
    setHandwritingRecognizing(true);
    try {
      const res = await geminiService.chat(HANDWRITING_PROMPT, {
        fileData: { data: base64Data, mimeType, name: 'handwriting.png' },
        history: [],
      });
      let latex = (res.text || '').trim();
      latex = latex.replace(/^```(?:latex|math)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const target = focusedMathFieldRef.current ?? equationRefs.current[0];
      if (latex && target) {
        target.value = latex;
        target.focus();
      }
      setShowHandwriting(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg || 'Recognition failed. Try again.');
    } finally {
      setHandwritingRecognizing(false);
    }
  };

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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">
                  Math Solver
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-300">
                  Beta
                </span>
              </div>
           </div>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>
      )}

      {/* Sidebar Categories */}
      <nav className="w-full md:w-56 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 p-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
          {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => {
                  if (cat === 'Graphs') {
                    setGraphSource('manual');
                    setShowGraphs(true);
                  } else {
                    setActiveCat(cat);
                  }
                }}
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
                        <i className={`fa-solid ${activeCat === 'Matrix' ? 'fa-table-cells' : 'fa-pen-to-square'}`}></i>
                        {activeCat === 'Matrix' ? 'Matrix' : 'Equation Editor'}
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <button
                          onClick={() => {
                            setGraphSource('manual');
                            setShowGraphs(true);
                          }}
                          className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-100"
                        >
                          <i className="fa-solid fa-chart-line mr-1" />
                          Graphs
                        </button>
                        <button
                          onClick={() => {
                          handwritingClosedByUserRef.current = false;
                          setShowHandwriting(true);
                        }}
                          className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                          title="Draw equation (handwriting)"
                        >
                          <i className="fa-solid fa-pencil"></i>
                          Draw
                        </button>
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
                        {activeCat === 'Physics' && (
                          <label className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 ml-auto">
                            <input
                              type="checkbox"
                              checked={unitsMode}
                              onChange={(e) => setUnitsMode(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                              <i className="fa-solid fa-ruler-combined mr-1" />
                              Units
                            </span>
                          </label>
                        )}
                        {activeCat === 'Physics' && unitsMode && (
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 italic max-w-[180px]">
                            e.g. 9.8 m/s^2 * 70 kg or 100 km/h to m/s
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            type="button"
                            onClick={() => setInputMode('math')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${
                              inputMode === 'math'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10'
                            }`}
                            title="Math input"
                          >
                            <i className="fa-solid fa-keyboard" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputMode('text')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${
                              inputMode === 'text'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10'
                            }`}
                            title="Text input"
                          >
                            <i className="fa-solid fa-align-left" />
                          </button>
                        </div>
                    </div>
                </div>
                
                {selectedFile && activeCat !== 'Matrix' && (
                  <div className="p-4 bg-slate-50 dark:bg-black/20">
                    <div className="relative group w-fit">
                        <div className="absolute -top-2 -right-2 z-10">
                            <button onClick={() => setSelectedFile(null)} className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-90"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                        </div>
                        <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="h-24 rounded-lg border border-black/10 dark:border-white/10 shadow-sm" alt="Attached" />
                    </div>
                  </div>
                )}

                {/* Matrix table input */}
                {activeCat === 'Matrix' && inputMode === 'math' && (
                  <div className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Size</span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600 dark:text-slate-300">Rows</label>
                        <select
                          value={matrixRows}
                          onChange={(e) => setMatrixRows(Math.max(1, Math.min(6, Number(e.target.value))))}
                          className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm px-2 py-1"
                        >
                          {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <span className="text-slate-400">×</span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600 dark:text-slate-300">Cols</label>
                        <select
                          value={matrixCols}
                          onChange={(e) => setMatrixCols(Math.max(1, Math.min(6, Number(e.target.value))))}
                          className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm px-2 py-1"
                        >
                          {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="border-collapse">
                        <tbody>
                          {matrixGrid.map((row, r) => (
                            <tr key={r}>
                              {row.map((val, c) => (
                                <td key={c} className="p-0.5">
                                  <input
                                    type="number"
                                    value={matrixGrid[r][c]}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                      setMatrixGrid(prev => {
                                        const next = prev.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? (Number.isFinite(v) ? v : cell) : cell));
                                        return next;
                                      });
                                    }}
                                    className="w-14 h-9 text-center rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    step="any"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Preview</span>
                      <div className="min-h-[40px] flex items-center">
                        <KatexBlock latex={matrixToPmatrix(matrixGrid)} className="text-lg text-slate-700 dark:text-slate-200" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-line equation fields - only mount after script has loaded to avoid "Params are not set" */}
                {inputMode === 'math' && activeCat !== 'Matrix' && (
                  mathLiveReady ? (
                    <div className="w-full space-y-2">
                      {Array.from({ length: equationCount }, (_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <MathFieldTag
                            ref={(el: any) => { equationRefs.current[i] = el; }}
                            onFocus={() => { focusedMathFieldRef.current = equationRefs.current[i]; }}
                            className="flex-1 text-xl md:text-2xl p-4 bg-transparent text-slate-900 dark:text-white outline-none min-h-[56px] rounded-lg border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-400"
                            style={{ '--caret-color': '#4f46e5', '--selection-background-color': '#4f46e550' } as React.CSSProperties}
                          />
                          {equationCount > 1 && i === equationCount - 1 ? (
                            <button
                              type="button"
                              onClick={() => setEquationCount(c => Math.max(1, c - 1))}
                              className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 flex items-center justify-center"
                              title="Remove equation"
                            >
                              <i className="fa-solid fa-minus text-[10px]" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEquationCount(c => c + 1)}
                        className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 hover:border-indigo-400 transition-colors flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-plus" /> Add equation
                      </button>
                    </div>
                  ) : (
                    <div className="w-full min-h-[80px] p-6 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-sm">
                      Loading math input…
                    </div>
                  )
                )}

                {inputMode === 'text' && (
                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    className="w-full min-h-[96px] text-sm md:text-base p-4 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-y"
                    placeholder="Type a math problem in normal words or notation..."
                  />
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>

              {showHandwriting && (
                <HandwritingCanvas
                  onRecognize={handleHandwritingRecognize}
                  onClose={() => {
                  handwritingClosedByUserRef.current = true;
                  setShowHandwriting(false);
                }}
                  isRecognizing={handwritingRecognizing}
                />
              )}
              {showVoiceMath && (
                <VoiceToMathModal
                  onInsert={(latex) => {
                    const target = focusedMathFieldRef.current ?? equationRefs.current[0];
                    if (target) {
                      target.value = latex;
                      target.focus();
                    }
                  }}
                  onClose={() => setShowVoiceMath(false)}
                />
              )}
              
              {/* Dynamic Toolbar */}
              <div className="flex flex-wrap gap-2 animate-reveal">
                {CATEGORIES[activeCat].tools.map((tool, i) => (
                    <button
                      key={i}
                      onClick={() => tool.type === 'action' ? handleAction(tool.cmd) : insertSymbol(tool.cmd)}
                      disabled={isTyping || isSolving}
                      className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 ${
                        tool.type === 'action' ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500' : 
                        'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-indigo-500/50'
                      }`}
                    >
                      {tool.label}
                    </button>
                ))}
                {/* Global Solve Button (local solve) */}
                <button 
                    onClick={() => handleAction('solve for x')} 
                    disabled={isTyping || isSolving}
                    className="flex-1 min-w-[120px] px-4 py-3 rounded-xl bg-cyan-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-cyan-500 shadow-lg active:scale-95 transition-all"
                >
                    Solve
                </button>
              </div>
          </div>

          {/* Results Area */}
          <div className="max-w-3xl mx-auto space-y-6 pb-12">
              {mathHistory.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <i className="fa-solid fa-clock-rotate-left" />
                      Math History
                    </span>
                    <button
                      type="button"
                      onClick={() => setMathHistory([])}
                      className="text-[9px] px-2 py-1 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 hover:border-red-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {mathHistory.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.kind === 'graph' && item.graph) {
                            setCurrentGraph(item.graph);
                            setGraphSource('manual');
                            setShowGraphs(true);
                          } else {
                            setActiveCat('General');
                            setEquationCount(1);
                            if (equationRefs.current[0]) {
                              equationRefs.current[0].value = item.inputLatex;
                              equationRefs.current[0].focus();
                            }
                          }
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-[11px]"
                      >
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <i className={`fa-solid ${item.kind === 'graph' ? 'fa-chart-line' : 'fa-calculator'} text-[10px]`} />
                          <span className="truncate max-w-[180px]">{item.inputLatex || '(graph)'}</span>
                        </span>
                        {item.result && item.result !== '' && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{item.result}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {matrixResult && (
                <div className="w-full p-6 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-lg space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                      <i className="fa-solid fa-table-cells" />
                      {matrixResult.op}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMatrixResult(null)}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 flex items-center justify-center"
                      title="Dismiss"
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  </div>
                  {matrixResult.error ? (
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">{matrixResult.error}</p>
                  ) : (
                    <div className="space-y-3">
                      {(matrixResult.op === 'Determinant' || matrixResult.op === 'Rank' || matrixResult.op === 'Eigenvalues') && matrixResult.latex != null && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mr-2">A = </span>
                          <KatexBlock latex={matrixResult.latex} className="inline-block text-lg text-slate-800 dark:text-slate-200" />
                        </div>
                      )}
                      {matrixResult.scalar != null && (
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {matrixResult.op === 'Determinant' && 'det(A) = '}
                          {matrixResult.op === 'Rank' && 'rank(A) = '}
                          {matrixResult.scalar}
                        </div>
                      )}
                      {(matrixResult.op === 'Inverse' || matrixResult.op === 'RREF') && matrixResult.latex != null && (
                        <div>
                          <KatexBlock latex={(matrixResult.op === 'Inverse' ? 'A^{-1} = ' : '\\mathrm{RREF}(A) = ') + matrixResult.latex} className="text-lg text-slate-800 dark:text-slate-200" />
                        </div>
                      )}
                      {matrixResult.op === 'Eigenvalues' && matrixResult.text != null && (
                        <KatexBlock latex={matrixResult.text} className="text-lg text-slate-800 dark:text-slate-200" />
                      )}
                    </div>
                  )}
                </div>
              )}
              {showGraphs && (
                <div className="space-y-3">
                  <Graphs
                    mode={graphSource === 'manual' ? 'manual' : 'fromQuestion'}
                    initialGraph={currentGraph}
                    onGraphsChange={(g) => {
                      setCurrentGraph(g);
                      if (g?.expressionLatex) {
                        appendMathHistory({
                          kind: 'graph',
                          inputLatex: g.expressionLatex,
                          result: '',
                          graph: g,
                        });
                      }
                    }}
                    onExplainWithAi={(summary) => {
                      const expr = summary.expression || currentGraph?.expressionLatex || '';
                      const domain = summary.xDomain || currentGraph?.xDomain;
                      const domainText = domain ? ` on domain [${domain.min}, ${domain.max}]` : '';
                      const prompt = `Explain this graph in simple steps. Function: ${expr || 'N/A'}${domainText}.`;
                      onSend(prompt);
                    }}
                    onClose={() => setShowGraphs(false)}
                    lang={lang}
                  />
                </div>
              )}
              {localStepsResult && (
                <div className={`w-full p-6 rounded-2xl border-2 shadow-lg space-y-4 ${
                  localStepsResult.kind === 'units' || localStepsResult.kind === 'number'
                    ? 'border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/50'
                    : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50'
                }`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                      localStepsResult.kind === 'units' || localStepsResult.kind === 'number' ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-300'
                    }`}>
                      <i className={localStepsResult.kind === 'units' ? 'fa-solid fa-ruler-combined' : localStepsResult.kind === 'number' ? 'fa-solid fa-hashtag' : 'fa-solid fa-list-check'} />
                      {localStepsResult.title}
                    </span>
                    <div className="flex items-center gap-2">
                      {localStepsResult.kind !== 'units' && localStepsResult.kind !== 'number' && (
                        <button
                          type="button"
                          onClick={() => {
                            const text = [
                              `Input: ${localStepsResult.input}`,
                              '',
                              'Steps:',
                              ...localStepsResult.steps.map((s, i) => `${i + 1}. ${s}`),
                              '',
                              `Result: ${localStepsResult.result}`,
                            ].join('\n');
                            onSend(`Explain this step-by-step solution in simple terms:\n\n${text}`);
                            setLocalStepsResult(null);
                          }}
                          disabled={isTyping}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500 disabled:opacity-50"
                        >
                          Explain with AI
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setLocalStepsResult(null)}
                        className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 flex items-center justify-center"
                        title="Dismiss"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    </div>
                  </div>
                  {(localStepsResult.kind === 'units' || localStepsResult.kind === 'number') ? (
                    <>
                      {localStepsResult.result ? (
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-mono">
                          {localStepsResult.result}
                        </div>
                      ) : null}
                      {localStepsResult.steps.length > 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{localStepsResult.steps[0]}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800 dark:text-slate-200 font-medium">
                        {localStepsResult.steps.map((step, i) => (
                          <li key={i} className="pl-1">
                            {step}
                          </li>
                        ))}
                      </ol>
                      {localStepsResult.result && (
                        <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Result: </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{localStepsResult.result}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {graphExpression && !showGraphs && (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-widest">
                    <i className="fa-solid fa-chart-line text-xs"></i>
                    Auto Graphed From Question
                  </div>
                  <div className="w-full h-64 md:h-80 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
                    <div ref={desmosContainerRef} className="w-full h-full" />
                  </div>
                </div>
              )}
              {messages.length > 0 && messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                    <div className={`max-w-full p-6 rounded-[24px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                      {msg.role === 'assistant' ? (
                        <SolutionMessageContent content={msg.content} />
                      ) : (
                        <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>
                          {msg.content}
                        </div>
                      )}
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
