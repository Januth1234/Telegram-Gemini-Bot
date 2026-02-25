
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { geminiService } from '../services/geminiService';
import { getMarkovSuggestions } from '../services/markovService';
import { ChatMessage, Language, WorkspaceMode, Conversation } from '../types';
import { translations } from '../translations';
import MathsMode from './MathsMode';
import VoiceAssistant from './VoiceAssistant';
import LiveVisionMode from './LiveVisionMode';
import FeatureCreate from './FeatureCreate';

interface ChatWorkspaceProps {
  onClose: () => void;
  initialPrompt: string;
  initialMode: WorkspaceMode;
  autoSubmit: boolean;
  onInputChange: (val: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  lang: Language;
  conversations: Conversation[];
  onSwitchConv: (id: string) => void;
  onNewConv: () => void;
  onDeleteConv: (id: string) => void;
  activeConvId: string;
  onUpdateTitle: (title: string, modes?: WorkspaceMode[]) => void;
  onModeSwitch?: (mode: WorkspaceMode) => void;
  isSyncing?: boolean;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ 
  onClose, initialPrompt, initialMode, autoSubmit, onInputChange, messages, setMessages, lang,
  conversations, onSwitchConv, onNewConv, onDeleteConv, activeConvId, onUpdateTitle, onModeSwitch, isSyncing = false
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<WorkspaceMode>(initialMode);
  const [isTyping, setIsTyping] = useState(false);
  
  // Private Mode State
  const [isPrivate, setIsPrivate] = useState(false);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);

  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [localInput, setLocalInput] = useState(initialPrompt);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [contextTime, setContextTime] = useState(() =>
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo', dateStyle: 'full', timeStyle: 'short' })
  );

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Active messages based on mode
  const currentMessages = isPrivate ? privateMessages : messages;

  // Collect all user message texts from conversations for Markov suggestions
  const userMessageTexts = useMemo(() => {
    const out: string[] = [];
    for (const c of conversations) {
      for (const m of c.messages || []) {
        if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) out.push(m.content.trim());
      }
    }
    return out;
  }, [conversations]);

  // Markov chain suggestions (blends your past messages with seed phrases for quick one-tap messages)
  useEffect(() => {
    if (activeTab !== 'chat' && activeTab !== 'translator') return;
    setSuggestions(getMarkovSuggestions(userMessageTexts, 3));
  }, [activeTab, userMessageTexts]);

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialPrompt !== undefined) setLocalInput(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isTyping]);

  useEffect(() => {
    const update = () => setContextTime(new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo', dateStyle: 'full', timeStyle: 'short' }));
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  const startProgress = (mode: WorkspaceMode) => {
    setProgress(0);
    const steps = [{ threshold: 30, label: "Reading..." }, { threshold: 60, label: "Thinking..." }, { threshold: 90, label: "Writing..." }];
    setStepLabel(steps[0].label);
    let currentProgress = 0;
    progressIntervalRef.current = window.setInterval(() => {
      currentProgress += Math.random() * 5;
      if (currentProgress > 95) currentProgress = 95;
      const activeStep = [...steps].reverse().find(s => currentProgress >= s.threshold);
      if (activeStep) setStepLabel(activeStep.label);
      setProgress(currentProgress);
    }, 400);
  };

  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(100);
    setTimeout(() => { setProgress(0); setStepLabel(""); }, 500);
  };

  const handleSend = useCallback(async (overrideInput?: string, overrideFile?: { data: string; mimeType: string; name: string }) => {
    const text = overrideInput !== undefined ? overrideInput : localInput;
    const fileToUse = overrideFile || selectedFile;

    if (!text.trim() && !fileToUse && activeTab !== 'studio') return;
    
    abortControllerRef.current = new AbortController();
    setChatError(null);
    setIsTyping(true);
    startProgress(activeTab);
    setLocalInput('');
    onInputChange('');

    const userMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'user', 
        content: text || "", 
        timestamp: new Date(), 
        type: fileToUse ? 'image' : 'text',
        imageUrl: fileToUse ? `data:${fileToUse.mimeType};base64,${fileToUse.data}` : undefined 
    };

    if (isPrivate) {
        setPrivateMessages(prev => [...prev, userMsg]);
    } else {
        setMessages(prev => [...prev, userMsg]);
    }

    try {
      const res = await geminiService.chat(text || "Continue.", { 
        fileData: fileToUse || undefined, 
        useThinking: false, // OPTIMIZED: Changed from true (Pro) to false (Flash) for speed
        history: isPrivate ? privateMessages : messages, 
        signal: abortControllerRef.current.signal,
        isPrivate: isPrivate 
      });

      const botMsg: ChatMessage = { 
         id: (Date.now() + 1).toString(), 
         role: 'assistant', 
         content: res.text, 
         timestamp: new Date(), 
         type: 'text', 
         links: res.links 
      };

      if (isPrivate) {
         setPrivateMessages(prev => [...prev, botMsg]);
      } else {
         setMessages(prev => [...prev, botMsg]);
         if (messages.length < 2) {
            const title = await geminiService.generateTitle([...messages, userMsg, botMsg], [activeTab], lang);
            onUpdateTitle(title, [activeTab]);
         }
      }
      
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : String(e);
      setChatError(msg || 'Something went wrong. Try again.');
      alert(msg || 'Something went wrong. Try again.');
    } finally { 
       setIsTyping(false); 
       stopProgress(); 
       setSelectedFile(null);
    }
  }, [localInput, selectedFile, activeTab, isPrivate, messages, privateMessages]);

  const togglePrivate = () => {
    setIsPrivate(prev => !prev);
    setPrivateMessages([]);
  };

  const renderBody = () => {
    if (activeTab === 'voice') return <div className="flex-1 overflow-hidden"><VoiceAssistant onClose={onClose} lang={lang} inline /></div>;
    if (activeTab === 'maths') return <div className="flex-1 flex flex-col overflow-hidden"><MathsMode onClose={onClose} lang={lang} embedded messages={currentMessages} onSend={handleSend} isTyping={isTyping} /></div>;
    if (activeTab === 'vision') return <div className="flex-1 overflow-hidden"><LiveVisionMode onClose={onClose} lang={lang} /></div>;
    if (activeTab === 'studio') return <div className="flex-1 overflow-hidden h-full"><FeatureCreate onClose={onClose} /></div>;

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-20 md:p-10 relative bg-slate-50/30 dark:bg-slate-950/30 pb-40 md:pb-48">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-10">
          {currentMessages.length === 0 ? (
            <div className="py-24 text-center space-y-10 animate-reveal min-h-[500px] flex flex-col justify-center">
               <div className={`w-24 h-24 md:w-28 md:h-28 rounded-[28px] mx-auto flex items-center justify-center border-2 shadow-2xl ring-4 ring-cyan-500/10 dark:ring-cyan-400/10 ${isPrivate ? 'bg-slate-900 text-white border-slate-600' : 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 text-cyan-600 dark:text-cyan-400 border-slate-200 dark:border-white/10'}`}>
                  <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-message'} text-4xl md:text-5xl`} />
               </div>
               <div className="space-y-3">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{isPrivate ? 'Private Mode' : 'Orin Workspace'}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{isPrivate ? 'Messages are not saved or synced.' : 'Secure, authenticated, production-ready. Ask anything below.'}</p>
               </div>
               <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <span className="px-3 py-1.5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-wider">Chat</span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Sinhala · Tamil · English</span>
               </div>
            </div>
          ) : (
            currentMessages.map((msg, i) => (
              <div key={msg.id || i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`} style={{ animationDelay: `${Math.min(i * 60, 240)}ms` }}>
                 <div className="flex items-end gap-2 max-w-[92%]">
                   {msg.role === 'assistant' && (
                     <div className="w-8 h-8 shrink-0 rounded-lg bg-cyan-500/20 dark:bg-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                       <i className="fa-solid fa-sparkles text-xs" />
                     </div>
                   )}
                   <div className={`min-w-0 p-5 md:p-8 rounded-[24px] shadow-md border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                     <div className={`whitespace-pre-wrap text-sm md:text-base leading-relaxed ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                     {msg.links && msg.links.length > 0 && (
                       <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200/50 dark:border-white/10">
                         {msg.links.slice(0, 5).map((link, j) => (
                           <a key={j} href={link.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-cyan-500/20 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                             <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" /> {link.title || 'Link'}
                           </a>
                         ))}
                       </div>
                     )}
                     <p className="text-[10px] opacity-60 mt-2">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   </div>
                   {msg.role === 'user' && (
                     <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-700 dark:bg-slate-600 flex items-center justify-center text-white">
                       <i className="fa-solid fa-user text-xs" />
                     </div>
                   )}
                 </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex flex-col items-center gap-3 animate-reveal">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/20">
                <div className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <div key={d} className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{stepLabel}</span>
              </div>
              {progress > 0 && progress < 100 && (
                <div className="w-48 h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}
          <div ref={scrollRef} className="h-4" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      
      {/* Sidebar Overlay */}
      {isHistoryOpen && <div className="fixed inset-0 bg-black/50 z-[140]" onClick={() => setIsHistoryOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-[150] w-72 md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform shadow-xl flex flex-col ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2"><i className="fa-solid fa-clock-rotate-left" /> History</span>
            <button onClick={() => setIsHistoryOpen(false)} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="p-4 space-y-3 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Quick actions</p>
            <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <i className="fa-solid fa-plus" /> New Chat
            </button>
            <button onClick={() => { togglePrivate(); setIsHistoryOpen(false); }} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${isPrivate ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-cyan-500/40'}`}>
               <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-eye'}`} /> {isPrivate ? 'Turn Off Private' : 'Private Mode'}
            </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 p-2">
            {conversations.map(c => (
                <div key={c.id} className={`group relative mb-2 rounded-xl transition-all border ${activeConvId === c.id ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800/50' : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <button 
                        onClick={() => { onSwitchConv(c.id); setIsHistoryOpen(false); }} 
                        className={`w-full text-left p-4 pr-10 text-xs font-bold truncate flex items-center gap-2 ${activeConvId === c.id ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <i className="fa-solid fa-message text-[10px] opacity-60 shrink-0" /> {c.title}
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this conversation?')) {
                                onDeleteConv(c.id);
                            }
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg transition-all ${activeConvId === c.id ? 'opacity-100 text-slate-500 hover:text-red-500' : 'text-slate-400 hover:text-red-500 hover:bg-white/50 dark:hover:bg-black/20 opacity-0 group-hover:opacity-100'}`}
                        title="Delete conversation"
                        aria-label="Delete conversation"
                    >
                        <i className="fa-solid fa-trash text-xs" />
                    </button>
                </div>
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-14 md:h-16 shrink-0 border-b border-slate-200 dark:border-white/5 flex flex-col z-[60] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 h-full">
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setIsHistoryOpen(true)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" aria-label="Open history">
                <i className="fa-solid fa-bars" />
              </button>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">{currentMessages.length} message{currentMessages.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              {isSyncing && <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1"><i className="fa-solid fa-cloud-arrow-up animate-pulse" /> Syncing</span>}
              <button
                onClick={togglePrivate}
                title={isPrivate ? 'Private Mode (tap to turn off)' : 'Public (tap for Private Mode)'}
                aria-label={isPrivate ? 'Turn off private mode' : 'Switch to private mode'}
                className={`p-2 md:px-4 md:py-2 rounded-xl border flex items-center gap-2 transition-all ${isPrivate ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-cyan-500/40'}`}
              >
                <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-eye'}`} aria-hidden />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">{isPrivate ? 'Private' : 'Public'}</span>
              </button>
            </div>
          </div>
          {isTyping && progress > 0 && (
            <div className="h-0.5 w-full bg-slate-100 dark:bg-white/5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-r-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </header>

        {renderBody()}

        {/* Input Bar - Hide when in studio/video/maths mode */}
        {activeTab !== 'studio' && activeTab !== 'vision' && activeTab !== 'voice' && activeTab !== 'maths' && (
          <div className="fixed bottom-0 left-0 right-0 w-full p-2 md:p-8 pointer-events-none z-[100] safe-pb mb-0">
               <div className="max-w-3xl mx-auto pointer-events-auto relative">
                  {chatError && (
                    <div className="absolute -top-14 left-0 right-0 flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-red-500/15 dark:bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium animate-reveal">
                      <span>{chatError}</span>
                      <button type="button" onClick={() => setChatError(null)} className="shrink-0 p-1 rounded hover:bg-red-500/20" aria-label="Dismiss"><i className="fa-solid fa-xmark" /></button>
                    </div>
                  )}
                  {/* Markov Chain Suggestions */}
                  {!localInput && currentMessages.length === 0 && !isPrivate && (
                     <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2 overflow-x-auto no-scrollbar pb-2 px-4">
                        {suggestions.map((s, i) => (
                           <button 
                             key={i} 
                             type="button"
                             onClick={() => {
                               setLocalInput(s);
                               onInputChange(s);
                               inputRef.current?.focus();
                             }}
                             className="px-4 py-1.5 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-bold text-slate-500 hover:text-cyan-600 hover:border-cyan-500/40 hover:scale-[1.03] transition-[transform,color,border-color] duration-150 shadow-sm whitespace-nowrap tap-target animate-reveal"
                             style={{ animationDelay: `${i * 80}ms` }}
                           >
                             {s}
                           </button>
                        ))}
                     </div>
                  )}

                  <div className={`glass-panel p-2 rounded-[28px] md:rounded-[32px] shadow-2xl border flex items-center gap-2 backdrop-blur-3xl transition-all ${isPrivate ? 'bg-slate-900/90 border-slate-700' : 'bg-white/95 dark:bg-slate-900/95 border-slate-300 dark:border-white/10 focus-within:ring-2 focus-within:ring-cyan-500/20 dark:focus-within:ring-cyan-400/20'}`}>
                     <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 shrink-0 rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" aria-label="Attach file"><i className="fa-solid fa-paperclip" /></button>
                     <input 
                      ref={inputRef} 
                      value={localInput} 
                      onChange={e => { setLocalInput(e.target.value); onInputChange(e.target.value); }} 
                      onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
                      placeholder={isPrivate ? "Private Mode (Not Saved)..." : "Ask Orin AI..."}
                      className={`flex-1 bg-transparent border-none outline-none focus:ring-0 focus:outline-none text-base py-3 px-2 font-medium min-w-0 ${isPrivate ? 'text-white placeholder:text-slate-500' : 'text-slate-900 dark:text-white placeholder:text-slate-400'}`} 
                     />
                     <button
                       onClick={() => handleSend()}
                       disabled={isTyping}
                       className={`w-10 h-10 shrink-0 rounded-[18px] flex items-center justify-center shadow-lg tap-target disabled:opacity-50 transition-all ${isTyping ? 'scale-95' : 'hover:scale-105 hover:shadow-xl'} ${isPrivate ? 'bg-white text-black' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'}`}
                       aria-label="Send"
                     >
                       {isTyping ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-arrow-up" />}
                     </button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const r = new FileReader();
                          r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
                          r.readAsDataURL(file);
                        }
                     }} />
                  </div>
                  <div className="mt-3 mb-1 pt-2 border-t border-slate-200/50 dark:border-white/5">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center select-none" aria-hidden>
                      {contextTime} Sri Lanka · Orin AI
                    </p>
                  </div>
               </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWorkspace;
