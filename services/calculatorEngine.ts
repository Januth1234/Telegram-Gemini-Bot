import { CalculationInput, CalculationResult, CalculatorType, CalculationStep, InputField } from '../types';
import * as math from 'mathjs';
import jstat from 'jstat';

/**
 * Central calculation engine supporting all calculator types.
 * Handles computation, validation, and step-by-step breakdown.
 */
export class CalculatorEngine {
  /**
   * Validates calculator inputs against required fields
   */
  validateInputs(inputs: CalculationInput, requiredFields: InputField[]): string[] {
    const errors: string[] = [];
    
    for (const field of requiredFields) {
      if (field.required) {
        const value = inputs[field.name];
        if (value === undefined || value === null || value === '') {
          errors.push(`${field.label} is required`);
        } else if (field.type === 'number') {
          const num = parseFloat(value as any);
          if (isNaN(num)) {
            errors.push(`${field.label} must be a valid number`);
          } else if (field.min !== undefined && num < field.min) {
            errors.push(`${field.label} must be at least ${field.min}`);
          } else if (field.max !== undefined && num > field.max) {
            errors.push(`${field.label} must be at most ${field.max}`);
          }
        }
      }
    }
    
    return errors;
  }

  /**
   * Basic Arithmetic Calculator
   */
  async calculateBasic(inputs: CalculationInput): Promise<CalculationResult> {
    const { a, b, operation } = inputs;
    const numA = parseFloat(a as any);
    const numB = parseFloat(b as any);
    
    if (isNaN(numA) || isNaN(numB)) {
      throw new Error('Invalid input numbers');
    }

    let result = 0;
    let formula = '';
    const steps: CalculationStep[] = [];

    switch (operation) {
      case 'add':
        result = numA + numB;
        formula = `${numA} + ${numB}`;
        steps.push({
          description: 'Add the two numbers',
          expression: `${numA} + ${numB}`,
          result: result.toString(),
        });
        break;
      case 'subtract':
        result = numA - numB;
        formula = `${numA} - ${numB}`;
        steps.push({
          description: 'Subtract the second number from the first',
          expression: `${numA} - ${numB}`,
          result: result.toString(),
        });
        break;
      case 'multiply':
        result = numA * numB;
        formula = `${numA} × ${numB}`;
        steps.push({
          description: 'Multiply the two numbers',
          expression: `${numA} * ${numB}`,
          result: result.toString(),
        });
        break;
      case 'divide':
        if (numB === 0) throw new Error('Cannot divide by zero');
        result = numA / numB;
        formula = `${numA} ÷ ${numB}`;
        steps.push({
          description: 'Divide the first number by the second',
          expression: `${numA} / ${numB}`,
          result: result.toFixed(10),
        });
        break;
      case 'power':
        result = Math.pow(numA, numB);
        formula = `${numA}^${numB}`;
        steps.push({
          description: `Raise ${numA} to the power of ${numB}`,
          expression: `${numA}^${numB}`,
          result: result.toString(),
        });
        break;
      default:
        throw new Error('Unknown operation');
    }

    return {
      value: parseFloat(result.toFixed(10)),
      unit: '',
      formula,
      steps,
      timestamp: new Date(),
      calculatorType: 'basic',
    };
  }

  /**
   * Scientific Calculator (trigonometry, logarithms, etc.)
   */
  async calculateScientific(inputs: CalculationInput): Promise<CalculationResult> {
    const { value, operation, angle_unit = 'degrees' } = inputs;
    const num = parseFloat(value as any);

    if (isNaN(num)) {
      throw new Error('Invalid input number');
    }

    let result = 0;
    let formula = '';
    const steps: CalculationStep[] = [];
    let unit = '';

    // Convert degrees to radians if needed
    const radians = angle_unit === 'degrees' ? (num * Math.PI) / 180 : num;

    switch (operation) {
      case 'sin':
        result = Math.sin(radians);
        formula = `sin(${num}°)`;
        steps.push({
          description: `Calculate sine of ${num}${angle_unit === 'degrees' ? '°' : ' radians'}`,
          expression: `sin(${radians})`,
          result: result.toFixed(10),
        });
        break;
      case 'cos':
        result = Math.cos(radians);
        formula = `cos(${num}°)`;
        steps.push({
          description: `Calculate cosine of ${num}${angle_unit === 'degrees' ? '°' : ' radians'}`,
          expression: `cos(${radians})`,
          result: result.toFixed(10),
        });
        break;
      case 'tan':
        result = Math.tan(radians);
        formula = `tan(${num}°)`;
        steps.push({
          description: `Calculate tangent of ${num}${angle_unit === 'degrees' ? '°' : ' radians'}`,
          expression: `tan(${radians})`,
          result: result.toFixed(10),
        });
        break;
      case 'sqrt':
        if (num < 0) throw new Error('Cannot calculate square root of negative number');
        result = Math.sqrt(num);
        formula = `√${num}`;
        steps.push({
          description: `Calculate square root of ${num}`,
          expression: `sqrt(${num})`,
          result: result.toFixed(10),
        });
        unit = '';
        break;
      case 'log':
        if (num <= 0) throw new Error('Cannot calculate logarithm of non-positive number');
        result = Math.log10(num);
        formula = `log₁₀(${num})`;
        steps.push({
          description: `Calculate logarithm base 10 of ${num}`,
          expression: `log10(${num})`,
          result: result.toFixed(10),
        });
        break;
      case 'ln':
        if (num <= 0) throw new Error('Cannot calculate natural logarithm of non-positive number');
        result = Math.log(num);
        formula = `ln(${num})`;
        steps.push({
          description: `Calculate natural logarithm of ${num}`,
          expression: `ln(${num})`,
          result: result.toFixed(10),
        });
        break;
      case 'factorial':
        if (num < 0 || !Number.isInteger(num)) throw new Error('Factorial requires non-negative integer');
        result = this.factorial(num);
        formula = `${num}!`;
        steps.push({
          description: `Calculate factorial of ${num}`,
          expression: `${num}!`,
          result: result.toString(),
        });
        break;
      default:
        throw new Error('Unknown scientific operation');
    }

    return {
      value: parseFloat(result.toFixed(10)),
      unit,
      formula,
      steps,
      timestamp: new Date(),
      calculatorType: 'scientific',
    };
  }

  /**
   * Financial Calculator (compound interest, loan payments, etc.)
   */
  async calculateFinancial(inputs: CalculationInput): Promise<CalculationResult> {
    const { operation, principal, rate, time, compounds = 12, future_value, periods } = inputs;

    let result = 0;
    let formula = '';
    const steps: CalculationStep[] = [];

    switch (operation) {
      case 'compound_interest': {
        const P = parseFloat(principal as any);
        const r = parseFloat(rate as any) / 100;
        const t = parseFloat(time as any);
        const n = parseFloat(compounds as any);

        if (isNaN(P) || isNaN(r) || isNaN(t)) throw new Error('Invalid inputs');

        result = P * Math.pow(1 + r / n, n * t);
        const interest = result - P;

        formula = `A = P(1 + r/n)^(nt)`;
        steps.push({
          description: 'Apply compound interest formula',
          expression: `${P} * (1 + ${r}/${n})^(${n}*${t})`,
          result: result.toFixed(2),
        });
        steps.push({
          description: `Interest earned: ${interest.toFixed(2)}`,
          expression: `${result.toFixed(2)} - ${P}`,
          result: interest.toFixed(2),
        });

        return {
          value: result,
          unit: 'currency',
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'financial',
        };
      }

      case 'loan_payment': {
        const principal_val = parseFloat(principal as any);
        const annual_rate = parseFloat(rate as any) / 100 / 12;
        const num_periods = parseFloat(periods as any);

        if (isNaN(principal_val) || isNaN(annual_rate) || isNaN(num_periods)) {
          throw new Error('Invalid inputs');
        }

        const payment =
          (principal_val * (annual_rate * Math.pow(1 + annual_rate, num_periods))) /
          (Math.pow(1 + annual_rate, num_periods) - 1);

        formula = `M = P[r(1+r)^n]/[(1+r)^n-1]`;
        steps.push({
          description: 'Calculate monthly payment using amortization formula',
          expression: formula,
          result: payment.toFixed(2),
        });

        return {
          value: payment,
          unit: 'currency',
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'financial',
        };
      }

      default:
        throw new Error('Unknown financial operation');
    }
  }

  /**
   * Statistical Calculator (mean, median, std dev, etc.)
   */
  async calculateStatistical(inputs: CalculationInput): Promise<CalculationResult> {
    const { operation, data } = inputs;

    let dataArray: number[] = [];
    if (Array.isArray(data)) {
      dataArray = (data as any[]).map(v => parseFloat(v as any)).filter(v => !isNaN(v));
    } else if (typeof data === 'string') {
      dataArray = (data as string).split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    }

    if (dataArray.length === 0) throw new Error('No valid numeric data provided');

    let result: any;
    let formula = '';
    const steps: CalculationStep[] = [];

    switch (operation) {
      case 'mean':
        result = jstat.mean(dataArray);
        formula = 'Mean = Σx / n';
        steps.push({
          description: `Sum all ${dataArray.length} values`,
          expression: `${dataArray.reduce((a, b) => a + b, 0)}`,
          result: dataArray.reduce((a, b) => a + b, 0).toString(),
        });
        steps.push({
          description: `Divide sum by count (${dataArray.length})`,
          expression: `${dataArray.reduce((a, b) => a + b, 0)} / ${dataArray.length}`,
          result: result.toFixed(4),
        });
        break;

      case 'median':
        result = jstat.median(dataArray);
        formula = 'Median = middle value(s)';
        steps.push({
          description: `Sort values and find middle`,
          expression: `sorted: [${[...dataArray].sort((a, b) => a - b).join(', ')}]`,
          result: result.toString(),
        });
        break;

      case 'std_dev':
        result = jstat.stdev(dataArray);
        formula = 'σ = √(Σ(x - μ)² / n)';
        steps.push({
          description: 'Calculate standard deviation',
          expression: formula,
          result: result.toFixed(4),
        });
        break;

      case 'variance':
        result = jstat.variance(dataArray);
        formula = 'σ² = Σ(x - μ)² / n';
        steps.push({
          description: 'Calculate variance',
          expression: formula,
          result: result.toFixed(4),
        });
        break;

      default:
        throw new Error('Unknown statistical operation');
    }

    return {
      value: typeof result === 'number' ? parseFloat(result.toFixed(4)) : result,
      unit: '',
      formula,
      steps,
      timestamp: new Date(),
      calculatorType: 'statistical',
    };
  }

  /**
   * Health Calculator (BMI, TDEE, body metrics)
   */
  async calculateHealth(inputs: CalculationInput): Promise<CalculationResult> {
    const { operation, height, weight, age, gender, activity_level } = inputs;

    let result = 0;
    let formula = '';
    const steps: CalculationStep[] = [];

    switch (operation) {
      case 'bmi': {
        const h = parseFloat(height as any);
        const w = parseFloat(weight as any);

        if (isNaN(h) || isNaN(w)) throw new Error('Invalid height or weight');

        result = w / (h * h);
        formula = 'BMI = weight (kg) / height² (m)';

        let category = '';
        if (result < 18.5) category = 'Underweight';
        else if (result < 25) category = 'Normal weight';
        else if (result < 30) category = 'Overweight';
        else category = 'Obese';

        steps.push({
          description: 'Calculate BMI',
          expression: `${w} / (${h} * ${h})`,
          result: result.toFixed(1),
        });
        steps.push({
          description: `Category: ${category}`,
          expression: `BMI = ${result.toFixed(1)}`,
          result: category,
        });

        return {
          value: parseFloat(result.toFixed(1)),
          unit: `kg/m² (${category})`,
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'health',
        };
      }

      case 'tdee': {
        const w = parseFloat(weight as any);
        const h = parseFloat(height as any);
        const a = parseFloat(age as any);
        const g = (gender as string).toLowerCase();

        if (isNaN(w) || isNaN(h) || isNaN(a)) throw new Error('Invalid inputs');

        // Harris-Benedict Formula for BMR
        let bmr: number;
        if (g === 'male') {
          bmr = 88.362 + 13.397 * w + 4.799 * h - 5.677 * a;
        } else {
          bmr = 447.593 + 9.247 * w + 3.098 * h - 4.33 * a;
        }

        // Activity multiplier
        const multipliers: Record<string, number> = {
          sedentary: 1.2,
          lightly_active: 1.375,
          moderately_active: 1.55,
          very_active: 1.725,
          extremely_active: 1.9,
        };

        const multiplier = multipliers[activity_level as string] || 1.55;
        result = bmr * multiplier;

        formula = `TDEE = BMR × Activity Factor`;
        steps.push({
          description: `Calculate BMR using Harris-Benedict`,
          expression: `${bmr.toFixed(2)}`,
          result: bmr.toFixed(2),
        });
        steps.push({
          description: `Multiply by activity factor (${multiplier})`,
          expression: `${bmr.toFixed(2)} × ${multiplier}`,
          result: result.toFixed(0),
        });

        return {
          value: parseFloat(result.toFixed(0)),
          unit: 'kcal/day',
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'health',
        };
      }

      default:
        throw new Error('Unknown health operation');
    }
  }

  /**
   * Mortgage Calculator
   */
  async calculateMortgage(inputs: CalculationInput): Promise<CalculationResult> {
    const { loan_amount, annual_rate, years } = inputs;

    const principal = parseFloat(loan_amount as any);
    const rate = parseFloat(annual_rate as any) / 100 / 12;
    const months = parseFloat(years as any) * 12;

    if (isNaN(principal) || isNaN(rate) || isNaN(months)) {
      throw new Error('Invalid inputs');
    }

    const monthlyPayment =
      (principal * (rate * Math.pow(1 + rate, months))) / (Math.pow(1 + rate, months) - 1);

    const totalPayment = monthlyPayment * months;
    const totalInterest = totalPayment - principal;

    const formula = `M = P[r(1+r)^n]/[(1+r)^n-1]`;
    const steps: CalculationStep[] = [];

    steps.push({
      description: 'Calculate monthly payment',
      expression: formula,
      result: monthlyPayment.toFixed(2),
    });
    steps.push({
      description: 'Calculate total payment amount',
      expression: `${monthlyPayment.toFixed(2)} × ${months} months`,
      result: totalPayment.toFixed(2),
    });
    steps.push({
      description: 'Calculate total interest paid',
      expression: `${totalPayment.toFixed(2)} - ${principal}`,
      result: totalInterest.toFixed(2),
    });

    return {
      value: monthlyPayment,
      unit: 'currency/month',
      formula,
      steps,
      timestamp: new Date(),
      calculatorType: 'mortgage',
    };
  }

  /**
   * Engineering Calculator (unit conversions, physics formulas)
   */
  async calculateEngineering(inputs: CalculationInput): Promise<CalculationResult> {
    const { operation, value } = inputs;
    const num = parseFloat(value as any);

    if (isNaN(num)) throw new Error('Invalid input');

    let result = 0;
    let formula = '';
    let unit = '';
    const steps: CalculationStep[] = [];

    switch (operation) {
      case 'celsius_to_fahrenheit':
        result = (num * 9) / 5 + 32;
        formula = '°F = (°C × 9/5) + 32';
        unit = '°F';
        steps.push({
          description: 'Convert Celsius to Fahrenheit',
          expression: `(${num} × 9/5) + 32`,
          result: result.toFixed(2),
        });
        break;

      case 'fahrenheit_to_celsius':
        result = ((num - 32) * 5) / 9;
        formula = '°C = (°F - 32) × 5/9';
        unit = '°C';
        steps.push({
          description: 'Convert Fahrenheit to Celsius',
          expression: `(${num} - 32) × 5/9`,
          result: result.toFixed(2),
        });
        break;

      case 'km_to_miles':
        result = num * 0.621371;
        formula = 'miles = km × 0.621371';
        unit = 'miles';
        steps.push({
          description: 'Convert kilometers to miles',
          expression: `${num} × 0.621371`,
          result: result.toFixed(4),
        });
        break;

      case 'miles_to_km':
        result = num / 0.621371;
        formula = 'km = miles / 0.621371';
        unit = 'km';
        steps.push({
          description: 'Convert miles to kilometers',
          expression: `${num} / 0.621371`,
          result: result.toFixed(4),
        });
        break;

      default:
        throw new Error('Unknown engineering operation');
    }

    return {
      value: parseFloat(result.toFixed(4)),
      unit,
      formula,
      steps,
      timestamp: new Date(),
      calculatorType: 'engineering',
    };
  }

  /**
   * Chemical Calculator (molarity, molecular weight, pH)
   */
  async calculateChemical(inputs: CalculationInput): Promise<CalculationResult> {
    const { operation, moles, volume, concentration, pH_value } = inputs;

    let result = 0;
    let formula = '';
    const steps: CalculationStep[] = [];

    switch (operation) {
      case 'molarity': {
        const m = parseFloat(moles as any);
        const v = parseFloat(volume as any);

        if (isNaN(m) || isNaN(v)) throw new Error('Invalid inputs');

        result = m / v;
        formula = 'Molarity (M) = moles / volume (L)';
        steps.push({
          description: 'Calculate molarity',
          expression: `${m} / ${v}`,
          result: result.toFixed(4),
        });

        return {
          value: parseFloat(result.toFixed(4)),
          unit: 'mol/L',
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'chemical',
        };
      }

      case 'ph_from_concentration': {
        const c = parseFloat(concentration as any);
        if (isNaN(c) || c <= 0) throw new Error('Concentration must be positive');

        result = -Math.log10(c);
        formula = 'pH = -log₁₀[H⁺]';
        steps.push({
          description: 'Calculate pH from concentration',
          expression: `-log₁₀(${c})`,
          result: result.toFixed(2),
        });

        return {
          value: parseFloat(result.toFixed(2)),
          unit: 'pH',
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'chemical',
        };
      }

      case 'concentration_from_ph': {
        const pH = parseFloat(pH_value as any);
        if (isNaN(pH)) throw new Error('Invalid pH value');

        result = Math.pow(10, -pH);
        formula = '[H⁺] = 10^(-pH)';
        steps.push({
          description: 'Calculate concentration from pH',
          expression: `10^(-${pH})`,
          result: result.toExponential(4),
        });

        return {
          value: result,
          unit: 'mol/L',
          formula,
          steps,
          timestamp: new Date(),
          calculatorType: 'chemical',
        };
      }

      default:
        throw new Error('Unknown chemical operation');
    }
  }

  /**
   * Helper: Calculate factorial
   */
  private factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }
}

export const calculatorEngine = new CalculatorEngine();
