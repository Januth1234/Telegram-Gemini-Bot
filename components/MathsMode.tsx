
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// ─── Solution display components (unchanged) ─────────────────────────────────

const MathSolutionCard: React.FC<{ content: string }> = ({ content }) => {
  const parsed = parseMathResponse(content);
  const [openMethod, setOpenMethod] = useState(0);

  return (
    <div className="space-y-4 w-full">
      {parsed.preamble && (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{parsed.preamble}</p>
      )}
      {parsed.methods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {parsed.methods.map((m, i) => (
            <button key={i} onClick={() => setOpenMethod(i)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                openMethod === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-50'
              }`}>
              {m.name}
            </button>
          ))}
        </div>
      )}
      {parsed.methods[openMethod] && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-500/20 p-5 space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{parsed.methods[openMethod].name}</h4>
          {parsed.methods[openMethod].steps.split('\n').filter(l => l.trim()).map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-[9px] font-black text-indigo-400 mt-1 shrink-0 min-w-[20px]">{i + 1}.</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed font-mono">{step.trim()}</span>
            </div>
          ))}
        </div>
      )}
      {parsed.verification && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Verification</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{parsed.verification}</p>
        </div>
      )}
    </div>
  );
};

const SolutionMessageContent: React.FC<{ content: string }> = ({ content }) => {
  const methods = parseSolutionMethods(content);
  const [activeTab, setActiveTab] = useState(0);

  if (isMathSolution(content)) return <MathSolutionCard content={content} />;

  if (methods && methods.length > 1) {
    return (
      <div className="w-full">
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
          {methods.map((m, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                activeTab === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-500/50'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
        <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${/[^\u0000-\u007F]/.test(methods[activeTab].content) ? 'sinhala-text' : ''}`}>
          {methods[activeTab].content}
        </div>
      </div>
    );
  }

  const displayContent = methods?.length === 1 ? methods[0].content : content;
  return (
    <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${/[^\u0000-\u007F]/.test(displayContent) ? 'sinhala-text' : ''}`}>
      {displayContent}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Multi-method tabbed result card ─────────────────────────────────────────
interface MathResultProps {
  result: {
    kind: string;
    title: string;
    steps: string[];
    result: string;
    input: string;
    resultLatex?: string;
    extraMethods?: { name: string; steps: string[] }[];
  };
  isTyping: boolean;
  onExplain: () => void;
  onClose: () => void;
}

const MathResultCard: React.FC<MathResultProps> = ({ result, isTyping, onExplain, onClose }) => {
  const isUtility = result.kind === 'units' || result.kind === 'number';
  const allMethods = [
    { name: result.title, steps: result.steps },
    ...(result.extraMethods || []),
  ];
  const [activeMethod, setActiveMethod] = React.useState(0);
  const current = allMethods[activeMethod];

  if (isUtility) {
    return (
      <div className="w-full p-5 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/50 shadow-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300 flex items-center gap-2">
            <i className={result.kind === 'units' ? 'fa-solid fa-ruler-combined' : 'fa-solid fa-hashtag'} />
            {result.title}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-red-500 flex items-center justify-center">
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
        {result.result && <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{result.result}</div>}
        {result.steps.length > 0 && <p className="text-sm text-red-600 dark:text-red-400">{result.steps[0]}</p>}
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-indigo-100 dark:border-indigo-900 flex-wrap">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-list-check text-indigo-500 text-sm" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Solution — Step by Step
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={isTyping} onClick={onExplain}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 transition-colors">
            <i className="fa-solid fa-wand-magic-sparkles mr-1" />Explain
          </button>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 flex items-center justify-center">
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      </div>

      {/* Method tabs — only show if multiple methods */}
      {allMethods.length > 1 && (
        <div className="flex gap-2 px-5 pt-3 pb-0 border-b border-indigo-50 dark:border-indigo-900/40 overflow-x-auto no-scrollbar">
          {allMethods.map((m, i) => (
            <button
              key={i}
              onClick={() => setActiveMethod(i)}
              className={`px-4 py-1.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${
                activeMethod === i
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="px-5 py-4 space-y-2">
        {allMethods.length === 1 && (
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3">{current.name}</p>
        )}
        {current.steps.map((step: string, i: number) => {
          const isFinal = /^final answer/i.test(step);
          return (
            <div key={i} className={`flex gap-3 items-start ${isFinal ? 'pt-3 mt-1 border-t border-indigo-100 dark:border-indigo-800' : ''}`}>
              {!isFinal && (
                <span className="text-[10px] font-black text-indigo-300 mt-0.5 shrink-0 w-5">{i + 1}.</span>
              )}
              <span className={`text-sm leading-relaxed font-mono ${
                isFinal
                  ? 'font-black text-indigo-700 dark:text-indigo-300 text-base'
                  : 'text-slate-700 dark:text-slate-300'
              }`}>{step}</span>
            </div>
          );
        })}
        {result.result && !/final answer/i.test(current.steps[current.steps.length - 1] || '') && (
          <div className="pt-3 border-t border-indigo-100 dark:border-indigo-800">
            <span className="text-[10px] font-black uppercase text-indigo-500">Result: </span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">{result.result}</span>
          </div>
        )}
      </div>
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
    op: string; latex?: string; scalar?: number; text?: string; error?: string;
  } | null>(null);
  const [localStepsResult, setLocalStepsResult] = useState<{
    kind: 'derivative' | 'integral' | 'solve' | 'units' | 'number';
    extraMethods?: { name: string; steps: string[] }[];
    title: string;
    steps: string[];
    result: string;
    resultLatex?: string;
    input: string;
  } | null>(null);
  const [inputMode, setInputMode] = useState<'math' | 'text'>('math');
  const [textInput, setTextInput] = useState('');
  const [mathHistory, setMathHistory] = useState<MathHistoryItem[]>(
    () => cacheService.get<MathHistoryItem[]>(CacheKey.MATH_HISTORY, [])
  );
  const [isSolving, setIsSolving] = useState(false);
  // Track AI extraction status separately so UI can show a message
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);

  const equationRefs = useRef<(any)[]>([]);
  const focusedMathFieldRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const desmosContainerRef = useRef<HTMLDivElement | null>(null);
  const desmosCalcRef = useRef<any>(null);
  const handwritingClosedByUserRef = useRef(false);

  // Persist math history
  useEffect(() => { cacheService.set(CacheKey.MATH_HISTORY, mathHistory); }, [mathHistory]);

  const appendMathHistory = (item: Omit<MathHistoryItem, 'id' | 'createdAt'>) => {
    const entry: MathHistoryItem = { id: `math-${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: new Date().toISOString(), ...item };
    setMathHistory(prev => [entry, ...prev].slice(0, 50));
  };

  // Resize matrix grid when rows/cols change
  useEffect(() => {
    if (activeCat !== 'Matrix') return;
    setMatrixGrid(prev => Array.from({ length: matrixRows }, (_, r) =>
      Array.from({ length: matrixCols }, (_, c) => prev[r]?.[c] ?? 0)
    ));
  }, [matrixRows, matrixCols, activeCat]);

  // Load MathLive
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (customElements.get('math-field')) { setMathLiveReady(true); return; }
    const existing = document.querySelector(`script[src="${MATHLIVE_SCRIPT}"]`);
    if (existing) { setMathLiveReady(true); return; }
    const script = document.createElement('script');
    script.src = MATHLIVE_SCRIPT; script.async = true;
    script.onload = () => setMathLiveReady(true);
    script.onerror = () => setMathLiveReady(false);
    document.head.appendChild(script);
  }, []);

  // Load Desmos
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if ((window as any).Desmos) { setDesmosReady(true); return; }
    const existing = document.querySelector(`script[src="${DESMOS_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => setDesmosReady(true), { once: true }); return; }
    const script = document.createElement('script');
    script.src = DESMOS_SCRIPT; script.async = true;
    script.onload = () => setDesmosReady(true);
    script.onerror = () => setDesmosReady(false);
    document.head.appendChild(script);
  }, []);

  // Init inline Desmos (only when NOT showing the full Graphs panel)
  useEffect(() => {
    if (showGraphs) {
      if (desmosCalcRef.current) { try { desmosCalcRef.current.destroy(); } catch {} desmosCalcRef.current = null; }
      return;
    }
    if (!desmosReady || !desmosContainerRef.current || desmosCalcRef.current) return;
    try {
      desmosCalcRef.current = (window as any).Desmos?.GraphingCalculator(desmosContainerRef.current, {
        expressions: true, keypad: true, graphpaper: true,
      }) ?? null;
    } catch { desmosCalcRef.current = null; }
    return () => {
      if (desmosCalcRef.current) { try { desmosCalcRef.current.destroy(); } catch {} desmosCalcRef.current = null; }
    };
  }, [desmosReady, showGraphs]);

  // Check for pending graph expression from other workspace modes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const pending = window.sessionStorage.getItem('pendingGraphExpression');
      if (pending?.trim()) {
        setGraphExpression(pending.trim());
        setCurrentGraph({ id: 'graph-from-question', type: 'function', expressionLatex: pending.trim(), xDomain: { min: -10, max: 10 } });
        setGraphSource('question');
        setShowGraphs(true);
        window.sessionStorage.removeItem('pendingGraphExpression');
      }
    } catch {}
  }, []);

  // Plot expression on inline Desmos when expression changes
  useEffect(() => {
    if (!desmosCalcRef.current || !graphExpression) return;
    try {
      const calc = desmosCalcRef.current;
      calc.setExpression({ id: 'main', latex: graphExpression });
      if (graphExpression.includes('=')) {
        const analysis = casService.functionAnalysis(graphExpression);
        analysis.roots.forEach((x, i) => {
          try { calc.setExpression({ id: `analysis_root_${i}`, latex: `(${x}, 0)`, showLabel: true, label: 'Root' }); } catch {}
        });
        if (analysis.yIntercept != null) {
          try { calc.setExpression({ id: 'analysis_yint', latex: `(0, ${analysis.yIntercept})`, showLabel: true, label: 'y-intercept' }); } catch {}
        }
        analysis.criticalPoints.forEach((x, i) => {
          const y = casService.evaluateRHSAt(graphExpression, x);
          if (y != null) try { calc.setExpression({ id: `analysis_crit_${i}`, latex: `(${x}, ${y})`, showLabel: true, label: 'Extremum' }); } catch {}
        });
        analysis.verticalAsymptotes.forEach((x, i) => {
          try { calc.setExpression({ id: `analysis_asymp_${i}`, latex: `x = ${x}` }); } catch {}
        });
      }
    } catch {}
  }, [graphExpression]);

  useEffect(() => {
    if (!mathLiveReady) return;
    const first = equationRefs.current[0];
    if (first) {
      setTimeout(() => {
        try {
          // Move keyboard toggle + menu buttons to the right (trailing)
          equationRefs.current.forEach(mf => {
            if (!mf) return;
            try { mf.setAttribute('virtual-keyboard-toggle', 'trailing'); } catch {}
            // Also try the mathfield API directly
            try { if (mf.menuToggle !== undefined) mf.menuToggle = 'trailing'; } catch {}
          });
          if (first.mathfield) first.mathfield.focus();
          else first.focus?.();
        } catch {}
      }, 300);
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
      .filter((s): s is string => Boolean(s));
  };

  const insertSymbol = (cmd: string) => {
    const target = focusedMathFieldRef.current ?? equationRefs.current[0];
    if (target) {
      target.executeCommand(['insert', cmd]);
      target.focus();
    }
  };

  const clearInput = () => {
    if (inputMode === 'text') {
      setTextInput('');
    } else {
      equationRefs.current.slice(0, equationCount).forEach(mf => { if (mf) mf.value = ''; });
    }
    setSelectedFile(null);
  };

  // ─── Math solve pipeline ─────────────────────────────────────────────────────
  // Direct input (LaTeX field) → local CAS first, null/generic → solveMathWithAI
  // Text/image → AI extracts expression → local CAS → null/generic → solveMathWithAI
  // Results shown as tabbed methods (CAS + AI methods can coexist)

  /** Returns true only if CAS produced real, non-generic steps */
  const isRealCASResult = (out: { steps: string[]; result: string } | null): boolean => {
    if (!out || out.steps.length < 2) return false;
    const joined = out.steps.join(' ').toLowerCase();
    const GENERIC = ['algebraic methods', 'isolate', 'rearrang', 'further analysis', 'standard technique', 'applying'];
    return !GENERIC.some(g => joined.includes(g));
  };

  /** Parse ---METHOD--- blocks from AI text into named method objects */
  const parseAIMethods = (text: string): { name: string; steps: string[] }[] => {
    const re = /---METHOD:\s*(.+?)\s*---\n([\s\S]*?)---ENDMETHOD---/gi;
    const methods: { name: string; steps: string[] }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      methods.push({ name: m[1].trim(), steps: m[2].trim().split('\n').filter(l => l.trim()) });
    }
    if (!methods.length && text.trim()) {
      methods.push({ name: 'AI Solution', steps: text.trim().split('\n').filter(l => l.trim()) });
    }
    return methods;
  };

  /** Extract expression via Gemini from text or image, then route to local CAS. */
  const runWithExtraction = async (command: string, rawText: string | undefined, fileData?: { data: string; mimeType: string; name: string }) => {
    setIsSolving(true);
    setExtractionStatus(fileData ? 'Reading image with AI…' : 'Extracting math from text…');
    try {
      const extracted = await geminiService.extractMathFromInput(rawText, fileData);

      if (extracted.unreadable) {
        // Can't extract — send directly to AI
        setExtractionStatus(null);
        const prompt = fileData
          ? `Analyze this math problem. ${command}. Show all steps.`
          : `${command}: ${rawText}. Show step-by-step working.`;
        onSend(prompt, fileData);
        return;
      }

      const expr = (typeof extracted.latexExpression === 'string' && extracted.latexExpression.trim())
        ? extracted.latexExpression.trim()
        : String(Array.isArray(extracted.expression) ? extracted.expression[0] : extracted.expression || '').trim();

      if (!expr) {
        setExtractionStatus(null);
        onSend(rawText ? `${command}: ${rawText}` : command, fileData);
        return;
      }

      setExtractionStatus(`Solving: ${expr}`);

      const op: MathOperation = extracted.operation ?? commandToOperation(command);
      const variable = extracted.variable || 'x';

      let solved = false;

      if (op === 'differentiate') {
        const out = casService.derivativeWithSteps(expr, variable);
        if (isRealCASResult(out)) {
          setLocalStepsResult({ kind: 'derivative', title: 'Derivative — Step by Step', steps: out.steps, result: out.result, resultLatex: out.resultLatex, input: expr });
          appendMathHistory({ kind: 'expression', inputLatex: expr, result: out.result, graph: null });
          solved = true;
        }
      } else if (op === 'integrate') {
        const out = casService.integralWithSteps(expr, variable);
        let resultTex = '';
        try {
          const nerd = (await import('nerdamer')).default;
          await import('nerdamer/Calculus');
          resultTex = nerd(`integrate(${expr}, ${variable})`).toTeX();
        } catch {}
        if (isRealCASResult(out) || resultTex) {
          const steps = [...(out.steps || [])];
          if (resultTex && !steps.some(s => s.includes(resultTex))) steps.push(`Result: $${resultTex}$`);
          const result = resultTex || out.result || '';
          setLocalStepsResult({ kind: 'integral', title: 'Integral — Step by Step', steps, result, input: expr });
          appendMathHistory({ kind: 'expression', inputLatex: expr, result, graph: null });
          solved = true;
        }
      } else if (op === 'solve') {
        const out = casService.solveEquationWithSteps(expr, variable);
        if (isRealCASResult(out)) {
          const result = out.roots?.length ? out.roots.map(r => typeof r === 'number' ? r.toFixed(4) : r).join(', ') : out.steps[out.steps.length - 1] || '';
          setLocalStepsResult({ kind: 'solve', title: 'Solution — Step by Step', steps: out.steps, result, input: expr });
          appendMathHistory({ kind: 'expression', inputLatex: expr, result, graph: null });
          solved = true;
        }
      } else if (op === 'simplify') {
        try {
          const simplified = casService.simplify(expr);
          setLocalStepsResult({ kind: 'solve', title: 'Simplification', steps: [`Input: ${expr}`, `Simplified: ${simplified}`], result: simplified, input: expr });
          appendMathHistory({ kind: 'expression', inputLatex: expr, result: simplified, graph: null });
          solved = true;
        } catch {}
      }

      if (!solved) {
        // CAS null/generic → solveMathWithAI with full method parsing
        setExtractionStatus('Solving with AI — finding all methods…');
        try {
          const mathPrompt = `${command} the expression: ${expr} (variable: ${variable})`;
          const aiText = await geminiService.solveMathWithAI({ prompt: mathPrompt, fileData });
          const aiMethods = parseAIMethods(aiText);
          // Show as localStepsResult with multiple methods (first method displayed, rest as tabs)
          if (aiMethods.length > 0) {
            const primary = aiMethods[0];
            const finalLine = primary.steps.findLast((s: string) => /final answer/i.test(s)) || primary.steps[primary.steps.length - 1] || '';
            setLocalStepsResult({
              kind: 'solve',
              title: primary.name,
              steps: primary.steps,
              result: finalLine.replace(/^final answer[:\s]*/i, '').trim(),
              input: expr,
              extraMethods: aiMethods.slice(1),
            });
            appendMathHistory({ kind: 'expression', inputLatex: expr, result: finalLine, graph: null });
          }
        } catch {
          // Last resort — route to chat
          const fmt = `Solve step by step. Use format:\n---METHOD: [Name] ---\nStep 1: ...\nFinal Answer: ...\n---ENDMETHOD---`;
          onSend(`${command}: ${expr}\n${fmt}`, fileData);
        }
      }

    } catch (e) {
      setExtractionStatus(null);
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      // Fallback: just send raw input to AI
      const prompt = fileData
        ? `Solve this math problem step by step. ${command}.`
        : `${command}: ${rawText}. Show full step-by-step working.`;
      try {
        const aiResult = await geminiService.solveMathWithAI({ prompt: rawText ? `${command}: ${rawText}` : command, fileData });
        onSend(`[MATH_RESULT]
${aiResult}`, undefined);
      } catch {
        onSend(prompt, fileData);
      }
    } finally {
      setIsSolving(false);
      setExtractionStatus(null);
    }
  };

  // ─── Main action handler ──────────────────────────────────────────────────

  const handleAction = async (command: string) => {

    // ── TEXT MODE: extract via AI then feed to CAS ──
    if (inputMode === 'text') {
      const rawText = textInput.trim();
      if (!rawText && !selectedFile) return;
      await runWithExtraction(command, rawText || undefined, selectedFile || undefined);
      if (selectedFile) setSelectedFile(null);
      return;
    }

    const equations = getEquations();
    const rawLatex = equations.length === 1 ? equations[0] : equations.join(' ; ');

    // ── IMAGE ATTACHED: extract expression via Gemini then solve locally ──
    if (selectedFile && !rawLatex) {
      await runWithExtraction(command, undefined, selectedFile);
      setSelectedFile(null);
      return;
    }

    // ── IMAGE + LATEX: use AI with both ──
    if (selectedFile && rawLatex) {
      const prompt = `Image contains a math problem. Also given expression: ${rawLatex}. ${command}. Show all steps.`;
      onSend(prompt, selectedFile);
      setSelectedFile(null);
      return;
    }

    // ── MATRIX OPERATIONS ──
    if (/matrix\s+(det|inv|eigs|rank|rref)/i.test(command)) {
      const grid = matrixGrid.map(row => row.map(Number));
      const op = command.replace(/matrix\s+/i, '').toLowerCase();
      if (op === 'det') {
        const out = casService.matrixDet(grid);
        if (out.error) setMatrixResult({ op: 'Determinant', error: out.error });
        else { setMatrixResult({ op: 'Determinant', scalar: out.value, latex: matrixToPmatrix(grid) }); appendMathHistory({ kind: 'expression', inputLatex: `det(${matrixToPmatrix(grid)})`, result: String(out.value), graph: null }); }
        return;
      }
      if (op === 'inv') {
        const out = casService.matrixInv(grid);
        if (out.error) setMatrixResult({ op: 'Inverse', error: out.error });
        else { const latex = matrixToPmatrix(out.matrix!); setMatrixResult({ op: 'Inverse', latex }); appendMathHistory({ kind: 'expression', inputLatex: 'A⁻¹', result: latex, graph: null }); }
        return;
      }
      if (op === 'eigs') {
        const out = casService.matrixEigs(grid);
        if (out.error) setMatrixResult({ op: 'Eigenvalues', error: out.error });
        else { const vals = out.values!.map(v => Math.abs(v) < 1e-10 ? 0 : v); setMatrixResult({ op: 'Eigenvalues', text: `\\lambda = ${vals.join(', ')}`, latex: matrixToPmatrix(grid) }); appendMathHistory({ kind: 'expression', inputLatex: matrixToPmatrix(grid), result: `λ = ${vals.join(', ')}`, graph: null }); }
        return;
      }
      if (op === 'rank') {
        const out = casService.matrixRank(grid);
        if (out.error) setMatrixResult({ op: 'Rank', error: out.error });
        else { setMatrixResult({ op: 'Rank', scalar: out.rank, latex: matrixToPmatrix(grid) }); }
        return;
      }
      if (op === 'rref') {
        const out = casService.matrixRref(grid);
        if (out.error) setMatrixResult({ op: 'RREF', error: out.error });
        else { const latex = matrixToPmatrix(out.matrix!); setMatrixResult({ op: 'RREF', latex }); }
        return;
      }
    }

    // ── NUMBER THEORY (local CAS, no AI needed) ──
    if (/^number\s+/i.test(command) && equations.length >= 1) {
      const raw = (equations[0] || '').replace(/\\cdot|\\times/g, '').replace(/\\mod|\\bmod/g, ' mod ').replace(/\s+/g, ' ').trim();
      const cmd = command.replace(/^number\s+/i, '').toLowerCase();
      let title = '', result = '', error: string | undefined;
      if (cmd === 'prime') { const n = parseInt(raw.replace(/,/g, ''), 10); const out = casService.primeFactors(n); title = 'Prime Factorisation'; if (out.error) error = out.error; else result = out.result!; }
      else if (cmd === 'gcd') { const parts = raw.split(/[,;\s]+/).map(s => parseInt(s.trim(), 10)).filter(Number.isFinite); const out = parts.length >= 2 ? casService.gcd(parts[0], parts[1]) : { error: 'Enter two integers (e.g. 12, 18)' }; title = 'GCD'; if (out.error) error = out.error; else result = String((out as any).value); }
      else if (cmd === 'lcm') { const parts = raw.split(/[,;\s]+/).map(s => parseInt(s.trim(), 10)).filter(Number.isFinite); const out = parts.length >= 2 ? casService.lcm(parts[0], parts[1]) : { error: 'Enter two integers' }; title = 'LCM'; if (out.error) error = out.error; else result = String((out as any).value); }
      else if (cmd === 'mod') { const modMatch = raw.match(/^(.+?)\s+mod\s+(\d+)$/i) || raw.split(/[,;\s]+/).map(s => s.trim()); const a = modMatch[2] != null ? parseFloat(modMatch[1]) : parseFloat(modMatch[0]); const m = modMatch[2] != null ? parseInt(modMatch[2], 10) : parseInt(modMatch[1], 10); const out = Number.isFinite(a) && Number.isFinite(m) ? casService.mod(a, m) : { error: 'Enter a mod m (e.g. 17 mod 5)' }; title = 'a mod m'; if (out.error) error = out.error; else result = String((out as any).value); }
      else if (/^to\s+(binary|hex|octal|decimal)$/i.test(cmd)) { const toBase = cmd.includes('binary') ? 2 : cmd.includes('hex') ? 16 : cmd.includes('octal') ? 8 : 10; const out = casService.baseConvert(raw, toBase as 2 | 8 | 10 | 16); title = `Base → ${toBase === 2 ? 'Binary' : toBase === 16 ? 'Hex' : toBase === 8 ? 'Octal' : 'Decimal'}`; if (out.error) error = out.error; else result = out.value!; }
      if (title) { setLocalStepsResult({ kind: 'number', title, steps: error ? [error] : [], result: error ? '' : result, input: raw }); if (!error) appendMathHistory({ kind: 'expression', inputLatex: raw, result, graph: null }); return; }
    }

    if (command === 'open graphs') { setGraphSource('manual'); setShowGraphs(true); return; }

    // ── PHYSICS UNITS (local CAS) ──
    if (/evaluate with units/i.test(command) && equations.length >= 1) {
      const input = (equations[0] || '').trim();
      if (input) {
        const out = casService.evaluateWithUnits(input);
        setLocalStepsResult({ kind: 'units', title: 'Unit Calculation', steps: out.error ? [`Error: ${out.error}`] : [], result: out.result || '', input });
        if (!out.error) appendMathHistory({ kind: 'expression', inputLatex: input, result: out.result || '', graph: null });
        return;
      }
    }

    // ── LATEX MATH FIELD MODE: try local CAS first ──
    if (!rawLatex && !selectedFile) return;

    const isDerivativeCommand = /derivative|derive|differentiat/i.test(command);
    const isIntegralCommand = /integral|integrate/i.test(command);
    const isSolveCommand = /solve|Solve/i.test(command);

    let casHandled = false;

    if (!selectedFile && equations.length === 1 && equations[0]?.trim()) {
      const input = equations[0].trim();

      if (isDerivativeCommand) {
        const out = casService.derivativeWithSteps(input, 'x');
        if (isRealCASResult(out)) {
          setLocalStepsResult({ kind: 'derivative', title: 'Derivative — Step by Step', steps: out.steps, result: out.result, resultLatex: out.resultLatex, input });
          appendMathHistory({ kind: 'expression', inputLatex: input, result: out.result, graph: null });
          casHandled = true;
        }
      }
      if (!casHandled && isIntegralCommand) {
        const out = casService.integralWithSteps(input, 'x');
        if (isRealCASResult(out)) {
          let resultTex = '';
          try {
            const nerd = (await import('nerdamer')).default;
            await import('nerdamer/Calculus');
            resultTex = nerd(`integrate(${input}, x)`).toTeX();
          } catch {}
          const steps = [...(out.steps || [])];
          if (resultTex && steps.length > 0) steps.push(`Result: $${resultTex}$`);
          setLocalStepsResult({ kind: 'integral', title: 'Integral — Step by Step', steps, result: resultTex || out.result, input });
          appendMathHistory({ kind: 'expression', inputLatex: input, result: resultTex || out.result, graph: null });
          casHandled = true;
        }
      }
      if (!casHandled && isSolveCommand) {
        const out = casService.solveEquationWithSteps(input, 'x');
        if (isRealCASResult(out)) {
          const result = out.roots?.length ? out.roots.map(r => typeof r === 'number' ? r.toFixed(4) : r).join(', ') : out.steps[out.steps.length - 1] || '';
          setLocalStepsResult({ kind: 'solve', title: 'Solution — Step by Step', steps: out.steps, result, input });
          appendMathHistory({ kind: 'expression', inputLatex: input, result, graph: null });
          casHandled = true;
        }
      }

      // System of equations via nerdamer
      if (!casHandled && equations.length > 1 && isSolveCommand) {
        try {
          const result = casService.solveEquations(equations);
          if (result.solution) {
            setLocalStepsResult({ kind: 'solve', title: 'System of Equations', steps: equations.map((e, i) => `Equation ${i + 1}: ${e}`), result: result.solution, input: rawLatex });
            casHandled = true;
          }
        } catch {}
      }
    }

    if (casHandled) return;

    // ── FALLBACK: CAS failed → solveMathWithAI for full multi-method solution ──
    setIsSolving(true);
    try {
      const prompt = selectedFile
        ? `Analyze this math problem image and ${command}.`
        : `${command} the expression: ${rawLatex}`;
      const aiText = await geminiService.solveMathWithAI({
        prompt,
        fileData: selectedFile || undefined,
      });
      const aiMethods = parseAIMethods(aiText);
      if (aiMethods.length > 0) {
        const primary = aiMethods[0];
        const finalLine = [...primary.steps].reverse().find((s: string) => /final answer/i.test(s)) || primary.steps[primary.steps.length - 1] || '';
        setLocalStepsResult({
          kind: 'solve',
          title: primary.name,
          steps: primary.steps,
          result: finalLine.replace(/^final answer[:\s]*/i, '').trim(),
          input: rawLatex || '(image)',
          extraMethods: aiMethods.slice(1),
        });
        appendMathHistory({ kind: 'expression', inputLatex: rawLatex || '(image)', result: finalLine, graph: null });
      }
    } catch {
      // Absolute last resort
      onSend(`Solve step by step: ${rawLatex}`, selectedFile || undefined);
    } finally {
      setIsSolving(false);
    }
    setSelectedFile(null);
  };

  const commandToOperation = (cmd: string): MathOperation => {
    const l = cmd.toLowerCase();
    if (l.includes('deriv') || l.includes('diff')) return 'differentiate';
    if (l.includes('integr')) return 'integrate';
    if (l.includes('simplif')) return 'simplify';
    if (l.includes('factor')) return 'factor';
    if (l.includes('expand')) return 'expand';
    return 'solve';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_IMAGE_BYTES) { alert('Image too large. Please upload under 10MB.'); e.target.value = ''; return; }
    const r = new FileReader();
    r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
    r.readAsDataURL(file);
    e.target.value = '';
  };

  const handleHandwritingRecognize = async (imageDataUrl: string, mimeType: string, base64Data: string) => {
    setHandwritingRecognizing(true);
    try {
      const res = await geminiService.chat('This image shows a handwritten mathematical equation. Extract it and return ONLY the LaTeX code, nothing else. No explanation, no markdown, no backticks—just the raw LaTeX.', {
        fileData: { data: base64Data, mimeType, name: 'handwriting.png' },
        history: [],
      });
      let latex = (res.text || '').trim().replace(/^```(?:latex|math)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const target = focusedMathFieldRef.current ?? equationRefs.current[0];
      if (latex && target) { target.value = latex; target.focus(); }
      setShowHandwriting(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Recognition failed. Try again.');
    } finally {
      setHandwritingRecognizing(false);
    }
  };

  const containerClass = embedded
    ? 'flex-1 flex flex-col md:flex-row overflow-hidden h-full bg-slate-50 dark:bg-slate-950 pb-20'
    : 'fixed inset-0 z-[120] bg-white dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden';

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
              <i className="fa-solid fa-square-root-variable text-lg" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-tighter text-slate-800 dark:text-white leading-none">Math Solver</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-300">Beta</span>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </header>
      )}

      {/* Sidebar Categories */}
      <nav className="w-full md:w-56 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 p-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
        {(Object.keys(CATEGORIES) as MathCategory[]).map(cat => (
          <button key={cat}
            onClick={() => { if (cat === 'Graphs') { setGraphSource('manual'); setShowGraphs(true); } else { setActiveCat(cat); } }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-w-max md:w-full border ${
              activeCat === cat
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'text-slate-500 hover:bg-white dark:hover:bg-white/5 border-transparent'
            }`}>
            <i className={`fa-solid ${CATEGORIES[cat].icon} text-sm w-5 text-center`} />
            {cat}
          </button>
        ))}
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Input Area */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-1 border border-indigo-500/20 shadow-xl relative">
            <div className="flex items-center justify-between px-4 py-2 border-b border-black/5 dark:border-white/5">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className={`fa-solid ${activeCat === 'Matrix' ? 'fa-table-cells' : 'fa-pen-to-square'}`} />
                {activeCat === 'Matrix' ? 'Matrix Editor' : 'Equation Editor'}
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => { setGraphSource('manual'); setShowGraphs(true); }}
                  className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-100">
                  <i className="fa-solid fa-chart-line mr-1" />Graphs
                </button>
                <button onClick={() => { handwritingClosedByUserRef.current = false; setShowHandwriting(true); }}
                  className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2">
                  <i className="fa-solid fa-pencil" />Draw
                </button>
                <button onClick={() => setShowVoiceMath(true)}
                  className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2">
                  <i className="fa-solid fa-microphone" />Voice
                </button>
                <button onClick={clearInput}
                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors" title="Clear Input">
                  <i className="fa-solid fa-trash text-[10px]" />
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${selectedFile ? 'bg-emerald-500 text-white border-emerald-500' : 'text-slate-500 border-slate-200 dark:border-white/10 hover:bg-slate-50'}`}>
                  <i className="fa-solid fa-camera" />{selectedFile ? 'Image Added' : 'Photo'}
                </button>
                {activeCat === 'Physics' && (
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5">
                    <input type="checkbox" checked={unitsMode} onChange={e => setUnitsMode(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      <i className="fa-solid fa-ruler-combined mr-1" />Units
                    </span>
                  </label>
                )}
                {/* Input mode toggle */}
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setInputMode('math')}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${inputMode === 'math' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10'}`} title="Math input">
                    <i className="fa-solid fa-superscript" />
                  </button>
                  <button type="button" onClick={() => setInputMode('text')}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${inputMode === 'text' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10'}`} title="Text input (sentences, paragraphs)">
                    <i className="fa-solid fa-align-left" />
                  </button>
                </div>
              </div>
            </div>

            {/* File preview */}
            {selectedFile && activeCat !== 'Matrix' && (
              <div className="p-4 bg-slate-50 dark:bg-black/20">
                <div className="relative group w-fit">
                  <div className="absolute -top-2 -right-2 z-10">
                    <button onClick={() => setSelectedFile(null)} className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-90">
                      <i className="fa-solid fa-xmark text-[8px]" />
                    </button>
                  </div>
                  <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="h-24 rounded-lg border border-black/10 dark:border-white/10 shadow-sm" alt="Attached math problem" />
                </div>
              </div>
            )}

            {/* AI extraction status indicator */}
            {extractionStatus && (
              <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-indigo-500 text-xs" />
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{extractionStatus}</span>
              </div>
            )}

            {/* Matrix grid input */}
            {activeCat === 'Matrix' && inputMode === 'math' && (
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Size</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 dark:text-slate-300">Rows</label>
                    <select value={matrixRows} onChange={e => setMatrixRows(Math.max(1, Math.min(6, Number(e.target.value))))}
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm px-2 py-1">
                      {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <span className="text-slate-400">×</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 dark:text-slate-300">Cols</label>
                    <select value={matrixCols} onChange={e => setMatrixCols(Math.max(1, Math.min(6, Number(e.target.value))))}
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm px-2 py-1">
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
                              <input type="number" value={matrixGrid[r][c]}
                                onChange={e => {
                                  const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  setMatrixGrid(prev => prev.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? (Number.isFinite(v) ? v : cell) : cell)));
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
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Preview</span>
                  <div className="min-h-[40px] flex items-center">
                    <KatexBlock latex={matrixToPmatrix(matrixGrid)} className="text-lg text-slate-700 dark:text-slate-200" />
                  </div>
                </div>
              </div>
            )}

            {/* Text mode: paragraph/sentence input */}
            {inputMode === 'text' && activeCat !== 'Matrix' && (
              <div className="p-3">
                <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                  placeholder="Type your math problem in plain text — e.g. 'find the derivative of x squared plus 5x' or 'solve 2x + 3 = 7' or paste an equation paragraph. AI will extract and solve it."
                  className="w-full min-h-[96px] text-sm md:text-base p-4 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-y outline-none focus:border-indigo-500"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                  <i className="fa-solid fa-wand-magic-sparkles mr-1 text-indigo-400" />
                  AI will extract the mathematical expression and solve it step by step
                </p>
              </div>
            )}

            {/* Math (MathLive) mode */}
            {inputMode === 'math' && activeCat !== 'Matrix' && (
              mathLiveReady ? (
                <div className="w-full space-y-2 p-2">
                  {Array.from({ length: equationCount }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <MathFieldTag
                        ref={(el: any) => { equationRefs.current[i] = el; }}
                        onFocus={() => { focusedMathFieldRef.current = equationRefs.current[i]; }}
                        className="flex-1 text-xl md:text-2xl p-4 bg-transparent text-slate-900 dark:text-white outline-none min-h-[56px] rounded-lg border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-400"
                        style={{ '--caret-color': '#4f46e5', '--selection-background-color': '#4f46e550' } as React.CSSProperties}
                      />
                      {equationCount > 1 && i === equationCount - 1 && (
                        <button type="button" onClick={() => setEquationCount(c => Math.max(1, c - 1))}
                          className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 flex items-center justify-center" title="Remove equation">
                          <i className="fa-solid fa-minus text-[10px]" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setEquationCount(c => c + 1)}
                    className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 hover:border-indigo-400 transition-colors flex items-center justify-center gap-2">
                    <i className="fa-solid fa-plus" /> Add equation
                  </button>
                </div>
              ) : (
                <div className="w-full min-h-[80px] p-6 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-sm m-2">
                  Loading math input…
                </div>
              )
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          {/* Dynamic Toolbar */}
          <div className="flex flex-wrap gap-2 animate-reveal">
            {CATEGORIES[activeCat].tools.map((tool, i) => (
              <button key={i}
                onClick={() => tool.type === 'action' ? handleAction(tool.cmd) : insertSymbol(tool.cmd)}
                disabled={isTyping || isSolving}
                className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 ${
                  tool.type === 'action'
                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-indigo-500/50'
                }`}>
                {tool.label}
              </button>
            ))}
            {/* Global Solve Button */}
            <button onClick={() => handleAction('solve for x')} disabled={isTyping || isSolving}
              className="flex-1 min-w-[120px] px-4 py-3 rounded-xl bg-cyan-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-cyan-500 shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {isSolving ? <><i className="fa-solid fa-circle-notch fa-spin mr-2" />Solving…</> : 'Solve'}
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="max-w-3xl mx-auto space-y-6 pb-12">

          {/* Math History */}
          {mathHistory.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left" />Math History
                </span>
                <button type="button" onClick={() => setMathHistory([])}
                  className="text-[9px] px-2 py-1 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 hover:border-red-300">
                  Clear
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {mathHistory.map(item => (
                  <button key={item.id} type="button"
                    onClick={() => {
                      if (item.kind === 'graph' && item.graph) { setCurrentGraph(item.graph); setGraphSource('manual'); setShowGraphs(true); }
                      else { setActiveCat('General'); setEquationCount(1); if (equationRefs.current[0]) { equationRefs.current[0].value = item.inputLatex; equationRefs.current[0].focus(); } }
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-[11px]">
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

          {/* Matrix Result */}
          {matrixResult && (
            <div className="w-full p-6 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <i className="fa-solid fa-table-cells" />{matrixResult.op}
                </span>
                <button type="button" onClick={() => setMatrixResult(null)}
                  className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 flex items-center justify-center" title="Dismiss">
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </div>
              {matrixResult.error ? (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{matrixResult.error}</p>
              ) : (
                <div className="space-y-3">
                  {(matrixResult.op === 'Determinant' || matrixResult.op === 'Rank' || matrixResult.op === 'Eigenvalues') && matrixResult.latex != null && (
                    <div><span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mr-2">A = </span><KatexBlock latex={matrixResult.latex} className="inline-block text-lg text-slate-800 dark:text-slate-200" /></div>
                  )}
                  {matrixResult.scalar != null && (
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {matrixResult.op === 'Determinant' && 'det(A) = '}{matrixResult.op === 'Rank' && 'rank(A) = '}{matrixResult.scalar}
                    </div>
                  )}
                  {(matrixResult.op === 'Inverse' || matrixResult.op === 'RREF') && matrixResult.latex != null && (
                    <KatexBlock latex={(matrixResult.op === 'Inverse' ? 'A^{-1} = ' : '\\mathrm{RREF}(A) = ') + matrixResult.latex} className="text-lg text-slate-800 dark:text-slate-200" />
                  )}
                  {matrixResult.op === 'Eigenvalues' && matrixResult.text != null && (
                    <KatexBlock latex={matrixResult.text} className="text-lg text-slate-800 dark:text-slate-200" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Graphs panel */}
          {showGraphs && (
            <div className="space-y-3">
              <Graphs
                mode={graphSource === 'manual' ? 'manual' : 'fromQuestion'}
                initialGraph={currentGraph}
                onGraphsChange={g => {
                  setCurrentGraph(g);
                  if (g?.expressionLatex) appendMathHistory({ kind: 'graph', inputLatex: g.expressionLatex, result: '', graph: g });
                }}
                onExplainWithAi={summary => {
                  const expr = summary.expression || currentGraph?.expressionLatex || '';
                  const domain = summary.xDomain || currentGraph?.xDomain;
                  const domainText = domain ? ` on domain [${domain.min}, ${domain.max}]` : '';
                  onSend(`Explain this graph in simple steps. Function: ${expr || 'N/A'}${domainText}.`);
                }}
                onClose={() => setShowGraphs(false)}
                lang={lang}
              />
            </div>
          )}

          {/* Local step-by-step result — multi-method tabbed view */}
          {localStepsResult && (
            <MathResultCard
              result={localStepsResult}
              isTyping={isTyping}
              onExplain={() => {
                const text = ['Input: ' + localStepsResult.input, '', 'Steps:', ...localStepsResult.steps.map((s: string, i: number) => `${i + 1}. ${s}`), '', 'Result: ' + localStepsResult.result].join('\n');
                onSend('Explain this step-by-step solution in simple terms:\n\n' + text);
                setLocalStepsResult(null);
              }}
              onClose={() => setLocalStepsResult(null)}
            />
          )}

          {/* Inline Desmos graph (from detected graph expressions) */}
          {graphExpression && !showGraphs && (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-widest">
                <i className="fa-solid fa-chart-line text-xs" />Auto Graphed From Question
              </div>
              <div className="w-full h-64 md:h-80 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
                <div ref={desmosContainerRef} className="w-full h-full" />
              </div>
            </div>
          )}

          {/* AI response messages */}
          {messages.length > 0 && messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
              <div className={`max-w-full p-6 rounded-[24px] shadow-sm border ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'
              }`}>
                {msg.role === 'assistant'
                  ? <SolutionMessageContent content={msg.content} />
                  : <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                }
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 w-fit shadow-sm">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => <div key={delay} className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}
              </div>
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Calculating...</span>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showHandwriting && (
        <HandwritingCanvas
          onRecognize={handleHandwritingRecognize}
          onClose={() => { handwritingClosedByUserRef.current = true; setShowHandwriting(false); }}
          isRecognizing={handwritingRecognizing}
        />
      )}
      {showVoiceMath && (
        <VoiceToMathModal
          onInsert={latex => { const target = focusedMathFieldRef.current ?? equationRefs.current[0]; if (target) { target.value = latex; target.focus(); } }}
          onClose={() => setShowVoiceMath(false)}
        />
      )}
    </div>
  );
};

export default MathsMode;
