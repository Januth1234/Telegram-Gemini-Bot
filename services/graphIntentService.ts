import { WorkspaceMode, GraphDefinition } from "../types";

export function detectGraphIntent(
  text: string,
  mode: WorkspaceMode
): GraphDefinition | null {
  const raw = (text || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // Must mention graphing in some form
  const hasGraphKeyword = /graph|plot|sketch|draw|graphically|using graph|with graph|via graph|visual/i.test(lower);
  if (!hasGraphKeyword && !/\by\s*=/i.test(raw)) return null;

  // Try to extract an explicit expression after the keyword
  const graphMatch = raw.match(/(?:graph|plot|sketch|draw)\s+(.+)/i);
  if (graphMatch?.[1]) {
    const expr = graphMatch[1].trim();
    if (isPlausibleExpression(expr)) {
      return { id: "graph-from-text", type: "function", expressionLatex: expr, xDomain: { min: -10, max: 10 } };
    }
  }

  // y = ... anywhere in text
  const yEqMatch = raw.match(/y\s*=\s*([^;\n,]+)/i);
  if (yEqMatch?.[1]) {
    const expr = `y = ${yEqMatch[1].trim()}`;
    if (isPlausibleExpression(expr)) {
      return { id: "graph-from-text", type: "function", expressionLatex: expr, xDomain: { min: -10, max: 10 } };
    }
  }

  // "solve for x ... graph" type — no explicit expression but has graph intent
  // Route to maths mode with empty expression so graphs tab opens
  if (hasGraphKeyword) {
    // Try to extract any equation-like fragment  
    const eqMatch = raw.match(/([\w\s+\-*/^=()]+=[\w\s+\-*/^()]+)/);
    if (eqMatch?.[0] && isPlausibleExpression(eqMatch[0])) {
      return { id: "graph-from-text", type: "function", expressionLatex: eqMatch[0].trim(), xDomain: { min: -10, max: 10 } };
    }
    // No equation found — still route to graphs tab (user will enter it there)
    return { id: "graph-intent-only", type: "function", expressionLatex: "", xDomain: { min: -10, max: 10 } };
  }

  return null;
}

function isPlausibleExpression(expr: string): boolean {
  const hasVar = /[a-zA-Z]/.test(expr);
  const hasOpOrNum = /[\d+\-*/^()]/.test(expr);
  return hasVar && hasOpOrNum && expr.length > 1;
}
