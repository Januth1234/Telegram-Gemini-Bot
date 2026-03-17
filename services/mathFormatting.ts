/**
 * Math Result Formatting & Numeric Precision
 * Handles display of calculation results with appropriate precision,
 * special values, and human-readable formatting.
 */

export interface FormattedResult {
  display: string;    // Formatted for display (short)
  precise: string;    // Full precision version
  latex?: string;     // LaTeX representation
  unit?: string;      // Unit suffix if applicable
}

export interface PrecisionOptions {
  maxDecimals?: number;          // Max decimal places (default: 12)
  minSignificantDigits?: number; // Min significant figures (default: 4)
  maxSignificantDigits?: number; // Max significant figures (default: 15)
  useScientific?: boolean;       // Use scientific notation for small/large (default: true)
  scientificThreshold?: number;  // Exponent threshold for scientific notation (default: ±4)
}

const DEFAULT_PRECISION: PrecisionOptions = {
  maxDecimals: 12,
  minSignificantDigits: 4,
  maxSignificantDigits: 15,
  useScientific: true,
  scientificThreshold: 4,
};

/**
 * Format a numeric result with appropriate precision
 */
export function formatNumber(
  value: number | string,
  options: PrecisionOptions = {}
): FormattedResult {
  const opts = { ...DEFAULT_PRECISION, ...options };

  if (typeof value === 'string') {
    return { display: value, precise: value };
  }

  // Handle special values
  if (!isFinite(value)) {
    return {
      display: value === Infinity ? '∞' : value === -Infinity ? '-∞' : 'NaN',
      precise: String(value),
      latex: value === Infinity ? '\\infty' : value === -Infinity ? '-\\infty' : '\\text{undefined}',
    };
  }

  // Zero is always zero
  if (value === 0) {
    return {
      display: '0',
      precise: '0',
      latex: '0',
    };
  }

  // Determine if scientific notation is needed
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const useScientific =
    opts.useScientific &&
    Math.abs(exponent) > (opts.scientificThreshold || 4);

  let formatted: string;
  let precise: string;

  if (useScientific) {
    // Scientific notation: 1.23e+45
    const mantissa = value / Math.pow(10, exponent);
    formatted = formatScientific(mantissa, exponent, opts);
    precise = formatScientific(mantissa, exponent, { ...opts, maxDecimals: 15 });
  } else {
    // Regular decimal notation
    const roundedValue = roundToPrecision(value, opts);
    formatted = formatDecimal(roundedValue, opts);
    precise = formatDecimal(value, { ...opts, maxDecimals: 15 });
  }

  // Build LaTeX version
  const latex = formatted.includes('e')
    ? formatLatexScientific(formatted)
    : formatted;

  return {
    display: formatted,
    precise,
    latex,
  };
}

/**
 * Format multiple results (e.g., for equation with multiple solutions)
 */
export function formatMultiple(
  values: (number | string)[],
  options: PrecisionOptions = {}
): string[] {
  return values.map((v) => {
    if (typeof v === 'string') return v;
    return formatNumber(v, options).display;
  });
}

/**
 * Format a fraction in simplest form
 */
export function formatFraction(
  numerator: number,
  denominator: number,
  options: PrecisionOptions = {}
): FormattedResult {
  if (denominator === 0) {
    return formatNumber(Infinity, options);
  }

  // Find GCD to simplify
  const gcd = findGCD(Math.abs(numerator), Math.abs(denominator));
  const simplNum = numerator / gcd;
  const simplDenom = denominator / gcd;

  const display = `${simplNum}/${simplDenom}`;
  const decimalValue = numerator / denominator;
  const decimalFormatted = formatNumber(decimalValue, options).display;

  const latex = `\\frac{${simplNum}}{${simplDenom}}`;

  return {
    display: `${display} ≈ ${decimalFormatted}`,
    precise: `${simplNum}/${simplDenom}`,
    latex,
  };
}

/**
 * Format matrix result
 */
export function formatMatrix(
  matrix: number[][],
  options: PrecisionOptions = {}
): FormattedResult {
  const formatted = matrix.map((row) =>
    row.map((val) => formatNumber(val, options).display)
  );

  const display = formatMatrixString(formatted);
  const latex = formatMatrixLatex(formatted);

  return {
    display,
    precise: display,
    latex,
  };
}

/**
 * Round a number to specified precision
 */
function roundToPrecision(value: number, options: PrecisionOptions): number {
  const opts = { ...DEFAULT_PRECISION, ...options };
  const maxDec = opts.maxDecimals || 12;

  // Use toPrecision for significant figures
  const precise = parseFloat(
    value.toPrecision(opts.maxSignificantDigits || 15)
  );

  // Then round to max decimals
  const factor = Math.pow(10, maxDec);
  return Math.round(precise * factor) / factor;
}

/**
 * Format decimal number
 */
function formatDecimal(
  value: number,
  options: PrecisionOptions
): string {
  const opts = { ...DEFAULT_PRECISION, ...options };

  // Determine decimal places to show
  let decimals = opts.maxDecimals || 12;

  // Reduce decimals if number naturally has fewer significant digits
  const absValue = Math.abs(value);
  if (absValue !== 0 && absValue < 1) {
    // For small decimals, keep enough to show the first few significant digits
    const exponent = Math.floor(Math.log10(absValue));
    decimals = Math.min(decimals, (opts.minSignificantDigits || 4) - exponent - 1);
  }

  decimals = Math.max(0, decimals);

  let formatted = value.toFixed(decimals);

  // Remove trailing zeros
  formatted = formatted.replace(/\.?0+$/, '');

  return formatted;
}

/**
 * Format in scientific notation
 */
function formatScientific(
  mantissa: number,
  exponent: number,
  options: PrecisionOptions
): string {
  const opts = { ...DEFAULT_PRECISION, ...options };
  const decimals = Math.min(opts.maxDecimals || 12, 6);

  const formattedMantissa = formatDecimal(mantissa, {
    ...opts,
    maxDecimals: decimals,
  });

  return `${formattedMantissa}e${exponent >= 0 ? '+' : ''}${exponent}`;
}

/**
 * Convert decimal scientific notation to LaTeX
 */
function formatLatexScientific(scientific: string): string {
  const match = scientific.match(/^([\d.]+)[eE]([+-]?\d+)$/);
  if (!match) return scientific;

  const [, mantissa, exponent] = match;
  return `${mantissa} \\times 10^{${exponent}}`;
}

/**
 * Format matrix as string
 */
function formatMatrixString(matrix: string[][]): string {
  if (matrix.length === 0) return '[]';

  const maxColWidths = matrix[0].map((_, colIdx) =>
    Math.max(...matrix.map((row) => row[colIdx].length))
  );

  const rows = matrix.map((row) =>
    '[ ' +
    row
      .map((val, i) => val.padStart(maxColWidths[i]))
      .join(' ') +
    ' ]'
  );

  return rows.join('\n');
}

/**
 * Format matrix as LaTeX
 */
function formatMatrixLatex(matrix: string[][]): string {
  if (matrix.length === 0) return '\\begin{bmatrix} \\end{bmatrix}';

  const rows = matrix
    .map((row) => row.join(' & '))
    .join(' \\\\ ');

  return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}

/**
 * Find greatest common divisor
 */
function findGCD(a: number, b: number): number {
  return b === 0 ? a : findGCD(b, a % b);
}

/**
 * Convert result to different number bases
 */
export function convertBase(
  value: number,
  fromBase: number = 10,
  toBase: number = 10
): FormattedResult {
  if (!Number.isInteger(value) || value < 0) {
    return {
      display: 'Only non-negative integers can be converted',
      precise: String(value),
    };
  }

  const decimal = fromBase === 10 ? value : parseInt(String(value), fromBase);
  let result: string;

  switch (toBase) {
    case 2:
      result = decimal.toString(2);
      return { display: result, precise: result, latex: `\\text{${result}}_2` };
    case 8:
      result = decimal.toString(8);
      return { display: result, precise: result, latex: `\\text{${result}}_8` };
    case 16:
      result = decimal.toString(16).toUpperCase();
      return { display: result, precise: result, latex: `\\text{${result}}_{16}` };
    default:
      return {
        display: decimal.toString(toBase),
        precise: String(value),
      };
  }
}

/**
 * Get human-readable unit suffix if applicable
 */
export function getUnitSuffix(value: number): string {
  if (!isFinite(value)) return '';

  const absValue = Math.abs(value);

  if (absValue >= 1e9) return 'B'; // Billion
  if (absValue >= 1e6) return 'M'; // Million
  if (absValue >= 1e3) return 'K'; // Thousand
  if (absValue < 1e-6) return 'μ'; // Micro
  if (absValue < 1e-9) return 'n'; // Nano

  return '';
}
