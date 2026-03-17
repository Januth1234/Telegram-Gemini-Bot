import React, { useState } from 'react';
import { CalculationResult } from '../types';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Copy, Download, FileJson, FileText } from 'lucide-react';
import { calculationHistoryService } from '../services/calculationHistoryService';

interface ResultsDisplayProps {
  result: CalculationResult | null;
  loading?: boolean;
  error?: string;
  onExport?: () => void;
  onCopy?: () => void;
  showExportOptions?: boolean;
}

export default function ResultsDisplay({
  result,
  loading = false,
  error,
  onExport,
  onCopy,
  showExportOptions = true,
}: ResultsDisplayProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!result) return;
    const json = calculationHistoryService.exportAsJSON({
      id: `calc_${Date.now()}`,
      userId: '',
      type: result.calculatorType,
      inputs: {},
      result,
      timestamp: result.timestamp,
    });
    downloadFile(json, `calculation_${Date.now()}.json`, 'application/json');
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    if (!result) return;
    const csv = calculationHistoryService.exportAsCSV({
      id: `calc_${Date.now()}`,
      userId: '',
      type: result.calculatorType,
      inputs: {},
      result,
      timestamp: result.timestamp,
    });
    downloadFile(csv, `calculation_${Date.now()}.csv`, 'text/csv');
    setShowExportMenu(false);
  };

  const handleExportHTML = () => {
    if (!result) return;
    const html = calculationHistoryService.exportAsHTML({
      id: `calc_${Date.now()}`,
      userId: '',
      type: result.calculatorType,
      inputs: {},
      result,
      timestamp: result.timestamp,
    });
    downloadFile(html, `calculation_${Date.now()}.html`, 'text/html');
    setShowExportMenu(false);
  };
  if (!result) {
    return (
      <Card className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 dark:text-slate-400 text-center">
          Enter values above to see results
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></div>
          <span className="text-slate-600 dark:text-slate-300 ml-2">Calculating...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <div className="flex items-start space-x-3">
          <div className="text-red-600 dark:text-red-400 mt-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-red-900 dark:text-red-100">Calculation Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Result */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 border-b border-slate-200 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Result</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {typeof result.value === 'number'
                ? result.value.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                    minimumFractionDigits: 0,
                  })
                : result.value}
            </span>
            {result.unit && (
              <span className="text-lg text-slate-600 dark:text-slate-400 font-medium">
                {result.unit}
              </span>
            )}
          </div>
        </div>

        {/* Formula */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Formula</p>
          <code className="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-lg block text-slate-900 dark:text-slate-100 font-mono break-all">
            {result.formula}
          </code>
        </div>

        {/* Step-by-Step */}
        {result.steps.length > 0 && (
          <div className="p-6 bg-white dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
              Step-by-Step Solution
            </p>
            <div className="space-y-4">
              {result.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex space-x-4 pb-4 last:pb-0 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {step.description}
                    </p>
                    <code className="block mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded text-slate-900 dark:text-slate-100 font-mono overflow-x-auto">
                      {step.expression}
                    </code>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Result:</span> {step.result}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCopy && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="flex items-center gap-2 flex-1"
          >
            <Copy className="w-4 h-4" />
            Copy Result
          </Button>
        )}
        {showExportOptions && (
          <div className="relative flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            {showExportMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-max">
                <button
                  onClick={handleExportJSON}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm"
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm border-t border-slate-200 dark:border-slate-700"
                >
                  <FileText className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={handleExportHTML}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm border-t border-slate-200 dark:border-slate-700"
                >
                  <FileText className="w-4 h-4" />
                  HTML (PDF-Ready)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
