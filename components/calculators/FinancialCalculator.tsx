import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const OPERATIONS = [
  { value: 'compound_interest', label: 'Compound Interest' },
  { value: 'loan_payment', label: 'Loan Payment' },
];

interface FinancialCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function FinancialCalculator({
  initialInputs = {},
  onResultChange,
}: FinancialCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    operation: initialInputs.operation || 'compound_interest',
    principal: initialInputs.principal || '',
    rate: initialInputs.rate || '',
    time: initialInputs.time || '',
    compounds: initialInputs.compounds || 12,
    periods: initialInputs.periods || '',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      const operation = inputs.operation as string;
      const hasRequiredFields =
        operation === 'compound_interest'
          ? inputs.principal && inputs.rate && inputs.time
          : operation === 'loan_payment'
          ? inputs.principal && inputs.rate && inputs.periods
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

      const calcResult = await calculatorEngine.calculateFinancial(inputs);
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

  const isCompoundInterest = inputs.operation === 'compound_interest';

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Financial Calculator
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

          {/* Principal/Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isCompoundInterest ? 'Principal (Amount)' : 'Loan Amount'}
              <span className="text-xs text-slate-500 ml-1">in currency</span>
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter amount"
              value={inputs.principal}
              onChange={e => handleInputChange('principal', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Annual Interest Rate
              <span className="text-xs text-slate-500 ml-1">%</span>
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g., 5.5"
              value={inputs.rate}
              onChange={e => handleInputChange('rate', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Time or Periods */}
          {isCompoundInterest ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Time Period
                  <span className="text-xs text-slate-500 ml-1">years</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter years"
                  value={inputs.time}
                  onChange={e => handleInputChange('time', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Compounds Per Year
                  <span className="text-xs text-slate-500 ml-1">frequency</span>
                </label>
                <select
                  value={inputs.compounds}
                  onChange={e => handleInputChange('compounds', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
                >
                  <option value="1">Annually</option>
                  <option value="2">Semi-Annually</option>
                  <option value="4">Quarterly</option>
                  <option value="12">Monthly</option>
                  <option value="365">Daily</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Number of Months
              </label>
              <Input
                type="number"
                step="1"
                placeholder="Enter number of months"
                value={inputs.periods}
                onChange={e => handleInputChange('periods', e.target.value)}
                className="w-full"
              />
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
