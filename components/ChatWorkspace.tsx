
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
      if (!(e instanceof Error && e.name === 'AbortError')) alert(e instanceof Error ? e.message : String(e));
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
            <div className="py-24 text-center space-y-8 animate-reveal min-h-[500px] flex flex-col justify-center">
               <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[32px] mx-auto flex items-center justify-center border shadow-xl ${isPrivate ? 'bg-slate-900 text-white border-slate-700' : 'bg-white dark:bg-slate-900 text-slate-200 dark:text-slate-800 border-slate-100 dark:border-white/5'}`}>
                  <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-message'} text-5xl`}></i>
               </div>
               <div className="space-y-4">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{isPrivate ? 'Private Mode' : 'Orin Workspace'}</h2>
                  <p className="text-sm text-slate-500">{isPrivate ? 'Messages are not saved or synced.' : 'Secure, Authenticated, Production-Ready.'}</p>
               </div>
            </div>
          ) : (
            currentMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`} style={{ animationDelay: `${Math.min(i * 60, 240)}ms` }}>
                 <div className={`max-w-[92%] p-5 md:p-8 rounded-[24px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                    <div className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</div>
                 </div>
              </div>
            ))
          )}
          {isTyping && <div className="text-[10px] font-black uppercase tracking-widest text-cyan-600 animate-pulse text-center">{stepLabel}</div>}
          <div ref={scrollRef} className="h-4" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      
      {/* Sidebar Overlay */}
      {isHistoryOpen && <div className="fixed inset-0 bg-black/50 z-[140]" onClick={() => setIsHistoryOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-[150] w-72 md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">History</span>
            <button onClick={() => setIsHistoryOpen(false)}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-4 space-y-2">
            <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest">+ New Chat</button>
            <button onClick={() => { togglePrivate(); setIsHistoryOpen(false); }} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${isPrivate ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}>
               {isPrivate ? 'Turn Off Private Mode' : 'Switch to Private Mode'}
            </button>
        </div>
        <div className="overflow-y-auto h-full p-2">
            {conversations.map(c => (
                <div key={c.id} className={`group relative mb-2 rounded-xl transition-all ${activeConvId === c.id ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <button 
                        onClick={() => { onSwitchConv(c.id); setIsHistoryOpen(false); }} 
                        className={`w-full text-left p-4 pr-10 text-xs font-bold truncate ${activeConvId === c.id ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        {c.title}
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
        <header className="h-14 md:h-16 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 z-[60] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setIsHistoryOpen(true)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center"><i className="fa-solid fa-bars"></i></button>
          </div>
          <button
            onClick={togglePrivate}
            title={isPrivate ? 'Private Mode (tap to turn off)' : 'Public (tap for Private Mode)'}
            aria-label={isPrivate ? 'Turn off private mode' : 'Switch to private mode'}
            className={`p-2 md:px-4 md:py-2 rounded-xl border flex items-center gap-2 transition-all ${isPrivate ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}
          >
            <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-eye'}`} aria-hidden />
            <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">{isPrivate ? 'Private' : 'Public'}</span>
          </button>
        </header>

        {renderBody()}

        {/* Input Bar - Hide when in studio/video/maths mode */}
        {activeTab !== 'studio' && activeTab !== 'vision' && activeTab !== 'voice' && activeTab !== 'maths' && (
          <div className="fixed bottom-0 left-0 right-0 w-full p-2 md:p-8 pointer-events-none z-[100] safe-pb mb-0">
               <div className="max-w-3xl mx-auto pointer-events-auto relative">
                  {/* Markov Chain Suggestions */}
                  {!localInput && currentMessages.length === 0 && !isPrivate && (
                     <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2 overflow-x-auto no-scrollbar pb-2 px-4">
                        {suggestions.map((s, i) => (
                           <button 
                             key={i} 
                             onClick={() => handleSend(s)} 
                             className="px-4 py-1.5 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-bold text-slate-500 hover:text-cyan-600 hover:border-cyan-500/40 hover:scale-[1.03] transition-[transform,color,border-color] duration-150 shadow-sm whitespace-nowrap tap-target animate-reveal"
                             style={{ animationDelay: `${i * 80}ms` }}
                           >
                             {s}
                           </button>
                        ))}
                     </div>
                  )}

                  <div className={`glass-panel p-2 rounded-[28px] md:rounded-[32px] shadow-2xl border flex items-center gap-1 backdrop-blur-3xl transition-colors ${isPrivate ? 'bg-slate-900/90 border-slate-700' : 'bg-white/95 dark:bg-slate-900/95 border-slate-300 dark:border-white/10'}`}>
                     <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 shrink-0 rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"><i className="fa-solid fa-paperclip"></i></button>
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
                       className={`w-10 h-10 shrink-0 rounded-[18px] flex items-center justify-center shadow-lg tap-target disabled:opacity-50 hover:shadow-xl ${isPrivate ? 'bg-white text-black' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'}`}
                     >
                       <i className="fa-solid fa-arrow-up"></i>
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
               </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWorkspace;
