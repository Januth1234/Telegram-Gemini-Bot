import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { APP_CONFIG } from '../config';

interface TelegramBotPageProps {
  onClose: () => void;
  lang: Language;
}

const TelegramBotPage: React.FC<TelegramBotPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [request, setRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;
    setIsSubmitting(true);
    // Simulate API delay for feature request submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitted(true);
    setRequest('');
  };

  const roadmapSteps = [
    { label: "Core Bot Engine", status: "completed", date: "Jan 2026" },
    { label: "Vision Relay (OCR)", status: "completed", date: "Feb 2026" },
    { label: "Voice Note Processing", status: "in-progress", date: "March 2026" },
    { label: "Group Management Pro", status: "planned", date: "April 2026" },
    { label: "Admin Dashboard Plugin", status: "planned", date: "May 2026" },
  ];

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal pb-20">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-black/5 dark:border-white/5 pb-10 mb-12">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[24px] bg-blue-500 shadow-xl shadow-blue-500/20 flex items-center justify-center text-white">
              <i className="fa-solid fa-paper-plane text-3xl"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.telegramBot}</h2>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mt-1">{t.tgStatus}: PRODUCTION STABLE</p>
            </div>
          </div>
          <div className="flex gap-3">
             <a href={`https://github.com/${APP_CONFIG.githubRepo}`} target="_blank" className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all">
                <i className="fa-brands fa-github text-base"></i>
                {t.tgGitHub}
             </a>
             <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
           {/* Bot Features */}
           <section className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{t.tgFeatures}</h3>
              <div className="space-y-4">
                 <FeatureItem icon="fa-language" title="Bilingual Engine" desc="Understands Sinhala and English natively." />
                 <FeatureItem icon="fa-eye" title="Vision OCR" desc="Extracts text from images sent to chat." />
                 <FeatureItem icon="fa-users" title="Group Relay" desc="Summarize long group chat history instantly." />
                 <FeatureItem icon="fa-bolt" title="Ultra Fast" desc="0.8s response time using Orin Flash Core." />
              </div>
           </section>

           {/* Feature Request Form */}
           <section className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-16 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] relative z-10">{t.tgRequest}</h3>
              
              {submitted ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-reveal">
                   <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/20"><i className="fa-solid fa-check text-2xl"></i></div>
                   <p className="text-sm font-bold tracking-tight">Requirement Captured</p>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Added to Dev Backlog</p>
                   <button onClick={() => setSubmitted(false)} className="text-[10px] font-bold text-blue-400 underline uppercase tracking-widest">Submit Another</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                   <p className="text-xs text-slate-400 leading-relaxed font-medium">Outline a new feature or logic gate for the Orin Telegram project.</p>
                   <textarea 
                     value={request}
                     onChange={(e) => setRequest(e.target.value)}
                     className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                     placeholder="This bot should be able to..."
                   />
                   <button 
                     type="submit"
                     disabled={isSubmitting || !request.trim()}
                     className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                   >
                     {isSubmitting ? "Syncing..." : "Submit to GitHub"}
                   </button>
                </form>
              )}
           </section>
        </div>

        {/* Roadmap */}
        <section className="space-y-10">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-map-location-dot"></i></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.tgRoadmap}</h3>
           </div>

           <div className="glass-panel p-8 md:p-12 rounded-[48px] border border-black/5 dark:border-white/5 space-y-8 shadow-sm">
              <div className="space-y-8">
                 {roadmapSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-6 relative group">
                       {i !== roadmapSteps.length - 1 && <div className="absolute left-3 top-8 bottom-0 w-[1px] bg-slate-200 dark:bg-white/5"></div>}
                       <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-4 ${step.status === 'completed' ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900/40' : step.status === 'in-progress' ? 'bg-blue-500 border-blue-100 dark:border-blue-900/40 animate-pulse' : 'bg-slate-200 dark:bg-slate-800 border-transparent'}`}>
                          {step.status === 'completed' && <i className="fa-solid fa-check text-[8px] text-white"></i>}
                       </div>
                       <div className="flex-1 flex flex-col md:flex-row justify-between gap-2">
                          <div>
                            <p className={`text-sm font-black uppercase tracking-tight ${step.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>{step.label}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{step.status.replace('-', ' ')}</p>
                          </div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg self-start">{step.date}</div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        <footer className="pt-24 text-center opacity-30">
           <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full mb-8"></div>
           <p className="text-[9px] font-black uppercase tracking-[0.6em] text-slate-500 dark:text-slate-400">Orin Telegram Integration Protocol • 2026</p>
        </footer>
      </div>
    </div>
  );
};

const FeatureItem = ({ icon, title, desc }: any) => (
  <div className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
     <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0"><i className={`fa-solid ${icon}`}></i></div>
     <div>
        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{title}</p>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{desc}</p>
     </div>
  </div>
);

export default TelegramBotPage;