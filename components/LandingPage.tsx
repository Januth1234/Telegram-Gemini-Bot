
import React, { useEffect, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { firebaseService } from '../services/firebaseService';
import { translations } from '../translations';
import { Language, WorkspaceMode, UserAccount } from '../types';

interface LandingPageProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  onStartChat: (prompt: string, mode: WorkspaceMode) => void;
  onVoiceOpen: () => void;
  lang: Language;
  user: UserAccount | null;
  onLogin: () => Promise<void>;
}

const LandingPage: React.FC<LandingPageProps> = ({ prompt, onPromptChange, onStartChat, onVoiceOpen, lang, user, onLogin }) => {
  const t = translations[lang];
  const [contextGreeting, setContextGreeting] = useState(() => lang === 'si' ? "ඔබට අද දවස සුබ එකක් වේවා" : "Have a very wonderful day today");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const fetchGreeting = useCallback(async () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { dateStyle: 'full' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    try {
      const msg = await geminiService.generateWelcomeMessage({ date, time, lang });
      if (msg) setContextGreeting(msg);
    } catch (e) {
      console.warn("Greeting AI failed.");
    }
  }, [lang]);

  useEffect(() => {
    fetchGreeting();
    const interval = setInterval(fetchGreeting, 300000);
    return () => clearInterval(interval);
  }, [fetchGreeting]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex flex-col items-center bg-transparent relative z-10 safe-pb">
      <div className="w-full max-w-7xl px-4 md:px-8 py-12 md:py-20 flex flex-col items-center gap-16 md:gap-24">
        
        <section className="w-full text-center flex flex-col items-center gap-8 md:gap-12 animate-fade max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 md:w-28 md:h-28 bg-cyan-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl hover:scale-105 transition-transform duration-500">
              <i className="fa-solid fa-bolt text-4xl md:text-6xl"></i>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">{t.welcome}</h1>
              <div className="min-h-[3rem] flex items-center justify-center px-4">
                  <h2 className="text-lg md:text-2xl font-bold text-slate-600 dark:text-slate-300 tracking-tight animate-reveal text-center leading-snug">
                    {contextGreeting}
                  </h2>
              </div>
              <p className="text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 dark:text-slate-500">{t.slogan}</p>
            </div>
          </div>

          <div className="w-full max-w-2xl px-2">
            <div className="relative group z-20">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[32px] blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
              <div className="relative glass-panel p-2 rounded-[28px] flex items-center shadow-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 transition-all">
                <input 
                  type="text" value={prompt} onChange={(e) => onPromptChange(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && onStartChat(prompt, 'chat')}
                  placeholder={t.howHelp} className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-xl px-6 py-4 dark:text-white placeholder:text-slate-400 font-medium"
                />
                <button onClick={() => onStartChat(prompt, 'chat')} className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-12 md:h-14 px-6 md:px-10 rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-lg">{t.go}</button>
              </div>
            </div>
            {!user && (
               <div className="mt-6 flex justify-center">
                 <button onClick={onLogin} disabled={isLoggingIn} className="flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-95">
                   {isLoggingIn ? <i className="fa-solid fa-circle-notch animate-spin text-slate-400"></i> : <img src="https://www.google.com/favicon.ico" className="w-5 h-5" />}
                   <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500">{lang === 'si' ? 'Google සමඟ සම්බන්ධ වන්න' : 'Sign in with Google'}</span>
                 </button>
               </div>
            )}
          </div>
        </section>

        {/* Features Grid - Improved Order and Alignment */}
        <section className="w-full max-w-6xl space-y-8 animate-slide-in-up">
          <div className="flex items-center gap-4 px-2 opacity-80">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tools</span>
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 items-stretch">
            <FeatureCard icon="fa-message" title={t.reasoning} desc="Deep Chat" onClick={() => onStartChat(prompt, 'chat')} color="blue" />
            <FeatureCard icon="fa-calculator" title={t.maths} desc="Solver" onClick={() => onStartChat(prompt, 'maths')} color="indigo" isBeta />
            <FeatureCard icon="fa-palette" title={t.creative} desc="Designer" onClick={() => onStartChat(prompt, 'studio')} color="purple" />
            <FeatureCard icon="fa-camera" title={t.vision} desc="Visual AI" onClick={() => onStartChat(prompt, 'vision')} color="emerald" />
            <FeatureCard icon="fa-microphone-lines" title={t.voiceBeta} desc="Voice" onClick={onVoiceOpen} color="cyan" isBeta />
          </div>
        </section>

        <section className="w-full max-w-6xl grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 animate-slide-in-up">
            <NavCard href="#downloads" icon="fa-download" color="blue" title={t.downloads} />
            <NavCard href="#creator" icon="fa-user-tie" color="orange" title={t.creator} />
            <NavCard href="#pricing" icon="fa-tags" color="emerald" title={t.pricing} />
            <NavCard href="#logic" icon="fa-diagram-project" color="violet" title={t.logicFlow} />
            <NavCard href="#releases" icon="fa-rocket" color="pink" title={t.releases} />
            <NavCard href="#privacy" icon="fa-shield-halved" color="blue" title={t.privacy} />
            <NavCard href="#terms" icon="fa-file-contract" color="slate" title={t.terms} />
        </section>

        <footer className="w-full pt-12 pb-8 text-center space-y-4 opacity-40">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">© 2026 JN Productions Global</p>
        </footer>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, onClick, color, isBeta }: any) => (
  <button onClick={onClick} className="glass-panel p-6 rounded-[32px] flex flex-col items-center text-center justify-center gap-4 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group border border-slate-200 dark:border-white/5 relative bg-white/60 dark:bg-slate-900/40">
    {isBeta && <div className="absolute top-4 right-4 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 text-[6px] font-black uppercase tracking-widest rounded-full border border-cyan-500/20">BETA</div>}
    <div className={`w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-${color}-500 group-hover:scale-110 transition-all duration-300 shadow-sm border border-slate-100 dark:border-white/5`}><i className={`fa-solid ${icon} text-2xl`}></i></div>
    <div className="space-y-1">
      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{title}</h4>
      <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
  </button>
);

const NavCard = ({ href, icon, title, color }: any) => (
  <a href={href} className="glass-panel p-4 py-6 rounded-2xl flex flex-col items-center text-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-1 transition-all border border-slate-200 dark:border-white/5 active:scale-95 bg-white/40 dark:bg-slate-900/20">
    <div className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-${color}-500 transition-colors`}><i className={`fa-solid ${icon} text-sm`}></i></div>
    <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>
  </a>
);

export default LandingPage;
