import React, { useState, useRef } from 'react';
import { ExtractionResult, CalculatorType, CalculationInput } from '../types';
import { extractionService } from '../services/extractionService';
import { dataMapper } from '../services/dataMapper';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface DataExtractorProps {
  onExtracted?: (result: ExtractionResult, inputs: CalculationInput) => void;
  onCalculatorDetected?: (type: CalculatorType) => void;
  disabled?: boolean;
}

export default function DataExtractor({
  onExtracted,
  onCalculatorDetected,
  disabled = false,
}: DataExtractorProps) {
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [passage, setPassage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Preview image
    const reader = new FileReader();
    reader.onload = e => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const event = {
        target: { files: e.dataTransfer.files },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    }
  };

  const extractFromImage = async () => {
    if (!file) {
      setError('Please select an image');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const reader = new FileReader();
      reader.onload = async e => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];

        const extracted = await extractionService.analyzeImage(base64Data, file.type);
        setResult(extracted);

        // Auto-detect calculator type
        const suggestion = dataMapper.getSuggestion(extracted);
        if (suggestion.calculatorType) {
          onCalculatorDetected?.(suggestion.calculatorType);
        }

        // Map to inputs and notify parent
        if (extracted) {
          const calculatorType = extracted.type || suggestion.calculatorType;
          if (calculatorType) {
            const inputs = dataMapper.mapToCalculatorInputs(extracted, calculatorType);
            onExtracted?.(extracted, inputs);
          }
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const extractFromPassage = async () => {
    if (!passage.trim()) {
      setError('Please enter some text');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const extracted = await extractionService.analyzePassage(passage);
      setResult(extracted);

      // Auto-detect calculator type
      const suggestion = dataMapper.getSuggestion(extracted);
      if (suggestion.calculatorType) {
        onCalculatorDetected?.(suggestion.calculatorType);
      }

      // Map to inputs and notify parent
      if (extracted) {
        const calculatorType = extracted.type || suggestion.calculatorType;
        if (calculatorType) {
          const inputs = dataMapper.mapToCalculatorInputs(extracted, calculatorType);
          onExtracted?.(extracted, inputs);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPassage('');
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="p-6 border border-slate-200 dark:border-slate-800">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
        Data Extractor
      </h2>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setMode('image')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            mode === 'image'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
          disabled={disabled}
        >
          Upload Image
        </button>
        <button
          onClick={() => setMode('text')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 transition-colors ${
            mode === 'text'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
          disabled={disabled}
        >
          Paste Text
        </button>
      </div>

      {/* Image Mode */}
      {mode === 'image' && (
        <div className="space-y-4">
          {!file ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDragDrop}
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="font-medium text-slate-900 dark:text-white mb-1">
                Drop image here or click to browse
              </p>
              <p className="text-sm text-slate-500">Supports JPG, PNG, GIF, WebP</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {preview && (
                <div className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 h-48">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={handleClear}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {file.name}
              </p>
              <Button
                onClick={extractFromImage}
                disabled={loading || disabled}
                className="w-full"
              >
                {loading ? 'Extracting...' : 'Extract Data from Image'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Text Mode */}
      {mode === 'text' && (
        <div className="space-y-4">
          <textarea
            value={passage}
            onChange={e => setPassage(e.target.value)}
            placeholder="Paste your text here. E.g., 'John weighs 75 kg and is 1.8 m tall' or 'Calculate compound interest on $10,000 at 5% for 10 years'"
            className="w-full h-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white text-sm font-mono resize-none"
            disabled={disabled}
          />
          <Button
            onClick={extractFromPassage}
            disabled={loading || disabled}
            className="w-full"
          >
            {loading ? 'Extracting...' : 'Extract Data from Text'}
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-100">Extraction Error</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Extraction Result */}
      {result && (
        <div className="mt-6 space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white mb-1">
                Extraction Successful!
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Detected: <span className="font-semibold capitalize">{result.type}</span> Calculator
                <span className="text-xs ml-2">
                  (Confidence: {(result.confidence * 100).toFixed(0)}%)
                </span>
              </p>

              {/* Extracted Fields */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                  Extracted Values:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(result.values).map(([key, value]) => (
                    <div
                      key={key}
                      className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700"
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {key}
                      </p>
                      <p className="font-mono font-medium text-slate-900 dark:text-white">
                        {Array.isArray(value)
                          ? `[${value.join(', ')}]`
                          : typeof value === 'number'
                          ? value.toFixed(2)
                          : value}
                        {result.units[key] && ` ${result.units[key]}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
