/**
 * useKeyboardShortcuts - Custom hook for handling keyboard shortcuts in Math mode
 * Provides standard shortcuts for math operations: undo/redo, history navigation, etc.
 */

import { useEffect, useRef } from 'react';

export interface KeyboardShortcutConfig {
  onSolve?: () => void;           // Ctrl+Enter
  onUndo?: () => void;            // Ctrl+Z
  onRedo?: () => void;            // Ctrl+Y or Ctrl+Shift+Z
  onNextHistory?: () => void;     // Arrow Up
  onPrevHistory?: () => void;     // Arrow Down
  onClear?: () => void;           // Escape (in input context)
  onHelp?: () => void;            // Shift+?
  onToggleGraphs?: () => void;    // Ctrl+G
  enabled?: boolean;
}

/**
 * Hook to attach keyboard shortcuts to a container element
 * @param containerRef - Reference to the element where shortcuts should be active
 * @param config - Configuration object with callback functions
 */
export function useKeyboardShortcuts(
  containerRef: React.RefObject<HTMLElement | null>,
  config: KeyboardShortcutConfig
) {
  const {
    onSolve,
    onUndo,
    onRedo,
    onNextHistory,
    onPrevHistory,
    onClear,
    onHelp,
    onToggleGraphs,
    enabled = true,
  } = config;

  const lastTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field (unless it's a math input)
      const target = event.target as HTMLElement;
      const isTextInput = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      const isMathInput = target.tagName === 'MATH-FIELD' || target.classList.contains('math-input');

      // Helper: prevent default only if needed
      const preventDefault = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      // Helper: debounce shortcuts (prevent rapid repeated triggering)
      const shouldExecute = (key: string, delayMs: number = 100): boolean => {
        const now = Date.now();
        const lastTime = lastTimeRef.current[key] || 0;
        if (now - lastTime < delayMs) return false;
        lastTimeRef.current[key] = now;
        return true;
      };

      // Ctrl+Enter: Solve
      if (event.ctrlKey && event.key === 'Enter' && onSolve && shouldExecute('solve')) {
        preventDefault();
        onSolve();
        return;
      }

      // Ctrl+Z: Undo
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey && onUndo && shouldExecute('undo')) {
        preventDefault();
        onUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if (
        ((event.ctrlKey && event.key === 'y') ||
          (event.ctrlKey && event.shiftKey && event.key === 'Z')) &&
        onRedo &&
        shouldExecute('redo')
      ) {
        preventDefault();
        onRedo();
        return;
      }

      // Arrow Up: Previous history (only if in input and not in text mode)
      if (
        event.key === 'ArrowUp' &&
        isMathInput &&
        onNextHistory &&
        shouldExecute('historyPrev')
      ) {
        preventDefault();
        onNextHistory();
        return;
      }

      // Arrow Down: Next history
      if (
        event.key === 'ArrowDown' &&
        isMathInput &&
        onPrevHistory &&
        shouldExecute('historyNext')
      ) {
        preventDefault();
        onPrevHistory();
        return;
      }

      // Escape: Clear (only in math input)
      if (event.key === 'Escape' && isMathInput && onClear && shouldExecute('clear')) {
        preventDefault();
        onClear();
        return;
      }

      // Ctrl+G: Toggle graphs
      if (event.ctrlKey && event.key === 'g' && onToggleGraphs && shouldExecute('toggleGraphs')) {
        preventDefault();
        onToggleGraphs();
        return;
      }

      // Shift+?: Help
      if (
        event.shiftKey &&
        (event.key === '?' || event.key === '/') &&
        onHelp &&
        shouldExecute('help')
      ) {
        preventDefault();
        onHelp();
        return;
      }
    };

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onSolve, onUndo, onRedo, onNextHistory, onPrevHistory, onClear, onHelp, onToggleGraphs]);
}

/**
 * Create a help overlay string describing available shortcuts
 */
export function getShortcutsHelpText(): string {
  return `
KEYBOARD SHORTCUTS

Solving & Operations:
  Ctrl+Enter  Solve equation
  Ctrl+Z      Undo
  Ctrl+Y      Redo
  Ctrl+G      Toggle graphs

Input Navigation:
  ↑ / ↓       Previous/next in history
  Escape      Clear input

Help:
  Shift+?     Show this help menu
`.trim();
}

/**
 * Format shortcuts for display in UI
 */
export function formatShortcut(
  action: string,
  shortcut: string
): { label: string; display: string } {
  const os = navigator.platform.toUpperCase();
  const isMac = os.includes('MAC') || os.includes('DARWIN');

  // Replace Ctrl with Cmd on Mac
  let display = shortcut;
  if (isMac) {
    display = display.replace('Ctrl', '⌘').replace('Shift', '⇧');
  } else {
    display = display.replace('+', ' + ');
  }

  return { label: action, display };
}
