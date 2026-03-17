import React, { useState, useEffect } from 'react';
import { CalculationResult, CalculationInput } from '../../types';
import { calculatorEngine } from '../../services/calculatorEngine';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ResultsDisplay from '../ResultsDisplay';

const OPERATIONS = [
  { value: 'molarity', label: 'Molarity' },
  { value: 'ph_from_concentration', label: 'pH from Concentration' },
  { value: 'concentration_from_ph', label: 'Concentration from pH' },
];

interface ChemicalCalculatorProps {
  initialInputs?: Partial<CalculationInput>;
  onResultChange?: (result: CalculationResult) => void;
}

export default function ChemicalCalculator({
  initialInputs = {},
  onResultChange,
}: ChemicalCalculatorProps) {
  const [inputs, setInputs] = useState<CalculationInput>({
    operation: initialInputs.operation || 'molarity',
    moles: initialInputs.moles || '',
    volume: initialInputs.volume || '',
    concentration: initialInputs.concentration || '',
    pH_value: initialInputs.pH_value || '',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      const operation = inputs.operation as string;
      const hasRequiredFields =
        operation === 'molarity'
          ? inputs.moles && inputs.volume
          : operation === 'ph_from_concentration'
          ? inputs.concentration
          : operation === 'concentration_from_ph'
          ? inputs.pH_value
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

      const calcResult = await calculatorEngine.calculateChemical(inputs);
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

  const operation = inputs.operation as string;

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Chemical Calculator
        </h2>

        <div className="space-y-4">
          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Calculation Type
            </label>
            <div className="grid grid-cols-3 gap-2">
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

          {/* Molarity: Moles and Volume */}
          {operation === 'molarity' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Moles (mol)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter moles"
                  value={inputs.moles}
                  onChange={e => handleInputChange('moles', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Volume (Liters)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter volume"
                  value={inputs.volume}
                  onChange={e => handleInputChange('volume', e.target.value)}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* pH from Concentration */}
          {operation === 'ph_from_concentration' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                H⁺ Concentration (mol/L)
              </label>
              <Input
                type="number"
                step="1e-8"
                placeholder="e.g., 0.001"
                value={inputs.concentration}
                onChange={e => handleInputChange('concentration', e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Concentration from pH */}
          {operation === 'concentration_from_ph' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                pH Value
              </label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g., 7.0"
                min="0"
                max="14"
                value={inputs.pH_value}
                onChange={e => handleInputChange('pH_value', e.target.value)}
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
