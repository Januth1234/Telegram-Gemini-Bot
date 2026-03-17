import { StoredCalculation, CalculatorType, CalculationInput, CalculationResult } from '../types';
import { cacheService, CacheKey } from './cacheService';

/**
 * Manages calculation history for localStorage and Firebase storage
 */
export class CalculationHistoryService {
  private historyKey = 'orin_calculations_v1';
  private maxLocalHistory = 100; // Keep last 100 calculations locally

  /**
   * Save calculation to local storage and optionally to Firebase
   */
  async saveCalculation(
    type: CalculatorType,
    inputs: CalculationInput,
    result: CalculationResult,
    extractionInfo?: {
      imageUrl?: string;
      passage?: string;
      confidence?: number;
    }
  ): Promise<StoredCalculation> {
    const calculation: StoredCalculation = {
      id: this.generateId(),
      userId: '', // Will be set if user is authenticated
      type,
      inputs,
      result,
      extractedFrom: extractionInfo,
      timestamp: new Date(),
    };

    // Save to localStorage
    this.addToLocalHistory(calculation);

    return calculation;
  }

  /**
   * Get all calculations from local storage
   */
  getLocalHistory(): StoredCalculation[] {
    try {
      const stored = localStorage.getItem(this.historyKey);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[v0] Failed to load calculation history:', error);
      return [];
    }
  }

  /**
   * Add calculation to local history (with max limit)
   */
  private addToLocalHistory(calculation: StoredCalculation): void {
    try {
      const history = this.getLocalHistory();
      history.unshift(calculation); // Add to beginning
      
      // Keep only most recent items
      const trimmed = history.slice(0, this.maxLocalHistory);
      
      localStorage.setItem(this.historyKey, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[v0] Failed to save calculation to history:', error);
    }
  }

  /**
   * Delete a calculation from history
   */
  deleteCalculation(id: string): void {
    try {
      const history = this.getLocalHistory();
      const filtered = history.filter(c => c.id !== id);
      localStorage.setItem(this.historyKey, JSON.stringify(filtered));
    } catch (error) {
      console.error('[v0] Failed to delete calculation:', error);
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.historyKey);
    } catch (error) {
      console.error('[v0] Failed to clear history:', error);
    }
  }

  /**
   * Export calculation as JSON
   */
  exportAsJSON(calculation: StoredCalculation): string {
    return JSON.stringify(calculation, null, 2);
  }

  /**
   * Export calculation as CSV
   */
  exportAsCSV(calculation: StoredCalculation): string {
    const headers = ['Field', 'Value'];
    const rows = [headers];

    rows.push(['Calculator Type', calculation.type]);
    rows.push(['Result', `${calculation.result.value} ${calculation.result.unit}`]);
    rows.push(['Formula', calculation.result.formula]);
    rows.push(['Timestamp', new Date(calculation.timestamp).toLocaleString()]);

    // Add inputs
    Object.entries(calculation.inputs).forEach(([key, value]) => {
      rows.push([key, String(value)]);
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  /**
   * Export calculation as PDF-compatible HTML
   */
  exportAsHTML(calculation: StoredCalculation): string {
    const now = new Date().toLocaleString();
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Calculation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .section { margin: 20px 0; }
    .section h2 { color: #333; border-left: 4px solid #0066cc; padding-left: 10px; }
    .result { font-size: 24px; font-weight: bold; color: #0066cc; }
    .formula { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; }
    .steps { margin: 15px 0; }
    .step { margin: 10px 0; padding-left: 20px; border-left: 2px solid #ddd; }
    .step-num { font-weight: bold; color: #0066cc; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Calculation Report</h1>
    <p>Generated on ${now}</p>
  </div>

  <div class="section">
    <h2>Calculation Details</h2>
    <p><strong>Calculator Type:</strong> ${calculation.type}</p>
    <p><strong>Formula:</strong></p>
    <div class="formula">${calculation.result.formula}</div>
  </div>

  <div class="section">
    <h2>Result</h2>
    <p class="result">${calculation.result.value} ${calculation.result.unit}</p>
  </div>

  ${
    calculation.result.steps.length > 0
      ? `
  <div class="section">
    <h2>Step-by-Step Solution</h2>
    <div class="steps">
      ${calculation.result.steps
        .map(
          (step, idx) => `
      <div class="step">
        <span class="step-num">Step ${idx + 1}:</span> ${step.description}
        <div class="formula">${step.expression}</div>
        <p>Result: ${step.result}</p>
      </div>
      `
        )
        .join('')}
    </div>
  </div>
      `
      : ''
  }

  ${
    Object.keys(calculation.inputs).length > 0
      ? `
  <div class="section">
    <h2>Input Values</h2>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      ${Object.entries(calculation.inputs)
        .map(
          ([key, value]) => `
      <tr>
        <td>${key}</td>
        <td>${value}</td>
      </tr>
      `
        )
        .join('')}
    </table>
  </div>
      `
      : ''
  }

  <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
    <p>Generated by Orin AI Calculator Hub</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `calc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Filter history by calculator type
   */
  filterByType(type: CalculatorType): StoredCalculation[] {
    return this.getLocalHistory().filter(c => c.type === type);
  }

  /**
   * Get history from the last N days
   */
  getRecentHistory(days: number = 7): StoredCalculation[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.getLocalHistory().filter(c => new Date(c.timestamp).getTime() > cutoff);
  }
}

export const calculationHistoryService = new CalculationHistoryService();
