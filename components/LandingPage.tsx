import React, { useEffect, useState, useMemo } from 'react';
import { geminiService } from '../services/geminiService';
import { firebaseService } from '../services/firebaseService';
import { translations } from '../translations';
import { Language, WorkspaceMode, UserAccount, UserThemeId } from '../types';

interface LandingPageProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  onStartChat: (prompt: string, mode: WorkspaceMode) => void;
  onVoiceOpen: () => void;
  lang: Language;
  user: UserAccount | null;
  onLogin: () => void;
  onSignInWithUser?: (authUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => Promise<void>;
  thinkingMode: boolean;
  descriptiveMode: boolean;
  onReasoningModeChange: (opts: { thinking?: boolean; descriptive?: boolean }) => void;
  userTheme?: UserThemeId;
  isDark?: boolean;
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

const VALID_THEME_IDS: UserThemeId[] = ['classic', 'midnight', 'aurora', 'terminal', 'paper', 'ocean', 'sunset'];

function resolveLandingTheme(theme: UserThemeId | undefined | string | null): UserThemeId {
  if (theme && VALID_THEME_IDS.includes(theme as UserThemeId)) return theme as UserThemeId;
  return 'classic'; // new users, "standard", or any invalid value → classic (animation always works)
}

/* No hero gradients: shaders (from App) are the only hero backgrounds.
 * Overlay is minimal/none for shader themes; classic uses base themeBg only. */
const THEME_ANIMATION: Record<UserThemeId, { animationClass: string; className: string }> = {
  classic: { animationClass: '', className: '' },
  midnight: { animationClass: '', className: '' },
  aurora: { animationClass: '', className: '' },
  terminal: { animationClass: '', className: '' },
  paper: { animationClass: '', className: '' },
  ocean: { animationClass: '', className: '' },
  sunset: { animationClass: '', className: '' },
  neon: { animationClass: '', className: '' },
};

const LandingPage: React.FC<LandingPageProps> = ({ prompt, onPromptChange, onStartChat, onVoiceOpen, lang, user, onLogin, onSignInWithUser, thinkingMode, descriptiveMode, onReasoningModeChange, userTheme, isDark }) => {
  const t = translations[lang];
  const [guestResult, setGuestResult] = useState<string | null>(null);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const context = useMemo(() => {
    const hour = new Date().getHours();
    return { timeOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening' };
  }, []);

  // Sign-in lives in the Account view (Orin AI accounts are the only method).
  const handleSignIn = () => {
    setShowLoginPrompt(false);
    window.location.hash = 'account';
  };

  const handleGuestSubmit = async () => {
    if (!prompt.trim()) return;

    // If user is logged in, use standard flow
    if (user) {
      onStartChat(prompt, 'chat');
      return;
    }

    setIsGuestLoading(true);
    setGuestResult(null);
    try {
      const res = await geminiService.chat(prompt, {
        useThinking: thinkingMode,
        descriptive: descriptiveMode,
      });
      setGuestResult(res.text);
    } catch (e: any) {
      if (e?.message && e.message.includes('limit')) {
        // Guest demo limit reached – show a clear sign-in modal instead of tiny inline text.
        setShowLoginPrompt(true);
      } else {
        setGuestResult('Connection interrupted. Please try again.');
      }
    } finally {
      setIsGuestLoading(false);
    }
  };

  const landingTheme = resolveLandingTheme(userTheme);
  const themeFx = THEME_ANIMATION[landingTheme];

  return (
    <main className="h-full overflow-x-hidden overflow-y-auto custom-scrollbar flex flex-col items-center bg-transparent relative z-10 safe-pb">
      {/* Optional soft overlay tint; for shader themes this is very subtle */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-0 transition-all duration-700 ease-out ${themeFx.className} ${themeFx.animationClass}`}
      />
      {/* Smooth fade from theme into next sections so scroll doesn’t feel like a jump */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1] h-[45vh] bg-gradient-to-t from-slate-50/95 to-transparent dark:from-slate-950/95 dark:to-transparent transition-colors duration-500"
      />
      {user && (
        <div className="w-full flex justify-center py-4 px-4 z-[100] opacity-0 animate-slide-in-up" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
          <button type="button" onClick={() => { window.location.hash = 'chat'; }} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl hover:scale-105 transition-transform tap-target">
            <i className="fa-solid fa-arrow-left" aria-hidden />
            Back to Chat
          </button>
        </div>
      )}
      <article className="w-full max-w-6xl px-4 md:px-6 py-8 md:py-24 flex flex-col items-center gap-10 md:gap-24 text-center">
        
        {/* Hero Section – shader background already covers full page; this just positions content */}
        <section className="w-full flex flex-col items-center gap-8 md:gap-12 relative overflow-visible">
          <div className="relative pt-12 md:pt-16 pb-8 md:pb-10">
            <div className="flex flex-col items-center gap-6 md:gap-8 relative z-10">
            <div className="w-20 h-20 md:w-32 md:h-32 rounded-[28px] md:rounded-[32px] flex items-center justify-center shadow-xl relative opacity-0 animate-reveal hover:shadow-2xl transition-shadow duration-300" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
              <div className="w-full h-full rounded-[28px] md:rounded-[32px] animate-hero-float">
                <img src="/favicon.svg" className="w-full h-full object-cover rounded-[28px] md:rounded-[32px]" alt="Orin AI" />
              </div>
            </div>
            
            <div className="space-y-4 md:space-y-6 text-center">
              <h1 className="text-4xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9] opacity-0 animate-reveal" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                {t.welcome}
              </h1>
              <div className="min-h-[3rem] md:min-h-[4rem] flex flex-col items-center justify-center px-4 gap-2">
                  <h2 className="text-lg md:text-3xl font-bold text-slate-600 dark:text-slate-300 tracking-tight max-w-2xl leading-snug opacity-0 animate-reveal" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                    {context.timeOfDay === 'morning' ? t.goodMorning : context.timeOfDay === 'afternoon' ? t.goodAfternoon : t.goodEvening} {t.orinReady}
                  </h2>
              </div>
            </div>
          </div>
          </div>

          {/* Spacer so input bar doesn’t sit right under hero */}
          <div className="h-4 md:h-6 shrink-0" />

          <div className="w-full max-w-2xl px-2 relative z-10 opacity-0 animate-slide-in-up" style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}>
            {/* Guest Chat / Input Area – minimal search bar: input first, then send */}
            <div className="w-full flex flex-col gap-3">
              {/* Result Area (Guest Only) – above the bar when present */}
              {(guestResult || isGuestLoading) && (
                 <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-left animate-reveal max-h-56 overflow-y-auto custom-scrollbar shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                       <i className="fa-solid fa-robot text-indigo-600" />
                       <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t.guestModeLabel}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                       {isGuestLoading ? <MarkovLoader /> : guestResult}
                    </div>
                 </div>
              )}

              {/* Single search-style row: input + send */}
              <div className="flex items-center gap-2 w-full rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm focus-within:border-cyan-400/50 dark:focus-within:border-cyan-400/40 focus-within:shadow-md transition-all duration-200 overflow-hidden">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuestSubmit()}
                  placeholder={user ? t.howHelp : t.tryDemoPlaceholder}
                  className="flex-1 min-w-0 px-4 py-3 md:py-3.5 text-sm md:text-base bg-transparent border-none outline-none focus:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
                />
                <button
                  onClick={handleGuestSubmit}
                  disabled={isGuestLoading || !prompt.trim()}
                  className="shrink-0 m-1.5 w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all tap-target"
                  aria-label={user ? t.go : t.demo}
                >
                  {isGuestLoading ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-arrow-right text-sm" />}
                </button>
              </div>

              {/* Thinking & Descriptive – small toggles below the bar */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onReasoningModeChange({ thinking: !thinkingMode })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    thinkingMode ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Thinking
                </button>
                <button
                  type="button"
                  onClick={() => onReasoningModeChange({ descriptive: !descriptiveMode })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    descriptiveMode ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Descriptive
                </button>
              </div>
            </div>
            
            {!user && !guestResult && (
               <div className="mt-6 flex flex-col items-center gap-3 opacity-0 animate-reveal" style={{ animationDelay: '450ms', animationFillMode: 'forwards' }}>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.guestLimitLabel}</p>
                 <button onClick={handleSignIn} className="flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-md hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 active:scale-95">
                    <i className="fa-solid fa-fingerprint text-slate-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.signInToUnlock}</span>
                 </button>
               </div>
            )}
          </div>

          {/* Stats / features strip */}
          <div className="w-full max-w-2xl flex flex-wrap justify-center gap-4 md:gap-8 py-8 opacity-0 animate-slide-in-up" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-language text-indigo-500" /> Sinhala · Tamil · English
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-message text-indigo-500" /> Chat
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-microphone text-indigo-500" /> Voice
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-camera text-indigo-500" /> Vision
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-palette text-indigo-500" /> Create
            </span>
          </div>
        </section>

        {/* Gradient divider */}
        <div className="w-full max-w-xl h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent my-4 opacity-0 animate-reveal" style={{ animationDelay: '550ms', animationFillMode: 'forwards' }} />

        {/* Navigation Grid - staggered entrance */}
        <section className="w-full max-w-6xl space-y-8 md:space-y-12">
          <div className="flex flex-wrap justify-center gap-3 md:gap-6 px-2 md:px-0">
              <NavCard href="#community" title="Creations" icon="fa-fire" lang={lang} delayMs={0} />
              <NavCard href="#downloads" title={t.downloads} icon="fa-download" lang={lang} delayMs={80} />
              <NavCard href="#creator" title={t.creator} icon="fa-user" lang={lang} delayMs={160} />
              <NavCard href="#logic" title={t.logicFlow} icon="fa-sitemap" lang={lang} delayMs={320} />
              <NavCard href="#releases" title={t.releases} icon="fa-code-branch" lang={lang} delayMs={400} />
              <NavCard href="#terms" title={t.terms} icon="fa-file-contract" lang={lang} delayMs={480} />
              <NavCard href="#privacy" title={t.privacy} icon="fa-shield-halved" lang={lang} delayMs={560} />
          </div>
        </section>

        {/* Detailed Information Section - staggered */}
        <section className="w-full max-w-5xl px-4 py-16 space-y-16 text-slate-600 dark:text-slate-400 text-left md:text-center">
          
          <div className="space-y-6 opacity-0 animate-reveal" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
             <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.heroTitle}</h3>
             <p className={`text-sm md:text-base font-medium leading-relaxed max-w-3xl mx-auto ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>
               {t.heroParagraph}
             </p>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4 opacity-0 animate-reveal" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>{t.coreCapabilities}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <InfoCard icon="fa-language" title={t.infoBilingualTitle} desc={t.infoBilingualDesc} lang={lang} delayMs={250} />
                <InfoCard icon="fa-eye" title={t.infoVisualTitle} desc={t.infoVisualDesc} lang={lang} delayMs={350} />
                <InfoCard icon="fa-palette" title={t.infoStudioTitle} desc={t.infoStudioDesc} lang={lang} delayMs={450} />
                <InfoCard icon="fa-microphone" title={t.infoVoiceTitle} desc={t.infoVoiceDesc} lang={lang} delayMs={550} />
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4 opacity-0 animate-reveal" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>{t.whoIsOrinFor}</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <AudienceCard title={t.audienceStudents} desc={t.audienceStudentsDesc} lang={lang} delayMs={250} />
                <AudienceCard title={t.audiencePro} desc={t.audienceProDesc} lang={lang} delayMs={350} />
                <AudienceCard title={t.audienceCreators} desc={t.audienceCreatorsDesc} lang={lang} delayMs={450} />
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4 opacity-0 animate-reveal" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>{t.howToGetStarted}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <StepRow num="01" title={t.step1Title} desc={t.step1Desc} lang={lang} delayMs={250} />
                <StepRow num="02" title={t.step2Title} desc={t.step2Desc} lang={lang} delayMs={350} />
                <StepRow num="03" title={t.step3Title} desc={t.step3Desc} lang={lang} delayMs={450} />
                <StepRow num="04" title={t.step4Title} desc={t.step4Desc} lang={lang} delayMs={550} />
             </div>
          </div>

        </section>

        {/* Footer with Socials - staggered icons */}
        <footer className="w-full py-16 border-t border-black/5 dark:border-white/5 mt-12 w-screen">
            <div className="max-w-6xl mx-auto flex flex-col items-center gap-8 px-6">
               <div className="flex flex-wrap justify-center gap-6">
                  <SocialIcon icon="fa-instagram" href="https://www.instagram.com/januth10.1/" label={t.instagram} delayMs={0} />
                  <SocialIcon icon="fa-facebook-f" href="https://web.facebook.com/januth10.1/" label={t.facebook} delayMs={80} />
                  <SocialIcon icon="fa-tiktok" href="https://www.tiktok.com/@januth10.1" label={t.tiktok} delayMs={160} />
                  <SocialIcon icon="fa-youtube" href="#" label={t.youtube} delayMs={240} />
                  <SocialIcon icon="fa-linkedin-in" href="#" label={t.linkedin} delayMs={320} />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center opacity-0 animate-reveal" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>{t.footerAllRights}</p>
            </div>
        </footer>
      </article>

      {/* Guest Limit Modal */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowLoginPrompt(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-slate-200 dark:border-white/10 flex flex-col items-center gap-6 text-center animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <i className="fa-solid fa-bolt text-2xl text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                You've used your 5 free prompts
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Sign in for free to unlock unlimited chats, Studio Create, Voice Mode, and cloud sync.
              </p>
            </div>

            <button
              onClick={handleSignIn}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all"
            >
              <i className="fa-solid fa-fingerprint" />
              <span>Sign in to Orin — It's Free</span>
            </button>

            <button
              onClick={() => setShowLoginPrompt(false)}
              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

const NavCard = ({ href, title, icon, lang, delayMs = 0 }: { href: string; title: string; icon: string; lang: Language; delayMs?: number }) => (
  <a
    href={href}
    style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}
    className="glass-panel group w-28 h-28 md:w-32 md:h-32 rounded-[24px] flex flex-col items-center justify-center gap-2 border border-slate-200 dark:border-white/5 tap-target bg-white/50 dark:bg-slate-900/30 shadow-sm opacity-0 animate-slide-in-up hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-2 hover:shadow-lg hover:border-indigo-500/30 transition-[transform,box-shadow,background-color,border-color] duration-300"
  >
    <i className={`fa-solid ${icon} text-2xl text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all duration-300`} aria-hidden />
    <h3 className={`text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center px-2 transition-colors duration-200 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{title}</h3>
  </a>
);

// Helper Components for Info Section - with stagger
const InfoCard = ({ icon, title, desc, lang, delayMs = 0 }: { icon: string; title: string; desc: string; lang?: Language; delayMs?: number }) => (
  <div className="flex gap-4 p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-indigo-500/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 opacity-0 animate-scale-in" style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}>
     <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><i className={`fa-solid ${icon} text-xl`} /></div>
     <div>
        <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide mb-2">{title}</h5>
        <p className={`text-xs leading-relaxed opacity-80 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
     </div>
  </div>
);

const AudienceCard = ({ title, desc, lang, delayMs = 0 }: { title: string; desc: string; lang?: Language; delayMs?: number }) => (
  <div className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:-translate-y-2 hover:shadow-lg hover:border-indigo-500/20 transition-all duration-300 opacity-0 animate-scale-in" style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}>
     <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide mb-3 border-b border-indigo-500/20 pb-2 inline-block">{title}</h5>
     <p className={`text-xs leading-relaxed opacity-80 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
  </div>
);

const StepRow = ({ num, title, desc, lang, delayMs = 0 }: { num: string; title: string; desc: string; lang?: Language; delayMs?: number }) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors opacity-0 animate-reveal" style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}>
     <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 px-2.5 py-1 rounded-lg shrink-0">{num}</span>
     <div>
        <h6 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">{title}</h6>
        <p className={`text-xs leading-relaxed opacity-70 ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{desc}</p>
     </div>
  </div>
);

const SocialIcon = ({ icon, href, label, delayMs = 0 }: { icon: string; href: string; label: string; delayMs?: number }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    title={label}
    className="w-11 h-11 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 hover:scale-110 hover:border-indigo-500/50 active:scale-95 transition-all duration-300 shadow-sm opacity-0 animate-scale-in"
    style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}
  >
     <i className={`fa-brands ${icon} text-lg`} />
  </a>
);

export default LandingPage;