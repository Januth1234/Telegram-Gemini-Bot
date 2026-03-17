import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const FUNCTIONS = [
  { value: 'sin', label: 'sin(x)', category: 'trigonometry' },
  { value: 'cos', label: 'cos(x)', category: 'trigonometry' },
  { value: 'tan', label: 'tan(x)', category: 'trigonometry' },
  { value: 'sqrt', label: '√', category: 'algebra' },
  { value: 'log', label: 'log₁₀', category: 'logarithm' },
  { value: 'ln', label: 'ln', category: 'logarithm' },
  { value: 'factorial', label: 'n!', category: 'algebra' },
];

interface ScientificCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function ScientificCalculator({
  initialInputs = {},
  onResultChange,
}: ScientificCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    value: initialInputs.value || '',
    operation: initialInputs.operation || 'sin',
    angle_unit: initialInputs.angle_unit || 'degrees',
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

      const calcResult = await calculatorEngine.calculateScientific(inputs);
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
      const text = `${result.value}\n\nFormula: ${result.formula}`;
      navigator.clipboard.writeText(text);
    }
  };

  const trigFunctions = FUNCTIONS.filter(f => f.category === 'trigonometry');
  const otherFunctions = FUNCTIONS.filter(f => f.category !== 'trigonometry');

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Scientific Calculator
        </h2>

        <div className="space-y-4">
          {/* Value Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Value
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter value"
              value={inputs.value}
              onChange={e => handleInputChange('value', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Angle Unit (for trig functions) */}
          {['sin', 'cos', 'tan'].includes(inputs.operation as string) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Angle Unit
              </label>
              <div className="flex gap-2">
                <Button
                  variant={inputs.angle_unit === 'degrees' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('angle_unit', 'degrees')}
                  className="flex-1"
                >
                  Degrees
                </Button>
                <Button
                  variant={inputs.angle_unit === 'radians' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('angle_unit', 'radians')}
                  className="flex-1"
                >
                  Radians
                </Button>
              </div>
            </div>
          )}

          {/* Trigonometric Functions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Trigonometric
            </label>
            <div className="grid grid-cols-3 gap-2">
              {trigFunctions.map(func => (
                <Button
                  key={func.value}
                  variant={inputs.operation === func.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('operation', func.value)}
                >
                  {func.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Other Functions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Other Functions
            </label>
            <div className="grid grid-cols-4 gap-2">
              {otherFunctions.map(func => (
                <Button
                  key={func.value}
                  variant={inputs.operation === func.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('operation', func.value)}
                  className="text-xs"
                >
                  {func.label}
                </Button>
              ))}
            </div>
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
