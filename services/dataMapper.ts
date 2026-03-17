import { ExtractionResult, CalculatorType, CalculationInput } from '../types';

/**
 * Maps extracted data to calculator input fields
 * Handles unit conversions and smart routing
 */
export class DataMapper {
  /**
   * Maps extracted values to calculator input format
   * Handles unit conversions and field name mapping
   */
  mapToCalculatorInputs(
    extraction: ExtractionResult,
    targetCalculatorType: CalculatorType
  ): CalculationInput {
    const inputs: CalculationInput = {};

    // Map based on target calculator type
    switch (targetCalculatorType) {
      case 'basic':
        inputs['a'] = extraction.values['a'] || extraction.values['num1'] || extraction.values['value1'];
        inputs['b'] = extraction.values['b'] || extraction.values['num2'] || extraction.values['value2'];
        inputs['operation'] = extraction.values['operation'] || 'add';
        break;

      case 'scientific':
        inputs['value'] = extraction.values['value'] || extraction.values['angle'] || extraction.values['x'];
        inputs['operation'] = extraction.values['operation'] || extraction.values['function'];
        inputs['angle_unit'] = extraction.units['value'] === 'degrees' ? 'degrees' : 'radians';
        break;

      case 'financial':
        inputs['operation'] = extraction.values['operation'] || 'compound_interest';
        inputs['principal'] = extraction.values['principal'] || extraction.values['amount'] || extraction.values['initial'];
        inputs['rate'] = extraction.values['rate'] || extraction.values['interest_rate'] || extraction.values['annual_rate'];
        inputs['time'] = extraction.values['time'] || extraction.values['years'];
        inputs['compounds'] = extraction.values['compounds'] || extraction.values['frequency'] || 12;
        inputs['periods'] = extraction.values['periods'] || extraction.values['months'] || extraction.values['time'];
        break;

      case 'statistical':
        inputs['operation'] = extraction.values['operation'] || 'mean';
        if (Array.isArray(extraction.values['data'])) {
          inputs['data'] = extraction.values['data'];
        } else if (typeof extraction.values['data'] === 'string') {
          inputs['data'] = extraction.values['data'];
        } else {
          // Try to collect numeric values
          const numbers = Object.entries(extraction.values)
            .filter(([key]) => !['operation', 'type'].includes(key))
            .map(([, val]) => val as number);
          inputs['data'] = numbers;
        }
        break;

      case 'engineering':
        inputs['operation'] = extraction.values['operation'] || extraction.values['conversion_type'];
        inputs['value'] = extraction.values['value'] || extraction.values['input'];
        break;

      case 'chemical':
        inputs['operation'] = extraction.values['operation'] || 'molarity';
        inputs['moles'] = extraction.values['moles'] || extraction.values['mol'];
        inputs['volume'] = extraction.values['volume'] || extraction.values['vol'];
        inputs['concentration'] = extraction.values['concentration'] || extraction.values['molarity'];
        inputs['pH_value'] = extraction.values['pH'] || extraction.values['pH_value'];
        break;

      case 'health':
        inputs['operation'] = extraction.values['operation'] || 'bmi';
        inputs['height'] = this.convertUnit(extraction.values['height'], extraction.units['height'], 'm');
        inputs['weight'] = this.convertUnit(extraction.values['weight'], extraction.units['weight'], 'kg');
        inputs['age'] = extraction.values['age'];
        inputs['gender'] = extraction.values['gender'] || 'male';
        inputs['activity_level'] = extraction.values['activity_level'] || 'moderately_active';
        break;

      case 'mortgage':
        inputs['loan_amount'] = extraction.values['loan_amount'] || extraction.values['principal'] || extraction.values['amount'];
        inputs['annual_rate'] = extraction.values['annual_rate'] || extraction.values['rate'] || extraction.values['interest_rate'];
        inputs['years'] = extraction.values['years'] || extraction.values['time'] || extraction.values['duration'];
        break;
    }

    // Remove undefined values
    Object.keys(inputs).forEach(key => {
      if (inputs[key] === undefined) {
        delete inputs[key];
      }
    });

    return inputs;
  }

  /**
   * Convert units to standard forms
   * e.g., cm to m, lbs to kg
   */
  private convertUnit(value: number | undefined, fromUnit: string | undefined, toUnit: string): number | undefined {
    if (value === undefined) return undefined;

    const normalizedFrom = fromUnit ? fromUnit.toLowerCase().trim() : '';
    const normalizedTo = toUnit.toLowerCase().trim();

    // Height conversions (to meters)
    if (normalizedTo === 'm') {
      if (normalizedFrom === 'cm') return value / 100;
      if (normalizedFrom === 'ft') return value * 0.3048;
      if (normalizedFrom === 'inch' || normalizedFrom === 'in') return value * 0.0254;
    }

    // Weight conversions (to kg)
    if (normalizedTo === 'kg') {
      if (normalizedFrom === 'g') return value / 1000;
      if (normalizedFrom === 'lbs' || normalizedFrom === 'lb') return value * 0.453592;
      if (normalizedFrom === 'stone') return value * 6.35029;
    }

    // Temperature conversions
    if (normalizedTo === '°c' || normalizedTo === 'c' || normalizedTo === 'celsius') {
      if (normalizedFrom === '°f' || normalizedFrom === 'f' || normalizedFrom === 'fahrenheit') {
        return (value - 32) * (5 / 9);
      }
    }

    // No conversion needed
    return value;
  }

  /**
   * Detect which calculator type is most appropriate for extracted data
   * Improved confidence scoring
   */
  detectCalculatorType(extraction: ExtractionResult, confidence: number = 0.7): CalculatorType | null {
    // If extraction service already detected a type with high confidence, use it
    if (extraction.confidence >= 0.8 && extraction.type) {
      return extraction.type;
    }

    // Fallback detection based on fields present
    const keys = Object.keys(extraction.values).map(k => k.toLowerCase());
    const unitKeys = Object.keys(extraction.units).map(k => k.toLowerCase());
    const allKeys = [...keys, ...unitKeys].join(' ');

    // Score each calculator type
    const scores: Record<CalculatorType, number> = {
      basic: 0,
      scientific: 0,
      financial: 0,
      statistical: 0,
      engineering: 0,
      chemical: 0,
      health: 0,
      mortgage: 0,
    };

    // Basic indicators
    if (keys.includes('a') || keys.includes('b') || keys.includes('num1') || keys.includes('num2')) {
      scores.basic += 2;
    }

    // Scientific indicators
    if (allKeys.includes('sin') || allKeys.includes('cos') || allKeys.includes('tan') ||
        allKeys.includes('log') || allKeys.includes('sqrt') || allKeys.includes('factorial')) {
      scores.scientific += 3;
    }

    // Financial indicators
    if (allKeys.includes('principal') || allKeys.includes('interest') || allKeys.includes('loan') ||
        allKeys.includes('rate') && allKeys.includes('time')) {
      scores.financial += 3;
    }

    // Statistical indicators
    if (keys.includes('data') || allKeys.includes('mean') || allKeys.includes('median') ||
        allKeys.includes('stdev') || allKeys.includes('variance')) {
      scores.statistical += 3;
    }

    // Engineering indicators
    if (allKeys.includes('temperature') || allKeys.includes('celsius') || allKeys.includes('fahrenheit') ||
        allKeys.includes('km') || allKeys.includes('mile') || allKeys.includes('conversion')) {
      scores.engineering += 3;
    }

    // Chemical indicators
    if (allKeys.includes('molarity') || allKeys.includes('moles') || allKeys.includes('ph') ||
        allKeys.includes('concentration') || allKeys.includes('chemical')) {
      scores.chemical += 3;
    }

    // Health indicators
    if (allKeys.includes('height') || allKeys.includes('weight') || allKeys.includes('bmi') ||
        allKeys.includes('age') || allKeys.includes('tdee') || allKeys.includes('calories')) {
      scores.health += 3;
    }

    // Mortgage indicators
    if (allKeys.includes('mortgage') || allKeys.includes('loan_amount') && allKeys.includes('annual_rate') && allKeys.includes('years')) {
      scores.mortgage += 3;
    }

    // Find highest scoring type
    let bestType: CalculatorType | null = null;
    let bestScore = confidence * 2; // Require minimum threshold

    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type as CalculatorType;
      }
    }

    return bestType;
  }

  /**
   * Suggest appropriate calculator based on detected type
   * Includes confidence and reasoning
   */
  getSuggestion(extraction: ExtractionResult): {
    calculatorType: CalculatorType | null;
    confidence: number;
    reasoning: string;
  } {
    const detected = this.detectCalculatorType(extraction);
    let reasoning = '';

    if (detected && extraction.extractedFields) {
      reasoning = `Detected ${detected} calculator based on fields: ${extraction.extractedFields.join(', ')}`;
    } else if (!detected) {
      reasoning = 'Could not confidently detect calculator type. Please select manually.';
    }

    return {
      calculatorType: detected,
      confidence: extraction.confidence,
      reasoning,
    };
  }
}

export const dataMapper = new DataMapper();
