import React, { useEffect, useState, useMemo } from 'react';
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
  onLogin: () => void;
}

// Client-side text generator for "Loading" states and non-critical content
const MarkovLoader = () => {
   const [text, setText] = useState("");
   useEffect(() => {
     const words = ["Initializing Orin Core...", "Syncing Knowledge Graph...", "Calibrating Response Vector...", "Optimizing Local Cache..."];
     let i = 0;
     const t = setInterval(() => {
        setText(words[i % words.length]);
        i++;
     }, 2000);
     return () => clearInterval(t);
   }, []);
   return <span className="animate-pulse">{text}</span>;
};

const LandingPage: React.FC<LandingPageProps> = ({ prompt, onPromptChange, onStartChat, onVoiceOpen, lang, user, onLogin }) => {
  const t = translations[lang];
  const [guestResult, setGuestResult] = useState<string | null>(null);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPromo, setShowPromo] = useState(() => !sessionStorage.getItem('orin_promo_dismissed'));

  const context = useMemo(() => {
    const hour = new Date().getHours();
    return { timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening' };
  }, []);

  const handleSignIn = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await firebaseService.loginWithGoogle();
    } catch {
      // Popup closed or network error; user can retry
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestSubmit = async () => {
     if (!prompt.trim()) return;
     
     // If user is logged in, use standard flow
     if (user) {
        onStartChat(prompt, 'chat');
        return;
     }

     // Guest Mode Logic
     setIsGuestLoading(true);
     setGuestResult(null);
     try {
        const res = await geminiService.chat(prompt, { useThinking: false }); // Fast model for guests
        setGuestResult(res.text);
     } catch (e: any) {
        if (e.message && e.message.includes("limit")) {
           setGuestResult("Guest demo limit reached. Please sign in to continue for free.");
        } else {
           setGuestResult("Connection interrupted. Please try again.");
        }
     } finally {
        setIsGuestLoading(false);
     }
  };

  return (
    <main className="h-full overflow-y-auto custom-scrollbar flex flex-col items-center bg-transparent relative z-10 safe-pb">
      {/* Promotional Banner */}
      {showPromo && (
        <div className="w-full bg-indigo-600 text-white px-4 py-2 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest relative z-[200]">
           <span className="text-center truncate">🚀 {t.promoBanner}</span>
           <button onClick={() => { setShowPromo(false); sessionStorage.setItem('orin_promo_dismissed', 'true'); }} className="opacity-50 hover:opacity-100"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      <article className="w-full max-w-6xl px-4 md:px-6 py-8 md:py-24 flex flex-col items-center gap-10 md:gap-24 text-center">
        
        {/* Hero Section */}
        <section className="w-full flex flex-col items-center gap-8 md:gap-12 animate-fade relative">
          <div className="flex flex-col items-center gap-6 md:gap-8">
            <div className="w-20 h-20 md:w-32 md:h-32 rounded-[28px] md:rounded-[32px] flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-[transform,box-shadow] duration-200 relative">
              <img src="/favicon.svg" className="w-full h-full object-cover rounded-[28px] md:rounded-[32px]" alt="Orin AI" />
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-4xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
                {t.welcome}
              </h1>
              <div className="min-h-[3rem] md:min-h-[4rem] flex flex-col items-center justify-center px-4 gap-2">
                  <h2 className="text-lg md:text-3xl font-bold text-slate-600 dark:text-slate-300 tracking-tight animate-reveal max-w-2xl leading-snug">
                    {context.timeOfDay === 'morning' ? t.goodMorning : context.timeOfDay === 'afternoon' ? t.goodAfternoon : t.goodEvening} {t.orinReady}
                  </h2>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl px-2 relative z-10">
            {/* Guest Chat / Input Area */}
            <div className="relative group w-full focus-glow rounded-[24px] transition-shadow duration-200">
              <div className="absolute -inset-px rounded-[24px] bg-gradient-to-r from-cyan-500/30 to-blue-600/30 group-hover:from-cyan-500/50 group-hover:to-blue-600/50 transition-colors duration-200" />
              <div className="relative glass-panel p-2 rounded-[24px] flex flex-col shadow-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 overflow-hidden">
                
                {/* Result Area (Guest Only) */}
                {(guestResult || isGuestLoading) && (
                   <div className="p-4 md:p-6 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-left animate-reveal max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="flex items-center gap-2 mb-2">
                         <i className="fa-solid fa-robot text-cyan-600"></i>
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t.guestModeLabel}</span>
                      </div>
                      <div className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                         {isGuestLoading ? <MarkovLoader /> : guestResult}
                      </div>
                      {guestResult && guestResult.includes("limit") && (
                         <button onClick={handleSignIn} disabled={isLoggingIn} className="mt-4 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">
                            {isLoggingIn ? t.signingIn : t.signInFree}
                         </button>
                      )}
                   </div>
                )}

                <div className="flex items-center pl-2">
                    <input 
                    type="text" 
                    value={prompt} 
                    onChange={(e) => onPromptChange(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleGuestSubmit()}
                    placeholder={user ? t.howHelp : t.tryDemoPlaceholder} 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-xl px-2 md:px-4 py-3 md:py-5 dark:text-white placeholder:text-slate-400 font-medium min-w-0"
                    />
                    <button 
                    onClick={handleGuestSubmit} 
                    disabled={isGuestLoading || !prompt.trim()}
                    className="shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-10 md:h-16 px-4 md:px-10 rounded-[18px] md:rounded-[20px] font-black text-[10px] md:text-sm uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-[0.98] transition-[box-shadow,transform] duration-150 flex items-center gap-2 disabled:opacity-50 m-1"
                    >
                    <span>{user ? t.go : (isGuestLoading ? "..." : t.demo)}</span>
                    {!isGuestLoading && <i className="fa-solid fa-arrow-right"></i>}
                    </button>
                </div>
              </div>
            </div>
            
            {!user && !guestResult && (
               <div className="mt-6 flex flex-col items-center gap-3 animate-slide-in-up">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.guestLimitLabel}</p>
                 <button onClick={handleSignIn} disabled={isLoggingIn} className="flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-70">
                    {isLoggingIn ? <i className="fa-solid fa-circle-notch animate-spin text-slate-500"></i> : <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isLoggingIn ? t.authenticating : t.signInToUnlock}</span>
                 </button>
               </div>
            )}
          </div>
        </section>

        {/* Navigation Grid */}
        <section className="w-full max-w-6xl space-y-8 md:space-y-12 animate-slide-in-up">
          <div className="flex flex-wrap justify-center gap-3 md:gap-6 px-2 md:px-0">
              {[t.telegramBot, t.downloads, t.creator, t.pricing, t.logicFlow, t.releases, t.terms, t.privacy].map((title, i) => (
                <NavCard key={i} href={['#telegram-bot', '#downloads', '#creator', '#pricing', '#logic', '#releases', '#terms', '#privacy'][i]} title={title} lang={lang} delayMs={i * 50} />
              ))}
          </div>
        </section>

        {/* Detailed Information Section */}
        <section className="w-full max-w-5xl px-4 py-16 space-y-16 text-slate-600 dark:text-slate-400 text-left md:text-center animate-reveal">
          
          <div className="space-y-6">
             <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.heroTitle}</h3>
             <p className={`text-sm md:text-base font-medium leading-relaxed max-w-3xl mx-auto ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>
               {t.heroParagraph}
             </p>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4">{t.coreCapabilities}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <InfoCard icon="fa-language" title={t.infoBilingualTitle} desc={t.infoBilingualDesc} lang={lang} />
                <InfoCard icon="fa-eye" title={t.infoVisualTitle} desc={t.infoVisualDesc} lang={lang} />
                <InfoCard icon="fa-palette" title={t.infoStudioTitle} desc={t.infoStudioDesc} lang={lang} />
                <InfoCard icon="fa-microphone" title={t.infoVoiceTitle} desc={t.infoVoiceDesc} lang={lang} />
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4">{t.whoIsOrinFor}</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <AudienceCard title={t.audienceStudents} desc={t.audienceStudentsDesc} lang={lang} />
                <AudienceCard title={t.audiencePro} desc={t.audienceProDesc} lang={lang} />
                <AudienceCard title={t.audienceCreators} desc={t.audienceCreatorsDesc} lang={lang} />
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4">{t.howToGetStarted}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <StepRow num="01" title={t.step1Title} desc={t.step1Desc} lang={lang} />
                <StepRow num="02" title={t.step2Title} desc={t.step2Desc} lang={lang} />
                <StepRow num="03" title={t.step3Title} desc={t.step3Desc} lang={lang} />
                <StepRow num="04" title={t.step4Title} desc={t.step4Desc} lang={lang} />
             </div>
          </div>

        </section>

        {/* Footer with Socials */}
        <footer className="w-full py-16 border-t border-black/5 dark:border-white/5 mt-12 w-screen">
            <div className="max-w-6xl mx-auto flex flex-col items-center gap-8 px-6">
               <div className="flex flex-wrap justify-center gap-6">
                  <SocialIcon icon="fa-instagram" href="https://www.instagram.com/januth10.1/" />
                  <SocialIcon icon="fa-facebook-f" href="https://web.facebook.com/januth10.1/" />
                  <SocialIcon icon="fa-tiktok" href="https://www.tiktok.com/@januth10.1" />
                  <SocialIcon icon="fa-youtube" href="#" />
                  <SocialIcon icon="fa-linkedin-in" href="#" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">{t.footerAllRights}</p>
            </div>
        </footer>
      </article>
    </main>
  );
};

const NavCard = ({ href, title, lang, delayMs = 0 }: { href: string; title: string; lang: Language; delayMs?: number }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const hash = href.startsWith('#') ? href.slice(1) : href;
    window.location.hash = hash;
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      style={{ animationDelay: `${delayMs}ms` }}
      className="glass-panel w-28 h-28 md:w-32 md:h-32 rounded-[24px] flex flex-col items-center justify-center hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-1 hover:shadow-md transition-[transform,box-shadow,background-color] duration-200 border border-slate-200 dark:border-white/5 active:scale-[0.98] bg-white/50 dark:bg-slate-900/30 shadow-sm animate-slide-in-up"
    >
      <h3 className={`text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-center px-2 transition-colors duration-150 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{title}</h3>
    </a>
  );
};

// Helper Components for Info Section
const InfoCard = ({ icon, title, desc, lang }: { icon: string; title: string; desc: string; lang?: Language }) => (
  <div className="flex gap-4 p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-cyan-500/20 hover:shadow-sm transition-[border-color,box-shadow] duration-150">
     <div className="w-12 h-12 shrink-0 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500"><i className={`fa-solid ${icon} text-xl`}></i></div>
     <div>
        <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide mb-2">{title}</h5>
        <p className={`text-xs leading-relaxed opacity-80 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
     </div>
  </div>
);

const AudienceCard = ({ title, desc, lang }: { title: string; desc: string; lang?: Language }) => (
  <div className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:-translate-y-1 transition-transform">
     <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide mb-3 border-b border-black/5 dark:border-white/5 pb-2 inline-block">{title}</h5>
     <p className={`text-xs leading-relaxed opacity-80 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
  </div>
);

const StepRow = ({ num, title, desc, lang }: { num: string; title: string; desc: string; lang?: Language }) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
     <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 opacity-60 bg-cyan-500/10 px-2 py-1 rounded">{num}</span>
     <div>
        <h6 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">{title}</h6>
        <p className={`text-xs leading-relaxed opacity-70 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
     </div>
  </div>
);

const SocialIcon = ({ icon, href }: any) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-cyan-600 hover:scale-110 active:scale-95 transition-[color,background,transform] duration-150 shadow-sm">
     <i className={`fa-brands ${icon} text-lg`}></i>
  </a>
);

export default LandingPage;