
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { geminiService, AppError } from '../services/geminiService';
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
      // App.tsx auth listener will handle user state update automatically
    } catch (e) {
      console.error("Login failed", e);
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
           <span className="text-center truncate">🚀 Orin AI v5.0 is Live! Free Elite Plan for Early Adopters.</span>
           <button onClick={() => { setShowPromo(false); sessionStorage.setItem('orin_promo_dismissed', 'true'); }} className="opacity-50 hover:opacity-100"><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      <article className="w-full max-w-6xl px-4 md:px-6 py-8 md:py-24 flex flex-col items-center gap-10 md:gap-24 text-center">
        
        {/* Hero Section */}
        <section className="w-full flex flex-col items-center gap-8 md:gap-12 animate-fade">
          <div className="flex flex-col items-center gap-6 md:gap-8">
            <div className="w-20 h-20 md:w-32 md:h-32 bg-cyan-600 rounded-[28px] md:rounded-[32px] flex items-center justify-center text-white shadow-2xl hover:scale-100 transition-transform duration-500 relative group">
              <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <i className="fa-solid fa-bolt text-4xl md:text-7xl relative z-10"></i>
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-4xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
                {t.welcome}
              </h1>
              <div className="min-h-[3rem] md:min-h-[4rem] flex flex-col items-center justify-center px-4 gap-2">
                  <h2 className="text-lg md:text-3xl font-bold text-slate-600 dark:text-slate-300 tracking-tight animate-reveal max-w-2xl leading-snug">
                    {`Good ${context.timeOfDay}. Orin AI is ready.`}
                  </h2>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl px-2 relative z-10">
            {/* Guest Chat / Input Area */}
            <div className="relative group w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[24px] blur opacity-15 group-hover:opacity-30 transition duration-500"></div>
              <div className="relative glass-panel p-2 rounded-[24px] flex flex-col shadow-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 overflow-hidden">
                
                {/* Result Area (Guest Only) */}
                {(guestResult || isGuestLoading) && (
                   <div className="p-4 md:p-6 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-left animate-reveal max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="flex items-center gap-2 mb-2">
                         <i className="fa-solid fa-robot text-cyan-600"></i>
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Orin Guest Mode</span>
                      </div>
                      <div className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                         {isGuestLoading ? <MarkovLoader /> : guestResult}
                      </div>
                      {guestResult && guestResult.includes("limit") && (
                         <button onClick={handleSignIn} disabled={isLoggingIn} className="mt-4 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">
                            {isLoggingIn ? "Signing In..." : "Sign In Free"}
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
                    placeholder={user ? t.howHelp : "Try a demo (e.g. 'Explain Quantum Physics')"} 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-xl px-2 md:px-4 py-3 md:py-5 dark:text-white placeholder:text-slate-400 font-medium min-w-0"
                    />
                    <button 
                    onClick={handleGuestSubmit} 
                    disabled={isGuestLoading || !prompt.trim()}
                    className="shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-10 md:h-16 px-4 md:px-10 rounded-[18px] md:rounded-[20px] font-black text-[10px] md:text-sm uppercase tracking-widest shadow-xl hover:scale-100 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 m-1"
                    >
                    <span>{user ? t.go : (isGuestLoading ? "..." : "Demo")}</span>
                    {!isGuestLoading && <i className="fa-solid fa-arrow-right"></i>}
                    </button>
                </div>
              </div>
            </div>
            
            {!user && !guestResult && (
               <div className="mt-6 flex flex-col items-center gap-3 animate-slide-in-up">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guest Limit: 5 Prompts</p>
                 <button onClick={handleSignIn} disabled={isLoggingIn} className="flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-70">
                    {isLoggingIn ? <i className="fa-solid fa-circle-notch animate-spin text-slate-500"></i> : <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isLoggingIn ? "Authenticating..." : "Sign In to Unlock Full Orin AI"}</span>
                 </button>
               </div>
            )}
          </div>
        </section>

        {/* Navigation Grid */}
        <section className="w-full max-w-6xl space-y-8 md:space-y-12 animate-slide-in-up">
          <div className="flex flex-wrap justify-center gap-3 md:gap-6 px-2 md:px-0">
              <NavCard href="#downloads" icon="fa-download" color="cyan" title={t.downloads} lang={lang} />
              <NavCard href="#creator" icon="fa-user-tie" color="orange" title={t.creator} lang={lang} />
              <NavCard href="#pricing" icon="fa-tags" color="emerald" title={t.pricing} lang={lang} />
              <NavCard href="#logic" icon="fa-diagram-project" color="violet" title={t.logicFlow} lang={lang} />
              <NavCard href="#releases" icon="fa-rocket" color="pink" title={t.releases} lang={lang} />
              <NavCard href="#privacy" icon="fa-shield-halved" color="blue" title={t.privacy} lang={lang} />
              <NavCard href="#terms" icon="fa-file-contract" color="purple" title={t.terms} lang={lang} />
          </div>
        </section>

        {/* Detailed Information Section */}
        <section className="w-full max-w-5xl px-4 py-16 space-y-16 text-slate-600 dark:text-slate-400 text-left md:text-center animate-reveal">
          
          <div className="space-y-6">
             <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Your Intelligent Assistant for Sri Lanka</h3>
             <p className="text-sm md:text-base font-medium leading-relaxed max-w-3xl mx-auto">
               Orin AI is designed to bridge the gap between global artificial intelligence capabilities and local usability. Supporting Sinhala, Tamil, and English natively, Orin empowers students, professionals, and creatives to access state-of-the-art neural reasoning without language barriers. Whether you need to draft emails, solve complex mathematics, or generate photorealistic images, Orin acts as your personal digital companion.
             </p>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4">Core Capabilities</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <InfoCard icon="fa-language" title="Bilingual Reasoning" desc="Switch seamlessly between languages to get answers in the format you understand best. Orin understands local context, idioms, and cultural nuances in both Sinhala and Tamil." />
                <InfoCard icon="fa-eye" title="Visual Intelligence (Vision)" desc="Upload photos to extract text (OCR) or get detailed descriptions of scenes. Solve math problems simply by taking a picture of your notebook." />
                <InfoCard icon="fa-palette" title="Studio Create" desc="Generate high-quality images and short videos using simple text prompts. Perfect for content creators, marketers, and digital artists." />
                <InfoCard icon="fa-microphone" title="Voice Assistant" desc="Talk to Orin naturally. The voice mode supports real-time conversation, making it accessible for users who prefer speaking over typing." />
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4">Who is Orin For?</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <AudienceCard title="Students" desc="Get help with math problems, summaries, and research in your mother tongue. Clarify complex concepts instantly." />
                <AudienceCard title="Professionals" desc="Draft emails, translate documents, and organize data instantly. Boost your workflow efficiency." />
                <AudienceCard title="Creators" desc="Brainstorm ideas, write scripts, and visualize concepts with the Studio tool. Overcome writer's block." />
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-black/5 dark:border-white/5 pb-4">How to Get Started</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <StepRow num="01" title="Type a Prompt" desc="Use the main input box above to ask a question or give a command in English, Sinhala, or Tamil." />
                <StepRow num="02" title="Select a Mode" desc="Click on specific tools like 'Studio' for images or 'Math' for calculations if you need specialized help." />
                <StepRow num="03" title="Sign In (Optional)" desc="Create a free account to save your chat history and access higher usage limits." />
                <StepRow num="04" title="Explore" desc="Try the 'Voice' mode for hands-free interaction or 'Vision' to analyze images." />
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
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">© 2026 JN Productions Global • All Rights Reserved</p>
            </div>
        </footer>
      </article>
    </main>
  );
};

const NavCard = ({ href, icon, title, color, lang }: any) => {
  const colors: Record<string, string> = {
    cyan: "group-hover:text-cyan-500 group-hover:bg-cyan-500/10",
    indigo: "group-hover:text-indigo-500 group-hover:bg-indigo-500/10",
    purple: "group-hover:text-purple-500 group-hover:bg-purple-500/10",
    emerald: "group-hover:text-emerald-500 group-hover:bg-emerald-500/10",
    orange: "group-hover:text-orange-500 group-hover:bg-orange-500/10",
    pink: "group-hover:text-pink-500 group-hover:bg-pink-500/10",
    violet: "group-hover:text-violet-500 group-hover:bg-violet-500/10",
    blue: "group-hover:text-blue-500 group-hover:bg-blue-500/10"
  };

  return (
    <a href={href} className="glass-panel w-28 h-28 md:w-32 md:h-32 rounded-[24px] flex flex-col items-center justify-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-2 transition-all border border-slate-200 dark:border-white/5 active:scale-95 bg-white/40 dark:bg-slate-900/20 shadow-sm group">
      <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 transition-all duration-300 group-hover:scale-110 shadow-inner ${colors[color] || colors.cyan}`}>
        <i className={`fa-solid ${icon} text-lg`}></i>
      </div>
      <h3 className={`text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-colors group-hover:text-slate-900 dark:group-hover:text-white ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : ''}`}>{title}</h3>
    </a>
  );
};

// Helper Components for Info Section
const InfoCard = ({ icon, title, desc }: any) => (
  <div className="flex gap-4 p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-cyan-500/20 transition-colors">
     <div className="w-12 h-12 shrink-0 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500"><i className={`fa-solid ${icon} text-xl`}></i></div>
     <div>
        <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide mb-2">{title}</h5>
        <p className="text-xs leading-relaxed opacity-80">{desc}</p>
     </div>
  </div>
);

const AudienceCard = ({ title, desc }: any) => (
  <div className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:-translate-y-1 transition-transform">
     <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide mb-3 border-b border-black/5 dark:border-white/5 pb-2 inline-block">{title}</h5>
     <p className="text-xs leading-relaxed opacity-80">{desc}</p>
  </div>
);

const StepRow = ({ num, title, desc }: any) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
     <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 opacity-60 bg-cyan-500/10 px-2 py-1 rounded">{num}</span>
     <div>
        <h6 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">{title}</h6>
        <p className="text-xs leading-relaxed opacity-70">{desc}</p>
     </div>
  </div>
);

const SocialIcon = ({ icon, href }: any) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-cyan-600 transition-all shadow-sm">
     <i className={`fa-brands ${icon} text-lg`}></i>
  </a>
);

export default LandingPage;
