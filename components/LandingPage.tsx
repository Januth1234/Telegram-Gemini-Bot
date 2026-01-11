
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

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => setShowNotifPrompt(true), 2500);
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
    <div className="h-full overflow-y-auto custom-scrollbar bg-transparent flex flex-col items-center overscroll-contain relative z-10 safe-pb">
      
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
               <button onClick={() => setShowNotifPrompt(false)} className="py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-colors">Skip</button>
               <button onClick={handleEnableNotifications} className="py-3 rounded-2xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-600/20 hover:scale-105 active:scale-95 transition-all">Allow</button>
             </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl px-4 md:px-8 py-12 md:py-24 flex flex-col items-center gap-16 md:gap-24">
        
        {/* Main Hero Area */}
        <section className="w-full text-center flex flex-col items-center gap-8 md:gap-12 animate-fade max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-6 md:gap-8 w-full">
            <div className="w-20 h-20 md:w-28 md:h-28 bg-cyan-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-cyan-900/20 border border-white/10 shrink-0 hover:scale-105 transition-transform duration-500">
              <i className="fa-solid fa-bolt text-4xl md:text-6xl"></i>
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-5xl xs:text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
                {t.welcome}
              </h1>
              
              <div className="min-h-[3rem] flex items-center justify-center px-4">
                {contextGreeting ? (
                  <h2 className="text-lg md:text-3xl font-bold text-slate-600 dark:text-slate-300 tracking-tight transition-all duration-700 animate-reveal text-center leading-snug">
                    {contextGreeting}
                  </h2>
                ) : (
                  <div className="w-32 h-2 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                )}
              </div>

              <p className="text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 dark:text-slate-500">
                {t.slogan}
              </p>
            </div>
          </div>

          <div className="w-full max-w-2xl px-2">
            <div className="relative group z-20 w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[30px] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative glass-panel p-2 rounded-[28px] flex items-center shadow-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 group-focus-within:border-cyan-500/50 transition-all">
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onStartChat(prompt, 'chat')}
                  placeholder={t.howHelp}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-xl px-6 py-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium h-14 md:h-16"
                />
                <button 
                  onClick={() => onStartChat(prompt, 'chat')}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-12 md:h-14 px-6 md:px-10 rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shrink-0"
                >
                  {t.go}
                </button>
              </div>
            </div>

            {!user && (
               <div className="mt-6 flex justify-center">
                 <button 
                   onClick={handleLoginClick}
                   disabled={isLoggingIn}
                   className="flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm hover:shadow-md transition-all group active:scale-95"
                 >
                   {isLoggingIn ? (
                     <i className="fa-solid fa-circle-notch animate-spin text-slate-400"></i>
                   ) : (
                     <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                   )}
                   <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {lang === 'si' ? 'Google සමඟ සම්බන්ධ වන්න' : 'Sign in with Google'}
                   </span>
                 </button>
               </div>
            )}
          </div>
        </section>

        {/* Features Grid */}
        <section className="w-full max-w-6xl space-y-8 animate-slide-in-up">
          <div className="flex items-center gap-4 px-2 opacity-80">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Core Modules</span>
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
            <FeatureCard icon="fa-message" title={t.reasoning} desc="Deep Logic Chat" href="#chat" color="blue" />
            <FeatureCard icon="fa-calculator" title={t.maths} desc="Step Solver" href="#math" color="indigo" isBeta />
            <FeatureCard icon="fa-palette" title={t.creative} desc="Design Studio" href="#art" color="purple" />
            <FeatureCard icon="fa-camera" title={t.vision} desc="Visual Intelligence" href="#camera" color="emerald" />
            <FeatureCard icon="fa-microphone-lines" title={t.voiceBeta} desc="Voice Engine" href="#voice" color="cyan" isBeta />
          </div>
        </section>

        {/* Navigation Grid */}
        <section className="w-full max-w-6xl space-y-8 animate-slide-in-up" style={{ animationDelay: '100ms' }}>
          <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-5">
            <NavCard href="#downloads" icon="fa-download" color="blue" title={t.downloads} desc={t.downloadsDesc} />
            <NavCard href="#creator" icon="fa-user-tie" color="orange" title={t.creator} desc={t.aboutCreator} />
            <NavCard href="#pricing" icon="fa-tags" color="emerald" title={t.pricing} desc={t.pricingDesc} />
            <NavCard href="#logic" icon="fa-diagram-project" color="violet" title={t.logicFlow} desc="Architecture" />
            <NavCard href="#releases" icon="fa-rocket" color="pink" title={t.releases} desc="Changelog" />
            <NavCard href="#privacy" icon="fa-shield-halved" color="blue" title={t.privacy} desc="Safety" />
          </div>
        </section>

        <footer className="w-full pt-12 pb-8 text-center space-y-4 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 mx-auto rounded-full"></div>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
            © 2026 JN Productions Global
          </p>
        </footer>
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; desc: string; href: string; color: string; isBeta?: boolean }> = ({ icon, title, desc, href, color, isBeta }) => (
  <a 
    href={href}
    className="glass-panel p-6 rounded-[24px] md:rounded-[32px] flex flex-col items-center text-center justify-between min-h-[160px] md:min-h-[180px] hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group border border-slate-200 dark:border-white/5 relative overflow-hidden bg-white/60 dark:bg-slate-900/40"
  >
    <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
    
    {isBeta && (
      <div className="absolute top-3 right-3 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[6px] font-black uppercase tracking-widest rounded border border-cyan-500/20">BETA</div>
    )}

    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-${color}-500 group-hover:scale-110 transition-all duration-300 shadow-sm border border-slate-100 dark:border-white/5 relative z-10 mt-2`}>
      <i className={`fa-solid ${icon} text-xl md:text-3xl`}></i>
    </div>
    
    <div className="space-y-1 relative z-10 w-full">
      <h4 className="text-xs md:text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{title}</h4>
      <p className="text-[9px] md:text-[10px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1">{desc}</p>
    </div>
  </a>
);

const NavCard: React.FC<{ href: string; icon: string; title: string; desc: string; color: string }> = ({ href, icon, title, desc, color }) => (
  <a 
    href={href} 
    className="glass-panel p-4 py-6 md:p-6 rounded-2xl md:rounded-[28px] flex flex-col items-center text-center space-y-3 hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-1 transition-all group border border-slate-200 dark:border-white/5 active:scale-95 bg-white/40 dark:bg-slate-900/20"
  >
    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-${color}-500 transition-colors`}>
      <i className={`fa-solid ${icon} text-sm md:text-lg`}></i>
    </div>
    <div className="space-y-0.5">
        <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>
        <p className="text-[8px] text-slate-400 dark:text-slate-500 font-medium hidden md:block">{desc}</p>
    </div>
  </a>
);

export default LandingPage;
