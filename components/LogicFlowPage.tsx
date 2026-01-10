
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
    <div className="flex flex-col items-center relative group z-10">
      <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[28px] bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-${color}-500/20 transition-all duration-500 relative overflow-hidden`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        <i className={`fa-solid ${icon} text-3xl md:text-4xl text-${color}-500 transition-transform duration-500 group-hover:rotate-12`}></i>
      </div>
      <div className="mt-6 text-center space-y-2">
        <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">{title}</h4>
        <p className={`text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase max-w-[140px] leading-relaxed ${lang === 'si' ? 'sinhala-text' : ''}`}>{label}</p>
      </div>
      
      {/* Connecting Line - Desktop (Right) */}
      {!isLast && (
        <div className="hidden md:block absolute top-10 md:top-12 left-[100%] w-16 lg:w-24 h-[2px] bg-slate-200 dark:bg-slate-800 -translate-x-4 -z-10">
           <div className={`absolute right-0 -top-1 w-2.5 h-2.5 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div>
           </div>
        </div>
      )}
      
      {/* Connecting Line - Mobile (Bottom) */}
      {!isLast && (
        <div className="md:hidden w-[2px] h-12 bg-slate-200 dark:bg-slate-800 my-4 relative -z-10">
          <div className={`absolute bottom-0 -left-1 w-2.5 h-2.5 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-7xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <i className="fa-solid fa-diagram-project text-xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.logicFlow}</h2>
              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Neural Pipeline Visualization</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-16">
          
          <div className="flex justify-center">
            <div className="p-1.5 bg-slate-200 dark:bg-slate-900 rounded-[20px] flex gap-1 shadow-inner">
               <button 
                onClick={() => setActiveFlow('si')}
                className={`px-6 md:px-8 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeFlow === 'si' ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 Sinhala Logic
               </button>
               <button 
                onClick={() => setActiveFlow('en')}
                className={`px-6 md:px-8 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeFlow === 'en' ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 English Logic
               </button>
            </div>
          </div>

          <div className="glass-panel p-12 md:p-20 rounded-[48px] md:rounded-[64px] border border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-center md:items-start gap-8 md:gap-0 shadow-sm relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.03),transparent_40%)]">
            
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="flex flex-col md:flex-row items-center justify-center w-full gap-0 md:gap-0">
                {activeFlow === 'si' ? (
                  <>
                    <FlowStep 
                      icon="fa-keyboard"
                      title={t.stepInput} 
                      label="පරිශීලකයා සිංහලෙන් විමසයි" 
                      color="cyan" 
                    />
                    <FlowStep 
                      icon="fa-language"
                      title={t.stepTranslate} 
                      label="ඉංග්‍රීසි භාෂාවට පරිවර්තනය" 
                      color="indigo" 
                    />
                    <FlowStep 
                      icon="fa-microchip"
                      title={t.stepProcess} 
                      label="AI සැකසුම් (English Core)" 
                      color="violet" 
                    />
                    <FlowStep 
                      icon="fa-language"
                      title={t.stepTranslate} 
                      label="සිංහල භාෂාවට පරිවර්තනය" 
                      color="indigo" 
                    />
                    <FlowStep 
                      icon="fa-message"
                      title={t.stepOutput} 
                      label="පිළිතුර සිංහලෙන් පෙන්වීම" 
                      color="emerald" 
                      isLast 
                    />
                  </>
                ) : (
                  <>
                    <FlowStep 
                      icon="fa-keyboard"
                      title={t.stepInput} 
                      label="User Types in English" 
                      color="cyan" 
                    />
                    <FlowStep 
                      icon="fa-microchip"
                      title={t.stepProcess} 
                      label="Direct AI Processing" 
                      color="violet" 
                    />
                    <FlowStep 
                      icon="fa-message"
                      title={t.stepOutput} 
                      label="Immediate English Output" 
                      color="emerald" 
                      isLast 
                    />
                  </>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="p-10 bg-slate-100/50 dark:bg-white/5 rounded-[40px] border border-black/5 dark:border-white/5 space-y-5 hover-lift transition-all group hover:bg-white dark:hover:bg-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
                   <i className="fa-solid fa-language text-xl"></i>
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Bilingual Support</h5>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  Orin uses a sophisticated translation relay system to handle Sinhala queries accurately by leveraging global LLM reasoning capabilities in English before translating back to your native language.
                </p>
             </div>
             <div className="p-10 bg-slate-100/50 dark:bg-white/5 rounded-[40px] border border-black/5 dark:border-white/5 space-y-5 hover-lift transition-all group hover:bg-white dark:hover:bg-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
                   <i className="fa-solid fa-bolt-lightning text-xl"></i>
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Latency Optimization</h5>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  Each step is optimized for local Sri Lankan network infrastructure, ensuring that even with the translation layer, response times remain highly competitive and low-latency.
                </p>
             </div>
          </div>

          <footer className="pt-20 pb-12 text-center opacity-30">
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 dark:text-slate-400">
               Orin System Architecture • JN Productions Global
             </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default LogicFlowPage;
