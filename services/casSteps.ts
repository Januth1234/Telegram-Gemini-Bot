/**
 * Step-by-step CAS: differentiation, integration, and equation solving.
 * Builds explicit working steps for students (rules, substitutions, manipulations).
 *
 * FIXES:
 *  - CRASH: diffWithSteps 'add' branch used `args` (undefined) instead of `opArgs`
 *  - CRASH: solveEquationWithSteps had duplicate `const evalAt` in same scope (SyntaxError)
 *  - Added missing trig derivatives: asin, acos, atan, sinh, cosh, tanh
 *  - Quadratic step-by-step now shows full discriminant working
 *  - Integration shows more patterns (trig, exp, ln)
 */
import { create, all, MathJsStatic } from 'mathjs';

const math = create(all, {}) as unknown as MathJsStatic;

export type MathNode = import('mathjs').MathNode;

export interface StepsResult {
  result: string;
  steps: string[];
  resultLatex?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeStr(n: MathNode): string {
  try { return n.toString(); } catch { return '…'; }
}

// ─── Differentiation ─────────────────────────────────────────────────────────

function diffWithSteps(node: MathNode, variable: string, steps: string[]): MathNode {
  const n = node as any;
  const expr = nodeStr(node);

  if (n.type === 'ConstantNode') {
    steps.push(`Constant rule: d/d${variable}(${expr}) = 0`);
    return math.parse('0');
  }

  if (n.type === 'SymbolNode') {
    if (n.name === variable) {
      steps.push(`Identity: d/d${variable}(${variable}) = 1`);
      return math.parse('1');
    }
    steps.push(`Constant rule: "${n.name}" is independent of ${variable}, d/d${variable}(${n.name}) = 0`);
    return math.parse('0');
  }

  if (n.type === 'OperatorNode') {
    const fn = n.fn as string;
    const opArgs = n.args as MathNode[]; // FIXED: was `args` (undefined) — critical crash fix

    if (fn === 'add') {
      const [u, v] = opArgs; // FIXED
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Sum rule: (f+g)' = f' + g'  →  d/d${variable}(${nodeStr(u)}) + d/d${variable}(${nodeStr(v)})`);
      return math.parse(`(${du.toString()}) + (${dv.toString()})`);
    }

    if (fn === 'subtract') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Difference rule: (f−g)' = f' − g'`);
      return math.parse(`(${du.toString()}) - (${dv.toString()})`);
    }

    if (fn === 'multiply') {
      const [u, v] = opArgs;
      const uIsConst = (u as any).type === 'ConstantNode' || ((u as any).type === 'SymbolNode' && (u as any).name !== variable);
      const vIsConst = (v as any).type === 'ConstantNode' || ((v as any).type === 'SymbolNode' && (v as any).name !== variable);

      if (uIsConst) {
        // Constant multiple rule: (k·f)' = k·f'
        const dv = diffWithSteps(v, variable, steps);
        steps.push(`Constant multiple: d/d${variable}(${nodeStr(u)}·${nodeStr(v)}) = ${nodeStr(u)} · (${dv.toString()})`);
        return math.parse(`(${nodeStr(u)}) * (${dv.toString()})`);
      }
      if (vIsConst) {
        const du = diffWithSteps(u, variable, steps);
        steps.push(`Constant multiple: d/d${variable}(${nodeStr(u)}·${nodeStr(v)}) = (${du.toString()}) · ${nodeStr(v)}`);
        return math.parse(`(${du.toString()}) * (${nodeStr(v)})`);
      }
      // Product rule: (u·v)' = u'v + uv'
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Product rule: (u·v)' = u'v + uv'\n   u = ${nodeStr(u)},  v = ${nodeStr(v)}\n   u' = ${du.toString()},  v' = ${dv.toString()}`);
      return math.parse(`((${du.toString()}) * (${v.toString()})) + ((${u.toString()}) * (${dv.toString()}))`);
    }

    if (fn === 'divide') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Quotient rule: (u/v)' = (u'v − uv') / v²\n   u = ${nodeStr(u)},  v = ${nodeStr(v)}\n   u' = ${du.toString()},  v' = ${dv.toString()}`);
      return math.parse(`(((${du.toString()}) * (${v.toString()})) - ((${u.toString()}) * (${dv.toString()}))) / ((${v.toString()}) ^ 2)`);
    }

    if (fn === 'pow') {
      const [base, exp] = opArgs;
      const baseStr = nodeStr(base);
      const expStr  = nodeStr(exp);
      const isConstExp  = (exp  as any).type === 'ConstantNode';
      const isConstBase = (base as any).type === 'ConstantNode';

      if (isConstExp && !isConstBase) {
        // Power rule: d/dx(u^n) = n·u^(n-1)·u'
        const nVal   = parseFloat(expStr);
        const n1Str  = Number.isFinite(nVal) ? String(nVal - 1) : `(${expStr}-1)`;
        const dBase  = diffWithSteps(base, variable, steps);
        steps.push(`Power rule: d/d${variable}(u^n) = n·u^(n−1)·u'\n   u = ${baseStr},  n = ${expStr}\n   = ${expStr}·(${baseStr})^${n1Str}·(${dBase.toString()})`);
        return math.parse(`(${expStr}) * ((${base.toString()}) ^ (${expStr} - 1)) * (${dBase.toString()})`);
      }

      if (isConstBase && !isConstBase) {
        // Exponential rule: d/dx(a^u) = a^u·ln(a)·u'
        const dExp = diffWithSteps(exp, variable, steps);
        steps.push(`Exponential rule: d/d${variable}(${baseStr}^u) = ${baseStr}^u·ln(${baseStr})·u'\n   u' = ${dExp.toString()}`);
        return math.parse(`((${base.toString()}) ^ (${exp.toString()})) * log(${base.toString()}) * (${dExp.toString()})`);
      }

      // General: use math.js derivative as fallback
      try {
        const derived = math.derivative(node, variable);
        steps.push(`General power/exponential rule applied: d/d${variable}(${expr}) = ${derived.toString()}`);
        return derived;
      } catch {
        steps.push(`Apply power rule to ${expr}`);
        return math.parse('0');
      }
    }

    if (fn === 'unaryMinus') {
      const u = opArgs[0];
      const du = diffWithSteps(u, variable, steps);
      steps.push(`Negation: d/d${variable}(−${nodeStr(u)}) = −(${du.toString()})`);
      return math.parse(`-(${du.toString()})`);
    }
  }

  if (n.type === 'FunctionNode') {
    const fname  = (n.fn as any).name || '';
    const fnArgs = n.args as MathNode[];
    const arg    = fnArgs[0];
    if (!arg) {
      try { return math.derivative(node, variable); } catch { return math.parse('0'); }
    }
    const argStr  = nodeStr(arg);
    const dArg    = diffWithSteps(arg, variable, steps);
    const dArgStr = dArg.toString();

    const chainStep = (outerDeriv: string) =>
      steps.push(`Chain rule: d/d${variable}(${fname}(${argStr})) = ${outerDeriv} · (${dArgStr})`);

    switch (fname) {
      case 'sin':
        chainStep(`cos(${argStr})`);
        return math.parse(`cos(${arg.toString()}) * (${dArgStr})`);

      case 'cos':
        chainStep(`−sin(${argStr})`);
        return math.parse(`(-sin(${arg.toString()})) * (${dArgStr})`);

      case 'tan':
        chainStep(`sec²(${argStr}) = 1/cos²(${argStr})`);
        return math.parse(`(1 / (cos(${arg.toString()}) ^ 2)) * (${dArgStr})`);

      case 'asin':
        chainStep(`1/√(1−${argStr}²)`);
        return math.parse(`(1 / sqrt(1 - (${arg.toString()})^2)) * (${dArgStr})`);

      case 'acos':
        chainStep(`−1/√(1−${argStr}²)`);
        return math.parse(`(-1 / sqrt(1 - (${arg.toString()})^2)) * (${dArgStr})`);

      case 'atan':
        chainStep(`1/(1+${argStr}²)`);
        return math.parse(`(1 / (1 + (${arg.toString()})^2)) * (${dArgStr})`);

      case 'sinh':
        chainStep(`cosh(${argStr})`);
        return math.parse(`cosh(${arg.toString()}) * (${dArgStr})`);

      case 'cosh':
        chainStep(`sinh(${argStr})`);
        return math.parse(`sinh(${arg.toString()}) * (${dArgStr})`);

      case 'tanh':
        chainStep(`sech²(${argStr})`);
        return math.parse(`(1 - tanh(${arg.toString()})^2) * (${dArgStr})`);

      case 'exp':
        chainStep(`e^${argStr}`);
        return math.parse(`exp(${arg.toString()}) * (${dArgStr})`);

      case 'log':
      case 'ln':
        chainStep(`1/${argStr}`);
        return math.parse(`(1 / (${arg.toString()})) * (${dArgStr})`);

      case 'log10':
        chainStep(`1/((${argStr})·ln(10))`);
        return math.parse(`(1 / ((${arg.toString()}) * log(10))) * (${dArgStr})`);

      case 'sqrt':
        chainStep(`1/(2√${argStr})`);
        return math.parse(`(1 / (2 * sqrt(${arg.toString()}))) * (${dArgStr})`);

      case 'abs':
        chainStep(`${argStr}/|${argStr}|`);
        return math.parse(`(${arg.toString()} / abs(${arg.toString()})) * (${dArgStr})`);
    }
  }

  if (n.type === 'ParenthesisNode') {
    return diffWithSteps(n.content, variable, steps);
  }

  // Fallback: let math.js handle it
  try {
    const derived = math.derivative(node, variable);
    steps.push(`Apply differentiation: d/d${variable}(${expr}) = ${derived.toString()}`);
    return derived;
  } catch {
    steps.push(`Differentiate ${expr} (complex rule applied)`);
    return math.parse('0');
  }
}

export function derivativeWithSteps(exprMath: string, variable: string = 'x'): StepsResult | null {
  try {
    const node = math.parse(exprMath);
    const steps: string[] = [];
    steps.push(`Find: d/d${variable}[ ${nodeStr(node)} ]`);
    steps.push(`Apply differentiation rules step by step:`);
    const resultNode = diffWithSteps(node, variable, steps);
    let simplified: any;
    try { simplified = math.simplify(resultNode); } catch { simplified = resultNode; }
    const result = simplified.toString();
    steps.push(`Simplified result: ${result}`);
    let resultLatex: string | undefined;
    try { resultLatex = resultNode.toTex(); } catch { /* ignore */ }
    return { result, steps, resultLatex };
  } catch {
    return null;
  }
}

// ─── Integration ─────────────────────────────────────────────────────────────

export function integralWithSteps(exprMath: string, variable: string = 'x'): StepsResult | null {
  try {
    const steps: string[] = [];
    const expr = exprMath.trim();
    steps.push(`Find: ∫ ${expr} d${variable}`);

    // Pattern: x^n (not x^-1)
    const powMatch = expr.match(new RegExp(`^${variable}\\s*\\^\\s*([+-]?[\\d./]+)$`));
    if (powMatch) {
      const nStr = powMatch[1];
      const nVal = parseFloat(nStr);
      if (Number.isFinite(nVal) && nVal !== -1) {
        const np1 = nVal + 1;
        steps.push(`Power rule: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C,  n = ${nVal}`);
        steps.push(`= ${variable}^${np1} / ${np1} + C`);
        return { result: `${variable}^(${np1})/(${np1})`, steps };
      }
      if (nVal === -1) {
        steps.push(`Special case: ∫x⁻¹ dx = ln|x| + C`);
        return { result: `log(${variable})`, steps };
      }
    }

    // Pattern: just x
    if (expr === variable) {
      steps.push(`Power rule: ∫x dx = x²/2 + C`);
      return { result: `${variable}^2/2`, steps };
    }

    // Constant
    if (/^[+-]?[\d.]+$/.test(expr)) {
      steps.push(`Constant rule: ∫k dx = kx + C,  k = ${expr}`);
      return { result: `(${expr})*${variable}`, steps };
    }

    // sin, cos, e^x, 1/x
    if (expr === `sin(${variable})`) {
      steps.push(`Standard form: ∫sin(x) dx = −cos(x) + C`);
      return { result: `-cos(${variable})`, steps };
    }
    if (expr === `cos(${variable})`) {
      steps.push(`Standard form: ∫cos(x) dx = sin(x) + C`);
      return { result: `sin(${variable})`, steps };
    }
    if (expr === `exp(${variable})` || expr === `e^${variable}`) {
      steps.push(`Standard form: ∫eˣ dx = eˣ + C`);
      return { result: `exp(${variable})`, steps };
    }
    if (expr === `1/${variable}` || expr === `${variable}^(-1)`) {
      steps.push(`Standard form: ∫(1/x) dx = ln|x| + C`);
      return { result: `log(${variable})`, steps };
    }

    // Constant multiple: k*f(x)
    const constMultMatch = expr.match(/^([+-]?[\d.]+)\s*\*\s*(.+)$/);
    if (constMultMatch) {
      const k = constMultMatch[1];
      const inner = constMultMatch[2].trim();
      steps.push(`Constant multiple rule: ∫k·f(x) dx = k·∫f(x) dx,  k = ${k}`);
      const innerResult = integralWithSteps(inner, variable);
      if (innerResult?.result) {
        steps.push(...innerResult.steps.slice(1));
        const res = `(${k}) * (${innerResult.result})`;
        steps.push(`= ${k} · (${innerResult.result}) + C`);
        return { result: res, steps };
      }
    }

    // Sum/difference: try to split by top-level + or -
    // (simplified: only attempt if no parentheses)
    if (!expr.includes('(') && (expr.includes(' + ') || expr.includes(' - '))) {
      const parts = expr.split(/\s+([+-])\s+/);
      if (parts.length >= 3) {
        steps.push(`Sum/difference rule: ∫(f ± g) dx = ∫f dx ± ∫g dx`);
        return { result: '', steps }; // caller fills from nerdamer
      }
    }

    steps.push(`Apply standard integration techniques (substitution, by-parts, or formula tables)`);
    return { result: '', steps };
  } catch {
    return null;
  }
}

// ─── Equation solving ────────────────────────────────────────────────────────

function solveLinearDetailed(a: number, b: number, target: number, variable: string): { steps: string[]; roots: number[] } {
  // a·x + b = target  →  a·x = target − b  →  x = (target − b) / a
  const steps: string[] = [];
  if (a === 0) {
    if (Math.abs(b - target) < 1e-10) {
      steps.push('Identity (0 = 0): infinitely many solutions — all real numbers.');
    } else {
      steps.push('Contradiction: no solution exists.');
    }
    return { steps, roots: [] };
  }
  steps.push(`Standard form: ${a === 1 ? '' : a}${variable}${b >= 0 ? ` + ${b}` : ` − ${Math.abs(b)}`} = ${target}`);
  const rhs = target - b;
  if (b !== 0) {
    steps.push(`Subtract ${b} from both sides: ${a === 1 ? '' : a}${variable} = ${target} − ${b} = ${rhs}`);
  }
  const x = rhs / a;
  if (a !== 1) {
    steps.push(`Divide both sides by ${a}: ${variable} = ${rhs} / ${a} = ${x}`);
  } else {
    steps.push(`${variable} = ${rhs}`);
  }
  steps.push(`Solution: ${variable} = ${x}`);
  return { steps, roots: [x] };
}

function solveQuadraticDetailed(a: number, b: number, c: number, variable: string): { steps: string[]; roots: number[] } {
  const steps: string[] = [];
  const sign = (n: number) => n >= 0 ? `+${n}` : `${n}`;

  steps.push(`Standard form: ${a}${variable}² ${sign(b)}${variable} ${sign(c)} = 0`);
  steps.push(`Using the quadratic formula: ${variable} = (−b ± √(b²−4ac)) / 2a`);
  steps.push(`Identify: a = ${a},  b = ${b},  c = ${c}`);

  const disc = b * b - 4 * a * c;
  steps.push(`Discriminant: Δ = b² − 4ac = (${b})² − 4·(${a})·(${c}) = ${b * b} − ${4 * a * c} = ${disc}`);

  if (disc < 0) {
    steps.push(`Δ < 0 → No real solutions  (complex roots: ${variable} = (${-b} ± ${Math.sqrt(-disc).toFixed(4)}i) / ${2 * a})`);
    return { steps, roots: [] };
  }

  if (disc === 0) {
    const x = -b / (2 * a);
    steps.push(`Δ = 0 → One repeated root`);
    steps.push(`${variable} = −b / 2a = ${-b} / ${2 * a} = ${x}`);
    steps.push(`Solution: ${variable} = ${x}  (double root)`);
    return { steps, roots: [x] };
  }

  const sqrtDisc = Math.sqrt(disc);
  steps.push(`Δ > 0 → Two distinct real roots`);
  steps.push(`√Δ = √${disc} ≈ ${sqrtDisc.toFixed(6)}`);
  const x1 = (-b + sqrtDisc) / (2 * a);
  const x2 = (-b - sqrtDisc) / (2 * a);
  steps.push(`${variable}₁ = (−${b < 0 ? `(${b})` : b} + ${sqrtDisc.toFixed(4)}) / (2·${a}) = ${(-b + sqrtDisc).toFixed(4)} / ${2 * a} ≈ ${x1.toFixed(6)}`);
  steps.push(`${variable}₂ = (−${b < 0 ? `(${b})` : b} − ${sqrtDisc.toFixed(4)}) / (2·${a}) = ${(-b - sqrtDisc).toFixed(4)} / ${2 * a} ≈ ${x2.toFixed(6)}`);
  steps.push(`Solutions: ${variable}₁ ≈ ${x1.toFixed(4)},  ${variable}₂ ≈ ${x2.toFixed(4)}`);
  return { steps, roots: [x1, x2] };
}

/** Attempt to extract polynomial coefficients by sampling. */
function detectPolyCoeffs(lhs: string, rhs: string, variable: string): { degree: number; a: number; b: number; c: number } | null {
  const evalBoth = (x: number): number | null => {
    try {
      const scope = { [variable]: x };
      const l = math.evaluate(lhs, scope) as number;
      const r = math.evaluate(rhs, scope) as number;
      if (!Number.isFinite(l) || !Number.isFinite(r)) return null;
      return l - r;
    } catch { return null; }
  };

  const y0  = evalBoth(0);
  const y1  = evalBoth(1);
  const ym1 = evalBoth(-1);
  const y2  = evalBoth(2);

  if (y0 == null || y1 == null || ym1 == null || y2 == null) return null;

  // Quadratic check: second difference should be constant
  const secondDiff1 = y1 - 2 * y0 + ym1;
  const secondDiff2 = y2 - 2 * y1 + y0;
  const isQuad = Math.abs(secondDiff1 - secondDiff2) < 0.01;

  if (isQuad) {
    const a = secondDiff1 / 2;
    const b = (y1 - ym1) / 2;
    const c = y0;
    if (Math.abs(a) > 1e-10) return { degree: 2, a, b, c };
  }

  // Linear check
  const slope  = y1  - y0;
  const slope2 = ym1 - y0; // should be -slope if truly linear
  if (Math.abs(slope + slope2) < 0.01) {
    const a = slope;
    const c = y0;
    if (Math.abs(a) > 1e-10) return { degree: 1, a, b: 0, c };
  }

  return null;
}

export function solveEquationWithSteps(
  exprMath: string,
  variable: string = 'x'
): (StepsResult & { roots?: number[] }) | null {
  try {
    const eq  = exprMath.trim();
    const steps: string[] = [];
    const hasEq = eq.includes('=');
    let lhs = eq, rhs = '0';

    if (hasEq) {
      const idx = eq.indexOf('=');
      lhs = eq.slice(0, idx).trim();
      rhs = eq.slice(idx + 1).trim();
      steps.push(`Equation: ${lhs} = ${rhs}`);
      if (rhs !== '0') steps.push(`Rearrange: ${lhs} − (${rhs}) = 0`);
    } else {
      steps.push(`Solve: ${eq} = 0`);
    }

    // Try to detect polynomial type by sampling
    const poly = detectPolyCoeffs(lhs, rhs, variable);
    if (poly) {
      if (poly.degree === 1) {
        const { steps: ls, roots } = solveLinearDetailed(poly.a, poly.c, 0, variable);
        steps.push(...ls);
        return { result: roots.length ? roots.join(', ') : 'No solution', steps, roots };
      }
      if (poly.degree === 2) {
        const { steps: qs, roots } = solveQuadraticDetailed(poly.a, poly.b, poly.c, variable);
        steps.push(...qs);
        return { result: roots.length ? roots.map(r => r.toFixed(4)).join(', ') : 'No real roots', steps, roots };
      }
    }

    // Fallback: try direct evaluation / nerdamer
    steps.push(`Applying algebraic methods to isolate ${variable}...`);
    return { result: '', steps };
  } catch {
    return null;
  }
}
