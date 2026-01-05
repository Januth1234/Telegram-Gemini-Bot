
import React from 'react';
import { APP_CONFIG } from '../config';
import { Language } from '../types';
import { translations } from '../translations';

const AboutModal: React.FC<{ onClose: () => void; lang: Language }> = ({ onClose, lang }) => {
  const t = translations[lang];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="max-w-md w-full glass-card rounded-[40px] p-10 border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-500">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="text-center space-y-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[24px] mx-auto flex items-center justify-center shadow-2xl border border-white/10">
            <i className="fa-solid fa-sparkles text-white text-3xl animate-pulse"></i>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tighter">{t.appName}</h2>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Native Release v{APP_CONFIG.version}</p>
          </div>

          <div className="space-y-6 text-sm font-medium text-slate-400 leading-relaxed">
            <p className={lang === 'si' ? 'sinhala-text' : ''}>
              {t.slogan}. A high-performance standalone environment designed for professional neural synthesis and deep reasoning cycles.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Architecture</span>
                <span className="text-xs font-bold text-slate-200">Orin Engine v4.0</span>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Distribution</span>
                <span className="text-xs font-bold text-slate-200">Production Build</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-2">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Developed by JN Productions</p>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">All rights reserved © {APP_CONFIG.releaseYear}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
