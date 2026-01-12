
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
            <FeatureCard icon="fa-message" title={t.reasoning} desc="Chat" onClick={() => onStartChat(prompt, 'chat')} color="cyan" lang={lang} />
            <FeatureCard icon="fa-calculator" title={t.maths} desc="Solve" onClick={() => onStartChat(prompt, 'maths')} color="indigo" isBeta lang={lang} />
            <FeatureCard icon="fa-palette" title={t.creative} desc="Create" onClick={() => onStartChat(prompt, 'studio')} color="purple" lang={lang} />
            <FeatureCard icon="fa-camera" title={t.vision} desc="Visuals" onClick={() => onStartChat(prompt, 'vision')} color="emerald" lang={lang} />
            <FeatureCard icon="fa-microphone-lines" title={t.voice} desc="Voice" onClick={onVoiceOpen} color="blue" isBeta lang={lang} />
            <FeatureCard icon="fa-wand-sparkles" title={t.getHelp} desc="Agents" onClick={() => onStartChat(prompt, 'gethelp')} color="emerald" isBeta lang={lang} />
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

        {/* SEO Platform Overview Section - Visually styled but content-heavy for crawlers */}
        <section className="w-full max-w-6xl py-12 px-6 mt-12 bg-slate-100/50 dark:bg-white/5 rounded-[40px] border border-black/5 dark:border-white/5 text-left animate-reveal">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Why Orin AI Platform?</h2>
                 <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                    Orin AI is the best AI interface for beginners and professionals alike. Designed by Januth Nimnal, this Orin AI assistant serves as a powerful AI workflow assistant, helping users with research, coding, and creative tasks. Unlike other AI chatbot tools, Orin provides native support for Sinhala and Tamil, making it the top AI assistant for Sri Lanka.
                 </p>
                 <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                    Looking for alternatives to ChatGPT? Orin AI platform offers a simple AI chatbot interface with a clean UI, acting as a personal AI assistant that respects your privacy. Whether you need an AI helper for productivity or an AI automation tool for business, Orin delivers.
                 </p>
              </div>
              <div className="space-y-6">
                 <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Key Features</h3>
                 <ul className="space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <li className="flex items-center gap-3"><i className="fa-solid fa-check text-cyan-500"></i> Smart AI Assistant & Virtual Helper</li>
                    <li className="flex items-center gap-3"><i className="fa-solid fa-check text-cyan-500"></i> Custom AI Interface & Dashboard</li>
                    <li className="flex items-center gap-3"><i className="fa-solid fa-check text-cyan-500"></i> AI Chat Tool for Students & Research</li>
                    <li className="flex items-center gap-3"><i className="fa-solid fa-check text-cyan-500"></i> Best AI Interface for Productivity</li>
                    <li className="flex items-center gap-3"><i className="fa-solid fa-check text-cyan-500"></i> Orin AI App & Web Software</li>
                 </ul>
                 <div className="pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Comparison: Orin AI vs ChatGPT • AI Platforms Comparison • Top AI Assistants
                    </p>
                 </div>
              </div>
           </div>
        </section>

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
        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter opacity-60">{desc}</p>
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
