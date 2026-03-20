/**
 * Step-by-step CAS: differentiation, integration, and equation solving.
 *
 * KEY FIX: Functions now return null when they can't produce REAL steps
 * (instead of returning generic placeholder text like "Applying algebraic
 * methods to isolate theta...").  MathsMode detects null → escalates to AI.
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

/** Returns true when a steps array contains only generic placeholder strings */
export function isGenericSteps(steps: string[]): boolean {
  const GENERIC = [
    'algebraic methods',
    'isolate',
    'rearrang',
    'moving all terms',
    'standard integration techniques',
    'further analysis',
  ];
  if (steps.length === 0) return true;
  const joined = steps.join(' ').toLowerCase();
  return GENERIC.some(g => joined.includes(g));
}

// ─── Differentiation ─────────────────────────────────────────────────────────

function diffWithSteps(node: MathNode, variable: string, steps: string[]): MathNode {
  const n = node as any;
  const expr = nodeStr(node);

  if (n.type === 'ConstantNode') {
    steps.push(`d/d${variable}(${expr}) = 0  [Constant rule]`);
    return math.parse('0');
  }

  if (n.type === 'SymbolNode') {
    if (n.name === variable) {
      steps.push(`d/d${variable}(${variable}) = 1  [Identity]`);
      return math.parse('1');
    }
    steps.push(`d/d${variable}(${n.name}) = 0  [${n.name} is constant w.r.t. ${variable}]`);
    return math.parse('0');
  }

  if (n.type === 'OperatorNode') {
    const fn = n.fn as string;
    const opArgs = n.args as MathNode[]; // FIXED: was `args` (undefined) in original

    if (fn === 'add') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Sum rule: (f+g)' = f' + g'`);
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
      const uIsConst = (u as any).type === 'ConstantNode';
      const vIsConst = (v as any).type === 'ConstantNode';
      if (uIsConst) {
        const dv = diffWithSteps(v, variable, steps);
        steps.push(`Constant multiple: ${nodeStr(u)} · d/d${variable}(${nodeStr(v)}) = ${nodeStr(u)} · (${dv.toString()})`);
        return math.parse(`(${nodeStr(u)}) * (${dv.toString()})`);
      }
      if (vIsConst) {
        const du = diffWithSteps(u, variable, steps);
        steps.push(`Constant multiple: d/d${variable}(${nodeStr(u)}) · ${nodeStr(v)} = (${du.toString()}) · ${nodeStr(v)}`);
        return math.parse(`(${du.toString()}) * (${nodeStr(v)})`);
      }
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Product rule: (u·v)' = u'v + uv'\n   u=${nodeStr(u)}, v=${nodeStr(v)}\n   = (${du.toString()})·(${nodeStr(v)}) + (${nodeStr(u)})·(${dv.toString()})`);
      return math.parse(`((${du.toString()}) * (${v.toString()})) + ((${u.toString()}) * (${dv.toString()}))`);
    }
    if (fn === 'divide') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Quotient rule: (u/v)' = (u'v − uv') / v²\n   u=${nodeStr(u)}, v=${nodeStr(v)}`);
      return math.parse(`(((${du.toString()}) * (${v.toString()})) - ((${u.toString()}) * (${dv.toString()}))) / ((${v.toString()}) ^ 2)`);
    }
    if (fn === 'pow') {
      const [base, exp] = opArgs;
      const baseStr = nodeStr(base);
      const expStr  = nodeStr(exp);
      const isConstExp  = (exp  as any).type === 'ConstantNode';
      const isConstBase = (base as any).type === 'ConstantNode';
      if (isConstExp && !isConstBase) {
        const nVal  = parseFloat(expStr);
        const n1Str = Number.isFinite(nVal) ? String(nVal - 1) : `(${expStr}−1)`;
        const dBase = diffWithSteps(base, variable, steps);
        steps.push(`Power rule: d/d${variable}(u^${expStr}) = ${expStr}·u^${n1Str}·u'\n   u=${baseStr}, u'=${dBase.toString()}`);
        return math.parse(`(${expStr}) * ((${base.toString()}) ^ (${expStr} - 1)) * (${dBase.toString()})`);
      }
      if (isConstBase && !isConstExp) {
        const dExp = diffWithSteps(exp, variable, steps);
        steps.push(`Exponential rule: d/d${variable}(${baseStr}^u) = ${baseStr}^u·ln(${baseStr})·u'\n   u'=${dExp.toString()}`);
        return math.parse(`((${base.toString()}) ^ (${exp.toString()})) * log(${base.toString()}) * (${dExp.toString()})`);
      }
      try {
        const derived = math.derivative(node, variable);
        steps.push(`General power/exponential: d/d${variable}(${expr}) = ${derived.toString()}`);
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
    if (!arg) { try { return math.derivative(node, variable); } catch { return math.parse('0'); } }
    const argStr  = nodeStr(arg);
    const dArg    = diffWithSteps(arg, variable, steps);
    const dArgStr = dArg.toString();
    const chainStep = (outerDeriv: string) =>
      steps.push(`Chain rule: d/d${variable}(${fname}(${argStr})) = ${outerDeriv} · (${dArgStr})`);

    switch (fname) {
      case 'sin':   chainStep(`cos(${argStr})`);                     return math.parse(`cos(${arg.toString()}) * (${dArgStr})`);
      case 'cos':   chainStep(`−sin(${argStr})`);                    return math.parse(`(-sin(${arg.toString()})) * (${dArgStr})`);
      case 'tan':   chainStep(`sec²(${argStr})`);                    return math.parse(`(1/(cos(${arg.toString()})^2)) * (${dArgStr})`);
      case 'asin':  chainStep(`1/√(1−${argStr}²)`);                 return math.parse(`(1/sqrt(1-(${arg.toString()})^2)) * (${dArgStr})`);
      case 'acos':  chainStep(`−1/√(1−${argStr}²)`);                return math.parse(`(-1/sqrt(1-(${arg.toString()})^2)) * (${dArgStr})`);
      case 'atan':  chainStep(`1/(1+${argStr}²)`);                   return math.parse(`(1/(1+(${arg.toString()})^2)) * (${dArgStr})`);
      case 'sinh':  chainStep(`cosh(${argStr})`);                    return math.parse(`cosh(${arg.toString()}) * (${dArgStr})`);
      case 'cosh':  chainStep(`sinh(${argStr})`);                    return math.parse(`sinh(${arg.toString()}) * (${dArgStr})`);
      case 'tanh':  chainStep(`sech²(${argStr}) = 1−tanh²(${argStr})`); return math.parse(`(1-tanh(${arg.toString()})^2) * (${dArgStr})`);
      case 'exp':   chainStep(`e^(${argStr})`);                      return math.parse(`exp(${arg.toString()}) * (${dArgStr})`);
      case 'log': case 'ln': chainStep(`1/(${argStr})`);             return math.parse(`(1/(${arg.toString()})) * (${dArgStr})`);
      case 'log10': chainStep(`1/((${argStr})·ln10)`);               return math.parse(`(1/((${arg.toString()})*log(10))) * (${dArgStr})`);
      case 'sqrt':  chainStep(`1/(2√(${argStr}))`);                  return math.parse(`(1/(2*sqrt(${arg.toString()}))) * (${dArgStr})`);
      case 'abs':   chainStep(`${argStr}/|${argStr}|`);              return math.parse(`(${arg.toString()}/abs(${arg.toString()})) * (${dArgStr})`);
    }
  }

  if (n.type === 'ParenthesisNode') return diffWithSteps(n.content, variable, steps);

  try {
    const derived = math.derivative(node, variable);
    steps.push(`Differentiate ${expr} → ${derived.toString()}`);
    return derived;
  } catch {
    steps.push(`Apply differentiation to ${expr}`);
    return math.parse('0');
  }
}

export function derivativeWithSteps(exprMath: string, variable: string = 'x'): StepsResult | null {
  try {
    const node = math.parse(exprMath);
    const steps: string[] = [];
    steps.push(`Find: d/d${variable}[ ${nodeStr(node)} ]`);
    const resultNode = diffWithSteps(node, variable, steps);
    let simplified: any;
    try { simplified = math.simplify(resultNode); } catch { simplified = resultNode; }
    const result = simplified.toString();
    steps.push(`Simplified: ${result}`);
    // Only return real steps (not generic)
    if (isGenericSteps(steps) || !result || result === '0' && steps.length < 3) return null;
    let resultLatex: string | undefined;
    try { resultLatex = resultNode.toTex(); } catch {}
    return { result, steps, resultLatex };
  } catch {
    return null; // Let AI handle it
  }
}

// ─── Integration ─────────────────────────────────────────────────────────────

export function integralWithSteps(exprMath: string, variable: string = 'x'): StepsResult | null {
  try {
    const steps: string[] = [];
    const expr = exprMath.trim();
    steps.push(`Find: ∫ ${expr} d${variable}`);

    // x^n
    const powMatch = expr.match(new RegExp(`^${variable}\\s*\\^\\s*([+-]?[\\d./]+)$`));
    if (powMatch) {
      const nVal = parseFloat(powMatch[1]);
      if (Number.isFinite(nVal) && nVal !== -1) {
        const np1 = nVal + 1;
        steps.push(`Power rule: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C`);
        steps.push(`n = ${nVal},  n+1 = ${np1}`);
        steps.push(`= ${variable}^${np1} / ${np1} + C`);
        return { result: `${variable}^(${np1})/(${np1})`, steps };
      }
      if (nVal === -1) {
        steps.push(`Special case n=−1: ∫x⁻¹ dx = ln|x| + C`);
        return { result: `log(${variable})`, steps };
      }
    }
    // Just x
    if (expr === variable) {
      steps.push(`Power rule: ∫x dx = x²/2 + C`);
      return { result: `${variable}^2/2`, steps };
    }
    // Constant
    if (/^[+-]?[\d.]+$/.test(expr)) {
      steps.push(`Constant rule: ∫k dx = kx + C,  k = ${expr}`);
      return { result: `(${expr})*${variable}`, steps };
    }
    // Standard forms
    const standards: Array<[string, string, string]> = [
      [`sin(${variable})`, `-cos(${variable}) + C`, `∫sin(x) dx = −cos(x) + C`],
      [`cos(${variable})`, `sin(${variable}) + C`,  `∫cos(x) dx = sin(x) + C`],
      [`tan(${variable})`, `-log(cos(${variable})) + C`, `∫tan(x) dx = −ln|cos(x)| + C`],
      [`exp(${variable})`, `exp(${variable}) + C`, `∫eˣ dx = eˣ + C`],
      [`e^${variable}`,    `exp(${variable}) + C`, `∫eˣ dx = eˣ + C`],
      [`1/${variable}`,    `log(${variable}) + C`, `∫(1/x) dx = ln|x| + C`],
      [`${variable}^(-1)`, `log(${variable}) + C`, `∫x⁻¹ dx = ln|x| + C`],
      [`sec(${variable})^2`, `tan(${variable}) + C`, `∫sec²(x) dx = tan(x) + C`],
      [`csc(${variable})^2`, `-cot(${variable}) + C`, `∫csc²(x) dx = −cot(x) + C`],
    ];
    for (const [pattern, result, note] of standards) {
      if (expr === pattern) { steps.push(`Standard form: ${note}`); return { result, steps }; }
    }
    // Constant multiple: k*f(x)
    const constMultMatch = expr.match(/^([+-]?[\d.]+)\s*\*\s*(.+)$/);
    if (constMultMatch) {
      const k = constMultMatch[1], inner = constMultMatch[2].trim();
      steps.push(`Constant multiple rule: ∫k·f(x) dx = k·∫f(x) dx,  k = ${k}`);
      const innerResult = integralWithSteps(inner, variable);
      if (innerResult?.result) {
        steps.push(...innerResult.steps.slice(1));
        steps.push(`= ${k}·(${innerResult.result}) + C`);
        return { result: `(${k})*(${innerResult.result})`, steps };
      }
    }

    // CAS couldn't handle it — return null so AI takes over
    return null;
  } catch {
    return null;
  }
}

// ─── Equation solving ─────────────────────────────────────────────────────────

function solveLinearDetailed(a: number, b: number, target: number, variable: string): { steps: string[]; roots: number[] } {
  const steps: string[] = [];
  if (a === 0) {
    steps.push(Math.abs(b - target) < 1e-10 ? 'Identity (0 = 0): infinitely many solutions.' : 'Contradiction: no solution exists.');
    return { steps, roots: [] };
  }
  const sign = (n: number) => n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
  steps.push(`Standard form: ${a === 1 ? '' : a}${variable} ${sign(b)} = ${target}`);
  const rhs = target - b;
  if (b !== 0) steps.push(`Subtract ${b >= 0 ? b : `(${b})`} from both sides: ${a === 1 ? '' : a}${variable} = ${target} − ${b} = ${rhs}`);
  const x = rhs / a;
  if (a !== 1) steps.push(`Divide both sides by ${a}: ${variable} = ${rhs} / ${a} = ${x}`);
  else steps.push(`${variable} = ${rhs}`);
  steps.push(`✓ Solution: ${variable} = ${x}`);
  return { steps, roots: [x] };
}

function solveQuadraticDetailed(a: number, b: number, c: number, variable: string): { steps: string[]; roots: number[] } {
  const steps: string[] = [];
  const sign = (n: number) => n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
  steps.push(`Standard form: ${a}${variable}² ${sign(b)}${variable} ${sign(c)} = 0`);
  steps.push(`Quadratic formula: ${variable} = (−b ± √(b²−4ac)) / 2a`);
  steps.push(`Coefficients: a = ${a},  b = ${b},  c = ${c}`);
  const disc = b * b - 4 * a * c;
  steps.push(`Discriminant: Δ = b² − 4ac`);
  steps.push(`   = (${b})² − 4·(${a})·(${c})`);
  steps.push(`   = ${b * b} − ${4 * a * c} = ${disc}`);
  if (disc < 0) {
    const im = Math.sqrt(-disc).toFixed(4);
    steps.push(`Δ < 0 → No real roots`);
    steps.push(`Complex roots: ${variable} = (${-b} ± ${im}i) / ${2 * a}`);
    return { steps, roots: [] };
  }
  if (disc === 0) {
    const x = -b / (2 * a);
    steps.push(`Δ = 0 → One repeated root`);
    steps.push(`${variable} = −b / 2a = ${-b} / ${2 * a} = ${x}`);
    steps.push(`✓ Solution: ${variable} = ${x}  (double root)`);
    return { steps, roots: [x] };
  }
  const sqrtDisc = Math.sqrt(disc);
  steps.push(`Δ > 0 → Two distinct real roots`);
  steps.push(`√Δ = √${disc} ≈ ${sqrtDisc.toFixed(6)}`);
  const x1 = (-b + sqrtDisc) / (2 * a);
  const x2 = (-b - sqrtDisc) / (2 * a);
  steps.push(`${variable}₁ = (−(${b}) + ${sqrtDisc.toFixed(4)}) / (2·${a}) ≈ ${x1.toFixed(6)}`);
  steps.push(`${variable}₂ = (−(${b}) − ${sqrtDisc.toFixed(4)}) / (2·${a}) ≈ ${x2.toFixed(6)}`);
  steps.push(`✓ Solutions: ${variable}₁ ≈ ${x1.toFixed(4)},  ${variable}₂ ≈ ${x2.toFixed(4)}`);
  return { steps, roots: [x1, x2] };
}

function detectPolyCoeffs(lhs: string, rhs: string, variable: string): { degree: number; a: number; b: number; c: number } | null {
  const evalBoth = (x: number): number | null => {
    try {
      const scope = { [variable]: x };
      const l = math.evaluate(lhs, scope) as number;
      const r = math.evaluate(rhs, scope) as number;
      return Number.isFinite(l) && Number.isFinite(r) ? l - r : null;
    } catch { return null; }
  };
  const y0 = evalBoth(0), y1 = evalBoth(1), ym1 = evalBoth(-1), y2 = evalBoth(2);
  if (y0 == null || y1 == null || ym1 == null || y2 == null) return null;
  // Quadratic check
  const sd1 = y1 - 2 * y0 + ym1, sd2 = y2 - 2 * y1 + y0;
  if (Math.abs(sd1 - sd2) < 0.01) {
    const a = sd1 / 2, b = (y1 - ym1) / 2, c = y0;
    if (Math.abs(a) > 1e-10) return { degree: 2, a, b, c };
  }
  // Linear check
  if (Math.abs((y1 - y0) + (ym1 - y0)) < 0.01) {
    const a = y1 - y0, c = y0;
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
    // If it contains trig, log, complex expressions — return null immediately
    // so AI handles it properly with full working
    const hasTrig = /\b(sin|cos|tan|csc|sec|cot|asin|acos|atan|sinh|cosh|tanh|theta|phi|alpha|beta|gamma)\b/i.test(eq);
    const hasLog  = /\b(log|ln|exp)\b/i.test(eq);
    const hasComplex = /\bi\b/.test(eq);
    if (hasTrig || hasLog || hasComplex) return null; // Escalate to AI

    const steps: string[] = [];
    const hasEq = eq.includes('=');
    let lhs = eq, rhs = '0';
    if (hasEq) {
      const idx = eq.indexOf('=');
      lhs = eq.slice(0, idx).trim();
      rhs = eq.slice(idx + 1).trim();
      steps.push(`Equation: ${lhs} = ${rhs}`);
      if (rhs !== '0') steps.push(`Rearrange: move all terms left → ${lhs} − (${rhs}) = 0`);
    } else {
      steps.push(`Solve: ${eq} = 0`);
    }

    const poly = detectPolyCoeffs(lhs, rhs, variable);
    if (poly) {
      if (poly.degree === 2) {
        const { steps: qs, roots } = solveQuadraticDetailed(poly.a, poly.b, poly.c, variable);
        steps.push(...qs);
        if (steps.length < 4) return null; // Not enough real steps
        return { result: roots.length ? roots.map(r => r.toFixed(4)).join(', ') : 'No real roots', steps, roots };
      }
      if (poly.degree === 1) {
        const { steps: ls, roots } = solveLinearDetailed(poly.a, poly.c, 0, variable);
        steps.push(...ls);
        if (steps.length < 3) return null;
        return { result: roots.length ? String(roots[0]) : 'No solution', steps, roots };
      }
    }

    // CAS cannot produce real steps → return null so AI handles it
    return null;
  } catch {
    return null;
  }
}
