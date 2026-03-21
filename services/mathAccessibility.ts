/**
 * Math Accessibility Utilities
 * Provides ARIA labels, screen reader announcements, and keyboard navigation support
 */

/**
 * Announce a result to screen readers using aria-live region
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Create accessible label for math operation
 */
export function getMathOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    simplify: 'Simplify expression',
    solve: 'Solve for variable',
    derivative: 'Find derivative with respect to variable',
    integral: 'Find integral with respect to variable',
    factor: 'Factor expression',
    expand: 'Expand expression',
    'matrix det': 'Calculate matrix determinant',
    'matrix inv': 'Calculate matrix inverse',
    'matrix eigs': 'Find eigenvalues and eigenvectors',
    'matrix rank': 'Calculate matrix rank',
    'matrix rref': 'Calculate reduced row echelon form',
    'prime factors': 'Find prime factorization',
    'number gcd': 'Calculate greatest common divisor',
    'number lcm': 'Calculate least common multiple',
    'number mod': 'Calculate modulo',
    mean: 'Calculate mean',
    median: 'Calculate median',
    'std dev': 'Calculate standard deviation',
    'area': 'Calculate area',
    'volume': 'Calculate volume',
  };

  return labels[operation.toLowerCase()] || operation;
}

/**
 * Create accessible label for math input field
 */
export function getMathInputLabel(category: string): string {
  const labels: Record<string, string> = {
    'General': 'Enter mathematical expression',
    'Algebra': 'Enter algebraic equation or expression',
    'Geometry': 'Enter geometric formula or expression',
    'Calculus': 'Enter function or expression for calculus',
    'Stats': 'Enter numbers or statistical expression',
    'Physics': 'Enter physics expression with units',
    'Matrix': 'Enter matrix or matrix operation',
    'Number': 'Enter number for number theory operation',
    'Graphs': 'Enter function to graph',
  };

  return labels[category] || 'Enter mathematical expression';
}

/**
 * Convert math expression to spoken form for screen readers
 */
export function speakMathExpression(expr: string): string {
  let spoken = expr;

  // Replace symbols with words
  const replacements: [RegExp, string][] = [
    [/\+/g, 'plus'],
    [/\-/g, 'minus'],
    [/\*/g, 'times'],
    [/\//g, 'divided by'],
    [/\^/g, 'to the power of'],
    [/\=/g, 'equals'],
    [/\>/g, 'greater than'],
    [/\</g, 'less than'],
    [/\>=/, 'greater than or equal to'],
    [/\<=/g, 'less than or equal to'],
    [/\pi/g, 'pi'],
    [/sqrt\(/g, 'square root of'],
    [/sin\(/g, 'sine of'],
    [/cos\(/g, 'cosine of'],
    [/tan\(/g, 'tangent of'],
    [/log\(/g, 'logarithm of'],
    [/ln\(/g, 'natural logarithm of'],
    [/exp\(/g, 'e to the power of'],
    [/\(/g, 'open parenthesis'],
    [/\)/g, 'close parenthesis'],
  ];

  for (const [pattern, replacement] of replacements) {
    spoken = spoken.replace(pattern, ` ${replacement} `);
  }

  // Clean up multiple spaces
  spoken = spoken.replace(/\s+/g, ' ').trim();

  return spoken;
}

/**
 * Format result for screen reader announcement
 */
export function formatResultForScreenReader(
  result: number | string | number[],
  operation?: string,
  variable?: string
): string {
  let announcement = '';

  if (operation) {
    announcement += `${getMathOperationLabel(operation)}. `;
  }

  if (Array.isArray(result)) {
    const values = result.map((v) => formatNumberForSpeech(v)).join(', ');
    announcement += `Result: ${values}`;
    if (variable) {
      announcement += ` for ${variable}`;
    }
  } else {
    announcement += `Result: ${formatNumberForSpeech(result)}`;
  }

  return announcement;
}

/**
 * Format a number for speech synthesis
 */
function formatNumberForSpeech(value: number | string): string {
  if (typeof value === 'string') return value;

  if (!isFinite(value)) {
    return value === Infinity ? 'infinity' : value === -Infinity ? 'negative infinity' : 'undefined';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  // Round to reasonable precision for speech
  return value.toPrecision(6).replace(/\.?0+$/, '');
}

/**
 * Get ARIA attributes for a button with tooltip
 */
export function getAriaButtonAttrs(
  action: string,
  tooltip?: string
): Record<string, string | boolean | number> {
  return {
    'aria-label': tooltip || getMathOperationLabel(action),
    'role': 'button',
    'tabIndex': 0,
  };
}

/**
 * Get ARIA attributes for input field
 */
export function getAriaInputAttrs(
  category: string,
  isValid?: boolean
): Record<string, string | boolean | undefined> {
  return {
    'aria-label': getMathInputLabel(category),
    'aria-invalid': isValid === false,
    'aria-describedby': isValid === false ? 'error-message' : undefined,
    'role': 'textbox',
    'aria-multiline': true,
  };
}

/**
 * Get ARIA attributes for error message
 */
export function getAriaErrorAttrs(errorId: string): Record<string, string> {
  return {
    'id': errorId,
    'role': 'alert',
    'aria-live': 'assertive',
    'aria-atomic': 'true',
  };
}

/**
 * Create accessible button with keyboard support
 */
export function createAccessibleButton(
  label: string,
  onClick: () => void,
  options?: {
    shortcut?: string;
    disabled?: boolean;
    className?: string;
  }
) {
  return {
    'aria-label': options?.shortcut ? `${label} (${options.shortcut})` : label,
    'disabled': options?.disabled,
    'onClick': onClick,
    'onKeyDown': (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    'className': options?.className,
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user is using dark mode
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Enhance existing element with ARIA attributes
 */
export function enhanceAccessibility(
  element: HTMLElement,
  attributes: Record<string, string | boolean>
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === true) {
      element.setAttribute(key, '');
    } else if (value !== false && value !== null && value !== undefined) {
      element.setAttribute(key, String(value));
    }
  });
}

/**
 * Validate keyboard navigation in element
 */
export function enableKeyboardNavigation(
  container: HTMLElement,
  selectableSelector: string = '[role="button"], [tabindex="0"]'
): void {
  const focusableElements = container.querySelectorAll(selectableSelector);

  container.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    const focused = document.activeElement as HTMLElement;
    if (!container.contains(focused)) return;

    e.preventDefault();

    const elements = Array.from(focusableElements) as HTMLElement[];
    const currentIndex = elements.indexOf(focused);

    let nextIndex: number;
    if (e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % elements.length;
    } else {
      nextIndex = (currentIndex - 1 + elements.length) % elements.length;
    }

    elements[nextIndex]?.focus();
  });
}

/**
 * Skip to main content link (for keyboard users)
 */
export function createSkipLink(): HTMLElement {
  const link = document.createElement('a');
  link.href = '#main-content';
  link.textContent = 'Skip to main content';
  link.className = `
    sr-only focus:not-sr-only
    fixed top-0 left-0 z-50
    px-3 py-2 bg-indigo-600 text-white
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600
  `;
  link.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const main = document.getElementById('main-content');
      main?.focus();
      main?.scrollIntoView();
    }
  };

  return link;
}
