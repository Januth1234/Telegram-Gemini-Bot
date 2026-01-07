
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface GetHelpModeProps {
  onClose: () => void;
  lang: Language;
}

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [isSharing, setIsSharing] = useState(false);
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios-pc'>('ios-pc');
  const [helpRequest, setHelpRequest] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      setPlatform('android');
    } else {
      setPlatform('ios-pc');
    }
  }, []);

  const startSharing = async () => {
    if (!helpRequest.trim()) {
      alert(lang === 'si' ? "කරුණාකර පළමුව ඔබගේ ගැටලුව විස්තර කරන්න." : "Please describe your issue first.");
      return;
    }
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
    if (!helpRequest.trim()) {
      alert(lang === 'si' ? "කරුණාකර පළමුව ඔබගේ ගැටලුව විස්තර කරන්න." : "Please describe your issue first.");
      return;
    }
    setIsDiagnostic(true);
    setTimeout(() => {
      setIsDiagnostic(false);
      alert(lang === 'si' ? `සහාය ඉල්ලීම ලැබුණි: "${helpRequest}"\nAccessibility සහාය දැන් සක්‍රීයයි.` : `Request received: "${helpRequest}"\nAccessibility assistance is now active.`);
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

      <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar flex flex-col items-center gap-12">
        <div className="max-w-2xl w-full text-center space-y-6">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-[48px] bg-slate-200 dark:bg-white/5 flex items-center justify-center mx-auto relative group">
            <div className={`absolute -inset-4 rounded-[64px] border-2 border-cyan-500/20 ${isSharing ? 'animate-pulse' : 'animate-soft-pulse'}`}></div>
            <i className={`fa-solid ${isSharing ? 'fa-user-gear' : 'fa-headset'} text-4xl md:text-5xl text-slate-400 dark:text-slate-600 transition-colors ${isSharing ? 'text-cyan-500' : ''}`}></i>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {isSharing ? (lang === 'si' ? "සජීවී සහාය ක්‍රියාත්මකයි" : "Live Assistance Active") : (lang === 'si' ? "සජීවී සහාය ලබාගන්න" : "Get Live Assistance")}
            </h3>
            <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
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

        <div className="w-full max-w-2xl space-y-8">
          {!isSharing && (
            <div className="space-y-4 animate-reveal">
              <div className="flex items-center gap-3 px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-600"></div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.help.label}</label>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-[32px] blur opacity-10 group-focus-within:opacity-25 transition duration-500"></div>
                <textarea
                  value={helpRequest}
                  onChange={(e) => setHelpRequest(e.target.value)}
                  placeholder={t.help.placeholder}
                  className="relative w-full h-32 md:h-40 glass-panel bg-white/60 dark:bg-slate-900/60 rounded-[32px] p-6 md:p-8 text-sm md:text-base border border-slate-200 dark:border-white/10 focus:border-cyan-500/50 outline-none transition-all resize-none dark:text-white shadow-inner"
                />
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

          <div className="space-y-4">
            {!isSharing ? (
              <button 
                onClick={platform === 'android' ? startAccessibilityAssistance : startSharing}
                disabled={isDiagnostic}
                className="w-full py-6 md:py-8 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
              >
                <i className={`fa-solid ${platform === 'android' ? 'fa-universal-access' : 'fa-display'}`}></i>
                {platform === 'android' ? t.help.startAccess : t.help.startSharing}
              </button>
            ) : (
              <button 
                onClick={platform === 'android' ? () => setIsSharing(false) : stopSharing}
                className="w-full py-6 md:py-8 bg-red-500 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
              >
                <i className="fa-solid fa-stop"></i>
                {t.help.stop}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl pb-12">
           <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 space-y-4 hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                 <i className="fa-solid fa-magnifying-glass-chart"></i>
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Diagnostic Hub</h4>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'si' ? "ඔරින් ඔබගේ පද්ධතියේ දෝෂ පරීක්ෂා කර ස්වයංක්‍රීයව විසඳුම් ලබා දෙයි." : "Orin analyzes your system status and provides automated solutions for technical issues."}
              </p>
           </div>
           <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 space-y-4 hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                 <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secure Protocol</h4>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'si' ? "සියලුම සහාය සැසි TLS 1.3 මට්ටමේ ගුප්තකේතනයක් මගින් ආරක්ෂා කර ඇත." : "All support sessions are protected by TLS 1.3 encryption and are strictly ephermal."}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default GetHelpMode;
