/**
 * Step-by-step CAS: differentiation, integration, and equation solving.
 * Builds explicit working steps for students (rules, substitutions, manipulations).
 */
import { create, all, MathJsStatic } from 'mathjs';

const math = create(all, {}) as unknown as MathJsStatic;

export type MathNode = import('mathjs').MathNode;

export interface StepsResult {
  result: string;
  steps: string[];
  resultLatex?: string;
}

/** Convert node to readable string (for step text). */
function nodeStr(n: MathNode): string {
  try {
    return n.toString();
  } catch {
    return '…';
  }
}

/** Recursively differentiate and record the rule applied at each step. */
function diffWithSteps(node: MathNode, variable: string, steps: string[]): MathNode {
  const n = node as any;
  const expr = nodeStr(node);

  if (n.type === 'ConstantNode') {
    steps.push(`Constant rule: d/d${variable}(${expr}) = 0`);
    return math.parse('0');
  }

  if (n.type === 'SymbolNode') {
    if (n.name === variable) {
      steps.push(`d/d${variable}(${variable}) = 1`);
      return math.parse('1');
    }
    steps.push(`Treat "${n.name}" as constant: d/d${variable}(${expr}) = 0`);
    return math.parse('0');
  }

  if (n.type === 'OperatorNode') {
    const fn = n.fn as string;
    const opArgs = n.args as MathNode[];

    if (fn === 'add') {
      const [u, v] = args;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Sum rule: d/d${variable}(${nodeStr(u)} + ${nodeStr(v)}) = d/d${variable}(${nodeStr(u)}) + d/d${variable}(${nodeStr(v)})`);
      return math.parse(`(${du.toString()}) + (${dv.toString()})`);
    }

    if (fn === 'subtract') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Difference rule: d/d${variable}(${nodeStr(u)} - ${nodeStr(v)}) = d/d${variable}(${nodeStr(u)}) - d/d${variable}(${nodeStr(v)})`);
      return math.parse(`(${du.toString()}) - (${dv.toString()})`);
    }

    if (fn === 'multiply') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Product rule: d/d${variable}(u·v) = u'·v + u·v' applied to ${nodeStr(u)} · ${nodeStr(v)}`);
      return math.parse(`((${du.toString()}) * (${v.toString()}) + ((${u.toString()}) * (${dv.toString()}))`);
    }

    if (fn === 'divide') {
      const [u, v] = opArgs;
      const du = diffWithSteps(u, variable, steps);
      const dv = diffWithSteps(v, variable, steps);
      steps.push(`Quotient rule: d/d${variable}(u/v) = (u'·v - u·v')/v² applied to (${nodeStr(u)})/(${nodeStr(v)})`);
      return math.parse(`(((${du.toString()}) * (${v.toString()}) - ((${u.toString()}) * (${dv.toString()}))) / ((${v.toString()}) ^ 2)`);
    }

    if (fn === 'pow') {
      const [base, exp] = opArgs;
      const baseStr = nodeStr(base);
      const expStr = nodeStr(exp);
      const dBase = diffWithSteps(base, variable, steps);
      const dExp = diffWithSteps(exp, variable, steps);
      const isConstExp = (exp as any).type === 'ConstantNode';
      const isConstBase = (base as any).type === 'ConstantNode';
      if (isConstExp && !isConstBase) {
        steps.push(`Power rule (chain): d/d${variable}(${baseStr}^${expStr}) = ${expStr}·${baseStr}^(${expStr}-1)·d/d${variable}(${baseStr})`);
        return math.parse(`(${expStr}) * ((${base.toString()}) ^ (${expStr} - 1)) * (${dBase.toString()})`);
      }
      if (isConstBase && !isConstExp) {
        steps.push(`Exponential rule: d/d${variable}(${baseStr}^${expStr}) = ${baseStr}^${expStr}·ln(${baseStr})·d/d${variable}(${expStr})`);
        return math.parse(`((${base.toString()}) ^ (${exp.toString()})) * log(${base.toString()}) * (${dExp.toString()})`);
      }
      steps.push(`Power rule (general): differentiating ${baseStr}^${expStr} using chain rule`);
      const inner = math.parse(`((${base.toString()}) ^ (${exp.toString()}))`);
      return diffWithSteps(inner, variable, steps);
    }

    if (fn === 'unaryMinus') {
      const u = opArgs[0];
      const du = diffWithSteps(u, variable, steps);
      steps.push(`Constant multiple: d/d${variable}(-${nodeStr(u)}) = -d/d${variable}(${nodeStr(u)})`);
      return math.parse(`-(${du.toString()})`);
    }
  }

  if (n.type === 'FunctionNode') {
    const fname = (n.fn as any).name || '';
    const args = n.args as MathNode[];
    const arg = args[0];
    const argStr = nodeStr(arg);
    const dArg = diffWithSteps(arg, variable, steps);

    if (fname === 'sin') {
      steps.push(`Chain rule: d/d${variable}(sin(${argStr})) = cos(${argStr})·d/d${variable}(${argStr})`);
      return math.parse(`cos(${arg.toString()}) * (${dArg.toString()})`);
    }
    if (fname === 'cos') {
      steps.push(`Chain rule: d/d${variable}(cos(${argStr})) = -sin(${argStr})·d/d${variable}(${argStr})`);
      return math.parse(`(-sin(${arg.toString()})) * (${dArg.toString()})`);
    }
    if (fname === 'tan') {
      steps.push(`Chain rule: d/d${variable}(tan(${argStr})) = sec²(${argStr})·d/d${variable}(${argStr})`);
      return math.parse(`(1 / (cos(${arg.toString()}) ^ 2)) * (${dArg.toString()})`);
    }
    if (fname === 'exp') {
      steps.push(`Exponential rule: d/d${variable}(exp(${argStr})) = exp(${argStr})·d/d${variable}(${argStr})`);
      return math.parse(`exp(${arg.toString()}) * (${dArg.toString()})`);
    }
    if (fname === 'log' || fname === 'ln') {
      steps.push(`Log rule: d/d${variable}(ln(${argStr})) = (1/(${argStr}))·d/d${variable}(${argStr})`);
      return math.parse(`(1 / (${arg.toString()})) * (${dArg.toString()})`);
    }
    if (fname === 'sqrt') {
      steps.push(`Chain rule: d/d${variable}(sqrt(${argStr})) = 1/(2·sqrt(${argStr}))·d/d${variable}(${argStr})`);
      return math.parse(`(1 / (2 * sqrt(${arg.toString()}))) * (${dArg.toString()})`);
    }
    if (fname === 'log10') {
      steps.push(`Log rule: d/d${variable}(log(${argStr})) = 1/((${argStr})·ln(10))·d/d${variable}(${argStr})`);
      return math.parse(`(1 / ((${arg.toString()}) * log(10))) * (${dArg.toString()})`);
    }
  }

  if (n.type === 'ParenthesisNode') {
    return diffWithSteps(n.content, variable, steps);
  }

  // Fallback: use math.derivative for this node's expression and record one step
  try {
    const derived = math.derivative(node, variable);
    steps.push(`Differentiate: ${expr} → ${derived.toString()}`);
    return derived;
  } catch {
    steps.push(`Apply differentiation rules to ${expr}`);
    return math.parse('0');
  }
}

/** Differentiation with step-by-step working. */
export function derivativeWithSteps(exprMath: string, variable: string = 'x'): StepsResult | null {
  try {
    const node = math.parse(exprMath);
    const steps: string[] = [];
    steps.push(`Given: find d/d${variable}(${nodeStr(node)})`);
    const resultNode = diffWithSteps(node, variable, steps);
    const result = (math.simplify(resultNode) as any).toString();
    steps.push(`Simplify: ${result}`);
    let resultLatex: string | undefined;
    try {
      resultLatex = resultNode.toTex();
    } catch {
      // ignore
    }
    return { result, steps, resultLatex };
  } catch {
    return null;
  }
}

/** Integration: show substitution steps where we can detect them. */
export function integralWithSteps(exprMath: string, variable: string = 'x'): StepsResult | null {
  try {
    const steps: string[] = [];
    steps.push(`Given: ∫(${exprMath}) d${variable}`);

    // Try to detect simple power: x^n -> x^(n+1)/(n+1)
    const powMatch = exprMath.match(new RegExp(`^\\s*${variable}\\s*\\^\\s*([^\\s]+)\\s*$`));
    if (powMatch) {
      const n = powMatch[1];
      steps.push(`Power rule for integration: ∫${variable}^n d${variable} = ${variable}^(n+1)/(n+1) with n = ${n}`);
      const nVal = parseFloat(n);
      if (Number.isFinite(nVal) && nVal !== -1) {
        steps.push(`= ${variable}^(${nVal + 1})/(${nVal + 1}) + C`);
        const result = `${variable}^(${nVal + 1})/(${nVal + 1})`;
        return { result, steps };
      }
    }

    // Try k*f(x) with constant k
    const prodMatch = exprMath.match(/^\s*(\d+(?:\.\d+)?)\s*\*\s*(.+)$/);
    if (prodMatch) {
      steps.push(`Constant multiple: ∫k·f(${variable}) d${variable} = k·∫f(${variable}) d${variable}`);
    }

    // Fallback: state we're integrating and delegate to nerdamer for result
    steps.push(`Applying integration rules (substitution, parts, or standard forms).`);
    return { result: '', steps }; // caller will fill result from nerdamer
  } catch {
    return null;
  }
}

/** Linear equation ax + b = 0: show algebraic manipulation steps. */
function solveLinearSteps(a: number, b: number, variable: string): string[] {
  const steps: string[] = [];
  steps.push(`Linear equation: ${a}${variable} + ${b} = 0`);
  if (a === 0) {
    steps.push(b === 0 ? 'All real numbers satisfy 0 = 0.' : 'No solution (contradiction).');
    return steps;
  }
  steps.push(`Subtract ${b} from both sides: ${a}${variable} = ${-b}`);
  steps.push(`Divide both sides by ${a}: ${variable} = ${-b}/${a} = ${-b / a}`);
  return steps;
}

/** Equation solving with step-by-step algebraic manipulation. */
export function solveEquationWithSteps(
  exprMath: string,
  variable: string = 'x'
): StepsResult & { roots?: number[] } | null {
  try {
    const steps: string[] = [];
    const eq = exprMath.trim();
    const hasEquals = eq.includes('=');
    if (!hasEquals) {
      steps.push(`Interpret as equation: ${eq} = 0`);
    } else {
      steps.push(`Given: ${eq}`);
    }

    // Normalize to LHS - RHS = 0 for parsing (we'll use nerdamer for actual solve)
    const normalized = hasEquals ? eq.replace('=', '-(') + ')' : eq;
    const sides = eq.split('=');
    const lhs = (sides[0] || eq).trim();
    const rhs = (sides[1] || '0').trim();

    // Try to detect linear: collect coefficients of variable
    const linearMatch = lhs.match(new RegExp(`^\\s*([+-]?\\d*\\.?\\d*)\\s*\\*?\\s*${variable}\\s*([+-]\\s*\\d+\\.?\\d*)?\\s*$`));
    if (linearMatch) {
      const aStr = (linearMatch[1] || '1').replace(/\s/g, '');
      const bStr = (linearMatch[2] || '0').replace(/\s/g, '');
      const a = parseFloat(aStr === '' || aStr === '+' ? '1' : aStr === '-' ? '-1' : aStr);
      const b = parseFloat(bStr || '0');
      const target = rhs ? parseFloat(rhs) : 0;
      const stepsLinear = solveLinearSteps(a, b - target, variable);
      steps.push(...stepsLinear);
      const roots = a !== 0 ? [(target - b) / a] : [];
      return { result: roots.length ? String(roots[0]) : '', steps, roots };
    }

    steps.push(`Rearrange and solve for ${variable} (algebraic manipulation or quadratic formula).`);
    return { result: '', steps };
  } catch {
    return null;
  }
}
