/**
 * Parses assistant solution content into multiple solution methods for tabbed display.
 * Supports delimiter-based format (---METHOD: name --- ... ---ENDMETHOD---) and
 * fallback header patterns (## Method N: ..., **Method N: ...**).
 */

export interface SolutionMethod {
  label: string;
  content: string;
}

const DELIMITER_START = /---METHOD:\s*([^\-]+?)---/gi;
const DELIMITER_END = /---ENDMETHOD---/gi;

/**
 * Splits content by ---METHOD: Name --- ... ---ENDMETHOD--- and returns array of { label, content }.
 * If no delimiters found, tries to split by ## Method N: or **Method N: ** style headers.
 */
export function parseSolutionMethods(content: string): SolutionMethod[] | null {
  if (!content || !content.trim()) return null;

  const trimmed = content.trim();

  // 1) Delimiter-based: ---METHOD: Name --- ... ---ENDMETHOD---
  const byDelimiter = splitByDelimiters(trimmed);
  if (byDelimiter.length > 1) return byDelimiter;

  // 2) Markdown-style: ## Method 1: Substitution ... ## Method 2: ...
  const byMarkdown = splitByMarkdownHeaders(trimmed);
  if (byMarkdown.length > 1) return byMarkdown;

  // 3) Bold-style: **Method 1: Substitution** ... **Method 2: ...
  const byBold = splitByBoldHeaders(trimmed);
  if (byBold.length > 1) return byBold;

  return null;
}

function splitByDelimiters(text: string): SolutionMethod[] {
  const methods: SolutionMethod[] = [];
  let remaining = text;
  let startMatch = DELIMITER_START.exec(remaining);

  while (startMatch) {
    const label = startMatch[1].trim() || `Method ${methods.length + 1}`;
    const afterStart = remaining.slice(startMatch.index + startMatch[0].length);
    DELIMITER_END.lastIndex = 0;
    const endMatch = DELIMITER_END.exec(afterStart);
    const content = endMatch ? afterStart.slice(0, endMatch.index).trim() : afterStart.trim();
    if (content) methods.push({ label, content });
    remaining = endMatch ? afterStart.slice(endMatch.index + endMatch[0].length) : '';
    DELIMITER_START.lastIndex = 0;
    startMatch = DELIMITER_START.exec(remaining);
  }

  return methods;
}

function splitByMarkdownHeaders(text: string): SolutionMethod[] {
  // Match ## Method 1: Name or ## Method 1 - Name or ## 1. Name
  const headerRe = /^#{1,3}\s*(?:Method\s*)?\d*[.:\-\s]+(.+)$/gm;
  const parts: { label: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  headerRe.lastIndex = 0;
  while ((m = headerRe.exec(text)) !== null) {
    parts.push({ label: m[1].trim(), start: m.index });
  }
  if (parts.length < 2) return [];
  const methods: SolutionMethod[] = [];
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].start;
    const end = i < parts.length - 1 ? parts[i + 1].start : text.length;
    const content = text.slice(start, end).trim();
    if (content) methods.push({ label: parts[i].label, content });
  }
  return methods;
}

function splitByBoldHeaders(text: string): SolutionMethod[] {
  const headerRe = /\*\*Method\s*\d*[.:\-\s]*(.+?)\*\*/g;
  const parts: { label: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  headerRe.lastIndex = 0;
  while ((m = headerRe.exec(text)) !== null) {
    parts.push({ label: m[1].trim(), start: m.index });
  }
  if (parts.length < 2) return [];
  const methods: SolutionMethod[] = [];
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].start;
    const end = i < parts.length - 1 ? parts[i + 1].start : text.length;
    const content = text.slice(start, end).trim();
    if (content) methods.push({ label: parts[i].label, content });
  }
  return methods;
}

// ---------------------------------------------------------------------------
// Structured math solution parsing (---METHOD: ... --- ... ---ENDMETHOD---)
// ---------------------------------------------------------------------------

export interface MathMethod {
  name: string;
  steps: string;
}

export interface ParsedMathResponse {
  preamble: string;
  methods: MathMethod[];
  verification?: string;
}

export function isMathSolution(content: string): boolean {
  if (!content) return false;
  return content.includes('---METHOD:') || content.includes('---ENDMETHOD---');
}

export function parseMathResponse(content: string): ParsedMathResponse {
  const text = content || '';
  const methodRegex = /---METHOD:\s*(.+?)\s*---([\s\S]*?)---ENDMETHOD---/g;
  const methods: MathMethod[] = [];
  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(text)) !== null) {
    methods.push({
      name: match[1].trim(),
      steps: match[2].trim(),
    });
  }

  const firstMethodIndex = text.indexOf('---METHOD:');
  const preamble =
    firstMethodIndex > 0 ? text.slice(0, firstMethodIndex).trim() : '';

  const verificationMatch = text.match(/VERIFICATION[:\s]+([\s\S]+?)$/i);
  const verification = verificationMatch
    ? verificationMatch[1].trim()
    : undefined;

  return { preamble, methods, verification };
}
