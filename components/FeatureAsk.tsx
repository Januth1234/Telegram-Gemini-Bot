
import React, { useState } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { GroundingLink, Language } from '../types';

const FeatureAsk: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ text: string; links: GroundingLink[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fix: Added lang property from document attribute to satisfy geminiService.chat requirements.
      const lang = document.documentElement.lang as Language || 'en';
      const res = await geminiService.chat(input, { lang, useThinking: true, grounding: 'search' });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceLabel = (uri: string) => {
    if (uri.includes('.gov') || uri.includes('official')) return "Authority Body";
    if (uri.includes('wikipedia') || uri.includes('encyclopedia')) return "Informational Dataset";
    if (uri.includes('legal') || uri.includes('statute') || uri.includes('gazette')) return "Statute Reference";
    return "Verified Knowledge Source";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 border border-indigo-600/20">
            <i className="fa-solid fa-brain-circuit text-xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Reasoning</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Official Analysis Engine</p>
          </div>
        </div>
        <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <i className="fa-solid fa-xmark text-slate-400"></i>
        </button>
      </div>

      <div className="space-y-6">
        <div className="relative group">
           <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Input your complex reasoning prompt... Aura handles English and Sinhala with synchronized grounding."
            className="relative w-full h-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[40px] p-10 text-lg focus:border-indigo-500 outline-none shadow-sm transition-all resize-none dark:text-white"
          />
        </div>
        <div className="flex justify-between items-center px-4">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
             <i className="fa-solid fa-circle-info text-indigo-500"></i>
             <span>Chain-of-thought active.</span>
          </div>
          <button 
            onClick={handleRun}
            disabled={isLoading || !input.trim()}
            className="px-12 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[22px] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
          >
            {isLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-microchip"></i>}
            Analyze Deep Logic
          </button>
        </div>
      </div>

      {error && (
        <div className="p-8 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[32px] text-xs font-black uppercase tracking-widest flex items-center gap-4 animate-bounce-subtle">
          <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 rounded-[48px] p-10 md:p-14 shadow-sm space-y-12 animate-reveal">
          <div className="space-y-6">
             <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
               <i className="fa-solid fa-shield-check"></i>
               Verified Analysis
             </div>
             <div className="prose prose-slate dark:prose-invert max-w-none">
                <div className="sinhala-text leading-relaxed whitespace-pre-wrap text-base md:text-lg text-slate-800 dark:text-slate-200">
                  {result.text}
                </div>
             </div>
          </div>

          {result.links.length > 0 && (
            <div className="pt-12 border-t border-slate-100 dark:border-white/5 space-y-8">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Official Grounding Map</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {result.links.map((link, i) => (
                  <a key={i} href={link.uri} target="_blank" rel="noreferrer" className="flex flex-col gap-3 p-6 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/50 rounded-3xl group shadow-sm">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest opacity-60">{getSourceLabel(link.uri)}</span>
                    <h5 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">{link.title}</h5>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <i className="fa-solid fa-link text-[10px] text-slate-400"></i>
                      <span className="text-[9px] font-bold text-slate-400 truncate">{link.uri}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeatureAsk;
