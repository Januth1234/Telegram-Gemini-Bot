
import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface LogicFlowPageProps {
  onClose: () => void;
  lang: Language;
}

// Custom Modern AI-Style Icons
const InputIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className={`w-8 h-8 text-${color}-500`} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 16V10C20 8.89543 19.1046 8 18 8H6C4.89543 8 4 8.89543 4 10V16" strokeLinecap="round" />
    <path d="M4 16C4 17.1046 4.89543 18 6 18H18C19.1046 18 20 17.1046 20 16" strokeLinecap="round" />
    <path d="M8 12H8.01" strokeLinecap="round" strokeWidth="3" />
    <path d="M12 12H12.01" strokeLinecap="round" strokeWidth="3" />
    <path d="M16 12H16.01" strokeLinecap="round" strokeWidth="3" />
    <path d="M7 15H17" strokeLinecap="round" />
    <path d="M12 4V8" strokeLinecap="round" opacity="0.4" />
  </svg>
);

const TranslateIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className={`w-8 h-8 text-${color}-500`} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 8H14M14 8V11M14 8C14 5.23858 11.7614 3 9 3C6.23858 3 4 5.23858 4 8" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
    <path d="M19 16H10M10 16V13M10 16C10 18.7614 12.2386 21 15 21C17.7614 21 20 18.7614 20 16" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 5L5 8L2 11" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
    <path d="M22 19L19 16L22 13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ProcessIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className={`w-8 h-8 text-${color}-500`} fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" strokeDasharray="2 2" />
    <path d="M12 8V12L15 15" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.1" />
    <path d="M8 12H16M12 8V16" strokeLinecap="round" opacity="0.6" />
  </svg>
);

const OutputIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className={`w-8 h-8 text-${color}-500`} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15C21 16.1046 20.1046 17 19 17H7L3 21V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 8H17" strokeLinecap="round" opacity="0.4" />
    <path d="M7 12H13" strokeLinecap="round" opacity="0.4" />
    <circle cx="18" cy="18" r="3" fill="currentColor" fillOpacity="0.2" className="animate-pulse" />
  </svg>
);

const LogicFlowPage: React.FC<LogicFlowPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeFlow, setActiveFlow] = useState<'si' | 'en'>(lang === 'si' ? 'si' : 'en');

  const FlowStep = ({ IconComp, title, label, color, isLast = false }: any) => (
    <div className="flex flex-col items-center relative group">
      <div className={`w-20 h-20 rounded-[28px] bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-${color}-500/20 transition-all duration-500 relative overflow-hidden`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        <IconComp color={color} />
      </div>
      <div className="mt-6 text-center space-y-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">{title}</h4>
        <p className={`text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase max-w-[130px] leading-relaxed ${lang === 'si' ? 'sinhala-text' : ''}`}>{label}</p>
      </div>
      {!isLast && (
        <div className="hidden md:block absolute left-[100%] top-10 w-24 h-[2px] bg-slate-200 dark:bg-slate-800 -translate-x-2">
           <div className={`absolute right-0 -top-1 w-2.5 h-2.5 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div>
           </div>
        </div>
      )}
      {!isLast && (
        <div className="md:hidden w-[2px] h-12 bg-slate-200 dark:bg-slate-800 my-6 relative">
          <div className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-ping`}></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
                className={`px-8 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeFlow === 'si' ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 Sinhala Logic
               </button>
               <button 
                onClick={() => setActiveFlow('en')}
                className={`px-8 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeFlow === 'en' ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 English Logic
               </button>
            </div>
          </div>

          <div className="glass-panel p-12 md:p-20 rounded-[64px] border border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-center md:gap-24 shadow-sm relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.03),transparent_40%)]">
            
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {activeFlow === 'si' ? (
              <>
                <FlowStep 
                  IconComp={InputIcon}
                  title={t.stepInput} 
                  label="පරිශීලකයා සිංහලෙන් විමසයි" 
                  color="cyan" 
                />
                <FlowStep 
                  IconComp={TranslateIcon}
                  title={t.stepTranslate} 
                  label="ඉංග්‍රීසි භාෂාවට පරිවර්තනය" 
                  color="indigo" 
                />
                <FlowStep 
                  IconComp={ProcessIcon}
                  title={t.stepProcess} 
                  label="AI සැකසුම් (English Core)" 
                  color="violet" 
                />
                <FlowStep 
                  IconComp={TranslateIcon}
                  title={t.stepTranslate} 
                  label="සිංහල භාෂාවට පරිවර්තනය" 
                  color="indigo" 
                />
                <FlowStep 
                  IconComp={OutputIcon}
                  title={t.stepOutput} 
                  label="පිළිතුර සිංහලෙන් පෙන්වීම" 
                  color="emerald" 
                  isLast 
                />
              </>
            ) : (
              <>
                <FlowStep 
                  IconComp={InputIcon}
                  title={t.stepInput} 
                  label="User Types in English" 
                  color="cyan" 
                />
                <FlowStep 
                  IconComp={ProcessIcon}
                  title={t.stepProcess} 
                  label="Direct AI Processing" 
                  color="violet" 
                />
                <FlowStep 
                  IconComp={OutputIcon}
                  title={t.stepOutput} 
                  label="Immediate English Output" 
                  color="emerald" 
                  isLast 
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="p-10 bg-slate-100/50 dark:bg-white/5 rounded-[40px] border border-black/5 dark:border-white/5 space-y-5 hover-lift transition-all">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                   <i className="fa-solid fa-language text-lg"></i>
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Bilingual Support</h5>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  Orin uses a sophisticated translation relay system to handle Sinhala queries accurately by leveraging global LLM reasoning capabilities in English before translating back to your native language.
                </p>
             </div>
             <div className="p-10 bg-slate-100/50 dark:bg-white/5 rounded-[40px] border border-black/5 dark:border-white/5 space-y-5 hover-lift transition-all">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                   <i className="fa-solid fa-bolt-lightning text-lg"></i>
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
