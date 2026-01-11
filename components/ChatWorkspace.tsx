
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { ChatMessage, Language, HardwareStatus, WorkspaceMode, Conversation } from '../types';
import { translations } from '../translations';

interface ChatWorkspaceProps {
  onClose: () => void;
  hwStatus: HardwareStatus;
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
  isSyncing?: boolean;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ 
  onClose, initialPrompt, initialMode, autoSubmit, onInputChange, messages, setMessages, lang,
  conversations, onSwitchConv, onNewConv, onDeleteConv, activeConvId, onUpdateTitle, isSyncing = false
}) => {
  const t = translations[lang];
  const activeTab = initialMode;
  const [isTyping, setIsTyping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [localInput, setLocalInput] = useState(initialPrompt);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const activeConversation = useMemo(() => 
    conversations.find(c => c.id === activeConvId), 
    [conversations, activeConvId]
  );

  const [modesUsed, setModesUsed] = useState<Set<WorkspaceMode>>(() => {
    const modes = new Set(activeConversation?.modesUsed || []);
    modes.add(initialMode);
    return modes;
  });

  useEffect(() => {
    const modes = new Set(activeConversation?.modesUsed || []);
    modes.add(activeTab);
    setModesUsed(modes);
  }, [activeConversation?.id, activeTab]);

  useEffect(() => {
    if (initialPrompt !== undefined) setLocalInput(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, activeConvId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleInputChange = (val: string) => {
    setLocalInput(val);
    onInputChange(val);
  };

  const handleClose = useCallback(() => {
    if ((localInput.trim() || selectedFile) && !window.confirm(lang === 'si' ? "ඔබ ලියූ දේ මකා දැමීමට අවශ්‍යද?" : "Discard your current draft?")) {
      return;
    }
    onInputChange('');
    onClose();
  }, [onClose, onInputChange, localInput, selectedFile, lang]);

  const startProgress = (mode: WorkspaceMode) => {
    setProgress(0);
    const steps = mode === 'studio' 
      ? [{ threshold: 20, label: lang === 'si' ? "සූදානම්..." : "Init..." }, { threshold: 50, label: lang === 'si' ? "සකසමින්..." : "Mapping..." }, { threshold: 85, label: lang === 'si' ? "අඳිමින්..." : "Rendering..." }]
      : [{ threshold: 30, label: lang === 'si' ? "විග්‍රහ කරමින්..." : "Analyzing..." }, { threshold: 60, label: lang === 'si' ? "සිතමින්..." : "Thinking..." }, { threshold: 90, label: lang === 'si' ? "සකසමින්..." : "Finalizing..." }];
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
    stopProgress();
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput !== undefined ? overrideInput : localInput;
    if (!text.trim() && !selectedFile && activeTab !== 'studio') return;
    if (geminiService.hasReachedLimit()) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const currentModes = new Set([...Array.from(modesUsed), activeTab]);
    setModesUsed(currentModes);

    setIsTyping(true);
    startProgress(activeTab);
    handleInputChange('');

    if (activeTab === 'studio') {
      try {
        const url = await geminiService.generateImagePro(text, "1:1", "1K", signal);
        const studioMsg: ChatMessage = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: lang === 'si' ? "ඔබේ නිර්මාණය සූදානම්." : "Your creation is ready.", 
          imageUrl: url, 
          timestamp: new Date(), 
          type: 'image' 
        };
        setMessages(prev => [...prev, studioMsg]);
        const title = await geminiService.generateTitle([studioMsg], Array.from(currentModes), lang);
        onUpdateTitle(title, Array.from(currentModes));
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `System Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
      } finally { setIsTyping(false); stopProgress(); }
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text || "", timestamp: new Date(), type: 'text', fileName: selectedFile?.name };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await geminiService.chat(text || "Explain.", { 
        fileData: selectedFile || undefined, grounding: 'search', messageCount: messages.filter(m => m.role === 'user').length,
        useThinking: activeTab === 'chat', history: messages, signal
      });
      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text, timestamp: new Date(), type: 'text', links: res.links };
      setMessages(prev => [...prev, assistantMsg]);
      
      if (messages.length < 2) {
        const title = await geminiService.generateTitle([...messages, userMsg, assistantMsg], Array.from(currentModes), lang);
        onUpdateTitle(title, Array.from(currentModes));
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Neural Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
    } finally { setIsTyping(false); setSelectedFile(null); stopProgress(); }
  }, [localInput, selectedFile, activeTab, onInputChange, setMessages, lang, messages, onUpdateTitle, modesUsed]);

  const getTabIcon = (tab: WorkspaceMode) => {
    switch(tab) {
      case 'studio': return 'fa-wand-magic-sparkles';
      case 'vision': return 'fa-camera';
      case 'maths': return 'fa-calculator';
      case 'voice': return 'fa-microphone-lines';
      case 'gethelp': return 'fa-life-ring';
      default: return 'fa-comment-dots';
    }
  };

  const currentSuggestions = useMemo(() => {
    const key = activeTab === 'chat' ? 'chat' : activeTab === 'maths' ? 'maths' : activeTab === 'studio' ? 'studio' : 'vision';
    return t.prompts[key as keyof typeof t.prompts] || [];
  }, [activeTab, t.prompts]);

  return (
    <div className="flex h-full w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans safe-pb">
      
      {isHistoryOpen && <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[110] animate-fade" onClick={() => setIsHistoryOpen(false)} />}

      {/* Improved History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[120] w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl safe-pt`}>
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fa-solid fa-memory text-cyan-600"></i>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Neural Memory</h3>
          </div>
          <button onClick={() => setIsHistoryOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={() => { onNewConv(); setIsHistoryOpen(false); }} 
            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
          >
            <i className="fa-solid fa-plus-circle"></i> {t.newNeuralChat}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 pb-32">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale">
              <i className="fa-solid fa-box-open text-4xl mb-4"></i>
              <p className="text-[10px] font-bold uppercase tracking-widest">No Archived Cycles</p>
            </div>
          ) : (
            conversations.map(conv => {
              const lastMsg = conv.messages[conv.messages.length - 1]?.content || "Empty Terminal";
              const isActive = activeConvId === conv.id;
              return (
                <div key={conv.id} className="group">
                  <button 
                    onClick={() => { onSwitchConv(conv.id); setIsHistoryOpen(false); }} 
                    className={`w-full text-left p-4 rounded-2xl transition-all border ${
                      isActive 
                        ? 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-500/20 shadow-sm' 
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-black uppercase tracking-tight truncate ${isActive ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {conv.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-medium">{lastMsg}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{conv.timestamp.toLocaleDateString()}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteConv(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                      </button>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Refined Header */}
        <header className="h-16 md:h-20 glass-panel border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 md:px-10 z-[60] bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsHistoryOpen(true)} 
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-cyan-600 transition-all active:scale-95"
            >
              <i className="fa-solid fa-sidebar text-sm"></i>
            </button>
            <div className="hidden tiny:block">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Workspace Mode</h4>
              <p className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                 <i className={`fa-solid ${getTabIcon(activeTab)} text-cyan-600`}></i>
                 {activeTab}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3">
             {isTyping && (
                <button onClick={handleStop} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                  <i className="fa-solid fa-stop text-sm"></i>
                </button>
             )}
             <button onClick={handleClose} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-red-500 transition-all active:scale-95 border border-slate-200 dark:border-white/10">
                <i className="fa-solid fa-arrow-right-from-bracket rotate-180"></i>
             </button>
          </div>

          {progress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-100 dark:bg-slate-900 overflow-hidden">
               <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </header>

        {/* Improved Message Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 p-4 md:p-10">
          <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-48">
            {messages.length === 0 ? (
              <div className="py-20 text-center space-y-10 animate-reveal">
                 <div className="w-24 h-24 rounded-[40px] bg-white dark:bg-slate-900 mx-auto flex items-center justify-center text-slate-200 dark:text-slate-800 border border-slate-100 dark:border-white/5 shadow-xl">
                    <i className={`fa-solid ${getTabIcon(activeTab)} text-5xl`}></i>
                 </div>
                 <div className="space-y-4">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Neural Core {activeTab.toUpperCase()} Initialize</h2>
                    <div className="flex flex-wrap justify-center gap-2">
                       {currentSuggestions.map(s => (
                          <button key={s} onClick={() => handleSend(s)} className="px-5 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-cyan-600 hover:border-cyan-200 transition-all shadow-sm active:scale-95">{s}</button>
                       ))}
                    </div>
                 </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                   <div className={`max-w-[90%] md:max-w-[85%] p-5 md:p-8 rounded-3xl md:rounded-[40px] shadow-sm relative border ${
                      msg.role === 'user' 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-sm border-transparent' 
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-sm border-slate-200 dark:border-white/10'
                   }`}>
                      <div className={`text-sm md:text-lg leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>
                        {msg.content}
                      </div>

                      {msg.imageUrl && (
                        <div className="mt-6 space-y-6">
                           <div className="rounded-[28px] md:rounded-[40px] overflow-hidden border-4 border-slate-100 dark:border-white/5 shadow-2xl group/img bg-slate-100 dark:bg-black relative">
                              <img src={msg.imageUrl} className="w-full h-auto transition-transform duration-700 group-hover/img:scale-105" alt="Neural Synthesis" />
                              <div className="absolute inset-0 bg-cyan-600/0 group-hover/img:bg-cyan-600/5 transition-colors pointer-events-none"></div>
                           </div>
                           <button 
                             onClick={() => geminiService.downloadImage(msg.imageUrl!)}
                             className="w-full py-4 bg-cyan-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                           >
                             <i className="fa-solid fa-download"></i>
                             {t.downloadAsset}
                           </button>
                        </div>
                      )}

                      {msg.links && msg.links.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 space-y-3">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.knowledgeSources}</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {msg.links.map((link, idx) => (
                                <a key={idx} href={link.uri} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-[10px] font-bold text-cyan-600 dark:text-cyan-400 truncate hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors border border-transparent hover:border-cyan-100 dark:hover:border-cyan-500/20">
                                   <i className="fa-solid fa-link mr-2 opacity-50"></i> {link.title}
                                </a>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>
                   <div className="mt-2 px-4 flex items-center gap-2 opacity-40">
                      <span className="text-[8px] font-black uppercase tracking-widest">{msg.role === 'user' ? 'Transmission' : 'Synthesis'}</span>
                      <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                      <span className="text-[8px] font-bold uppercase">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                   </div>
                </div>
              ))
            )}
            
            {isTyping && (
              <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 shadow-md w-fit">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                  <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                  <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
                </div>
                <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">{stepLabel || t.calculating}</span>
              </div>
            )}
            <div ref={scrollRef} className="h-10" />
          </div>
        </div>

        {/* Refined Input Bar */}
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-10 pointer-events-none">
           <div className="max-w-4xl mx-auto pointer-events-auto">
              <div className="glass-panel p-2 md:p-4 rounded-[32px] md:rounded-[48px] shadow-2xl border border-slate-300/50 dark:border-white/10 flex items-center gap-2 backdrop-blur-3xl bg-white/95 dark:bg-slate-900/95">
                 
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[36px] flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-90"
                 >
                   <i className="fa-solid fa-plus-circle text-xl"></i>
                 </button>

                 <input 
                  ref={inputRef} 
                  value={localInput} 
                  onChange={e => handleInputChange(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
                  placeholder={activeTab === 'studio' ? t.placeholderStudio : t.inputPrompt} 
                  className={`flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-xl py-3 dark:text-white placeholder:text-slate-400 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`} 
                 />

                 <button 
                   onClick={() => handleSend()} 
                   disabled={isTyping || (!localInput.trim() && !selectedFile && activeTab !== 'studio')}
                   className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[36px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
                 >
                   <i className="fa-solid fa-paper-plane text-sm md:text-lg"></i>
                 </button>

                 <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
                      r.readAsDataURL(file);
                    }
                 }} />
              </div>

              {selectedFile && (
                <div className="mt-4 flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 w-fit animate-reveal">
                   <i className="fa-solid fa-file-shield text-emerald-600"></i>
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{selectedFile.name}</span>
                   <button onClick={() => setSelectedFile(null)} className="text-red-500"><i className="fa-solid fa-circle-xmark"></i></button>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWorkspace;
