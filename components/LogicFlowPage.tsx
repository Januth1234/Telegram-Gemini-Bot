
import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface LogicFlowPageProps {
  onClose: () => void;
  lang: Language;
}

const LogicFlowPage: React.FC<LogicFlowPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeFlow, setActiveFlow] = useState<'si' | 'en'>(lang === 'si' ? 'si' : 'en');
  const isSinhalaFlow = activeFlow === 'si';

  const FlowStep = ({ icon, title, label, color, isLast = false }: any) => (
    <div className="flex flex-col items-center relative z-10 w-full md:w-auto group">
      {/* Icon Container - Scaled for tiny devices */}
      <div className={`w-16 h-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 rounded-2xl sm:rounded-[32px] bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center shadow-xl group-hover:scale-105 transition-all duration-700 relative overflow-hidden`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        <i className={`fa-solid ${icon} text-2xl sm:text-3xl text-${color}-500 transition-transform duration-700 group-hover:rotate-12`}></i>
        <div className={`absolute inset-0 bg-${color}-500/5 animate-pulse`}></div>
      </div>

      {/* Text Labels - Fluid font */}
      <div className="mt-4 md:mt-6 text-center space-y-1 md:space-y-1.5 px-2">
        <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white leading-tight">{title}</h4>
        <p className={`text-[8px] md:text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase max-w-[120px] leading-relaxed mx-auto ${lang === 'si' ? 'sinhala-text' : ''}`}>{label}</p>
      </div>
      
      {/* Connecting Line - Desktop (Horizontal) */}
      {!isLast && (
        <div className={`hidden md:block absolute top-10 md:top-12 left-[calc(100%+0.5rem)] h-[2px] bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 -z-10 ${isSinhalaFlow ? 'w-8 lg:w-16' : 'w-16 lg:w-32'}`}>
           <div className="absolute top-1/2 left-0 w-1.5 h-1.5 -translate-y-1/2 bg-cyan-500 rounded-full blur-[1px] animate-[flowLine_3s_infinite_linear]"></div>
           <div className={`absolute right-0 -top-1 w-2 h-2 rounded-full bg-${color}-500/40 flex items-center justify-center`}><div className={`w-1 h-1 rounded-full bg-${color}-500 animate-ping`}></div></div>
        </div>
      )}
      
      {/* Connecting Line - Mobile (Vertical) */}
      {!isLast && (
        <div className="md:hidden w-[1px] h-8 sm:h-12 bg-gradient-to-b from-slate-200 via-slate-400 to-slate-200 dark:from-slate-800 dark:via-slate-600 dark:to-slate-800 my-2 sm:my-4 relative -z-10">
          <div className="absolute left-1/2 top-0 w-2 h-2 -translate-x-1/2 bg-cyan-500 rounded-full blur-[2px] animate-[flowLineVertical_3s_infinite_linear]"></div>
          <div className={`absolute bottom-0 -left-1 w-2 h-2 rounded-full bg-${color}-500/40 flex items-center justify-center`}><div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal safe-pb">
      <style>{`
        @keyframes flowLine { 0% { left: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
        @keyframes flowLineVertical { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      `}</style>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-6 md:pb-8 mb-10 md:mb-16">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><i className="fa-solid fa-diagram-project text-xl"></i></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{t.logicFlow}</h2>
              <p className="text-[8px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] mt-1">Neural Pipeline Visualization</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 active:scale-90"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>

        <div className="space-y-12 md:space-y-20">
          <div className="flex justify-center">
            <div className="p-1.5 bg-slate-200 dark:bg-slate-900/50 rounded-2xl flex gap-1 shadow-inner border border-black/5 dark:border-white/5 backdrop-blur-md">
               <button onClick={() => setActiveFlow('si')} className={`px-5 md:px-12 py-2 md:py-3 rounded-xl md:rounded-[18px] text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all ${activeFlow === 'si' ? 'bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Sinhala Logic</button>
               <button onClick={() => setActiveFlow('en')} className={`px-5 md:px-12 py-2 md:py-3 rounded-xl md:rounded-[18px] text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all ${activeFlow === 'en' ? 'bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>English Logic</button>
            </div>
          </div>

          <div className="glass-panel py-12 px-4 md:py-24 md:px-16 rounded-[40px] md:rounded-[64px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center shadow-sm relative overflow-x-auto custom-scrollbar bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05),transparent_70%)]">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }}></div>
            
            <div className={`flex flex-col md:flex-row items-center justify-center w-full min-w-max md:min-w-0 transition-all duration-500 ${isSinhalaFlow ? 'gap-0 md:gap-10 lg:gap-20' : 'gap-0 md:gap-24 lg:gap-40'}`}>
                {activeFlow === 'si' ? (
                  <>
                    <FlowStep icon="fa-keyboard" title={t.stepInput} label="Input in Sinhala" color="cyan" />
                    <FlowStep icon="fa-language" title={t.stepTranslate} label="To English Core" color="indigo" />
                    <FlowStep icon="fa-microchip" title={t.stepProcess} label="Neural Thinking" color="violet" />
                    <FlowStep icon="fa-language" title={t.stepTranslate} label="Back to Sinhala" color="indigo" />
                    <FlowStep icon="fa-message" title={t.stepOutput} label="Final Response" color="emerald" isLast />
                  </>
                ) : (
                  <>
                    <FlowStep icon="fa-keyboard" title={t.stepInput} label="Direct Input" color="cyan" />
                    <FlowStep icon="fa-microchip" title={t.stepProcess} label="Direct Core Processing" color="violet" />
                    <FlowStep icon="fa-message" title={t.stepOutput} label="Immediate Output" color="emerald" isLast />
                  </>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
             <div className="p-8 md:p-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] md:rounded-[48px] border border-black/5 dark:border-white/5 space-y-4 md:space-y-6 hover-lift transition-all shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 shadow-inner"><i className="fa-solid fa-language text-xl"></i></div>
                <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Multimodal Relay</h5>
                <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium">Orin uses a sophisticated translation relay system to handle Sinhala queries accurately by leveraging global LLM reasoning capabilities in English before translating back to your native language.</p>
             </div>
             <div className="p-8 md:p-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] md:rounded-[48px] border border-black/5 dark:border-white/5 space-y-4 md:space-y-6 hover-lift transition-all shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 shadow-inner"><i className="fa-solid fa-bolt-lightning text-xl"></i></div>
                <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Latency Optimization</h5>
                <p className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium">Each step is optimized for local Sri Lankan network infrastructure, ensuring that even with the translation layer, response times remain highly competitive and low-latency.</p>
             </div>
          </div>
        </div>

        <footer className="pt-20 pb-10 text-center opacity-30">
           <div className="w-10 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full mb-6"></div>
           <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.6em] text-slate-500 dark:text-slate-400">Orin System Architecture • JN Productions Global</p>
        </footer>
      </div>
    </div>
  );
};

export default LogicFlowPage;
