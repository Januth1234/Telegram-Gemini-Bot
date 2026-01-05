
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface CreatorPageProps {
  onClose: () => void;
  lang: Language;
}

const CreatorPage: React.FC<CreatorPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col animate-reveal">
      <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <i className="fa-solid fa-user-tie"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.creator}</h2>
            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Chief Architect & Founder</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-12">
          
          <div className="flex flex-col items-center text-center space-y-6">
             <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-[44px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative w-40 h-40 md:w-56 md:h-56 bg-white dark:bg-slate-900 rounded-[44px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl flex items-center justify-center">
                   <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                      <i className="fa-solid fa-user text-6xl md:text-8xl text-slate-300 dark:text-slate-700 transition-all duration-700 group-hover:scale-110"></i>
                   </div>
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-lg border-4 border-white dark:border-slate-900 animate-bounce">
                   <i className="fa-solid fa-code text-sm"></i>
                </div>
             </div>

             <div className="space-y-2 opacity-0 animate-reveal">
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Januth Nimnal</h1>
                <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.4em]">Project Lead • Orin AI</p>
             </div>
          </div>

          <div className="glass-panel p-8 md:p-12 rounded-[48px] border border-black/5 dark:border-white/5 space-y-8 animate-reveal" style={{ animationDelay: '0.2s' }}>
             <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] border-b border-black/5 dark:border-white/5 pb-4">Executive Profile</h3>
             <p className="text-sm md:text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-medium italic">
                "Orin AI represents a localized bridge to artificial intelligence. My mission is to build tools that feel native to Sri Lanka, supporting both English and Sinhala logic with world-class performance. This platform is the start of that journey."
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-reveal" style={{ animationDelay: '0.4s' }}>
             <SocialLink index={0} href="https://www.instagram.com/januth10.1/" icon="fa-brands fa-instagram" label="Instagram" color="hover:text-pink-500 hover:bg-pink-500/5" />
             <SocialLink index={1} href="https://web.facebook.com/januth10.1/" icon="fa-brands fa-facebook-f" label="Facebook" color="hover:text-blue-600 hover:bg-blue-600/5" />
             <SocialLink index={2} href="https://www.tiktok.com/@januth10.1" icon="fa-brands fa-tiktok" label="TikTok" color="hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5" />
          </div>

          <footer className="pt-20 pb-12 text-center opacity-30">
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 dark:text-slate-400">
               JN Productions Global • Official Release 2026
             </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

const SocialLink: React.FC<{ href: string; icon: string; label: string; color: string; index: number }> = ({ href, icon, label, color, index }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={`glass-panel p-8 rounded-[36px] border border-black/5 dark:border-white/5 flex flex-col items-center gap-5 transition-all duration-500 group hover:translate-y-[-4px] ${color}`}>
    <i className={`${icon} text-3xl group-hover:scale-125 transition-transform duration-300`}></i>
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 group-hover:text-inherit">{label}</span>
  </a>
);

export default CreatorPage;
