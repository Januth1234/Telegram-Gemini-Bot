/**
 * Math Expression Input Validator
 * Validates mathematical expressions before processing to prevent crashes,
 * infinite loops, and stack overflows from malformed input.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

interface ValidationConfig {
  maxLength?: number;
  maxNestingDepth?: number;
  maxNumberValue?: number;
  minNumberValue?: number;
}

const DEFAULT_CONFIG: ValidationConfig = {
  maxLength: 1000,        // Reasonable limit for math expressions
  maxNestingDepth: 50,    // Prevent stack overflow from deeply nested expressions
  maxNumberValue: 1e308,  // JavaScript max finite number
  minNumberValue: 1e-308, // JavaScript min positive number
};

/**
 * Validate a mathematical expression for safety and reasonableness
 */
export function validateMathInput(
  input: string,
  config: ValidationConfig = {}
): ValidationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      error: 'Input must be a non-empty string',
    };
  }

  const trimmed = input.trim();

  // Check length
  if (trimmed.length > cfg.maxLength!) {
    return {
      isValid: false,
      error: `Expression is too long (max ${cfg.maxLength} characters)`,
      suggestion: `Try breaking it into smaller parts`,
    };
  }

  // Check for empty or whitespace-only input
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Please enter a mathematical expression',
    };
  }

  // Check nesting depth (count parentheses)
  const nestingDepth = checkNestingDepth(trimmed);
  if (nestingDepth > cfg.maxNestingDepth!) {
    return {
      isValid: false,
      error: `Expression has too many nested parentheses (max ${cfg.maxNestingDepth})`,
      suggestion: 'Try using simpler expressions',
    };
  }

  // Check for suspicious patterns that indicate invalid input
  const suspiciousCheck = checkSuspiciousPatterns(trimmed);
  if (suspiciousCheck.error) {
    return suspiciousCheck;
  }

  // Check for unbalanced brackets
  const bracketCheck = checkBalancedBrackets(trimmed);
  if (bracketCheck.error) {
    return bracketCheck;
  }

  // Check for numbers that are too large/small
  const numberCheck = checkNumberRanges(trimmed, cfg);
  if (numberCheck.error) {
    return numberCheck;
  }

  return { isValid: true };
}

/**
 * Count maximum nesting depth of parentheses/brackets
 */
function checkNestingDepth(expr: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of expr) {
    if (char === '(' || char === '[' || char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === ')' || char === ']' || char === '}') {
      currentDepth--;
    }
  }

  return maxDepth;
}

/**
 * Check for unbalanced brackets/parentheses
 */
function checkBalancedBrackets(expr: string): ValidationResult {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (const char of expr) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char === ')' || char === ']' || char === '}') {
      const expected = pairs[char];
      if (stack.length === 0 || stack[stack.length - 1] !== expected) {
        return {
          isValid: false,
          error: `Unbalanced brackets: found '${char}' without matching '${expected}'`,
        };
      }
      stack.pop();
    }
  }

  if (stack.length > 0) {
    return {
      isValid: false,
      error: `Unclosed bracket: '${stack[stack.length - 1]}'`,
    };
  }

  return { isValid: true };
}

/**
 * Check for suspicious patterns that usually indicate malformed input
 */
function checkSuspiciousPatterns(expr: string): ValidationResult {
  const suspiciousPatterns = [
    { pattern: /(\+\+|--|\*\*|\/\/)/g, message: 'Double operators not allowed' },
    { pattern: /^[\+\-\*\/]/g, message: 'Expression cannot start with an operator' },
    { pattern: /[\+\-\*\/]$/g, message: 'Expression cannot end with an operator' },
    { pattern: /\(\s*\)/g, message: 'Empty parentheses not allowed' },
    { pattern: /\[\s*\]/g, message: 'Empty brackets not allowed' },
    { pattern: /\{\s*\}/g, message: 'Empty braces not allowed' },
    { pattern: /\d{1000,}/g, message: 'Number has too many digits' },
  ];

  for (const { pattern, message } of suspiciousPatterns) {
    if (pattern.test(expr)) {
      return { isValid: false, error: message };
    }
  }

  return { isValid: true };
}

/**
 * Check if numbers in expression exceed allowed ranges
 */
function checkNumberRanges(
  expr: string,
  config: ValidationConfig
): ValidationResult {
  // Extract all numbers from the expression (simplified regex)
  const numberPattern = /(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/g;
  const matches = expr.match(numberPattern) || [];

  for (const numStr of matches) {
    const num = parseFloat(numStr);

    if (isNaN(num)) continue;

    if (
      config.maxNumberValue &&
      Math.abs(num) > config.maxNumberValue
    ) {
      return {
        isValid: false,
        error: `Number ${numStr} exceeds maximum allowed value (${config.maxNumberValue})`,
      };
    }

    if (
      config.minNumberValue &&
      num !== 0 &&
      Math.abs(num) < config.minNumberValue
    ) {
      return {
        isValid: false,
        error: `Number ${numStr} is smaller than minimum allowed value (${config.minNumberValue})`,
        suggestion: 'Try using scientific notation or a larger value',
      };
    }
  }

  return { isValid: true };
}

/**
 * Sanitize input by removing potentially harmful characters
 * Used as preprocessing before sending to math engines
 */
export function sanitizeMathInput(input: string): string {
  if (!input) return '';

  let sanitized = input.trim();

  // Remove multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Remove common non-math characters
  sanitized = sanitized.replace(/[<>!@#$%^&|]/g, '');

  // Normalize Unicode dash characters to hyphen
  sanitized = sanitized.replace(/[−–—]/g, '-');

  // Normalize quotes
  sanitized = sanitized.replace(/[""]/g, '"');

  return sanitized;
}

/**
 * Get expression complexity score (0-100)
 * Higher score = more complex = potentially slower to compute
 */
export function getComplexityScore(expr: string): number {
  let score = 0;

  // Length factor (max 20 points)
  score += Math.min(20, expr.length / 10);

  // Nesting depth factor (max 20 points)
  score += Math.min(20, checkNestingDepth(expr) * 2);

  // Operation count (max 30 points)
  const opCount = (expr.match(/[\+\-\*\/\^]/g) || []).length;
  score += Math.min(30, opCount * 2);

  // Function count (max 30 points)
  const funcCount = (
    expr.match(/\b(sin|cos|tan|log|exp|sqrt|abs|floor|ceil|round)\b/gi) || []
  ).length;
  score += Math.min(30, funcCount * 3);

  return Math.round(Math.min(100, score));
}
