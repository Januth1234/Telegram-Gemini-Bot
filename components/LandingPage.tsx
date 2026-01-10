
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
  const [contextGreeting, setContextGreeting] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Check for notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => setShowNotifPrompt(true), 1500);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setShowNotifPrompt(false);
    try {
      await firebaseService.requestPermission();
    } catch (e) {
      console.error("Notification setup failed", e);
    }
  };

  const handleLoginClick = async () => {
    setIsLoggingIn(true);
    try {
      await onLogin();
    } catch (e) {
      console.error("Navigation to login failed", e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchGreeting = useCallback(async () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { dateStyle: 'full' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const msg = await geminiService.generateWelcomeMessage({ 
            date, 
            time, 
            location: `Lat: ${pos.coords.latitude.toFixed(2)}, Lng: ${pos.coords.longitude.toFixed(2)}`,
            lang
          });
          setContextGreeting(msg);
        }, async () => {
          const msg = await geminiService.generateWelcomeMessage({ date, time, lang });
          setContextGreeting(msg);
        });
      } else {
        const msg = await geminiService.generateWelcomeMessage({ date, time, lang });
        setContextGreeting(msg);
      }
    } catch (e) {
      setContextGreeting("");
    }
  }, [lang]);

  useEffect(() => {
    fetchGreeting();
    const refreshTimer = setInterval(fetchGreeting, 5 * 60 * 1000);
    return () => clearInterval(refreshTimer);
  }, [fetchGreeting]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-transparent flex flex-col items-center overscroll-contain relative z-10">
      
      {/* Startup Notification Prompt Modal */}
      {showNotifPrompt && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4 md:p-0 bg-slate-950/60 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-sm glass-panel p-6 rounded-[32px] border border-cyan-500/30 shadow-2xl flex flex-col items-center gap-4 animate-scale-in bg-slate-900/90">
             <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-500 flex items-center justify-center animate-bounce-subtle">
               <i className="fa-solid fa-bell text-xl"></i>
             </div>
             <div className="text-center space-y-1">
               <h3 className="text-lg font-black text-white uppercase tracking-tight">Stay Connected</h3>
               <p className="text-xs font-medium text-slate-400">Enable notifications to receive alerts when your background tasks complete.</p>
             </div>
             <div className="grid grid-cols-2 gap-3 w-full pt-2">
               <button 
                 onClick={() => setShowNotifPrompt(false)}
                 className="py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-colors"
               >
                 Skip
               </button>
               <button 
                 onClick={handleEnableNotifications}
                 className="py-3 rounded-2xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-600/20 hover:scale-105 active:scale-95 transition-all"
               >
                 Allow
               </button>
             </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl px-6 py-12 md:py-32 flex flex-col items-center gap-12 md:gap-24">
        
        {/* Main Hero Area */}
        <section className="w-full text-center flex flex-col items-center gap-8 md:gap-12 animate-fade">
          <div className="flex flex-col items-center gap-6 md:gap-8 w-full">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-cyan-600 rounded-[24px] md:rounded-[32px] flex items-center justify-center text-white shadow-2xl animate-neural border border-white/10 shrink-0">
              <i className="fa-solid fa-bolt text-white text-4xl md:text-5xl"></i>
            </div>
            
            <div className="flex flex-col items-center max-w-5xl px-2 space-y-4 md:space-y-6">
              {/* Largest: Ayubowan */}
              <h1 className="text-5xl md:text-9xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {t.welcome}
              </h1>
              
              {/* Medium: Context Aware Greeting */}
              <div className="flex flex-col items-center gap-4">
                <div className="min-h-[1.5rem] md:min-h-[2.5rem] flex items-center justify-center">
                  {contextGreeting ? (
                    <h2 className="text-lg md:text-4xl font-bold text-slate-700 dark:text-slate-300 tracking-tight transition-all duration-1000 animate-reveal text-center">
                      {contextGreeting}
                    </h2>
                  ) : (
                    <div className="w-24 md:w-24 h-1 md:h-2 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>

              {/* Smallest: Slogan */}
              <p className="text-slate-500 dark:text-slate-400 font-black tracking-[0.3em] md:tracking-[0.5em] uppercase text-[9px] md:text-xs opacity-60">
                {t.slogan}
              </p>
            </div>
          </div>

          <div className="w-full max-w-3xl flex flex-col items-center gap-6">
            <div className="w-full relative group px-0 md:px-2 z-20">
              <div className="glass-panel p-1.5 md:p-2 rounded-[28px] md:rounded-[36px] flex items-center shadow-2xl border border-slate-300 dark:border-slate-800 focus-within:ring-4 md:focus-within:ring-8 focus-within:ring-cyan-500/10 transition-all duration-500">
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onStartChat(prompt, 'chat')}
                  placeholder={t.howHelp}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-xl px-4 md:px-8 py-4 md:py-5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                />
                <button 
                  onClick={() => onStartChat(prompt, 'chat')}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-12 md:h-16 px-6 md:px-10 rounded-[20px] md:rounded-2xl font-black text-[10px] md:text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl ml-1 md:ml-2"
                >
                  {t.go}
                </button>
              </div>
            </div>

            {!user && (
               <button 
                 onClick={handleLoginClick}
                 disabled={isLoggingIn}
                 className="flex items-center gap-3 px-6 py-3 rounded-full glass-panel border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all group z-20 shadow-md"
               >
                 {isLoggingIn ? (
                    <i className="fa-solid fa-circle-notch animate-spin text-slate-500"></i>
                 ) : (
                    <i className="fa-brands fa-google text-slate-900 dark:text-white text-lg"></i>
                 )}
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                    {lang === 'si' ? 'Google සමඟ සම්බන්ධ වන්න' : 'Sign in with Google'}
                 </span>
               </button>
            )}
          </div>
        </section>

        {/* Features Grid - Clean Straight Line - Updated to use strict Flex/Grid alignment */}
        <section className="w-full flex flex-wrap justify-center items-stretch gap-4 md:gap-6 z-10 max-w-5xl">
          <FeatureCard icon="fa-message" title={t.reasoning} desc="Deep Logic" href="#chat" />
          <FeatureCard icon="fa-calculator" title={t.maths} desc="Solver" href="#math" isBeta />
          <FeatureCard icon="fa-palette" title={t.creative} desc="Studio" href="#art" />
          <FeatureCard icon="fa-camera" title={t.vision} desc="Vision" href="#camera" />
          <FeatureCard icon="fa-microphone-lines" title={t.voiceBeta} desc="Live" href="#voice" isBeta />
        </section>

        {/* Navigation Cards */}
        <section className="w-full grid grid-cols-3 lg:grid-cols-6 gap-2 md:gap-6 z-10">
          <NavCard index={0} href="#creator" icon="fa-user-tie" color="orange" title={t.creator} desc={t.aboutCreator} />
          <NavCard index={1} href="#pricing" icon="fa-tags" color="emerald" title={t.pricing} desc={t.pricingDesc} />
          <NavCard index={2} href="#logic" icon="fa-diagram-project" color="violet" title={t.logicFlow} desc="Neural map." />
          <NavCard index={3} href="#releases" icon="fa-rocket" color="cyan" title={t.releases} desc="Changelogs." />
          <NavCard index={4} href="#privacy" icon="fa-shield-halved" color="indigo" title={t.privacy} desc="Safety doc." />
          <NavCard index={5} href="#terms" icon="fa-file-contract" color="emerald" title={t.terms} desc="Agreement." />
        </section>

        {/* Simple Footer */}
        <footer className="w-full pt-8 md:pt-32 pb-16 md:pb-24 text-center space-y-4 md:space-y-6 opacity-30">
          <div className="w-8 md:w-12 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full"></div>
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-slate-500">© 2026 JN Productions Global • Powered by Januth's Neural Bridge</p>
        </footer>
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; desc: string; href: string; isBeta?: boolean }> = ({ icon, title, desc, href, isBeta }) => (
  <a 
    href={href}
    className="glass-panel p-4 md:p-6 rounded-[24px] md:rounded-[32px] space-y-3 md:space-y-4 hover:translate-y-[-4px] transition-all group border border-slate-200 dark:border-white/5 text-left w-[140px] md:w-44 h-full relative overflow-hidden active:scale-95 flex flex-col items-center justify-center text-center shadow-md hover:shadow-xl shrink-0"
  >
    {isBeta && (
      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-cyan-600 text-white text-[6px] font-black rounded-sm border border-white/20 shadow-sm animate-pulse">BETA</div>
    )}
    <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-cyan-600 transition-colors shadow-inner">
      <i className={`fa-solid ${icon} text-lg md:text-2xl transition-transform duration-500 group-hover:scale-110`} title={title}></i>
    </div>
    <div>
      <h4 className="text-[10px] md:text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h4>
      <p className="text-[8px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">{desc}</p>
    </div>
  </a>
);

const NavCard: React.FC<{ href: string; icon: string; title: string; desc: string; color: string; index: number }> = ({ href, icon, title, desc, color, index }) => (
  <a 
    href={href} 
    className="glass-panel p-3 md:p-8 rounded-[20px] md:rounded-[40px] flex flex-col items-center text-center space-y-2 md:space-y-4 hover:translate-y-[-2px] transition-all group border border-slate-200 dark:border-white/5 active:scale-95"
  >
    <div className={`w-8 h-8 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-${color}-500/10 flex items-center justify-center text-${color}-600 border border-${color}-500/20`}>
      <i className={`fa-solid ${icon} text-xs md:text-xl`}></i>
    </div>
    <h3 className="text-[7px] md:text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">{title}</h3>
    <p className="text-[7px] md:text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 hidden md:block">{desc}</p>
  </a>
);

export default LandingPage;
