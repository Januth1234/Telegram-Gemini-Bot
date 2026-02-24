import React, { useState } from 'react';

interface BotSimulatorProps {
  onClose?: () => void;
  lang?: string;
}

const BotSimulator: React.FC<BotSimulatorProps> = ({ onClose, lang = 'en' }) => {
  const [input, setInput] = useState('');
  return (
    <div className="h-full w-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Bot Simulator</h2>
        <p className="text-sm text-slate-500 mt-2">Simulate bot responses.</p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="mt-4 w-full p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        />
        {onClose && (
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold">
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default BotSimulator;
