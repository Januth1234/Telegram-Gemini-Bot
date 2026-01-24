
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { geminiService } from '../services/geminiService';
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

  // Promo Banner State
  const [showBanner, setShowBanner] = useState(() => {
    try {
      return sessionStorage.getItem('promo_jan_30_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const dismissBanner = () => {
    setShowBanner(false);
    try {
      sessionStorage.setItem('promo_jan_30_dismissed', 'true');
    } catch {}
  };

  const context = useMemo(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const weathers = ['sunny', 'cloudy', 'rainy', 'breezy'];
    const weather = weathers[Math.floor(Math.random() * weathers.length)];
    return { timeOfDay, weather };
  }, []);

  const getLocalGreeting = () => {
    if (lang === 'si') {
      const timeStr = context.timeOfDay === 'morning' ? 'සුබ උදෑසනක්' : context.timeOfDay === 'afternoon' ? 'සුබ දහවලක්' : 'සුබ සැන්දෑවක්';
      return `${timeStr} වේවා ඔරින් AI වෙතින් ඔබට`;
    } else if (lang === 'ta') {
      const timeStr = context.timeOfDay === 'morning' ? 'காலை வணக்கம்' : context.timeOfDay === 'afternoon' ? 'மதிய வணக்கம்' : 'மாலை வணக்கம்';
      return `ஓரின் AI உங்களுக்கு ${timeStr} தெரிவிக்கிறது`;
    } else {
      return `Good ${context.timeOfDay} and welcome to Orin AI`;
    }
  };

  const [greeting, setGreeting] = useState(getLocalGreeting);

  const fetchAiGreeting = useCallback(async () => {
    try {
      const aiGreeting = await geminiService.generateWelcomeMessage({
        timeOfDay: context.timeOfDay,
        weather: context.weather,
        lang
      });
      if (aiGreeting) setGreeting(aiGreeting);
    } catch (e) {}
  }, [lang, context]);

  useEffect(() => {
    setGreeting(getLocalGreeting()); 
    fetchAiGreeting();
  }, [lang, fetchAiGreeting]);

  return (
    <main className="h-full overflow-y-auto custom-scrollbar flex flex-col items-center bg-transparent relative z-10 safe-pb">
      
      {/* Promo Banner */}
      {showBanner && (
        <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-3 shrink-0 relative z-50 shadow-lg animate-in slide-in-from-top duration-500">
            <div className="max-w-6xl mx-auto flex items-center justify-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                        <i className="fa-solid fa-gift text-xs"></i>
                    </span>
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-center md:text-left">
                        {lang === 'si' 
                            ? "විශේෂ දැනුම්දීමයි: ජනවාරි 30 දක්වා සියලුම Orin සේවාවන් නොමිලේ!" 
                            : lang === 'ta' 
                            ? "ஜனவரி 30 வரை அனைத்து சேவைகளும் இலவசம்!" 
                            : "Limited Offer: All services are FREE for everyone throughout January (until Jan 30)!"}
                    </p>
                </div>
                <button 
                    onClick={dismissBanner} 
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/30 transition-all shrink-0 absolute right-4 md:static"
                >
                    <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
            </div>
        </div>
      )}

      <article className="w-full max-w-6xl px-6 py-12 md:py-24 flex flex-col items-center gap-16 md:gap-24 text-center">
        
        {/* Hero Section */}
        <section className="w-full flex flex-col items-center gap-8 md:gap-12 animate-fade">
          <div className="flex flex-col items-center gap-8">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-cyan-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl hover:scale-105 transition-transform duration-500 relative group">
              <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <i className="fa-solid fa-bolt text-5xl md:text-7xl relative z-10"></i>
            </div>
            
            <div className="space-y-6">
              {/* Semantic H1 for SEO */}
              <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.85]">
                {t.welcome}
              </h1>
              <div className="min-h-[4rem] flex flex-col items-center justify-center px-4 gap-2">
                  <h2 className="text-xl md:text-3xl font-bold text-slate-600 dark:text-slate-300 tracking-tight animate-reveal max-w-2xl leading-snug">
                    {greeting}
                  </h2>
                  <p className="text-[10px] md:text-xs font-black tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500">
                    {t.slogan} <span className="sr-only">Built by Januth Nimnal for Sri Lanka</span>
                  </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl px-2">
            <div className="relative group w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[24px] blur opacity-15 group-hover:opacity-30 transition duration-500"></div>
              <div className="relative glass-panel p-2 rounded-[24px] flex items-center shadow-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10">
                <input 
                  type="text" 
                  value={prompt} 
                  onChange={(e) => onPromptChange(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && onStartChat(prompt, 'chat')}
                  placeholder={t.howHelp} 
                  aria-label="Ask Orin AI anything - The Smart AI Assistant"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-2xl px-4 md:px-6 py-4 md:py-5 dark:text-white placeholder:text-slate-400 font-medium min-w-0"
                />
                <button 
                  onClick={() => onStartChat(prompt, 'chat')} 
                  aria-label="Start Chat with Orin AI"
                  className="shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-12 md:h-16 px-6 md:px-10 rounded-[20px] font-black text-xs md:text-sm uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                >
                  <span>{prompt.trim() ? t.go : (lang === 'si' ? "Orin අරඹන්න" : lang === 'ta' ? "ஓரினைத் தொடங்க" : "Start Orin")}</span>
                  {!prompt.trim() && <i className="fa-solid fa-arrow-right"></i>}
                </button>
              </div>
            </div>
            {!user && (
               <button onClick={onLogin} className="mt-8 flex items-center gap-3 px-8 py-4 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-95 mx-auto">
                 <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{lang === 'si' ? 'Google සමඟ එක්වන්න' : lang === 'ta' ? 'கூகுள் மூலம் இணையுங்கள்' : 'Join with Google'}</span>
               </button>
            )}
          </div>
        </section>

        {/* Feature Grid */}
        <section className="w-full max-w-6xl space-y-12 animate-slide-in-up">
          <header className="flex items-center gap-6 opacity-40">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-400 dark:to-slate-600"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Neural Tools</span>
             <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-400 dark:to-slate-600"></div>
          </header>
          
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            <FeatureCard icon="fa-message" title={t.reasoning} desc={t.featureDesc.chat} onClick={() => onStartChat(prompt, 'chat')} color="cyan" lang={lang} />
            <FeatureCard icon="fa-calculator" title={t.maths} desc={t.featureDesc.solve} onClick={() => onStartChat(prompt, 'maths')} color="indigo" isBeta lang={lang} />
            <FeatureCard icon="fa-palette" title={t.creative} desc={t.featureDesc.create} onClick={() => onStartChat(prompt, 'studio')} color="purple" lang={lang} />
            <FeatureCard icon="fa-camera" title={t.vision} desc={t.featureDesc.visuals} onClick={() => onStartChat(prompt, 'vision')} color="emerald" lang={lang} />
            <FeatureCard icon="fa-microphone-lines" title={t.voice} desc={t.featureDesc.voice} onClick={onVoiceOpen} color="blue" isBeta lang={lang} />
            <FeatureCard icon="fa-wand-sparkles" title={t.getHelp} desc={t.featureDesc.agents} onClick={() => onStartChat(prompt, 'gethelp')} color="emerald" isBeta lang={lang} />
          </div>
        </section>

        {/* Navigation Grid */}
        <section className="w-full max-w-6xl space-y-12 animate-slide-in-up">
          <header className="flex items-center gap-6 opacity-40">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-400 dark:to-slate-600"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Archive</span>
             <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-400 dark:to-slate-600"></div>
          </header>
          
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <NavCard href="#downloads" icon="fa-download" color="cyan" title={t.downloads} lang={lang} />
              <NavCard href="#creator" icon="fa-user-tie" color="orange" title={t.creator} lang={lang} />
              <NavCard href="#pricing" icon="fa-tags" color="emerald" title={t.pricing} lang={lang} />
              <NavCard href="#logic" icon="fa-diagram-project" color="violet" title={t.logicFlow} lang={lang} />
              <NavCard href="#releases" icon="fa-rocket" color="pink" title={t.releases} lang={lang} />
              <NavCard href="#privacy" icon="fa-shield-halved" color="blue" title={t.privacy} lang={lang} />
              <NavCard href="#terms" icon="fa-file-contract" color="indigo" title={t.terms} lang={lang} />
          </div>
        </section>

        {/* Strategic SEO Content: Intro -> Problem -> Solution -> Benefits -> CTA */}
        <article className="w-full max-w-6xl py-16 px-8 mt-16 bg-slate-100/50 dark:bg-white/5 rounded-[48px] border border-black/5 dark:border-white/5 text-left animate-reveal shadow-sm">
           <header className="mb-10 text-center md:text-left">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Orin AI Review 2026: The Next Generation of Assistant</h2>
              <div className="h-1 w-24 bg-cyan-500 rounded-full mx-auto md:mx-0"></div>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-8">
                 <section>
                    <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">The Problem</h3>
                    <p className="text-base font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                       Finding the <strong>best AI assistant for small businesses</strong> and students in South Asia has always been a challenge. Most global tools lack localization, making it hard to find a reliable <strong>Sinhala AI chatbot</strong> or a tool that understands the nuance of local research needs. Expensive subscriptions and complex interfaces often gatekeep powerful AI from those who need it most.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">The Solution</h3>
                    <p className="text-base font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                       Orin AI bridges this gap. It is designed as a custom <strong>AI chat interface</strong> that prioritizes speed, accessibility, and bilingual support. Whether you are looking for <strong>how to build your own AI chatbot</strong> experience or simply need a "smart AI assistant" for daily tasks, Orin delivers a seamless, ad-free environment powered by Google's Gemini models.
                    </p>
                 </section>
              </div>

              <div className="space-y-8">
                 <section>
                    <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Key Benefits</h3>
                    <ul className="space-y-4">
                       <li className="flex items-start gap-3">
                          <i className="fa-solid fa-check-circle text-cyan-500 mt-1"></i>
                          <div>
                             <strong className="text-slate-900 dark:text-white text-sm block mb-1">Total Privacy</strong>
                             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Your data stays on your device. Orin operates with a local-first memory architecture.</p>
                          </div>
                       </li>
                       <li className="flex items-start gap-3">
                          <i className="fa-solid fa-check-circle text-cyan-500 mt-1"></i>
                          <div>
                             <strong className="text-slate-900 dark:text-white text-sm block mb-1">Native Language Support</strong>
                             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">The only robust <strong>AI interface for productivity</strong> optimized for Sinhala and Tamil input.</p>
                          </div>
                       </li>
                       <li className="flex items-start gap-3">
                          <i className="fa-solid fa-check-circle text-cyan-500 mt-1"></i>
                          <div>
                             <strong className="text-slate-900 dark:text-white text-sm block mb-1">Multimodal Power</strong>
                             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">From <strong>AI assistant for research</strong> to creative image synthesis and math solving.</p>
                          </div>
                       </li>
                    </ul>
                 </section>

                 <div className="pt-4">
                    <button onClick={() => onStartChat(prompt, 'chat')} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all">
                       Start Free AI Workspace
                    </button>
                 </div>
              </div>
           </div>
        </article>

        <footer className="w-full py-16 opacity-30 border-t border-black/5 dark:border-white/5 mt-12">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">© 2026 JN Productions Global • All Rights Reserved</p>
        </footer>
      </article>
    </main>
  );
};

const FeatureCard = ({ icon, title, desc, onClick, color, isBeta, lang }: any) => {
  const colors: Record<string, string> = {
    cyan: "group-hover:text-cyan-500",
    indigo: "group-hover:text-indigo-500",
    purple: "group-hover:text-purple-500",
    emerald: "group-hover:text-emerald-500",
    blue: "group-hover:text-blue-500"
  };

  return (
    <button onClick={onClick} className="glass-panel w-40 h-40 md:w-48 md:h-48 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:-translate-y-3 hover:shadow-2xl transition-all duration-500 group border border-slate-200 dark:border-white/5 relative bg-white/50 dark:bg-slate-900/50">
      {isBeta && (
        <div className="absolute top-4 right-4 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </div>
      )}
      <div className={`w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:scale-125 transition-all duration-500 shadow-sm border border-slate-100 dark:border-white/5 ${colors[color]}`}>
        <i className={`fa-solid ${icon} text-2xl md:text-3xl`}></i>
      </div>
      <div className="space-y-0.5 px-4 text-center">
        <h4 className={`text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{title}</h4>
        <p className={`text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter opacity-60 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
      </div>
    </button>
  );
};

const NavCard = ({ href, icon, title, color, lang }: any) => {
  const colors: Record<string, string> = {
    cyan: "group-hover:text-cyan-500",
    indigo: "group-hover:text-indigo-500",
    purple: "group-hover:text-purple-500",
    emerald: "group-hover:text-emerald-500",
    orange: "group-hover:text-orange-500",
    pink: "group-hover:text-pink-500",
    violet: "group-hover:text-violet-500",
    blue: "group-hover:text-blue-500"
  };

  return (
    <a 
      href={href} 
      className="glass-panel w-28 h-28 md:w-32 md:h-32 rounded-[24px] flex flex-col items-center justify-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-2 transition-all border border-slate-200 dark:border-white/5 active:scale-95 bg-white/40 dark:bg-slate-900/20 shadow-sm group"
    >
      <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 transition-all duration-300 group-hover:scale-125 shadow-inner ${colors[color]}`}>
        <i className={`fa-solid ${icon} text-lg`}></i>
      </div>
      <h3 className={`text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-colors group-hover:text-slate-900 dark:group-hover:text-white ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{title}</h3>
    </a>
  );
};

export default LandingPage;
