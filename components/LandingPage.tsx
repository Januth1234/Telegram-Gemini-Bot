
import React, { useEffect, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { translations } from '../translations';
import { Language, WorkspaceMode } from '../types';

interface LandingPageProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  onStartChat: (prompt: string, mode: WorkspaceMode) => void;
  onVoiceOpen: () => void;
  lang: Language;
}

const LandingPage: React.FC<LandingPageProps> = ({ prompt, onPromptChange, onStartChat, onVoiceOpen, lang }) => {
  const t = translations[lang];
  const [contextGreeting, setContextGreeting] = useState("");

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
    <div className="h-full overflow-y-auto custom-scrollbar bg-transparent flex flex-col items-center overscroll-contain">
      <div className="w-full max-w-6xl px-6 py-12 md:py-32 flex flex-col items-center gap-16 md:gap-24">
        
        {/* Main Hero Area */}
        <section className="w-full text-center flex flex-col items-center gap-10 md:gap-12 animate-fade">
          <div className="flex flex-col items-center gap-6 md:gap-8 w-full">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-cyan-600 rounded-[28px] md:rounded-[32px] flex items-center justify-center shadow-2xl animate-neural border border-white/10 shrink-0">
              <i className="fa-solid fa-bolt text-white text-3xl md:text-5xl"></i>
            </div>
            
            <div className="flex flex-col items-center max-w-5xl px-4 space-y-4 md:space-y-6">
              {/* Largest: Ayubowan */}
              <h1 className="text-5xl md:text-9xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
                {t.welcome}
              </h1>
              
              {/* Medium: Context Aware Greeting */}
              <div className="flex flex-col items-center gap-4">
                <div className="min-h-[1.5rem] md:min-h-[2.5rem] flex items-center justify-center">
                  {contextGreeting ? (
                    <h2 className="text-base md:text-4xl font-bold text-slate-700 dark:text-slate-300 tracking-tight transition-all duration-1000 animate-reveal">
                      {contextGreeting}
                    </h2>
                  ) : (
                    <div className="w-16 md:w-24 h-1 md:h-2 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>

              {/* Smallest: Slogan */}
              <p className="text-slate-500 dark:text-slate-400 font-black tracking-[0.3em] md:tracking-[0.5em] uppercase text-[8px] md:text-xs opacity-60">
                {t.slogan}
              </p>
            </div>
          </div>

          <div className="w-full max-w-3xl relative group px-2">
            <div className="glass-panel p-1 md:p-2 rounded-[28px] md:rounded-[36px] flex items-center shadow-2xl border border-slate-300 dark:border-slate-800 focus-within:ring-4 md:focus-within:ring-8 focus-within:ring-cyan-500/10 transition-all duration-500">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onStartChat(prompt, 'chat')}
                placeholder={t.howHelp}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-xl px-4 md:px-8 py-4 md:py-5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
              />
              <button 
                onClick={() => onStartChat(prompt, 'chat')}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-12 md:h-16 px-6 md:px-10 rounded-2xl font-black text-[10px] md:text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl ml-1 md:ml-2"
              >
                {t.go}
              </button>
            </div>
          </div>
        </section>

        {/* Features Grid - Reordered: Chat, Creator, Camera, Voice */}
        <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <FeatureCard index={0} icon="fa-message" title={t.reasoning} desc="Advanced chat logic" onClick={() => onStartChat(prompt, 'chat')} />
          <FeatureCard index={1} icon="fa-palette" title={t.creative} desc="Create visual assets" onClick={() => onStartChat(prompt, 'studio')} />
          <FeatureCard index={2} icon="fa-camera" title={t.vision} desc="Visual recognition" onClick={() => onStartChat(prompt, 'vision')} />
          <FeatureCard index={3} icon="fa-microphone-lines" title={t.voiceBeta} desc="Neural voice assistant" onClick={onVoiceOpen} />
        </section>

        {/* Navigation Cards */}
        <section className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
          <NavCard index={0} href="#creator" icon="fa-user-tie" color="orange" title={t.creator} desc={t.aboutCreator} />
          <NavCard index={1} href="#pricing" icon="fa-tags" color="emerald" title={t.pricing} desc={t.pricingDesc} />
          <NavCard index={2} href="#logic" icon="fa-diagram-project" color="violet" title={t.logicFlow} desc="Neural map." />
          <NavCard index={3} href="#releases" icon="fa-rocket" color="cyan" title={t.releases} desc="Changelogs." />
          <NavCard index={4} href="#privacy" icon="fa-shield-halved" color="indigo" title={t.privacy} desc="Safety doc." />
          <NavCard index={5} href="#terms" icon="fa-file-contract" color="emerald" title={t.terms} desc="Agreement." />
        </section>

        {/* Simple Footer */}
        <footer className="w-full pt-16 md:pt-32 pb-16 md:pb-24 text-center space-y-4 md:space-y-6 opacity-30">
          <div className="w-8 md:w-12 h-1 bg-slate-300 dark:bg-slate-800 mx-auto rounded-full"></div>
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-slate-500">© 2026 JN Productions Global • Powered by Puter & Januth's Neural Bridge</p>
        </footer>
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; desc: string; index: number; onClick: () => void }> = ({ icon, title, desc, index, onClick }) => (
  <button 
    onClick={onClick}
    className="glass-panel p-6 md:p-10 rounded-[32px] md:rounded-[40px] space-y-4 md:space-y-6 hover:translate-y-[-4px] transition-all group border border-slate-200 dark:border-white/5 text-left w-full"
  >
    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-cyan-600 transition-colors shadow-inner">
      <i className={`fa-solid ${icon} text-xl md:text-2xl transition-transform duration-500 group-hover:scale-110`} title={title}></i>
    </div>
    <div>
      <h4 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h4>
      <p className="text-[9px] md:text-[11px] text-slate-500 dark:text-slate-400 mt-1 md:mt-2 font-medium leading-relaxed">{desc}</p>
    </div>
  </button>
);

const NavCard: React.FC<{ href: string; icon: string; title: string; desc: string; color: string; index: number }> = ({ href, icon, title, desc, color, index }) => (
  <a 
    href={href} 
    className="glass-panel p-4 md:p-8 rounded-[28px] md:rounded-[40px] flex flex-col items-center text-center space-y-2 md:space-y-4 hover:translate-y-[-2px] transition-all group border border-slate-200 dark:border-white/5"
  >
    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-${color}-500/10 flex items-center justify-center text-${color}-600 border border-${color}-500/20`}>
      <i className={`fa-solid ${icon} text-sm md:text-xl`}></i>
    </div>
    <h3 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">{title}</h3>
    <p className="text-[7px] md:text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 hidden md:block">{desc}</p>
  </a>
);

export default LandingPage;
