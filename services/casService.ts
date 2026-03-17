import { create, all, MathJsStatic, MathJsChain } from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Solve';
import 'nerdamer/Calculus';
import 'nerdamer/Algebra';
import 'nerdamer/Extra';
import * as jStat from 'jstat';
import {
  derivativeWithSteps as diffSteps,
  integralWithSteps as intSteps,
  solveEquationWithSteps as solveSteps,
  type StepsResult,
} from './casSteps';

const math = create(all, {}) as unknown as MathJsStatic;

export interface SolveResult {
  roots?: number[];
  steps?: string[];
}

export interface StepsResultWithAnswer extends StepsResult {
  result: string;
  steps: string[];
  resultLatex?: string;
}

// Helper: convert LaTeX to math.js parseable string
function latexToMath(latex: string): string {
  let expr = latex || '';
  expr = expr.replace(/\\cdot/g, '*');
  expr = expr.replace(/\\times/g, '*');
  expr = expr.replace(/\\left|\\right/g, '');
  expr = expr.replace(/\\frac\s*{([^}]+)}{([^}]+)}/g, '($1)/($2)');
  expr = expr.replace(/\\sqrt{([^}]+)}/g, 'sqrt($1)');
  expr = expr.replace(/\\pi/g, 'pi');
  expr = expr.replace(/\\,/g, '');
  return expr;
}

function latexToUnitExpr(latex: string): string {
  let s = latex || '';
  s = s.replace(/\\mathrm\s*{([^}]+)}/g, '$1');
  s = s.replace(/\\text\s*{([^}]+)}/g, '$1');
  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\times/g, '*');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\frac\s*{([^}]+)}{([^}]+)}/g, '$1/$2');
  s = s.replace(/\\sqrt{([^}]+)}/g, 'sqrt($1)');
  s = s.replace(/\\pi/g, 'pi');
  s = s.replace(/\\,/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** RREF via Gauss-Jordan elimination. */
function rrefCopy(grid: number[][]): number[][] {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0].length;
  const M = grid.map(row => [...row]);
  let pivotCol = 0;
  for (let r = 0; r < rows && pivotCol < cols; ) {
    let maxRow = r;
    for (let i = r + 1; i < rows; i++) {
      if (Math.abs(M[i][pivotCol]) > Math.abs(M[maxRow][pivotCol])) maxRow = i;
    }
    if (Math.abs(M[maxRow][pivotCol]) < 1e-12) { pivotCol++; continue; }
    [M[r], M[maxRow]] = [M[maxRow], M[r]];
    const pivot = M[r][pivotCol];
    for (let j = 0; j < cols; j++) M[r][j] /= pivot;
    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const factor = M[i][pivotCol];
      for (let j = 0; j < cols; j++) M[i][j] -= factor * M[r][j];
    }
    r++; pivotCol++;
  }
  return M;
}

// ─── casService (plain object — methods called as casService.xxx so `this` is safe) ─────

export const casService = {

  simplify(latex: string): string {
    try {
      const expr = latexToMath(latex);
      const simplified = (math.simplify(expr) as unknown as MathJsChain).toString();
      return simplified;
    } catch { return latex; }
  },

  derivative(latex: string, variable: string = 'x'): string {
    try {
      const expr = latexToMath(latex);
      const d = nerdamer(`diff(${expr}, ${variable})`);
      return d.toTeX();
    } catch { return latex; }
  },

  integral(latex: string, variable: string = 'x'): string {
    try {
      const expr = latexToMath(latex);
      const i = nerdamer(`integrate(${expr}, ${variable})`);
      return i.toTeX();
    } catch { return latex; }
  },

  solveEquation(latex: string, variable: string = 'x'): SolveResult {
    try {
      const expr = latexToMath(latex);
      const roots = nerdamer
        .solve(expr, variable)
        .evaluate()
        .text()
        .split(',')
        .map(parseFloat)
        .filter(v => Number.isFinite(v));
      return { roots };
    } catch { return {}; }
  },

  /** Solve a system of equations. Each equation is LaTeX or plain math. */
  solveEquations(equations: string[], variables?: string[]): { solution?: string; error?: string } {
    try {
      const converted = equations.map(eq => latexToMath(eq.trim())).filter(Boolean);
      if (converted.length === 0) return { error: 'No equations' };
      // FIX: nerdamer.solveEquations may not exist on all builds; guard it
      const nerd = nerdamer as any;
      if (typeof nerd.solveEquations !== 'function') {
        return { error: 'System solve not available; try individual equations' };
      }
      const vars = variables ?? (converted.length === 1 ? ['x'] : undefined);
      const sol = nerd.solveEquations(
        converted.length === 1 ? converted[0] : converted,
        vars
      );
      const text = sol && typeof sol.toString === 'function' ? sol.toString() : String(sol);
      return text ? { solution: text } : { error: 'No solution found' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  },

  evaluateAt(latex: string, variable: string, x: number): number | null {
    try {
      const expr = latexToMath(latex);
      const scope: Record<string, number> = { [variable]: x };
      const val = math.evaluate(expr, scope) as number;
      return typeof val === 'number' && Number.isFinite(val) ? val : null;
    } catch { return null; }
  },

  buildPlotSamples(latex: string, variable: string, min: number, max: number, steps: number = 100): { x: number[]; y: number[] } {
    const xs: number[] = [], ys: number[] = [];
    if (max <= min || steps <= 1) return { x: xs, y: ys };
    const stepSize = (max - min) / (steps - 1);
    for (let i = 0; i < steps; i++) {
      const x = min + i * stepSize;
      const y = casService.evaluateAt(latex, variable, x);
      if (y != null && Number.isFinite(y)) { xs.push(x); ys.push(y); }
    }
    return { x: xs, y: ys };
  },

  mean(values: number[]): number | null {
    if (!values.length) return null;
    try { return jStat.mean(values); } catch { return null; }
  },

  std(values: number[]): number | null {
    if (!values.length) return null;
    try { return jStat.stdev(values, true); } catch { return null; }
  },

  /** Differentiation with step-by-step rules. */
  derivativeWithSteps(latex: string, variable: string = 'x'): StepsResultWithAnswer | null {
    try {
      const expr = latexToMath(latex);
      const out = diffSteps(expr, variable);
      if (out && out.steps.length > 0) return { result: out.result, steps: out.steps, resultLatex: out.resultLatex };
      const fallback = casService.derivative(latex, variable);
      return { result: fallback, steps: [] };
    } catch { return null; }
  },

  /** Integration with substitution / rule steps. */
  integralWithSteps(latex: string, variable: string = 'x'): StepsResultWithAnswer | null {
    try {
      const expr = latexToMath(latex);
      const stepOut = intSteps(expr, variable);
      let resultTex = '';
      try {
        const i = nerdamer(`integrate(${expr}, ${variable})`);
        resultTex = i.toTeX();
      } catch {}
      const steps = [...(stepOut?.steps ?? [])];
      if (resultTex && steps.length > 0) steps.push(`Result: $${resultTex}$`);
      else if (resultTex) steps.push(`∫(${expr}) d${variable} = ${resultTex}`);
      return { result: resultTex || stepOut?.result || '', steps, resultLatex: resultTex || undefined };
    } catch { return null; }
  },

  /** Equation solve with algebraic manipulation steps. */
  solveEquationWithSteps(latex: string, variable: string = 'x'): (SolveResult & { steps: string[] }) | null {
    try {
      const expr = latexToMath(latex);
      const stepOut = solveSteps(expr, variable);
      let roots: number[] = [];
      try {
        roots = nerdamer
          .solve(expr, variable)
          .evaluate()
          .text()
          .split(',')
          .map(parseFloat)
          .filter(v => Number.isFinite(v));
      } catch {}
      const steps = [...(stepOut?.steps ?? [])];
      if (roots.length > 0 && steps.length <= 1) {
        steps.push(`Solution: ${variable} = ${roots.join(', ')}`);
      }
      // Prefer CAS-detected roots, fallback to nerdamer
      const finalRoots = (stepOut as any)?.roots?.length ? (stepOut as any).roots : roots;
      return { roots: finalRoots, steps };
    } catch { return null; }
  },

  /** Unit-aware evaluation for physics. */
  evaluateWithUnits(expr: string): { result: string; error?: string } {
    try {
      const s = latexToUnitExpr(expr?.trim() || '');
      if (!s) return { error: 'Empty expression' };
      const value = math.evaluate(s);
      if (value == null) return { error: 'No result' };
      const unit = value as any;
      if (typeof unit?.toString === 'function' && (unit.units || unit.unit)) return { result: unit.toString() };
      if (typeof value === 'number' && Number.isFinite(value)) return { result: String(value) };
      if (typeof value === 'object' && value !== null && 'toString' in value) return { result: String((value as { toString(): string }).toString()) };
      return { result: String(value) };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  // ── Matrix ops ──────────────────────────────────────────────────────────────

  matrixDet(grid: number[][]): { value?: number; error?: string } {
    try { const v = math.det(math.matrix(grid)); return { value: typeof v === 'number' ? v : Number(v) }; }
    catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  matrixInv(grid: number[][]): { matrix?: number[][]; error?: string } {
    try { return { matrix: (math.inv(math.matrix(grid)) as any).toArray() as number[][] }; }
    catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  matrixEigs(grid: number[][]): { values?: number[]; eigenvectors?: number[][][]; error?: string } {
    try {
      const out = math.eigs(math.matrix(grid), { eigenvectors: true });
      const values = (out.values as any).toArray ? (out.values as any).toArray() : Array.isArray(out.values) ? out.values : [];
      const vectors = (out.eigenvectors || []).map((ev: any) => (ev.vector?.toArray ? ev.vector.toArray() : ev.vector));
      return { values: values.map((x: number) => Number(x)), eigenvectors: vectors };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  matrixRank(grid: number[][]): { rank?: number; error?: string } {
    try {
      const rref = rrefCopy(grid);
      let rank = 0;
      for (const row of rref) { if (row.some((x: number) => Math.abs(x) > 1e-10)) rank++; }
      return { rank };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  matrixRref(grid: number[][]): { matrix?: number[][]; error?: string } {
    try { return { matrix: rrefCopy(grid) }; }
    catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  // ── Number theory ──────────────────────────────────────────────────────────

  primeFactors(n: number): { factors?: [number, number][]; result?: string; error?: string } {
    try {
      const x = Math.floor(Math.abs(Number(n)));
      if (x < 2 || !Number.isFinite(x)) return { error: 'Need integer ≥ 2' };
      const factors: [number, number][] = [];
      let rest = x;
      for (let p = 2; p * p <= rest; p++) { let count = 0; while (rest % p === 0) { rest /= p; count++; } if (count) factors.push([p, count]); }
      if (rest > 1) factors.push([rest, 1]);
      const result = factors.map(([p, k]) => k === 1 ? String(p) : `${p}^${k}`).join(' × ');
      return { factors, result };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  gcd(a: number, b: number): { value?: number; error?: string } {
    try {
      const x = Math.floor(Math.abs(Number(a))), y = Math.floor(Math.abs(Number(b)));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'Need two integers' };
      return { value: Number(math.gcd(x, y)) };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  lcm(a: number, b: number): { value?: number; error?: string } {
    try {
      const x = Math.floor(Math.abs(Number(a))), y = Math.floor(Math.abs(Number(b)));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'Need two integers' };
      return { value: Number(math.lcm(x, y)) };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  mod(a: number, m: number): { value?: number; error?: string } {
    try {
      const x = Number(a), mVal = Math.floor(Math.abs(Number(m)));
      if (!Number.isFinite(x) || !mVal) return { error: 'Need number and non-zero modulus' };
      return { value: Number(math.mod(x, mVal)) };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  baseConvert(input: string, toBase: 2 | 8 | 10 | 16): { value?: string; error?: string } {
    try {
      const s = (input || '').trim().replace(/\s+/g, '');
      let num: number;
      if (/^0x[\da-fA-F]+$/.test(s)) num = parseInt(s, 16);
      else if (/^0b[01]+$/.test(s)) num = parseInt(s.slice(2), 2);
      else if (/^0o?[0-7]+$/.test(s)) num = parseInt(s.replace(/^0o?/, ''), 8);
      else num = parseInt(s, 10);
      if (!Number.isFinite(num) || num < 0) return { error: 'Invalid number' };
      if (toBase === 2) return { value: '0b' + num.toString(2) };
      if (toBase === 8) return { value: '0o' + num.toString(8) };
      if (toBase === 16) return { value: '0x' + num.toString(16).toUpperCase() };
      return { value: String(num) };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  },

  // FIX: evaluateRHSAt and getFunctionRHS defined as normal methods (not using `this`)
  // so they work safely whether called via casService.xxx or destructured
  evaluateRHSAt(latex: string, x: number): number | null {
    try {
      const s = (latex || '').trim();
      const eq = s.indexOf('=');
      const rhs = eq >= 0 ? s.slice(eq + 1).trim() : s;
      const expr = latexToMath(rhs);
      const y = math.evaluate(expr, { x });
      return typeof y === 'number' && Number.isFinite(y) ? y : null;
    } catch { return null; }
  },

  getFunctionRHS(latex: string): string {
    const s = (latex || '').trim();
    const eq = s.indexOf('=');
    const rhs = eq >= 0 ? s.slice(eq + 1).trim() : s;
    return latexToMath(rhs);
  },

  /** Function analysis for graphing: roots, y-intercept, critical points, vertical asymptotes. */
  functionAnalysis(latex: string): { roots: number[]; yIntercept: number | null; criticalPoints: number[]; verticalAsymptotes: number[] } {
    const roots: number[] = [], criticalPoints: number[] = [], verticalAsymptotes: number[] = [];
    let yIntercept: number | null = null;
    try {
      const expr = casService.getFunctionRHS(latex);
      if (!expr) return { roots, yIntercept, criticalPoints, verticalAsymptotes };

      try {
        const sol = nerdamer.solve(expr, 'x');
        const text = sol.evaluate().text().replace(/^\[|\]$/g, '');
        text.split(',').forEach(s => { const n = parseFloat(s.trim()); if (Number.isFinite(n)) roots.push(n); });
      } catch {}

      try { const y0 = math.evaluate(expr, { x: 0 }); yIntercept = typeof y0 === 'number' && Number.isFinite(y0) ? y0 : null; } catch { yIntercept = null; }

      try {
        const deriv = nerdamer(`diff(${expr}, x)`).toString();
        const sol = nerdamer.solve(deriv, 'x');
        const text = sol.evaluate().text().replace(/^\[|\]$/g, '');
        text.split(',').forEach(s => { const n = parseFloat(s.trim()); if (Number.isFinite(n)) criticalPoints.push(n); });
      } catch {}

      try {
        const denomMatch = expr.match(/\/\s*\(([^()]+)\)|\/\s*\(\(([^()]*)\)\)/);
        if (denomMatch) {
          const denom = denomMatch[1] || denomMatch[2] || '';
          const sol = nerdamer.solve(denom, 'x');
          const text = sol.evaluate().text().replace(/^\[|\]$/g, '');
          text.split(',').forEach(s => { const n = parseFloat(s.trim()); if (Number.isFinite(n)) verticalAsymptotes.push(n); });
        }
      } catch {}
    } catch {}
    return { roots, yIntercept, criticalPoints, verticalAsymptotes };
  },
};

/** Format a 2D matrix as LaTeX \begin{pmatrix}...\end{pmatrix} for KaTeX. */
export function matrixToPmatrix(grid: number[][]): string {
  if (!grid.length) return '\\begin{pmatrix}\\end{pmatrix}';
  const rows = grid.map(row =>
    row.map(x => {
      const n = Number(x);
      if (Number.isInteger(n)) return String(n);
      const s = Number.isFinite(n) ? n.toPrecision(6).replace(/\.?0+e?$/, '') : String(x);
      return s.includes('.') || s.includes('e') ? s : String(n);
    }).join(' & ')
  );
  return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
}
