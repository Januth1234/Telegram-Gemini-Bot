import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const OPERATIONS = [
  { value: 'mean', label: 'Mean (Average)' },
  { value: 'median', label: 'Median' },
  { value: 'std_dev', label: 'Standard Deviation' },
  { value: 'variance', label: 'Variance' },
];

interface StatisticalCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function StatisticalCalculator({
  initialInputs = {},
  onResultChange,
}: StatisticalCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    operation: initialInputs.operation || 'mean',
    data: initialInputs.data || '',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputs.data && typeof inputs.data === 'string' && inputs.data.trim()) {
        calculateResult();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs]);

  const calculateResult = async () => {
    try {
      setLoading(true);
      setError('');

      const calcResult = await calculatorEngine.calculateStatistical(inputs);
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
      const text = `${result.value}`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Statistical Calculator
        </h2>

        <div className="space-y-4">
          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Statistic
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

          {/* Data Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Data Values
              <span className="text-xs text-slate-500 ml-1">comma-separated</span>
            </label>
            <textarea
              placeholder="e.g., 10, 20, 30, 40, 50"
              value={inputs.data}
              onChange={e => handleInputChange('data', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white text-sm font-mono"
              rows={5}
            />
            <p className="text-xs text-slate-500 mt-2">
              Enter numbers separated by commas or spaces
            </p>
          </div>

          {/* Data Preview */}
          {typeof inputs.data === 'string' && inputs.data.trim() && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Parsed Values:
              </p>
              <div className="flex flex-wrap gap-2">
                {(inputs.data as string)
                  .split(/[,\s]+/)
                  .filter(v => v)
                  .slice(0, 10)
                  .map((val, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs rounded"
                    >
                      {val}
                    </span>
                  ))}
                {(inputs.data as string).split(/[,\s]+/).filter(v => v).length > 10 && (
                  <span className="inline-block px-2 py-1 text-slate-500 text-xs">
                    ...and {(inputs.data as string).split(/[,\s]+/).filter(v => v).length - 10} more
                  </span>
                )}
              </div>
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
