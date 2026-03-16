import { WorkspaceMode, GraphDefinition } from "../types";

// Very lightweight, deterministic graph intent detector.
// It looks for obvious \"plot/graph\" phrases or y = f(x)-style patterns.
export function detectGraphIntent(
  text: string,
  mode: WorkspaceMode
): GraphDefinition | null {
  const raw = (text || "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  // Quick exit if nothing hinting at graphing.
  if (!/graph|plot|sketch|draw/i.test(lower) && !/\by\s*=/i.test(raw)) {
    return null;
  }

  // If user explicitly says \"graph\" or \"plot\", try to grab the expression after that word.
  const graphMatch = raw.match(/(?:graph|plot|sketch|draw)\s+(.+)/i);
  if (graphMatch && graphMatch[1]) {
    const expr = graphMatch[1].trim();
    if (isPlausibleExpression(expr)) {
      return {
        id: "graph-from-text",
        type: "function",
        expressionLatex: expr,
        xDomain: { min: -10, max: 10 },
      };
    }
  }

  // Fallback: look for a y = ... style line.
  const yEqMatch = raw.match(/y\s*=\s*([^;]+)/i);
  if (yEqMatch && yEqMatch[1]) {
    const expr = `y = ${yEqMatch[1].trim()}`;
    if (isPlausibleExpression(expr)) {
      return {
        id: "graph-from-text",
        type: "function",
        expressionLatex: expr,
        xDomain: { min: -10, max: 10 },
      };
    }
  }

  return null;
}

function isPlausibleExpression(expr: string): boolean {
  // Very small sanity check: contains at least one variable and one operator/number.
  const hasVar = /[a-zA-Z]/.test(expr);
  const hasOpOrNum = /[\d+\-*/^()]/.test(expr);
  return hasVar && hasOpOrNum;
}

