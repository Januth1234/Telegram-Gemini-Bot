import React, { useEffect, useRef, useState } from 'react';
import { Language, GraphDefinition, GraphType, GraphDataSeries } from '../types';
import { translations } from '../translations';
import { casService } from '../services/casService';
import * as PlotlyNS from 'plotly.js-dist-min';
/** Resolve Plotly API for Vite/bundlers that expose it as default */
const Plotly = (PlotlyNS as any).default ?? PlotlyNS;

declare const Desmos: any;

interface GraphsProps {
  mode: 'manual' | 'fromQuestion';
  initialGraph: GraphDefinition | null;
  onGraphsChange: (graph: GraphDefinition) => void;
  onExplainWithAi?: (summary: { type: GraphType; expression?: string; xDomain?: { min: number; max: number } }) => void;
  onClose: () => void;
  lang: Language;
}

const DEFAULT_DOMAIN = { min: -10, max: 10 };

const TABLE_X_MIN = -10;
const TABLE_X_MAX = 10;

const Graphs: React.FC<GraphsProps> = ({ mode, initialGraph, onGraphsChange, onExplainWithAi, onClose, lang }) => {
  const t = translations[lang];
  const [activeType, setActiveType] = useState<GraphType>(initialGraph?.type || 'function');
  const [expression, setExpression] = useState(initialGraph?.expressionLatex || 'y = x');
  const [xDomain, setXDomain] = useState(initialGraph?.xDomain || DEFAULT_DOMAIN);
  const [dataSeries, setDataSeries] = useState<GraphDataSeries[]>(
    initialGraph?.dataSeries || [{ id: 's1', label: 'Series 1', x: [0, 1, 2], y: [0, 1, 4] }],
  );
  const [valueTable, setValueTable] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const desmosRef = useRef<HTMLDivElement | null>(null);
  const desmosCalcRef = useRef<any>(null);
  const plotlyRef = useRef<HTMLDivElement | null>(null);
  const onGraphsChangeRef = useRef(onGraphsChange);
  onGraphsChangeRef.current = onGraphsChange;

  // Initialise Desmos for analytic graphs
  useEffect(() => {
    if (!desmosRef.current || desmosCalcRef.current) return;
    if (!(window as any).Desmos) return;
    try {
      desmosCalcRef.current = (window as any).Desmos.GraphingCalculator(desmosRef.current, {
        expressions: true,
        keypad: true,
        graphpaper: true,
      });
    } catch {
      desmosCalcRef.current = null;
    }
  }, []);

  // Plot function / polar / parametric in Desmos whenever state changes, with analysis overlay
  useEffect(() => {
    if (!desmosCalcRef.current) return;
    if (activeType !== 'function' && activeType !== 'polar' && activeType !== 'parametric') return;
    const latex = expression || 'y = x';
    try {
      desmosCalcRef.current.setBlank();
      desmosCalcRef.current.setExpression({ id: 'main', latex });

      // Function analysis overlay (roots, y-intercept, extrema, asymptotes) for y = f(x)
      if (activeType === 'function' && latex.includes('=')) {
        const analysis = casService.functionAnalysis(latex);
        const calc = desmosCalcRef.current;
        analysis.roots.forEach((x, i) => {
          try { calc.setExpression({ id: `analysis_root_${i}`, latex: `(${x}, 0)`, showLabel: true, label: 'Root' }); } catch { /* ignore */ }
        });
        if (analysis.yIntercept != null && analysis.yIntercept !== 0) {
          try { calc.setExpression({ id: 'analysis_yint', latex: `(0, ${analysis.yIntercept})`, showLabel: true, label: 'y-intercept' }); } catch { /* ignore */ }
        } else if (analysis.yIntercept === 0 && !analysis.roots.includes(0)) {
          try { calc.setExpression({ id: 'analysis_yint', latex: '(0, 0)', showLabel: true, label: 'y-intercept' }); } catch { /* ignore */ }
        }
        analysis.criticalPoints.forEach((x, i) => {
          const y = casService.evaluateRHSAt(latex, x);
          if (y != null) {
            try { calc.setExpression({ id: `analysis_crit_${i}`, latex: `(${x}, ${y})`, showLabel: true, label: 'Extremum' }); } catch { /* ignore */ }
          }
        });
        analysis.verticalAsymptotes.forEach((x, i) => {
          try { calc.setExpression({ id: `analysis_asymp_${i}`, latex: `x = ${x}` }); } catch { /* ignore */ }
        });
      }
    } catch {
      // ignore
    }
  }, [expression, activeType]);

  // Value table for function: x from -10 to 10 in steps of 1, f(x) for each
  useEffect(() => {
    if (activeType !== 'function' || !expression?.includes('=')) {
      setValueTable({ x: [], y: [] });
      return;
    }
    try {
      const x: number[] = [];
      const y: number[] = [];
      for (let xi = TABLE_X_MIN; xi <= TABLE_X_MAX; xi++) {
        x.push(xi);
        const yi = casService.evaluateRHSAt(expression, xi);
        y.push(yi ?? NaN);
      }
      setValueTable({ x, y });
    } catch {
      setValueTable({ x: [], y: [] });
    }
  }, [activeType, expression]);

  // Plot data series in Plotly whenever data changes
  useEffect(() => {
    if (!plotlyRef.current) return;
    if (activeType !== 'data') return;

    const traces = dataSeries.map(series => ({
      x: series.x,
      y: series.y,
      mode: 'markers+lines',
      type: 'scatter',
      name: series.label,
    }));
    const layout: Partial<Plotly.Layout> = {
      margin: { l: 40, r: 10, t: 20, b: 35 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
    };
    Plotly.newPlot(plotlyRef.current, traces, layout, { displayModeBar: false });
  }, [dataSeries, activeType]);

  // Sync outward GraphDefinition whenever core inputs change (use ref for callback to avoid infinite loop when parent passes inline fn)
  useEffect(() => {
    const def: GraphDefinition = {
      id: initialGraph?.id || 'graph-1',
      type: activeType,
      expressionLatex: activeType === 'data' ? undefined : expression,
      xDomain,
      dataSeries: activeType === 'data' ? dataSeries : undefined,
    };
    onGraphsChangeRef.current(def);
  }, [activeType, expression, xDomain, dataSeries, initialGraph?.id]);

  const handleDomainChange = (key: 'min' | 'max', value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setXDomain(prev => ({ ...prev, [key]: num }));
  };

  const handleTableChange = (seriesIndex: number, pointIndex: number, axis: 'x' | 'y', value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setDataSeries(prev => {
      const copy = [...prev];
      const target = { ...copy[seriesIndex] };
      const xs = [...target.x];
      const ys = [...target.y];
      if (axis === 'x') xs[pointIndex] = num;
      else ys[pointIndex] = num;
      target.x = xs;
      target.y = ys;
      copy[seriesIndex] = target;
      return copy;
    });
  };

  const addPoint = (seriesIndex: number) => {
    setDataSeries(prev => {
      const copy = [...prev];
      const s = { ...copy[seriesIndex] };
      s.x = [...s.x, (s.x[s.x.length - 1] ?? 0) + 1];
      s.y = [...s.y, 0];
      copy[seriesIndex] = s;
      return copy;
    });
  };

  const activeLabel =
    activeType === 'function'
      ? 'Function'
      : activeType === 'parametric'
      ? 'Parametric'
      : activeType === 'polar'
      ? 'Polar'
      : 'Data';

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      <aside className="w-full md:w-72 bg-white/80 dark:bg-slate-900/80 border border-black/5 dark:border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Graphs ({mode === 'manual' ? 'Manual' : 'From Question'})</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5"
            aria-label="Close graphs"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        <div className="flex gap-2">
          {(['function', 'data'] as GraphType[]).map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`flex-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                activeType === type
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-white/10'
              }`}
            >
              {type === 'function' ? 'Function' : 'Data'}
            </button>
          ))}
        </div>

        {activeType === 'function' && (
          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Equation (LaTeX or y = f(x))
            </label>
            <input
              value={expression}
              onChange={e => setExpression(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="y = x^2"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">X Min</label>
                <input
                  type="number"
                  value={xDomain.min}
                  onChange={e => handleDomainChange('min', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400">X Max</label>
                <input
                  type="number"
                  value={xDomain.max}
                  onChange={e => handleDomainChange('max', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {activeType === 'data' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Table</span>
              <button
                onClick={() => addPoint(0)}
                className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
              >
                + Point
              </button>
            </div>
            <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-2 py-1 text-left">x</th>
                    <th className="px-2 py-1 text-left">y</th>
                  </tr>
                </thead>
                <tbody>
                  {dataSeries[0].x.map((_, idx) => (
                    <tr key={idx} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={dataSeries[0].x[idx]}
                          onChange={e => handleTableChange(0, idx, 'x', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={dataSeries[0].y[idx]}
                          onChange={e => handleTableChange(0, idx, 'y', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-0.5"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeType === 'function' && (
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Domain and derivative/area analysis can be powered by the local CAS. For now, the graph is drawn directly from the
            equation above.
          </div>
        )}
      </aside>

      <section className="flex-1 rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-slate-900/80 p-3 md:p-4 flex flex-col min-h-[260px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-slate-400" />
            {activeLabel} Graph
          </h3>
          {onExplainWithAi && (
            <button
              onClick={() =>
                onExplainWithAi({
                  type: activeType,
                  expression: activeType === 'data' ? undefined : expression,
                  xDomain,
                })
              }
              className="px-3 py-1 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-slate-700"
              type="button"
            >
              Explain With AI
            </button>
          )}
        </div>
        <div className="flex-1 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-white/10 overflow-hidden">
          {activeType === 'data' ? (
            <div ref={plotlyRef} className="w-full h-full" />
          ) : (
            <div ref={desmosRef} className="w-full h-full" />
          )}
        </div>
        {activeType === 'function' && expression?.includes('=') && valueTable.x.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3 py-2 border-b border-slate-100 dark:border-white/5">
              Value table (x from {TABLE_X_MIN} to {TABLE_X_MAX})
            </h4>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-bold text-slate-600 dark:text-slate-300">x</th>
                    <th className="px-3 py-1.5 text-left font-bold text-slate-600 dark:text-slate-300">f(x)</th>
                  </tr>
                </thead>
                <tbody>
                  {valueTable.x.map((xi, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-3 py-1 font-mono text-slate-700 dark:text-slate-200">{xi}</td>
                      <td className="px-3 py-1 font-mono text-slate-700 dark:text-slate-200">
                        {Number.isFinite(valueTable.y[i]) ? valueTable.y[i] : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Graphs;

