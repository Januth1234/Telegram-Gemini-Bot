/**
 * Math Solver Error Messages & Diagnostics
 * Provides consistent, helpful error messages and suggestions for troubleshooting.
 */

export type ErrorCode =
  | 'INVALID_SYNTAX'
  | 'DIV_BY_ZERO'
  | 'NO_SOLUTION'
  | 'INFINITE_SOLUTIONS'
  | 'UNDEFINED_VARIABLE'
  | 'INVALID_DOMAIN'
  | 'COMPLEX_RESULT'
  | 'TIMEOUT'
  | 'EXTERNAL_ERROR'
  | 'INVALID_INPUT'
  | 'NOT_SUPPORTED'
  | 'MEMORY_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorMessage {
  code: ErrorCode;
  title: string;
  description: string;
  suggestion?: string;
  latex?: string; // Example or explanation in LaTeX
  recoverySteps?: string[];
}

/**
 * Error message database with helpful context
 */
const ERROR_DB: Record<ErrorCode, ErrorMessage> = {
  INVALID_SYNTAX: {
    code: 'INVALID_SYNTAX',
    title: 'Invalid Expression Syntax',
    description:
      'The expression contains syntax errors and cannot be parsed. Check for mismatched parentheses, invalid operators, or incorrect function names.',
    suggestion:
      'Make sure all parentheses are balanced and operators are used correctly.',
    latex: 'Example: \\text{3+4*2 is valid, but 3++4 or 3+(4 are not}',
    recoverySteps: [
      'Check that all opening brackets have closing brackets',
      'Verify operators are between operands (e.g., a + b, not + a b)',
      'Ensure function names are spelled correctly',
    ],
  },

  DIV_BY_ZERO: {
    code: 'DIV_BY_ZERO',
    title: 'Division by Zero',
    description:
      'The expression results in division by zero, which is undefined in mathematics.',
    suggestion: 'Check your expression for values that make the denominator zero.',
    latex: '\\text{For example, } \\frac{5}{0} \\text{ is undefined}',
    recoverySteps: [
      'Identify the term causing division by zero',
      'Check if the variable has constraints (e.g., x ≠ 0)',
      'Try solving with the constraint in mind',
    ],
  },

  NO_SOLUTION: {
    code: 'NO_SOLUTION',
    title: 'No Solution Exists',
    description:
      'The equation has no solution that satisfies all conditions.',
    suggestion:
      'This is mathematically correct. The equation is inconsistent or has no roots.',
    latex: '\\text{Example: } x = x + 1 \\text{ has no solution}',
    recoverySteps: [
      'Verify the equation is what you intended',
      'Check if the equation should have solutions graphically',
      'Try a related equation with a solution',
    ],
  },

  INFINITE_SOLUTIONS: {
    code: 'INFINITE_SOLUTIONS',
    title: 'Infinite Solutions',
    description:
      'The equation is satisfied by infinitely many values, typically because it\'s an identity.',
    suggestion: 'This is a valid result. The equation is true for all valid inputs.',
    latex: '\\text{Example: } 2x + 4 = 2(x + 2) \\text{ is true for all } x',
    recoverySteps: [
      'Verify this is the intended equation',
      'If you need a specific solution, add more constraints',
      'Check if this represents a line or plane in your system',
    ],
  },

  UNDEFINED_VARIABLE: {
    code: 'UNDEFINED_VARIABLE',
    title: 'Undefined Variable',
    description:
      'A variable in your expression has not been defined or assigned a value.',
    suggestion: 'Define all variables before using them in calculations.',
    latex: '\\text{Example: If } y \\text{ is undefined, } x + y \\text{ cannot be evaluated}',
    recoverySteps: [
      'Check the spelling of variable names',
      'Define all variables used in the expression',
      'Use only standard mathematical variables',
    ],
  },

  INVALID_DOMAIN: {
    code: 'INVALID_DOMAIN',
    title: 'Invalid Domain',
    description:
      'The expression is undefined for the given input values (e.g., square root of negative number).',
    suggestion:
      'Check if the input is within the valid domain of the function.',
    latex: '\\text{Example: } \\sqrt{-4} \\text{ is not defined for real numbers}',
    recoverySteps: [
      'Identify which function has domain restrictions',
      'Check if input is within the valid range',
      'Try different input values',
    ],
  },

  COMPLEX_RESULT: {
    code: 'COMPLEX_RESULT',
    title: 'Complex Number Result',
    description:
      'The result is a complex number (with imaginary part), not a real number.',
    suggestion:
      'This is mathematically valid. The solver returned a complex result.',
    latex: '\\text{Example: } \\sqrt{-9} = 3i',
    recoverySteps: [
      'Verify you intended to allow complex numbers',
      'Check if there are real solutions as well',
      'Interpret the result as a complex number if needed',
    ],
  },

  TIMEOUT: {
    code: 'TIMEOUT',
    title: 'Calculation Timeout',
    description:
      'The calculation took too long and was cancelled to prevent hanging.',
    suggestion: 'Try a simpler expression or break it into smaller parts.',
    recoverySteps: [
      'Simplify the expression',
      'Break the problem into smaller steps',
      'Try solving a related, simpler problem first',
      'Check if you meant to use different operators',
    ],
  },

  EXTERNAL_ERROR: {
    code: 'EXTERNAL_ERROR',
    title: 'External Service Error',
    description:
      'The AI solver encountered an error. This is usually a temporary issue.',
    suggestion: 'Try again in a moment, or use the local math engine.',
    recoverySteps: [
      'Verify your internet connection',
      'Try the calculation again',
      'If it persists, report the issue',
    ],
  },

  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    title: 'Invalid Input',
    description: 'The input is not valid for the requested operation.',
    suggestion: 'Check the format of your input and try again.',
    recoverySteps: [
      'Verify the input type is correct',
      'Check for typos or formatting issues',
      'Refer to the input format guide',
    ],
  },

  NOT_SUPPORTED: {
    code: 'NOT_SUPPORTED',
    title: 'Operation Not Supported',
    description:
      'This operation or expression type is not currently supported by the calculator.',
    suggestion:
      'Try a different approach or break the problem into simpler steps.',
    recoverySteps: [
      'Check if a simpler operation is supported',
      'Try a different method or approach',
      'Request support for this feature',
    ],
  },

  MEMORY_ERROR: {
    code: 'MEMORY_ERROR',
    title: 'Memory Error',
    description: 'The operation requires too much memory. Try a simpler problem.',
    suggestion: 'Break the problem into smaller parts or use simpler expressions.',
    recoverySteps: [
      'Reload the page to clear memory',
      'Try a simpler calculation',
      'Close other browser tabs',
    ],
  },

  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    title: 'Unknown Error',
    description: 'An unexpected error occurred during calculation.',
    suggestion: 'Try the calculation again, or check your input.',
    recoverySteps: [
      'Try the calculation again',
      'Reload the page',
      'Try a similar calculation',
      'Check the browser console for details',
    ],
  },
};

/**
 * Get error message for an error code
 */
export function getErrorMessage(code: ErrorCode): ErrorMessage {
  return ERROR_DB[code] || ERROR_DB.UNKNOWN_ERROR;
}

/**
 * Diagnose error from exception message
 */
export function diagnoseError(error: Error | string): ErrorMessage {
  const message = typeof error === 'string' ? error : error.message;
  const code = classifyError(message);
  return getErrorMessage(code);
}

/**
 * Classify error based on message content
 */
function classifyError(message: string): ErrorCode {
  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes('divide') ||
    lowerMsg.includes('division by zero') ||
    lowerMsg.includes('div by zero')
  ) {
    return 'DIV_BY_ZERO';
  }

  if (
    lowerMsg.includes('syntax') ||
    lowerMsg.includes('parse') ||
    lowerMsg.includes('unexpected')
  ) {
    return 'INVALID_SYNTAX';
  }

  if (
    lowerMsg.includes('no solution') ||
    lowerMsg.includes('cannot be solved')
  ) {
    return 'NO_SOLUTION';
  }

  if (
    lowerMsg.includes('infinite') ||
    lowerMsg.includes('infinitely many')
  ) {
    return 'INFINITE_SOLUTIONS';
  }

  if (
    lowerMsg.includes('undefined') ||
    lowerMsg.includes('not defined')
  ) {
    return 'UNDEFINED_VARIABLE';
  }

  if (
    lowerMsg.includes('domain') ||
    lowerMsg.includes('imaginary') ||
    lowerMsg.includes('complex')
  ) {
    return 'INVALID_DOMAIN';
  }

  if (
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('too long')
  ) {
    return 'TIMEOUT';
  }

  if (
    lowerMsg.includes('memory') ||
    lowerMsg.includes('stack')
  ) {
    return 'MEMORY_ERROR';
  }

  if (
    lowerMsg.includes('network') ||
    lowerMsg.includes('fetch') ||
    lowerMsg.includes('api')
  ) {
    return 'EXTERNAL_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Format error for user display (React component friendly)
 */
export function formatErrorForDisplay(error: Error | string): {
  title: string;
  description: string;
  suggestion?: string;
  steps?: string[];
} {
  const errorMsg = diagnoseError(error);

  return {
    title: errorMsg.title,
    description: errorMsg.description,
    suggestion: errorMsg.suggestion,
    steps: errorMsg.recoverySteps,
  };
}

/**
 * Create a helpful hint based on user's expression
 */
export function getExpressionHint(expr: string): string | null {
  // Detect common mistakes
  if (expr.includes('((')) {
    return 'You have nested parentheses. Make sure they are balanced.';
  }

  if (expr.match(/(\+\+)|(\-\-)|(\*\*)|(\/\/)/)) {
    return 'Double operators (++, --, **, //) are not valid. Use single operators.';
  }

  if (expr.match(/^\s*[\+\-\*\/]/)) {
    return 'Expressions should not start with an operator.';
  }

  if (expr.match(/[\+\-\*\/]\s*$/)) {
    return 'Expressions should not end with an operator.';
  }

  if (expr.includes('xx') || expr.includes('yy')) {
    return 'Did you mean x or y? Double letters might not be valid.';
  }

  if (
    expr.match(/sqrt|sin|cos|tan|log/) &&
    !expr.match(/sqrt\(|sin\(|cos\(|tan\(|log\(/)
  ) {
    return 'Function names need parentheses. Try: sqrt(x), sin(x), etc.';
  }

  return null;
}
