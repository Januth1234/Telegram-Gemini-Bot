
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

  const FlowStep = ({ icon, title, label, color, isLast = false }: any) => (
    <div className="flex flex-col items-center relative z-10">
      {/* Icon Container */}
      <div className={`w-20 h-20 md:w-28 md:h-28 rounded-[32px] bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-${color}-500/20 transition-all duration-700 relative overflow-hidden group`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        <i className={`fa-solid ${icon} text-3xl md:text-5xl text-${color}-500 transition-transform duration-700 group-hover:rotate-12`}></i>
        
        {/* Subtle breathing glow */}
        <div className={`absolute inset-0 bg-${color}-500/5 animate-pulse`}></div>
      </div>

      {/* Text Labels */}
      <div className="mt-8 text-center space-y-2 px-2">
        <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-slate-900 dark:text-white">{title}</h4>
        <p className={`text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase max-w-[160px] leading-relaxed ${lang === 'si' ? 'sinhala-text' : ''}`}>{label}</p>
      </div>
      
      {/* Connecting Line - Desktop (Horizontal) */}
      {!isLast && (
        <div className="hidden md:block absolute top-14 left-[calc(100%+1rem)] w-16 lg:w-32 h-[1px] bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 dark:from-slate-800 dark:via-slate-600 dark:to-slate-800 -z-10">
           {/* Moving Data Packet */}
           <div className="absolute top-1/2 left-0 w-2 h-2 -translate-y-1/2 bg-cyan-500 rounded-full blur-[2px] animate-[flowLine_3s_infinite_linear]"></div>
           <div className={`absolute right-0 -top-1 w-2 h-2 rounded-full bg-${color}-500/40 flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div>
           </div>
        </div>
      )}
      
      {/* Connecting Line - Mobile (Vertical) */}
      {!isLast && (
        <div className="md:hidden w-[1px] h-16 bg-gradient-to-b from-slate-200 via-slate-400 to-slate-200 dark:from-slate-800 dark:via-slate-600 dark:to-slate-800 my-6 relative -z-10">
          <div className="absolute left-1/2 top-0 w-2 h-2 -translate-x-1/2 bg-cyan-500 rounded-full blur-[2px] animate-[flowLineVertical_3s_infinite_linear]"></div>
          <div className={`absolute bottom-0 -left-1 w-2 h-2 rounded-full bg-${color}-500/40 flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <style>{`
        @keyframes flowLine {
          0% { left: 0; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes flowLineVertical {
          0% { top: 0; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <i className="fa-solid fa-diagram-project text-2xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.logicFlow}</h2>
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em]">Neural Pipeline Visualization</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90 active:scale-90"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </header>

        <div className="space-y-24">
          
          <div className="flex justify-center">
            <div className="p-2 bg-slate-200 dark:bg-slate-900/50 rounded-[24px] flex gap-2 shadow-inner border border-black/5 dark:border-white/5 backdrop-blur-md">
               <button 
                onClick={() => setActiveFlow('si')}
                className={`px-8 md:px-12 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${activeFlow === 'si' ? 'bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 Sinhala Logic
               </button>
               <button 
                onClick={() => setActiveFlow('en')}
                className={`px-8 md:px-12 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${activeFlow === 'en' ? 'bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 English Logic
               </button>
            </div>
          </div>

          {/* Main Visualizer Container */}
          <div className="glass-panel p-16 md:p-24 lg:p-32 rounded-[64px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center shadow-sm relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05),transparent_70%)]">
            
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)', backgroundSize: '48px 48px' }}></div>

            <div className="flex flex-col md:flex-row items-center justify-center w-full gap-0 md:gap-24 lg:gap-40">
                {activeFlow === 'si' ? (
                  <>
                    <FlowStep 
                      icon="fa-keyboard"
                      title={t.stepInput} 
                      label="Input in Sinhala" 
                      color="cyan" 
                    />
                    <FlowStep 
                      icon="fa-language"
                      title={t.stepTranslate} 
                      label="To English Core" 
                      color="indigo" 
                    />
                    <FlowStep 
                      icon="fa-microchip"
                      title={t.stepProcess} 
                      label="Neural Thinking" 
                      color="violet" 
                    />
                    <FlowStep 
                      icon="fa-language"
                      title={t.stepTranslate} 
                      label="Back to Sinhala" 
                      color="indigo" 
                    />
                    <FlowStep 
                      icon="fa-message"
                      title={t.stepOutput} 
                      label="Final Response" 
                      color="emerald" 
                      isLast 
                    />
                  </>
                ) : (
                  <>
                    <FlowStep 
                      icon="fa-keyboard"
                      title={t.stepInput} 
                      label="Direct Input" 
                      color="cyan" 
                    />
                    <FlowStep 
                      icon="fa-microchip"
                      title={t.stepProcess} 
                      label="Direct Core Processing" 
                      color="violet" 
                    />
                    <FlowStep 
                      icon="fa-message"
                      title={t.stepOutput} 
                      label="Immediate Output" 
                      color="emerald" 
                      isLast 
                    />
                  </>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="p-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[48px] border border-black/5 dark:border-white/5 space-y-6 hover-lift transition-all group hover:bg-white dark:hover:bg-slate-800 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform shadow-inner">
                   <i className="fa-solid fa-language text-2xl"></i>
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Multimodal Relay</h5>
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                  Orin uses a sophisticated translation relay system to handle Sinhala queries accurately by leveraging global LLM reasoning capabilities in English before translating back to your native language.
                </p>
             </div>
             <div className="p-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[48px] border border-black/5 dark:border-white/5 space-y-6 hover-lift transition-all group hover:bg-white dark:hover:bg-slate-800 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform shadow-inner">
                   <i className="fa-solid fa-bolt-lightning text-2xl"></i>
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Latency Optimization</h5>
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                  Each step is optimized for local Sri Lankan network infrastructure, ensuring that even with the translation layer, response times remain highly competitive and low-latency.
                </p>
             </div>
          </div>

          <footer className="pt-24 pb-12 text-center opacity-40">
             <div className="w-16 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full mb-8"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-500 dark:text-slate-400">
               Orin System Architecture • JN Productions Global
             </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default LogicFlowPage;
