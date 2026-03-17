import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const OPERATIONS = [
  { value: 'bmi', label: 'BMI (Body Mass Index)' },
  { value: 'tdee', label: 'TDEE (Daily Calories)' },
];

interface HealthCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function HealthCalculator({
  initialInputs = {},
  onResultChange,
}: HealthCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    operation: initialInputs.operation || 'bmi',
    height: initialInputs.height || '',
    weight: initialInputs.weight || '',
    age: initialInputs.age || '',
    gender: initialInputs.gender || 'male',
    activity_level: initialInputs.activity_level || 'moderately_active',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      const operation = inputs.operation as string;
      const hasRequiredFields =
        operation === 'bmi'
          ? inputs.height && inputs.weight
          : operation === 'tdee'
          ? inputs.height && inputs.weight && inputs.age
          : false;

      if (hasRequiredFields) {
        calculateResult();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs]);

  const calculateResult = async () => {
    try {
      setLoading(true);
      setError('');

      const calcResult = await calculatorEngine.calculateHealth(inputs);
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

  const isTDEE = inputs.operation === 'tdee';

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Health Calculator
        </h2>

        <div className="space-y-4">
          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Calculation Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OPERATIONS.map(op => (
                <Button
                  key={op.value}
                  variant={inputs.operation === op.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('operation', op.value)}
                >
                  {op.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Height (meters)
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g., 1.75"
              value={inputs.height}
              onChange={e => handleInputChange('height', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Weight (kilograms)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="e.g., 70"
              value={inputs.weight}
              onChange={e => handleInputChange('weight', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Age (for TDEE only) */}
          {isTDEE && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Age (years)
              </label>
              <Input
                type="number"
                step="1"
                placeholder="e.g., 30"
                value={inputs.age}
                onChange={e => handleInputChange('age', e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Gender (for TDEE only) */}
          {isTDEE && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Gender
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={inputs.gender === 'male' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('gender', 'male')}
                >
                  Male
                </Button>
                <Button
                  variant={inputs.gender === 'female' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('gender', 'female')}
                >
                  Female
                </Button>
              </div>
            </div>
          )}

          {/* Activity Level (for TDEE only) */}
          {isTDEE && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Activity Level
              </label>
              <select
                value={inputs.activity_level}
                onChange={e => handleInputChange('activity_level', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
              >
                <option value="sedentary">Sedentary (little exercise)</option>
                <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                <option value="very_active">Very Active (6-7 days/week)</option>
                <option value="extremely_active">Extremely Active (training twice/day)</option>
              </select>
            </div>
          )}
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
