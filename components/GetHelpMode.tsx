
import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage } from '../types';
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
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      setPlatform('android');
    } else {
      setPlatform('ios-pc');
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

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
      
      // Auto-greeting from AI
      addAiMessage(lang === 'si' ? "තිරය බෙදාගැනීම සක්‍රීයයි. මම දැන් ඔබගේ වැඩසටහන නිරීක්ෂණය කරමි. මම ඔබට උදව් කරන්නේ කෙසේද?" : "Screen sharing is active. I am now observing your workspace. How can I assist you with your task?");

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

  const addAiMessage = (text: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text }]);
  };

  const handleTaskSubmit = async () => {
    if (!userInput.trim()) return;
    
    const currentInput = userInput;
    setMessages(prev => [...prev, { role: 'user', text: currentInput }]);
    setUserInput('');
    setIsProcessing(true);

    try {
      let imageData = null;
      // Capture frame if sharing
      if (isSharing && videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          imageData = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        }
      }

      const prompt = `You are a Remote Assistance AI inside Orin AI. The user needs help with a task. 
      Task Description: ${currentInput}
      Action: Analyze the request (and the provided screen frame if available) and provide technical guidance or automated text generation. 
      If the user wants you to 'input text' or 'do work', provide the exact text or steps they need to follow.
      Maintain a professional and helpful tone. Respond in ${lang === 'si' ? 'Sinhala' : 'English'}.`;

      const res = await geminiService.chat(prompt, {
        fileData: imageData ? { data: imageData, mimeType: 'image/jpeg' } : undefined,
        useThinking: true
      });

      addAiMessage(res.text);
    } catch (e: any) {
      addAiMessage(lang === 'si' ? "සමාවන්න, දෝෂයක් සිදු විය." : "Apologies, an error occurred in the neural bridge.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startAccessibilityAssistance = () => {
    setIsDiagnostic(true);
    setTimeout(() => {
      setIsDiagnostic(false);
      addAiMessage(lang === 'si' ? "Accessibility සහාය දැන් සක්‍රීයයි. මම ඔබගේ උපාංගය පාලනය කිරීමට සූදානම්." : "Accessibility assistance is now active. I am ready to help guide your device actions.");
      setIsSharing(true);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
      <header className="h-16 md:h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-life-ring text-xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.getHelp}</h2>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse beta-glow">SUPPORT</span>
            </div>
            <p className="hidden md:block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Neural Remote Assistant</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Main Support Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center gap-8 border-r border-black/5 dark:border-white/5">
          <div className="w-full max-w-4xl space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {isSharing ? (lang === 'si' ? "සජීවී නිරීක්ෂණය ක්‍රියාත්මකයි" : "Live Observation Active") : (lang === 'si' ? "පද්ධති සහාය අරඹන්න" : "Initialize System Support")}
              </h3>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                {platform === 'android' ? t.help.infoAndroid : t.help.infoPC}
              </p>
            </div>

            {isSharing && platform === 'ios-pc' && (
              <div className="w-full aspect-video rounded-[32px] md:rounded-[48px] overflow-hidden border border-black/5 dark:border-white/10 shadow-2xl bg-black relative animate-reveal ring-8 ring-cyan-500/5">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain"></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="absolute top-6 left-6 flex items-center gap-3 glass-panel px-4 py-2 rounded-full border border-white/20">
                   <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                   <span className="text-[9px] font-black uppercase text-white tracking-widest">LIVE STREAM FEED</span>
                </div>
              </div>
            )}

            {!isSharing && !isDiagnostic && (
              <div className="py-20 flex flex-col items-center gap-12 animate-fade">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-[40px] md:rounded-[48px] bg-slate-100 dark:bg-white/5 flex items-center justify-center relative group">
                  <div className="absolute -inset-4 rounded-[56px] border-2 border-cyan-500/20 animate-soft-pulse"></div>
                  <i className="fa-solid fa-headset text-4xl md:text-5xl text-slate-400 dark:text-slate-600"></i>
                </div>
                <button 
                  onClick={platform === 'android' ? startAccessibilityAssistance : startSharing}
                  className="px-12 py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
                >
                  <i className={`fa-solid ${platform === 'android' ? 'fa-universal-access' : 'fa-display'}`}></i>
                  {platform === 'android' ? t.help.startAccess : t.help.startSharing}
                </button>
              </div>
            )}

            {isDiagnostic && (
              <div className="py-20 flex flex-col items-center gap-6 animate-reveal">
                <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600 animate-pulse">
                  {platform === 'android' ? t.help.accessibility : t.help.sharing}
                </p>
              </div>
            )}

            {isSharing && (
              <div className="flex justify-center">
                <button 
                  onClick={platform === 'android' ? () => setIsSharing(false) : stopSharing}
                  className="px-8 py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                  <i className="fa-solid fa-stop"></i>
                  {t.help.stop}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Neural Assistant Sidebar */}
        <div className="w-full md:w-[400px] h-[400px] md:h-auto bg-white dark:bg-slate-900 border-l border-black/5 dark:border-white/5 flex flex-col shrink-0">
          <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Assistant Chat</h3>
            <div className="flex gap-1">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                 <i className="fa-solid fa-comment-dots text-3xl"></i>
                 <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed px-10">Describe the task you need Orin to perform or assist with</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] font-bold leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' 
                    : 'glass-panel text-slate-700 dark:text-slate-300 rounded-tl-none border border-black/5 dark:border-white/5'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-start animate-pulse">
                <div className="p-3 glass-panel rounded-2xl rounded-tl-none border border-black/5 dark:border-white/5 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce"></div>
                   <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">Analyzing Task</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-black/5 dark:border-white/5 bg-white dark:bg-slate-900">
             <div className="glass-panel p-2 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-2 shadow-inner focus-within:ring-4 focus-within:ring-cyan-500/5 transition-all">
                <input 
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTaskSubmit()}
                  placeholder={t.help.placeholder}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[12px] font-bold py-2 px-2 dark:text-white"
                />
                <button 
                  onClick={handleTaskSubmit}
                  disabled={!userInput.trim() || isProcessing}
                  className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-20"
                >
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GetHelpMode;
