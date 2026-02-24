import React from 'react';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

const AboutModal: React.FC<AboutModalProps> = ({ open, onClose, title = 'About Orin AI' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        <p className="text-sm text-slate-500 mt-2">Orin AI – From a Sri Lankan to Sri Lankans.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold">
          Close
        </button>
      </div>
    </div>
  );
};

export default AboutModal;
