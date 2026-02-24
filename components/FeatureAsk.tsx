import React from 'react';

interface FeatureAskProps {
  onClose?: () => void;
  lang?: string;
}

const FeatureAsk: React.FC<FeatureAskProps> = ({ onClose, lang = 'en' }) => {
  return (
    <div className="h-full w-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Ask</h2>
        <p className="text-sm text-slate-500 mt-2">Feature: Ask mode.</p>
        {onClose && (
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold">
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default FeatureAsk;
