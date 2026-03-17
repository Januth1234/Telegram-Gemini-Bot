import React, { useState, useEffect } from 'react';
import { CalculatorType, CalculationInput, ExtractionResult } from '../types';
import { Card } from './ui/card';
import { Button } from './ui/button';
import DataExtractor from './DataExtractor';
import BasicCalculator from './calculators/BasicCalculator';
import ScientificCalculator from './calculators/ScientificCalculator';
import FinancialCalculator from './calculators/FinancialCalculator';
import StatisticalCalculator from './calculators/StatisticalCalculator';
import EngineeringCalculator from './calculators/EngineeringCalculator';
import ChemicalCalculator from './calculators/ChemicalCalculator';
import HealthCalculator from './calculators/HealthCalculator';
import MortgageCalculator from './calculators/MortgageCalculator';
import { Grid, Calculator, Zap } from 'lucide-react';

const CALCULATOR_REGISTRY: Record<
  CalculatorType,
  {
    name: string;
    icon: React.ReactNode;
    description: string;
    component: React.ComponentType<{ initialInputs?: Partial<CalculationInput> }>;
  }
> = {
  basic: {
    name: 'Basic',
    icon: <Calculator className="w-5 h-5" />,
    description: 'Add, subtract, multiply, divide',
    component: BasicCalculator,
  },
  scientific: {
    name: 'Scientific',
    icon: <Zap className="w-5 h-5" />,
    description: 'Trigonometry, logarithms, factorials',
    component: ScientificCalculator,
  },
  financial: {
    name: 'Financial',
    icon: <Grid className="w-5 h-5" />,
    description: 'Loans, mortgages, compound interest',
    component: FinancialCalculator,
  },
  statistical: {
    name: 'Statistical',
    icon: <Grid className="w-5 h-5" />,
    description: 'Mean, median, standard deviation',
    component: StatisticalCalculator,
  },
  engineering: {
    name: 'Engineering',
    icon: <Grid className="w-5 h-5" />,
    description: 'Unit conversions, physics',
    component: EngineeringCalculator,
  },
  chemical: {
    name: 'Chemical',
    icon: <Grid className="w-5 h-5" />,
    description: 'Molarity, pH, chemistry',
    component: ChemicalCalculator,
  },
  health: {
    name: 'Health',
    icon: <Grid className="w-5 h-5" />,
    description: 'BMI, TDEE, health metrics',
    component: HealthCalculator,
  },
  mortgage: {
    name: 'Mortgage',
    icon: <Grid className="w-5 h-5" />,
    description: 'Real estate financing',
    component: MortgageCalculator,
  },
};

interface CalculatorHubProps {
  autoHeight?: boolean;
}

export default function CalculatorHub({ autoHeight = false }: CalculatorHubProps) {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorType>('basic');
  const [extractedInputs, setExtractedInputs] = useState<Partial<CalculationInput> | null>(null);
  const [showExtractor, setShowExtractor] = useState(true);

  const handleExtraction = (result: ExtractionResult, inputs: CalculationInput) => {
    setExtractedInputs(inputs);
    // Auto-hide extractor on mobile after successful extraction
    if (window.innerWidth < 768) {
      setShowExtractor(false);
    }
  };

  const handleCalculatorDetected = (type: CalculatorType) => {
    setActiveCalculator(type);
  };

  const CurrentCalculator = CALCULATOR_REGISTRY[activeCalculator].component;

  return (
    <div className={`w-full ${autoHeight ? '' : 'min-h-screen'} bg-slate-50 dark:bg-slate-950 p-4 md:p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Calculator Hub
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Upload images or paste text for AI-powered data extraction, then calculate instantly
          </p>
        </div>

        {/* Main Layout: Desktop (side-by-side) */}
        <div className="hidden md:grid md:grid-cols-2 gap-6 mb-6">
          {/* Left: Data Extractor */}
          <div>
            <DataExtractor
              onExtracted={handleExtraction}
              onCalculatorDetected={handleCalculatorDetected}
            />
          </div>

          {/* Right: Calculator */}
          <div className="space-y-6">
            {/* Calculator Selector */}
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(CALCULATOR_REGISTRY) as Array<
                [CalculatorType, (typeof CALCULATOR_REGISTRY)[CalculatorType]]
              >).map(([type, config]) => (
                <Button
                  key={type}
                  variant={activeCalculator === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCalculator(type)}
                  className="flex flex-col items-center gap-1 h-auto py-2"
                >
                  <div className="flex items-center gap-1">
                    {config.icon}
                    <span className="text-xs font-medium">{config.name}</span>
                  </div>
                </Button>
              ))}
            </div>

            {/* Calculator Component */}
            <CurrentCalculator initialInputs={extractedInputs || undefined} />
          </div>
        </div>

        {/* Mobile Layout: Tabbed */}
        <div className="md:hidden space-y-4">
          {/* Tab Toggle */}
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowExtractor(true)}
              className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                showExtractor
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              Extract
            </button>
            <button
              onClick={() => setShowExtractor(false)}
              className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                !showExtractor
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              Calculate
            </button>
          </div>

          {/* Extractor Tab */}
          {showExtractor && (
            <DataExtractor
              onExtracted={handleExtraction}
              onCalculatorDetected={handleCalculatorDetected}
            />
          )}

          {/* Calculator Tab */}
          {!showExtractor && (
            <div className="space-y-4">
              {/* Calculator Selector */}
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(CALCULATOR_REGISTRY) as Array<
                  [CalculatorType, (typeof CALCULATOR_REGISTRY)[CalculatorType]]
                >).map(([type, config]) => (
                  <Button
                    key={type}
                    variant={activeCalculator === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveCalculator(type)}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <span className="text-xs font-medium">{config.name}</span>
                  </Button>
                ))}
              </div>

              {/* Calculator Component */}
              <CurrentCalculator initialInputs={extractedInputs || undefined} />
            </div>
          )}
        </div>

        {/* Calculator Info Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(CALCULATOR_REGISTRY) as Array<
            [CalculatorType, (typeof CALCULATOR_REGISTRY)[CalculatorType]]
          >).map(([type, config]) => (
            <Card
              key={type}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-800"
              onClick={() => {
                setActiveCalculator(type);
                if (window.innerWidth < 768) {
                  setShowExtractor(false);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 mt-1">{config.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {config.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {config.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Feature Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              AI-Powered Extraction
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Upload images or paste text. Our AI extracts numbers, values, and units automatically.
            </p>
          </Card>
          <Card className="p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              Instant Calculations
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              See results in real-time as you enter or extract data. Step-by-step breakdowns included.
            </p>
          </Card>
          <Card className="p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              Multiple Calculator Types
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Switch between 8+ specialized calculators for different domains and use cases.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
