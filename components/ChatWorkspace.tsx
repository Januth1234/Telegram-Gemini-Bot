
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

const ITEMS_PER_PAGE = 15;

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
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(ITEMS_PER_PAGE);

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

  const hasReachedLimit = geminiService.hasReachedLimit();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialPrompt !== undefined) {
      setLocalInput(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, activeConvId]);

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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startProgress = (mode: WorkspaceMode) => {
    setProgress(0);
    const steps = mode === 'studio' 
      ? [
          { threshold: 20, label: lang === 'si' ? "සූදානම් කරමින්..." : "Initializing..." },
          { threshold: 50, label: lang === 'si' ? "සකසමින්..." : "Mapping..." },
          { threshold: 85, label: lang === 'si' ? "අඳිමින්..." : "Rendering..." }
        ]
      : [
          { threshold: 30, label: lang === 'si' ? "විග්‍රහ කරමින්..." : "Analyzing..." },
          { threshold: 60, label: lang === 'si' ? "සිතමින්..." : "Processing..." },
          { threshold: 90, label: lang === 'si' ? "පිළිතුර සකසමින්..." : "Finalizing..." }
        ];
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
    setTimeout(() => {
      setProgress(0);
      setStepLabel("");
    }, 500);
  };

  const handleDownloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `orin-asset-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput !== undefined ? overrideInput : localInput;
    if (!text.trim() && !selectedFile && activeTab !== 'studio') return;
    if (hasReachedLimit) return;

    const previousModesCount = modesUsed.size;
    const currentModes = new Set([...Array.from(modesUsed), activeTab]);
    setModesUsed(currentModes);

    setIsTyping(true);
    startProgress(activeTab);
    handleInputChange('');

    if (activeTab === 'studio') {
      try {
        const url = await geminiService.generateImagePro(text, "1:1", "1K");
        const studioMsg: ChatMessage = { id: Date.now().toString(), role: 'assistant', content: lang === 'si' ? "නිර්මාණය අවසන්." : "Done.", imageUrl: url, timestamp: new Date(), type: 'image' };
        setMessages(prev => [...prev, studioMsg]);
        if (currentModes.size > previousModesCount || messages.length < 4) {
           const title = await geminiService.generateTitle([studioMsg], Array.from(currentModes), lang);
           onUpdateTitle(title, Array.from(currentModes));
        }
      } catch (e: any) {
        if (e instanceof AppError && e.type === 'auth') {
           if ((window as any).aistudio) (window as any).aistudio.openSelectKey();
        }
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
      } finally { 
        setIsTyping(false); 
        stopProgress();
      }
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text || "", timestamp: new Date(), type: 'text', fileName: selectedFile?.name };
    setMessages(prev => [...prev, userMsg]);

    try {
      const messageCount = messages.filter(m => m.role === 'user').length;
      const res = await geminiService.chat(text || "Explain.", { 
        fileData: selectedFile || undefined, 
        grounding: 'search',
        messageCount: messageCount,
        useThinking: activeTab === 'chat', 
        history: messages 
      });
      
      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text, timestamp: new Date(), type: 'text', links: res.links };
      setMessages(prev => [...prev, assistantMsg]);
      
      if (messages.length < 6 || currentModes.size > previousModesCount) {
        const title = await geminiService.generateTitle([...messages, userMsg, assistantMsg], Array.from(currentModes), lang);
        onUpdateTitle(title, Array.from(currentModes));
      }
    } catch (e: any) {
      if (e instanceof AppError && e.type === 'auth') {
        if ((window as any).aistudio) (window as any).aistudio.openSelectKey();
      }
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
    } finally {
      setIsTyping(false);
      setSelectedFile(null);
      stopProgress();
    }
  }, [localInput, selectedFile, activeTab, hasReachedLimit, onInputChange, setMessages, lang, messages, onUpdateTitle, modesUsed]);

  const getTabUrl = (tab: WorkspaceMode) => {
    if (tab === 'studio') return '#art';
    if (tab === 'vision') return '#camera';
    if (tab === 'maths') return '#math';
    if (tab === 'voice') return '#voice';
    if (tab === 'gethelp') return '#help';
    return '#chat';
  };

  const currentSuggestions = useMemo(() => {
    const key = activeTab === 'chat' ? 'chat' : activeTab === 'maths' ? 'maths' : activeTab === 'studio' ? 'studio' : 'vision';
    return t.prompts[key as keyof typeof t.prompts] || [];
  }, [activeTab, t.prompts]);

  return (
    <div className="flex flex-row h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] animate-fade" onClick={() => setIsHistoryOpen(false)} />
      )}

      {/* History Sidebar - Mobile Optimized */}
      <div className={`fixed inset-y-0 left-0 z-[120] w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl`}>
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <i className="fa-solid fa-clock-rotate-left text-cyan-600"></i>
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{t.memoryHistory}</h3>
          </div>
          <button onClick={() => setIsHistoryOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <div className="p-6">
          <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-5 bg-cyan-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-cyan-600/20 active:scale-95 transition-all">
            <i className="fa-solid fa-plus"></i> {t.newNeuralChat}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 pb-32">
          {conversations.map(conv => (
            <div key={conv.id} className="group relative">
               <button 
                 onClick={() => { onSwitchConv(conv.id); setIsHistoryOpen(false); }} 
                 className={`w-full text-left p-5 rounded-2xl transition-all flex flex-col gap-2 border ${activeConvId === conv.id ? 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-500/20' : 'border-transparent bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-slate-800'}`}
               >
                 <span className={`text-sm font-bold truncate w-full ${activeConvId === conv.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'} ${/[^\u0000-\u007F]/.test(conv.title) ? 'sinhala-text' : ''}`}>
                   {conv.title}
                 </span>
                 <div className="flex items-center justify-between">
                   <span className="text-[10px] font-bold text-slate-400 uppercase">{conv.timestamp.toLocaleDateString()}</span>
                   <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{conv.mode}</span>
                 </div>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this?')) onDeleteConv(conv.id); }} 
                className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center opacity-0 md:group-hover:opacity-100 bg-red-500 text-white rounded-lg transition-all z-10 shadow-lg"
              >
                <i className="fa-solid fa-trash-can text-[10px]"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-[50]">
        {/* LOCKED HEADER - Always accessible at the top */}
        <div className="shrink-0 h-20 glass-panel px-4 md:px-8 flex items-center justify-between z-30 border-b border-slate-200 dark:border-white/5 shadow-sm sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsHistoryOpen(true)} 
               className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-cyan-600 transition-all active:scale-90 border border-black/5 dark:border-white/5" 
               title="History"
             >
              <i className="fa-solid fa-clock-rotate-left"></i>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 ${isSyncing ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500 shadow-sm'}`}>
                <i className={`fa-solid ${isSyncing ? 'fa-cloud-arrow-up' : 'fa-cloud'} text-[7px] text-white`}></i>
              </div>
            </button>
          </div>

          {/* Tab Nav - Optimized for Swipe/Scroll */}
          <div className="flex-1 flex justify-center w-full max-w-[calc(100%-120px)] overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-x px-2 py-2">
                {(['chat', 'maths', 'studio', 'vision', 'voice', 'gethelp'] as WorkspaceMode[]).map(tab => (
                  <a
                    key={tab}
                    href={getTabUrl(tab)}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                      activeTab === tab ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-lg scale-105' : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <i className={`fa-solid ${tab === 'chat' ? 'fa-message' : tab === 'maths' ? 'fa-calculator' : tab === 'studio' ? 'fa-palette' : tab === 'vision' ? 'fa-camera' : tab === 'voice' ? 'fa-microphone-lines' : 'fa-life-ring'} text-[10px]`}></i>
                    <span className="hidden sm:inline">{tab === 'chat' ? t.reasoning : tab === 'maths' ? t.maths : tab === 'studio' ? t.creative : tab === 'vision' ? t.vision : tab === 'voice' ? t.voiceBeta : t.getHelp}</span>
                    <span className="sm:hidden uppercase">{tab.slice(0,3)}</span>
                  </a>
                ))}
            </div>
          </div>

          <button 
            onClick={handleClose} 
            className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center transition-all active:scale-90 border border-red-200 dark:border-red-900/30" 
            title="Exit"
          >
             <i className="fa-solid fa-right-from-bracket text-lg"></i>
          </button>
          
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-200 dark:bg-slate-800 overflow-hidden">
               <div className="h-full bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.8)] transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50 dark:bg-slate-950">
          <div className="min-h-full flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-reveal">
                <div className="w-24 h-24 rounded-[40px] glass-panel flex items-center justify-center text-slate-300 dark:text-slate-700 mb-10 border-slate-200 dark:border-white/10 shadow-xl">
                  <i className={`fa-solid ${activeTab === 'chat' ? 'fa-message' : activeTab === 'studio' ? 'fa-palette' : 'fa-camera'} text-4xl`}></i>
                </div>
                <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                   {currentSuggestions.map(p => (
                     <button key={p} onClick={() => handleSend(p)} className={`px-6 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-500 hover:text-cyan-600 transition-all shadow-md active:scale-95 ${lang === 'si' ? 'sinhala-text' : ''}`}>{p}</button>
                   ))}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full space-y-8 md:space-y-12 pb-44 p-6 md:p-12 animate-fade">
                {messages.map((msg) => (
                  <div key={msg.id} className={`w-full flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                    <div className={`max-w-[95%] p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-sm glass-panel border border-slate-200 dark:border-white/10 ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-sm' : 'rounded-tl-sm text-slate-800 dark:text-slate-200'}`}>
                      <div className={`text-base md:text-lg leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                      {msg.imageUrl && (
                        <div className="mt-8 flex flex-col gap-6">
                          <div className="rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-black/5">
                            <img src={msg.imageUrl} className="w-full h-auto" alt="Asset" />
                          </div>
                          <button onClick={() => handleDownloadImage(msg.imageUrl!)} className="flex items-center gap-3 px-8 py-4 bg-cyan-600 text-white hover:bg-cyan-500 transition-all rounded-[20px] text-[10px] font-black uppercase tracking-widest w-full sm:w-fit justify-center shadow-lg active:scale-95">
                            <i className="fa-solid fa-cloud-arrow-down text-lg"></i> {t.downloadAsset}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="w-full flex flex-col gap-2 animate-reveal items-start">
                    <div className="flex items-center gap-4 bg-white/80 dark:bg-white/5 px-8 py-4 rounded-full w-fit animate-pulse border border-slate-200 dark:border-white/5 shadow-md">
                      <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"></div>
                      <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">{stepLabel || t.calculating}</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </div>
        </div>

        {/* INPUT BAR - Mobile Optimized */}
        <div className="shrink-0 p-6 md:p-10 bg-gradient-to-t from-slate-100 dark:from-slate-950 via-slate-100/90 dark:via-slate-950/90 to-transparent absolute bottom-0 left-0 w-full z-[40]">
          <div className="max-w-4xl mx-auto">
            <div className="glass-panel p-2 md:p-4 rounded-[32px] md:rounded-[48px] shadow-2xl border border-slate-300 dark:border-white/10 flex items-center gap-3 backdrop-blur-3xl bg-white/90 dark:bg-slate-900/90 focus-within:ring-4 focus-within:ring-cyan-500/20">
              <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-90 shrink-0">
                 <i className="fa-solid fa-paperclip text-xl"></i>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const r = new FileReader();
                  r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
                  r.readAsDataURL(file);
                }
              }} />
              <input 
                ref={inputRef}
                value={localInput}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={activeTab === 'studio' ? t.placeholderStudio : t.inputPrompt}
                className={`flex-1 bg-transparent border-none focus:ring-0 text-base md:text-xl py-4 px-2 dark:text-white placeholder:text-slate-400 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`}
              />
              <button 
                 onClick={() => handleSend()} 
                 disabled={isTyping || (!localInput.trim() && !selectedFile && activeTab !== 'studio')} 
                 className="w-12 h-12 md:w-16 md:h-16 rounded-[24px] md:rounded-[36px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 shrink-0"
              >
                 <i className="fa-solid fa-paper-plane text-lg"></i>
              </button>
            </div>
            {selectedFile && (
              <div className="mt-4 flex items-center gap-3 px-4 py-2 bg-cyan-600/10 rounded-xl border border-cyan-600/20 w-fit animate-reveal">
                 <i className="fa-solid fa-file-code text-cyan-600"></i>
                 <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 truncate max-w-[200px]">{selectedFile.name}</span>
                 <button onClick={() => setSelectedFile(null)} className="text-red-500 hover:text-red-600 ml-2"><i className="fa-solid fa-circle-xmark"></i></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWorkspace;
