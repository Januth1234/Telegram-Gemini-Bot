import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const OPERATIONS = [
  { value: 'add', label: 'Add (+)' },
  { value: 'subtract', label: 'Subtract (−)' },
  { value: 'multiply', label: 'Multiply (×)' },
  { value: 'divide', label: 'Divide (÷)' },
  { value: 'power', label: 'Power (^)' },
];

interface BasicCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function BasicCalculator({
  initialInputs = {},
  onResultChange,
}: BasicCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    a: initialInputs.a || '',
    b: initialInputs.b || '',
    operation: initialInputs.operation || 'add',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputs.a !== '' && inputs.b !== '') {
        calculateResult();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs]);

  const calculateResult = async () => {
    try {
      setLoading(true);
      setError('');

      const calcResult = await calculatorEngine.calculateBasic(inputs);
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
      const text = `${result.value} ${result.unit}\n\nFormula: ${result.formula}`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Basic Calculator
        </h2>

        <div className="space-y-4">
          {/* First Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              First Number
            </label>
            <Input
              type="number"
              placeholder="Enter first number"
              value={inputs.a}
              onChange={e => handleInputChange('a', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Operation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Operation
            </label>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {OPERATIONS.map(op => (
                <Button
                  key={op.value}
                  variant={inputs.operation === op.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('operation', op.value)}
                  className="text-xs"
                >
                  {op.label.split(' ')[1]}
                </Button>
              ))}
            </div>
          </div>

          {/* Second Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Second Number
            </label>
            <Input
              type="number"
              placeholder="Enter second number"
              value={inputs.b}
              onChange={e => handleInputChange('b', e.target.value)}
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
