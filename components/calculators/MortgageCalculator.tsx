import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

interface MortgageCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function MortgageCalculator({
  initialInputs = {},
  onResultChange,
}: MortgageCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    loan_amount: initialInputs.loan_amount || '',
    annual_rate: initialInputs.annual_rate || '',
    years: initialInputs.years || '',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputs.loan_amount && inputs.annual_rate && inputs.years) {
        calculateResult();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputs]);

  const calculateResult = async () => {
    try {
      setLoading(true);
      setError('');

      const calcResult = await calculatorEngine.calculateMortgage(inputs);
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
      const text = `Monthly Payment: ${result.value}\nTotal Interest: ${
        result.steps[2]?.result || 'N/A'
      }`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Mortgage Calculator
        </h2>

        <div className="space-y-4">
          {/* Loan Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loan Amount
              <span className="text-xs text-slate-500 ml-1">currency</span>
            </label>
            <Input
              type="number"
              step="1000"
              placeholder="e.g., 300000"
              value={inputs.loan_amount}
              onChange={e => handleInputChange('loan_amount', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Annual Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Annual Interest Rate
              <span className="text-xs text-slate-500 ml-1">%</span>
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g., 6.5"
              value={inputs.annual_rate}
              onChange={e => handleInputChange('annual_rate', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Loan Term */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loan Term
              <span className="text-xs text-slate-500 ml-1">years</span>
            </label>
            <Input
              type="number"
              step="1"
              placeholder="e.g., 30"
              value={inputs.years}
              onChange={e => handleInputChange('years', e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      {result && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Monthly Payment
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {typeof result.value === 'number'
                ? `$${result.value.toFixed(2)}`
                : result.value}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Total Payment
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              ${result.steps[1]?.result || 'N/A'}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Total Interest
            </p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ${result.steps[2]?.result || 'N/A'}
            </p>
          </Card>
        </div>
      )}

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
