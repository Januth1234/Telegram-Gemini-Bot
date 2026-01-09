
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';

interface GetHelpModeProps {
  onClose: () => void;
  lang: Language;
}

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [isSharing, setIsSharing] = useState(false);
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios-pc'>('ios-pc');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      setPlatform('android');
    } else {
      setPlatform('ios-pc');
    }
  }, []);

  const captureScreenFrame = (): string | null => {
    if (!videoRef.current || !isSharing) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        return dataUrl.split(',')[1];
      }
    } catch (e) {
      console.error("Screen capture failed:", e);
    }
    return null;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    try {
       // Capture visual context if sharing is active
       const visualContext = captureScreenFrame();
       
       let finalPrompt = `User is asking for help about: "${searchQuery}". Provide a helpful, concise solution. If it's about the app, use your system knowledge.`;
       const options: any = { useThinking: true, grounding: 'search' };

       if (visualContext) {
         finalPrompt = `[VISUAL CONTEXT PROVIDED] The user is sharing their screen. Analyze the visual screenshot attached and answer their question: "${searchQuery}". Guide them based on what you see.`;
         options.fileData = { data: visualContext, mimeType: 'image/jpeg' };
       }

       const response = await geminiService.chat(finalPrompt, options);
       setSearchResult(response.text);
    } catch (e: any) {
       console.error(e);
       setSearchResult("I couldn't connect to the support database or analyze the visual feed. Please try again.");
    } finally {
       setIsSearching(false);
    }
  };

  const startSharing = async () => {
    setIsDiagnostic(true);
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsSharing(true);
      setIsDiagnostic(false);
      
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error("Screen share failed", err);
      setIsDiagnostic(false);
      alert(t.help.notSupported);
    }
  };

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startAccessibilityAssistance = () => {
    setIsDiagnostic(true);
    setTimeout(() => {
      setIsDiagnostic(false);
      alert(lang === 'si' ? "Accessibility සහාය දැන් සක්‍රීයයි. ඔරින් හට ඔබගේ තිරය කියවීමට සහ මග පෙන්වීමට හැකිය." : "Accessibility assistance is now active. Orin can now read your screen and provide guidance.");
      setIsSharing(true);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
      <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-life-ring text-xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.getHelp}</h2>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse beta-glow">BETA</span>
            </div>
            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Neural Support Hub</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start gap-12">
        
        {/* Smart Search Bar */}
        <div className="w-full max-w-2xl space-y-4">
             <div className="relative group">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t.help.searchPlaceholder}
                  className="w-full p-6 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] text-sm md:text-base shadow-lg focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all dark:text-white"
                />
                <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSearching ? <i className="fa-solid fa-circle-notch animate-spin"></i> : t.help.searchAction}
                </button>
             </div>

             {/* Search Result */}
             {searchResult && (
               <div className="p-8 bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-500/20 rounded-[32px] animate-reveal">
                  <div className="flex items-center gap-2 mb-4">
                     <i className="fa-solid fa-robot text-cyan-600"></i>
                     <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Orin Support Agent</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 sinhala-text whitespace-pre-wrap">{searchResult}</p>
               </div>
             )}
        </div>

        <div className="max-w-2xl w-full text-center space-y-6 pt-8 border-t border-black/5 dark:border-white/5">
          <div className="w-32 h-32 rounded-[48px] bg-slate-200 dark:bg-white/5 flex items-center justify-center mx-auto relative group">
            <div className={`absolute -inset-4 rounded-[64px] border-2 border-cyan-500/20 ${isSharing ? 'animate-pulse' : 'animate-soft-pulse'}`}></div>
            <i className={`fa-solid ${isSharing ? 'fa-user-gear' : 'fa-headset'} text-5xl text-slate-400 dark:text-slate-600 transition-colors ${isSharing ? 'text-cyan-500' : ''}`}></i>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {isSharing ? (lang === 'si' ? "සජීවී සහාය ක්‍රියාත්මකයි" : "Live Assistance Active") : (lang === 'si' ? "සජීවී සහාය ලබාගන්න" : "Get Live Assistance")}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
              {platform === 'android' ? t.help.infoAndroid : t.help.infoPC}
            </p>
          </div>
        </div>

        {isSharing && platform === 'ios-pc' && (
          <div className="w-full max-w-4xl aspect-video rounded-[48px] overflow-hidden border border-black/5 dark:border-white/10 shadow-2xl bg-black relative animate-reveal">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            <div className="absolute top-6 left-6 flex items-center gap-3 glass-panel px-4 py-2 rounded-full border border-white/20">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
               <span className="text-[10px] font-black uppercase text-white tracking-widest">TRANSMITTING UI DATA</span>
            </div>
          </div>
        )}

        {isDiagnostic && (
          <div className="flex flex-col items-center gap-4 animate-reveal">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600">
              {platform === 'android' ? t.help.accessibility : t.help.sharing}
            </p>
          </div>
        )}

        <div className="w-full max-w-md space-y-4">
          {!isSharing ? (
            <button 
              onClick={platform === 'android' ? startAccessibilityAssistance : startSharing}
              disabled={isDiagnostic}
              className="w-full py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
            >
              <i className={`fa-solid ${platform === 'android' ? 'fa-universal-access' : 'fa-display'}`}></i>
              {platform === 'android' ? t.help.startAccess : t.help.startSharing}
            </button>
          ) : (
            <button 
              onClick={platform === 'android' ? () => setIsSharing(false) : stopSharing}
              className="w-full py-6 bg-red-500 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
            >
              <i className="fa-solid fa-stop"></i>
              {t.help.stop}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GetHelpMode;
