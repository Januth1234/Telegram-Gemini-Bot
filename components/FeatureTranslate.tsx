
import React, { useState } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { Language } from '../types';

const FeatureTranslate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [targetLang, setTargetLang] = useState<Language>('si');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await geminiService.translate(sourceText, targetLang);
      setTargetText(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const swap = () => {
    setTargetLang(targetLang === 'en' ? 'si' : 'en');
    setSourceText(targetText);
    setTargetText('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bilingual Translation</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</span>
            <span className="text-xs font-bold text-slate-600">{targetLang === 'si' ? 'English' : 'Sinhala'}</span>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Type or paste text..."
            className="w-full h-64 bg-white border border-slate-200 rounded-3xl p-6 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 resize-none shadow-sm transition-all"
          />
        </div>

        <button 
          onClick={swap}
          className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all active:scale-90"
        >
          <i className="fa-solid fa-arrows-left-right text-slate-400"></i>
        </button>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target</span>
            <span className="text-xs font-bold text-blue-600">{targetLang === 'si' ? 'Sinhala' : 'English'}</span>
          </div>
          <div className={`w-full h-64 bg-white border border-slate-200 rounded-3xl p-6 text-sm shadow-sm overflow-y-auto ${targetLang === 'si' ? 'sinhala-text' : ''}`}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <i className="fa-solid fa-spinner-third animate-spin text-blue-500 text-2xl"></i>
              </div>
            ) : (
              targetText || <span className="text-slate-300 italic">Translated text will appear here.</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
        <button 
          onClick={handleTranslate}
          disabled={isLoading || !sourceText.trim()}
          className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
        >
          Translate Document
        </button>
      </div>
    </div>
  );
};

export default FeatureTranslate;
