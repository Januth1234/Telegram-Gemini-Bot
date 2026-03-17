import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface LogicFlowPageProps {
  onClose: () => void;
  lang: Language;
}

const LOGIC_FLOW_KEYFRAMES = `
  @keyframes flowLine { 0% { left: -10%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { left: 110%; opacity: 0; } }
  @keyframes flowLineVertical { 0% { top: -10%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 110%; opacity: 0; } }
`;

const LogicFlowPage: React.FC<LogicFlowPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [activeFlow, setActiveFlow] = useState<'si' | 'en'>(lang === 'si' ? 'si' : 'en');
  const isSinhalaFlow = activeFlow === 'si';

  useEffect(() => {
    const id = 'logic-flow-keyframes';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      style.textContent = LOGIC_FLOW_KEYFRAMES;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el?.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  const FlowStep = ({ icon, title, label, color, isLast = false }: any) => {
    const colorMap: Record<string, string> = {
      cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",
      indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
      violet: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
      emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
    };

    const dotColorMap: Record<string, string> = {
      cyan: "bg-cyan-500",
      indigo: "bg-indigo-500",
      violet: "bg-violet-500",
      emerald: "bg-emerald-500"
    };

    return (
      <div className="flex flex-col items-center relative z-10 w-full md:w-auto group">
        {/* Icon Container */}
        <div className={`w-20 h-20 md:w-28 md:h-28 rounded-3xl md:rounded-[40px] ${colorMap[color]} border flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-700 relative overflow-hidden cursor-default`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <i className={`fa-solid ${icon} text-3xl md:text-5xl transition-transform duration-700 group-hover:rotate-6`}></i>
        </div>

        {/* Text Labels */}
        <div className="mt-6 md:mt-8 text-center space-y-2 px-4 max-w-[180px]">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">{title}</h4>
          <p className={`text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-relaxed ${lang === 'si' ? 'sinhala-text' : ''}`}>{label}</p>
        </div>
        
        {/* Horizontal Line - Desktop */}
        {!isLast && (
          <div className={`hidden md:block absolute top-[56px] left-[110%] h-[1px] bg-slate-200 dark:bg-slate-800 -z-10 ${isSinhalaFlow ? 'w-20 lg:w-28' : 'w-28 lg:w-40'}`}>
             <div className="absolute top-1/2 left-0 w-2 h-2 -translate-y-1/2 bg-cyan-500 rounded-full blur-[2px] animate-[flowLine_4s_infinite_linear]"></div>
             <div className={`absolute right-0 -top-1 w-2.5 h-2.5 rounded-full ${dotColorMap[color]} opacity-20 flex items-center justify-center`}><div className={`w-1.5 h-1.5 rounded-full ${dotColorMap[color]} animate-ping`}></div></div>
          </div>
        )}
        
        {/* Vertical Line - Mobile */}
        {!isLast && (
          <div className="md:hidden w-[1px] h-12 bg-slate-200 dark:bg-slate-800 my-4 relative -z-10">
            <div className="absolute left-1/2 top-0 w-2 h-2 -translate-x-1/2 bg-cyan-500 rounded-full blur-[2px] animate-[flowLineVertical_4s_infinite_linear]"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal safe-pb">
      <div className="max-w-7xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-10 mb-16">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner"><i className="fa-solid fa-diagram-project text-2xl"></i></div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{t.logicFlow}</h2>
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] mt-2">Platform Infrastructure Map</p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all active:scale-90"><i className="fa-solid fa-xmark text-xl"></i></button>
        </header>

        <div className="space-y-20">
          <div className="flex justify-center">
            <div className="p-2 bg-slate-200/50 dark:bg-slate-900/50 rounded-3xl flex gap-2 border border-black/5 dark:border-white/5 backdrop-blur-3xl shadow-inner">
               <button onClick={() => setActiveFlow('si')} className={`px-8 md:px-14 py-3 md:py-4 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeFlow === 'si' ? 'bg-white dark:bg-slate-800 shadow-2xl text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Native Logic (SI)</button>
               <button onClick={() => setActiveFlow('en')} className={`px-8 md:px-14 py-3 md:py-4 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeFlow === 'en' ? 'bg-white dark:bg-slate-800 shadow-2xl text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Direct Logic (EN)</button>
            </div>
          </div>

          <div className="glass-panel py-20 px-6 md:py-32 md:px-16 rounded-[64px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center shadow-sm relative overflow-x-auto no-scrollbar bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_70%)]">
            <div className="flex flex-col md:flex-row items-center justify-center w-full min-w-max md:min-w-0 transition-all duration-700 ${isSinhalaFlow ? 'gap-10 md:gap-20 lg:gap-32' : 'gap-10 md:gap-32 lg:gap-48'}">
                {activeFlow === 'si' ? (
                  <>
                    <FlowStep icon="fa-keyboard" title={t.stepInput} label="Bilingual Capture" color="cyan" />
                    <FlowStep icon="fa-language" title={t.stepTranslate} label="Bridge to English Core" color="indigo" />
                    <FlowStep icon="fa-brain" title={t.stepProcess} label="Multimodal Thinking" color="violet" />
                    <FlowStep icon="fa-language" title={t.stepTranslate} label="Output Translation" color="indigo" />
                    <FlowStep icon="fa-comment-dots" title={t.stepOutput} label="Final Response" color="emerald" isLast />
                  </>
                ) : (
                  <>
                    <FlowStep icon="fa-keyboard" title={t.stepInput} label="Raw Data Capture" color="cyan" />
                    <FlowStep icon="fa-microchip" title={t.stepProcess} label="Neural Cycle Alpha" color="violet" />
                    <FlowStep icon="fa-comment-dots" title={t.stepOutput} label="Instant Manifest" color="emerald" isLast />
                  </>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="p-10 md:p-14 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[48px] border border-black/5 dark:border-white/5 space-y-6 hover:-translate-y-1 transition-all shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 shadow-inner"><i className="fa-solid fa-microchip text-2xl"></i></div>
                <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Neural Relay Mechanism</h5>
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium">Orin v4.0 leverages an advanced relay system that translates Sinhala queries into high-precision English prompts, ensuring the model's global reasoning depth is applied to local context.</p>
             </div>
             <div className="p-10 md:p-14 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[48px] border border-black/5 dark:border-white/5 space-y-6 hover:-translate-y-1 transition-all shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600 shadow-inner"><i className="fa-solid fa-bolt-lightning text-2xl"></i></div>
                <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Low-Latency Handshake</h5>
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium">Every packet in the logic flow is optimized for the Sri Lankan network backbone, utilizing regional edge computing to minimize the 'wait time' between input and neural synthesis.</p>
             </div>
          </div>
        </div>

        <footer className="pt-32 pb-12 text-center opacity-30">
           <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full mb-8"></div>
           <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-500 dark:text-slate-400">Orin System Architecture • Production Artifact 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default LogicFlowPage;
