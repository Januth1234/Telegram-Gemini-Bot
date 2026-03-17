import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const OPERATIONS = [
  { value: 'celsius_to_fahrenheit', label: '°C → °F' },
  { value: 'fahrenheit_to_celsius', label: '°F → °C' },
  { value: 'km_to_miles', label: 'km → miles' },
  { value: 'miles_to_km', label: 'miles → km' },
];

interface EngineeringCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function EngineeringCalculator({
  initialInputs = {},
  onResultChange,
}: EngineeringCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    operation: initialInputs.operation || 'celsius_to_fahrenheit',
    value: initialInputs.value || '',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputs.value !== '') {
        calculateResult();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs]);

  const calculateResult = async () => {
    try {
      setLoading(true);
      setError('');

      const calcResult = await calculatorEngine.calculateEngineering(inputs);
      setResult(calcResult);
      onResultChange?.(calcResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCopyResult = () => {
    if (result) {
      const text = `${result.value} ${result.unit}`;
      navigator.clipboard.writeText(text);
    }
  };

  const currentOp = OPERATIONS.find(op => op.value === inputs.operation);
  const inputUnit = currentOp?.label.split(' → ')[0] || 'Value';
  const outputUnit = currentOp?.label.split(' → ')[1] || 'Result';

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Engineering Calculator
        </h2>

        <div className="space-y-4">
          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Conversion Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OPERATIONS.map(op => (
                <Button
                  key={op.value}
                  variant={inputs.operation === op.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('operation', op.value)}
                  className="text-xs"
                >
                  {op.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Value Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {inputUnit}
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder={`Enter ${inputUnit.toLowerCase()}`}
              value={inputs.value}
              onChange={e => handleInputChange('value', e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Results */}
      <ResultsDisplay
        result={result}
        loading={loading}
        error={error}
        onCopy={handleCopyResult}
      />
    </div>
  );
}
