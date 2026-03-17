/**
 * useMathHistory - Custom hook for managing calculation input history
 * Handles undo/redo, history navigation, and persistence to localStorage
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface HistoryEntry {
  expression: string;
  timestamp: Date;
  category?: string;
}

export interface UseHistoryReturn {
  expression: string;
  setExpression: (expr: string) => void;
  history: HistoryEntry[];
  undo: () => void;
  redo: () => void;
  clear: () => void;
  navigateHistory: (direction: 'prev' | 'next') => void;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  addToHistory: (expr: string, category?: string) => void;
}

const HISTORY_STORAGE_KEY = 'orin_math_input_history_v1';
const MAX_HISTORY_SIZE = 100;

/**
 * Hook for managing math expression history with undo/redo
 * @param initialExpression - Starting expression (default: '')
 * @param persistToStorage - Save history to localStorage (default: true)
 */
export function useMathHistory(
  initialExpression: string = '',
  persistToStorage: boolean = true
): UseHistoryReturn {
  // History stack: [expr1, expr2, expr3, currentExpr]
  // currentIndex points to current position in stack
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (!persistToStorage) return [];

    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryEntry[];
        return parsed.slice(0, MAX_HISTORY_SIZE);
      }
    } catch (e) {
      console.warn('[useMathHistory] Failed to load history from localStorage:', e);
    }

    return [];
  });

  const [currentIndex, setCurrentIndex] = useState<number>(history.length);
  const [expression, setExpressionState] = useState<string>(initialExpression);
  const hasUnsavedChangesRef = useRef<boolean>(false);

  // Save history to localStorage on changes
  useEffect(() => {
    if (!persistToStorage || !hasUnsavedChangesRef.current) return;

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      hasUnsavedChangesRef.current = false;
    } catch (e) {
      console.warn('[useMathHistory] Failed to save history to localStorage:', e);
    }
  }, [history, persistToStorage]);

  /**
   * Get expression at specific history index
   */
  const getExpressionAt = useCallback((index: number): string => {
    if (index < 0 || index >= history.length) return expression;
    return history[index].expression;
  }, [history, expression]);

  /**
   * Set expression and update history
   */
  const setExpression = useCallback(
    (expr: string) => {
      setExpressionState(expr);

      // If user types while viewing history, truncate future history
      if (currentIndex < history.length) {
        const newHistory = history.slice(0, currentIndex);
        setHistory(newHistory);
      }
    },
    [currentIndex, history]
  );

  /**
   * Add expression to history (called after solving/operation)
   */
  const addToHistory = useCallback(
    (expr: string, category?: string) => {
      if (!expr || expr === expression) return; // Don't add duplicates

      const newEntry: HistoryEntry = {
        expression: expr,
        timestamp: new Date(),
        category,
      };

      // Truncate future history if navigating then making changes
      let newHistory = history.slice(0, currentIndex);
      newHistory.push(newEntry);

      // Keep size under control
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory = newHistory.slice(-MAX_HISTORY_SIZE);
      }

      setHistory(newHistory);
      setCurrentIndex(newHistory.length);
      setExpressionState(expr);
      hasUnsavedChangesRef.current = true;
    },
    [expression, history, currentIndex]
  );

  /**
   * Undo: go back one step
   */
  const undo = useCallback(() => {
    if (currentIndex <= 0) return;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    setExpressionState(getExpressionAt(newIndex));
  }, [currentIndex, getExpressionAt]);

  /**
   * Redo: go forward one step
   */
  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    setExpressionState(getExpressionAt(newIndex));
  }, [currentIndex, history.length, getExpressionAt]);

  /**
   * Navigate history with arrow keys
   */
  const navigateHistory = useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev') {
        undo();
      } else {
        redo();
      }
    },
    [undo, redo]
  );

  /**
   * Clear all history and reset to empty state
   */
  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(0);
    setExpressionState('');
    hasUnsavedChangesRef.current = true;
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    expression,
    setExpression,
    history,
    undo,
    redo,
    clear,
    navigateHistory,
    canUndo,
    canRedo,
    historyIndex: currentIndex,
    addToHistory,
  };
}

/**
 * Format history entry for display
 */
export function formatHistoryEntry(
  entry: HistoryEntry,
  maxLength: number = 50
): string {
  let text = entry.expression;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }

  const time = entry.timestamp instanceof Date
    ? entry.timestamp
    : new Date(entry.timestamp);

  const timeStr = formatTimeAgo(time);
  const category = entry.category ? ` [${entry.category}]` : '';

  return `${text}${category} • ${timeStr}`;
}

/**
 * Format time as relative string (e.g., "2 minutes ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  // For older entries, show the date
  return date.toLocaleDateString();
}

/**
 * Get recent history for display in UI
 */
export function getRecentHistory(
  history: HistoryEntry[],
  limit: number = 5
): HistoryEntry[] {
  return history.slice(-limit).reverse();
}

/**
 * Search history by expression text
 */
export function searchHistory(
  history: HistoryEntry[],
  query: string
): HistoryEntry[] {
  const lowerQuery = query.toLowerCase();
  return history.filter((entry) =>
    entry.expression.toLowerCase().includes(lowerQuery)
  );
}
