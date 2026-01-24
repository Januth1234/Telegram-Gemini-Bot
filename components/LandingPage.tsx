
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { geminiService } from '../services/geminiService';
import { translations } from '../translations';
import { Language, WorkspaceMode, UserAccount } from '../types';
import { markovService } from '../services/markovService';

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
  const [guestResult, setGuestResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Markov Dynamic States
  const [placeholder, setPlaceholder] = useState(t.howHelp);
  const [dynamicSlogan, setDynamicSlogan] = useState(t.slogan);
  const [loadingText, setLoadingText] = useState("Processing...");

  // Initialize Markov Generators
  useEffect(() => {
    // Initial generation
    setPlaceholder(markovService.generatePlaceholder());
    setDynamicSlogan(markovService.generateSlogan());

    // Cycle placeholder every 4 seconds to keep interface lively
    const interval = setInterval(() => {
        if (!prompt) { // Only change if user hasn't typed
            setPlaceholder(markovService.generatePlaceholder());
        }
    }, 4000);

    return () => clearInterval(interval);
  }, [prompt]);

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
      return `${timeStr} වේවා`;
    } else if (lang === 'ta') {
      const timeStr = context.timeOfDay === 'morning' ? 'காலை வணக்கம்' : context.timeOfDay === 'afternoon' ? 'மதிய வணக்கம்' : 'மாலை வணக்கம்';
      return `ஓரின் AI உடன் ${timeStr}`;
    } else {
      return `Good ${context.timeOfDay}`;
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

  // Handle Search Action
  const handleSearch = async () => {
    if (!prompt.trim()) return;

    if (user) {
        // Authenticated users go to main chat
        onStartChat(prompt, 'chat');
    } else {
        // Guest users get inline response
        setIsProcessing(true);
        setGuestResult(null);
        
        // Generate dynamic loading text using Markov chain
        const loaderInterval = setInterval(() => {
            setLoadingText(markovService.generateLoadingMessage());
        }, 1500);

        try {
            const res = await geminiService.chat(prompt);
            setGuestResult(res.text);
        } catch (e: any) {
            if (e.message.includes('limit')) {
                setGuestResult("Guest Limit Reached (5/5). Please sign in to continue accessing specialized neural features.");
            } else {
                setGuestResult("Connection error. Please try again.");
            }
        } finally {
            clearInterval(loaderInterval);
            setIsProcessing(false);
        }
    }
  };

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
                    aria-label="Dismiss Promo Banner"
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
              {/* Corrected H1 Strategy for SEO */}
              <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.85]">
                Orin AI
              </h1>
              <div className="min-h-[4rem] flex flex-col items-center justify-center px-4 gap-2">
                  <h2 className="text-xl md:text-3xl font-bold text-slate-600 dark:text-slate-300 tracking-tight animate-reveal max-w-2xl leading-snug">
                    {greeting}
                  </h2>
                  <p className="text-[10px] md:text-xs font-black tracking-[0.4em] uppercase text-slate-400 dark:text-slate-500">
                    {lang === 'en' ? dynamicSlogan : t.slogan} <span className="sr-only">Built by Januth Nimnal for Sri Lanka</span>
                  </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl px-2 space-y-6">
            <div className="relative group w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[24px] blur opacity-15 group-hover:opacity-30 transition duration-500"></div>
              <div className="relative glass-panel p-2 rounded-[24px] flex items-center shadow-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10">
                <input 
                  type="text" 
                  value={prompt} 
                  onChange={(e) => onPromptChange(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={placeholder} 
                  aria-label="Ask Orin AI anything"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-2xl px-4 md:px-6 py-4 md:py-5 dark:text-white placeholder:text-slate-400 font-medium min-w-0 transition-all"
                />
                <button 
                  onClick={handleSearch} 
                  disabled={isProcessing}
                  aria-label="Start Generation"
                  className="shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-950 h-12 md:h-16 px-6 md:px-10 rounded-[20px] font-black text-xs md:text-sm uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                >
                  {isProcessing ? (
                      <i className="fa-solid fa-circle-notch animate-spin"></i>
                  ) : (
                      <span>{prompt.trim() ? t.go : (lang === 'si' ? "Orin අරඹන්න" : lang === 'ta' ? "ஓரினைத் தொடங்க" : "Start Orin")}</span>
                  )}
                  {!prompt.trim() && !isProcessing && <i className="fa-solid fa-arrow-right"></i>}
                </button>
              </div>
            </div>

            {/* Guest Result Display */}
            {guestResult && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 text-left shadow-xl animate-reveal">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Guest Mode (5 Prompts Max)</span>
                        <button onClick={() => setGuestResult(null)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className={`text-base text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(guestResult) ? 'sinhala-text' : ''}`}>
                        {guestResult}
                    </div>
                    {guestResult.includes("Limit Reached") && (
                        <button onClick={onLogin} className="mt-6 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest">
                            Sign In to Continue
                        </button>
                    )}
                </div>
            )}
            
            {/* Loading Overlay for Guest Mode */}
            {isProcessing && !guestResult && (
                <div className="mt-4 animate-pulse text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {loadingText}
                </div>
            )}

            {!user && !guestResult && !isProcessing && (
               <button onClick={onLogin} className="mt-8 flex items-center gap-3 px-8 py-4 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all active:scale-95 mx-auto">
                 <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{lang === 'si' ? 'Google සමඟ එක්වන්න' : lang === 'ta' ? 'கூகுள் மூலம் இணையுங்கள்' : 'Join with Google'}</span>
               </button>
            )}
          </div>
        </section>

        {/* Feature Grid */}
        <section className="w-full max-w-6xl space-y-12 animate-slide-in-up" aria-label="Orin AI Features">
          <header className="flex items-center gap-6 opacity-40">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-400 dark:to-slate-600"></div>
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Neural Tools</h3>
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

        {/* EXPANDED SEO CONTENT SECTION */}
        <article className="w-full max-w-5xl py-12 text-left space-y-16 text-slate-600 dark:text-slate-400">
           {/* Section 1: Introduction */}
           <section className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Your Intelligent Assistant for Sri Lanka</h2>
              <p className="leading-relaxed text-sm md:text-base font-medium">
                 Orin AI is designed to bridge the gap between global artificial intelligence capabilities and local usability. 
                 Supporting <strong>Sinhala, Tamil, and English</strong> natively, Orin empowers students, professionals, and creatives 
                 to access state-of-the-art neural reasoning without language barriers. Whether you need to draft emails, 
                 solve complex mathematics, or generate photorealistic images, Orin acts as your personal digital companion.
              </p>
           </section>

           {/* Section 2: Detailed Features */}
           <section className="space-y-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 border-b border-black/5 dark:border-white/5 pb-4">Core Capabilities</h3>
              <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><i className="fa-solid fa-language text-cyan-500"></i> Bilingual Reasoning</h4>
                    <p className="text-sm">Switch seamlessly between languages to get answers in the format you understand best. Orin understands local context, idioms, and cultural nuances in both Sinhala and Tamil.</p>
                 </div>
                 <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><i className="fa-solid fa-eye text-cyan-500"></i> Visual Intelligence (Vision)</h4>
                    <p className="text-sm">Upload photos to extract text (OCR) or get detailed descriptions of scenes. Solve math problems simply by taking a picture of your notebook.</p>
                 </div>
                 <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><i className="fa-solid fa-palette text-cyan-500"></i> Studio Create</h4>
                    <p className="text-sm">Generate high-quality images and short videos using simple text prompts. Perfect for content creators, marketers, and digital artists.</p>
                 </div>
                 <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><i className="fa-solid fa-microphone text-cyan-500"></i> Voice Assistant</h4>
                    <p className="text-sm">Talk to Orin naturally. The voice mode supports real-time conversation, making it accessible for users who prefer speaking over typing.</p>
                 </div>
              </div>
           </section>

           {/* Section 3: Use Cases */}
           <section className="space-y-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 border-b border-black/5 dark:border-white/5 pb-4">Who is Orin For?</h3>
              <ul className="grid md:grid-cols-3 gap-6">
                 <li className="glass-panel p-6 rounded-2xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <i className="fa-solid fa-user-graduate text-indigo-500 text-xl"></i>
                        <strong className="text-slate-900 dark:text-white">Students</strong>
                    </div>
                    <p className="text-xs">Get help with math problems, summaries, and research in your mother tongue. Clarify complex concepts instantly.</p>
                 </li>
                 <li className="glass-panel p-6 rounded-2xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <i className="fa-solid fa-briefcase text-indigo-500 text-xl"></i>
                        <strong className="text-slate-900 dark:text-white">Professionals</strong>
                    </div>
                    <p className="text-xs">Draft emails, translate documents, and organize data instantly. Boost your workflow efficiency.</p>
                 </li>
                 <li className="glass-panel p-6 rounded-2xl border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <i className="fa-solid fa-pen-nib text-indigo-500 text-xl"></i>
                        <strong className="text-slate-900 dark:text-white">Creators</strong>
                    </div>
                    <p className="text-xs">Brainstorm ideas, write scripts, and visualize concepts with the Studio tool. Overcome writer's block.</p>
                 </li>
              </ul>
           </section>

           {/* Section 4: Instructions */}
           <section className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 border-b border-black/5 dark:border-white/5 pb-4">How to Get Started</h3>
              <ol className="list-decimal list-inside space-y-4 text-sm font-medium pl-2">
                 <li><strong>Type a Prompt:</strong> Use the main input box above to ask a question or give a command in English, Sinhala, or Tamil.</li>
                 <li><strong>Select a Mode:</strong> Click on specific tools like "Studio" for images or "Math" for calculations if you need specialized help.</li>
                 <li><strong>Sign In (Optional):</strong> Create a free account to save your chat history and access higher usage limits.</li>
                 <li><strong>Explore:</strong> Try the "Voice" mode for hands-free interaction or "Vision" to analyze images.</li>
              </ol>
           </section>
        </article>

        {/* Navigation Grid */}
        <section className="w-full max-w-6xl space-y-12 animate-slide-in-up" aria-label="Site Navigation">
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
        
        <footer className="w-full py-16 border-t border-black/5 dark:border-white/5 mt-12 flex flex-col items-center gap-8">
          {/* Social Media Links */}
          <div className="flex gap-6">
             <a href="https://www.instagram.com/januth10.1/" target="_blank" aria-label="Instagram" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all"><i className="fa-brands fa-instagram text-lg"></i></a>
             <a href="https://web.facebook.com/januth10.1/" target="_blank" aria-label="Facebook" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"><i className="fa-brands fa-facebook-f text-lg"></i></a>
             <a href="https://www.tiktok.com/@januth10.1" target="_blank" aria-label="TikTok" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all"><i className="fa-brands fa-tiktok text-lg"></i></a>
             <a href="#" aria-label="YouTube" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><i className="fa-brands fa-youtube text-lg"></i></a>
             <a href="#" aria-label="LinkedIn" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"><i className="fa-brands fa-linkedin-in text-lg"></i></a>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">© 2026 JN Productions Global • All Rights Reserved</p>
        </footer>
      </article>
    </main>
  );
};

// ... (Helper Components kept as is) ...
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
