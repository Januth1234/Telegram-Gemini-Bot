/**
 * MathLoadingState - Loading indicator for math calculations
 * Shows progress, time elapsed, and helpful tips while calculating
 */

import React, { useState, useEffect } from 'react';

export interface MathLoadingStateProps {
  isLoading: boolean;
  status?: 'solving' | 'extracting' | 'graphing' | 'simplifying' | 'analyzing';
  progress?: number; // 0-100
  elapsedTime?: number; // milliseconds
  tip?: string;
  onCancel?: () => void;
  showTips?: boolean;
}

const STATUS_MESSAGES: Record<string, string> = {
  solving: 'Solving equation...',
  extracting: 'Extracting from image...',
  graphing: 'Generating graph...',
  simplifying: 'Simplifying expression...',
  analyzing: 'Analyzing function...',
};

const HELPFUL_TIPS = [
  'Did you know? Most equations solve in under 200ms.',
  'Tip: Use Ctrl+Enter to quickly solve an expression.',
  'Tip: Press ↑/↓ to navigate your calculation history.',
  'Tip: Click "Steps" to see the detailed solution.',
  'Fun fact: Complex calculations use both symbolic and numerical methods.',
  'Tip: Use parentheses to clarify expression order.',
  'Tip: Break complex problems into smaller steps.',
];

export const MathLoadingState: React.FC<MathLoadingStateProps> = ({
  isLoading,
  status = 'solving',
  progress = 0,
  elapsedTime = 0,
  tip,
  onCancel,
  showTips = true,
}) => {
  const [displayTip, setDisplayTip] = useState<string>('');
  const [animationFrame, setAnimationFrame] = useState<number>(0);

  // Rotate tips while loading
  useEffect(() => {
    if (!isLoading || !showTips) return;

    // Show a random tip
    if (!displayTip) {
      setDisplayTip(HELPFUL_TIPS[Math.floor(Math.random() * HELPFUL_TIPS.length)]);
    }

    // Change tip every 4 seconds
    const tipInterval = setInterval(() => {
      setDisplayTip(HELPFUL_TIPS[Math.floor(Math.random() * HELPFUL_TIPS.length)]);
    }, 4000);

    return () => clearInterval(tipInterval);
  }, [isLoading, showTips, displayTip]);

  // Animate loading spinner
  useEffect(() => {
    if (!isLoading) return;

    let frame = 0;
    const animInterval = setInterval(() => {
      frame = (frame + 1) % 4;
      setAnimationFrame(frame);
    }, 100);

    return () => clearInterval(animInterval);
  }, [isLoading]);

  if (!isLoading) return null;

  const statusMessage = STATUS_MESSAGES[status] || STATUS_MESSAGES.solving;
  const timeText = elapsedTime > 0 ? `${(elapsedTime / 1000).toFixed(1)}s` : '';
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸'];
  const spinner = spinnerFrames[animationFrame];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 space-y-6">
      {/* Animated spinner */}
      <div className="flex items-center gap-3">
        <span className="text-2xl text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">
          {spinner}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {statusMessage}
          </p>
          {timeText && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Elapsed: {timeText}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-full max-w-xs">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
              style={{ width: `${Math.min(progress, 95)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Helpful tip */}
      {showTips && displayTip && (
        <div className="max-w-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-900 dark:text-blue-200 text-center italic">
            {displayTip}
          </p>
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 
                   bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 
                   rounded-lg transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

/**
 * Lightweight loading skeleton for quick feedback
 */
export const MathLoadingSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md"
          style={{
            width: `${Math.random() * 40 + 60}%`,
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Inline loading indicator for compact spaces
 */
export const MathLoadingInline: React.FC<{ text?: string }> = ({
  text = 'Calculating...',
}) => {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-block w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" />
      <span className="text-sm text-slate-600 dark:text-slate-400">{text}</span>
    </div>
  );
};
