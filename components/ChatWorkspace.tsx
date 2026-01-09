
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { ChatMessage, Language, HardwareStatus, WorkspaceMode, Conversation } from '../types';
import { translations } from '../translations';
import VoiceAssistant from './VoiceAssistant';
import GetHelpMode from './GetHelpMode';
import MathsMode from './MathsMode';

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
}

const ITEMS_PER_PAGE = 12;

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ 
  onClose, hwStatus, initialPrompt, initialMode, autoSubmit, onInputChange, messages, setMessages, lang,
  conversations, onSwitchConv, onNewConv, onDeleteConv, activeConvId, onUpdateTitle
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<WorkspaceMode>(initialMode);
  const [isTyping, setIsTyping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [localInput, setLocalInput] = useState(initialPrompt);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(ITEMS_PER_PAGE);

  const [modesUsed, setModesUsed] = useState<Set<WorkspaceMode>>(new Set([initialMode]));

  const hasReachedLimit = geminiService.hasReachedLimit();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeTab !== 'voice' && activeTab !== 'gethelp' && activeTab !== 'maths') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialPrompt && initialPrompt !== localInput) {
      setLocalInput(initialPrompt);
    }
  }, [initialPrompt]);

  const handleInputChange = (val: string) => {
    setLocalInput(val);
    onInputChange(val);
  };

  const handleClose = useCallback(() => {
    if (localInput.trim() && !window.confirm(lang === 'si' ? "ඔබ ලියූ දේ මකා දැමීමට අවශ්‍යද?" : "Discard your current draft?")) {
      return;
    }
    onInputChange(''); 
    onClose();
  }, [onClose, onInputChange, localInput, lang]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startProgress = (mode: WorkspaceMode) => {
    setProgress(0);
    const steps = mode === 'studio' 
      ? [
          { threshold: 20, label: lang === 'si' ? "නිර්මාණය සූදානම් කරමින්..." : "Initializing synthesis..." },
          { threshold: 50, label: lang === 'si' ? "නියුරල් සිතියම් සකසමින්..." : "Mapping neural pathways..." },
          { threshold: 85, label: lang === 'si' ? "රූපය නිර්මාණය කරමින්..." : "Rendering creative asset..." }
        ]
      : [
          { threshold: 30, label: lang === 'si' ? "ප්‍රශ්නය විග්‍රහ කරමින්..." : "Analyzing prompt..." },
          { threshold: 60, label: lang === 'si' ? "තර්කනය සකසමින්..." : "Processing reasoning flow..." },
          { threshold: 90, label: lang === 'si' ? "පිළිතුර සකසමින්..." : "Finalizing response..." }
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

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput !== undefined ? overrideInput : localInput;
    if (!text.trim() && !selectedFile && activeTab !== 'studio') return;
    if (hasReachedLimit) return;

    const currentModes = new Set([...Array.from(modesUsed), activeTab]);
    setModesUsed(currentModes);

    setIsTyping(true);
    startProgress(activeTab);

    if (activeTab === 'studio') {
      try {
        const url = await geminiService.generateImagePro(text, "1:1", "1K");
        const studioMsg: ChatMessage = { id: Date.now().toString(), role: 'assistant', content: lang === 'si' ? "නිර්මාණය අවසන්." : "Synthesis complete.", imageUrl: url, timestamp: new Date(), type: 'image' };
        setMessages(prev => [...prev, studioMsg]);
        handleInputChange('');
        const title = await geminiService.generateTitle([studioMsg], Array.from(currentModes), lang);
        onUpdateTitle(title, Array.from(currentModes));
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
    handleInputChange('');

    try {
      const messageCount = messages.filter(m => m.role === 'user').length;
      const res = await geminiService.chat(text || "Explain.", { 
        fileData: selectedFile || undefined, 
        grounding: 'search',
        messageCount: messageCount,
        useThinking: activeTab === 'chat', 
        history: messages 
      });
      
      const assistantMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: res.text, 
        timestamp: new Date(), 
        type: 'text', 
        links: res.links,
        reasoning_details: res.reasoning_details 
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      if (messages.length < 4) {
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

  useEffect(() => {
    if (autoSubmit && initialPrompt && !hasReachedLimit && messages.length === 0 && activeTab === 'chat') {
      handleSend(initialPrompt);
    }
  }, []);

  const isSinhala = (text: string) => /[^\u0000-\u007F]/.test(text);

  const handleTabChange = (tab: WorkspaceMode) => {
    setActiveTab(tab);
    setModesUsed(prev => new Set([...Array.from(prev), tab]));
  };

  const currentSuggestions = useMemo(() => {
    const key = activeTab === 'chat' ? 'chat' : activeTab === 'maths' ? 'maths' : activeTab === 'studio' ? 'studio' : 'vision';
    return t.prompts[key as keyof typeof t.prompts] || [];
  }, [activeTab, t.prompts]);

  return (
    <div className="flex flex-row h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans transition-colors duration-500">
      
      {/* --- Ambient Backgrounds --- */}
      {/* Mobile Blob */}
      <div className="absolute top-[-20%] right-[-30%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none md:hidden"></div>
      
      {/* Desktop Ambient Glow - Top Right */}
      <div className="hidden md:block absolute top-[-10%] right-[10%] w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none animate-soft-pulse"></div>
      {/* Desktop Ambient Glow - Bottom Left */}
      <div className="hidden md:block absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none animate-soft-pulse" style={{animationDelay: '2s'}}></div>


      {/* Mobile History Backdrop */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] md:hidden animate-fade" onClick={() => setIsHistoryOpen(false)} />
      )}
      
      {/* Sidebar - Desktop & Mobile */}
      <div className={`fixed md:relative inset-y-0 left-0 z-[120] w-72 md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform duration-300 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full md:hidden'} flex flex-col shadow-2xl md:shadow-none`}>
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t.memoryHistory}</h3>
          <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-slate-400 p-2"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-4 space-y-2">
          <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
            <i className="fa-solid fa-plus text-[10px]"></i> {t.newNeuralChat}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 overscroll-contain">
          {conversations.slice(0, visibleHistoryCount).map(conv => (
            <div key={conv.id} className="group relative">
               <button onClick={() => { onSwitchConv(conv.id); setIsHistoryOpen(false); }} className={`w-full text-left p-4 rounded-2xl transition-all flex flex-col gap-1 border border-transparent ${activeConvId === conv.id ? 'bg-cyan-600/10 border-cyan-600/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`text-[11px] font-bold truncate max-w-[180px] ${activeConvId === conv.id ? 'text-cyan-600' : 'text-slate-700 dark:text-slate-300'} ${isSinhala(conv.title) ? 'sinhala-text' : ''}`}>
                    {conv.title}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400">{conv.timestamp.toLocaleDateString()}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDeleteConv(conv.id); }} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                <i className="fa-solid fa-trash-can text-[10px]"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-[50]">
        
        {/* Navigation / Tab Bar */}
        <div className="shrink-0 h-16 md:h-20 glass-panel p-2 md:px-6 flex items-center justify-between z-30 border-b border-slate-200 dark:border-white/5 shadow-sm relative">
          
          {/* Left: Mobile Menu & Breadcrumbs */}
          <div className="flex items-center gap-4">
             <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-cyan-600 transition-all md:hidden">
              <i className="fa-solid fa-bars"></i>
            </button>
          </div>

          {/* Center: Desktop Tabs (More Focused) */}
          <div className="flex-1 flex justify-center w-full overflow-hidden">
            <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar mask-gradient-x px-2">
                {(['chat', 'maths', 'studio', 'vision', 'voice', 'gethelp'] as WorkspaceMode[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 relative shrink-0 ${
                      activeTab === tab ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <i className={`fa-solid ${tab === 'chat' ? 'fa-message' : tab === 'maths' ? 'fa-calculator' : tab === 'studio' ? 'fa-palette' : tab === 'vision' ? 'fa-camera' : tab === 'voice' ? 'fa-microphone-lines' : 'fa-life-ring'} text-[9px]`}></i>
                    <span className="hidden md:inline">{tab === 'chat' ? t.reasoning : tab === 'maths' ? t.maths : tab === 'studio' ? t.creative : tab === 'vision' ? t.vision : tab === 'voice' ? t.voiceBeta : t.getHelp}</span>
                    <span className="md:hidden">{tab === 'chat' ? 'Chat' : tab === 'maths' ? 'Math' : tab === 'studio' ? 'Art' : tab === 'vision' ? 'Cam' : tab === 'voice' ? 'Mic' : 'Help'}</span>
                    {(tab === 'voice' || tab === 'gethelp' || tab === 'maths') && (
                      <span className="absolute -top-1 -right-1 px-1 bg-cyan-600 text-white text-[5px] font-black rounded-sm border border-white/20 scale-75 md:scale-100">BETA</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
          
          {/* Right: Home Action */}
          <div className="flex items-center">
            <button onClick={handleClose} className="w-10 h-10 rounded-xl hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors flex items-center justify-center" title="Close Workspace">
               <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>

          {/* Neural Progress Bar */}
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-200 dark:bg-slate-800 overflow-hidden">
               <div 
                 className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-500 ease-out"
                 style={{ width: `${progress}%` }}
               ></div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain relative">
          {activeTab === 'voice' ? (
            <VoiceAssistant inline onClose={() => handleTabChange('chat')} lang={lang} />
          ) : activeTab === 'gethelp' ? (
            <GetHelpMode onClose={() => handleTabChange('chat')} lang={lang} />
          ) : activeTab === 'maths' ? (
            <MathsMode onClose={() => handleTabChange('chat')} lang={lang} />
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center animate-reveal px-6 text-center">
              <div className="w-24 h-24 rounded-[36px] glass-panel flex items-center justify-center text-slate-400 dark:text-slate-600 mb-8 animate-soft-pulse border-slate-200 dark:border-white/10 shadow-xl">
                <i className={`fa-solid ${activeTab === 'chat' ? 'fa-message' : activeTab === 'studio' ? 'fa-palette' : 'fa-camera'} text-4xl`}></i>
              </div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-8">{activeTab === 'chat' ? t.reasoning : activeTab === 'studio' ? t.creative : t.vision}</p>
              <div className="flex flex-wrap justify-center gap-3 max-w-lg">
                 {currentSuggestions.map(p => (
                   <button key={p} onClick={() => handleInputChange(p)} className={`px-5 py-3 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl text-[11px] font-bold text-slate-500 hover:text-cyan-600 hover:border-cyan-500/30 transition-all shadow-sm ${lang === 'si' ? 'sinhala-text' : ''}`}>{p}</button>
                 ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 md:space-y-12 pb-40 p-4 md:p-8">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                  <div className={`max-w-[95%] md:max-w-[85%] p-5 md:p-8 rounded-[24px] md:rounded-[40px] shadow-sm glass-panel border border-slate-200 dark:border-white/10 ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-sm' : 'rounded-tl-sm text-slate-800 dark:text-slate-200'}`}>
                    <div className={`text-[14px] md:text-base leading-relaxed whitespace-pre-wrap ${isSinhala(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-black/5 dark:border-black/5 flex flex-wrap gap-2">
                        {msg.links.map((link, idx) => (
                          <a key={idx} href={link.uri} target="_blank" className="px-3 py-1.5 bg-black/5 dark:bg-black/10 rounded-xl text-[9px] font-bold flex items-center gap-2 hover:bg-cyan-600 hover:text-white transition-all"><i className="fa-solid fa-link"></i> {link.title}</a>
                        ))}
                      </div>
                    )}
                    {msg.imageUrl && (
                      <div className="mt-6 rounded-[20px] md:rounded-[32px] overflow-hidden border border-slate-200 dark:border-black/10 shadow-xl">
                        <img src={msg.imageUrl} className="w-full h-auto" alt="Asset" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex flex-col gap-2 animate-reveal">
                  <div className="flex items-center gap-3 bg-white/50 dark:bg-white/5 px-6 py-3 rounded-full w-fit animate-pulse border border-slate-200 dark:border-white/5">
                    <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce"></div>
                    <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">{stepLabel || t.calculating}</span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {activeTab !== 'voice' && activeTab !== 'gethelp' && activeTab !== 'maths' && (
          <div className="shrink-0 p-4 md:p-8 bg-gradient-to-t from-slate-100 dark:from-slate-950 via-slate-50/90 dark:via-slate-950/90 to-transparent">
            <div className="max-w-4xl mx-auto">
              {/* Premium Input Bar */}
              <div className="glass-panel p-2 md:p-3 rounded-[28px] md:rounded-[40px] shadow-2xl border border-slate-300 dark:border-white/10 flex items-center gap-3 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 transition-all focus-within:ring-4 focus-within:ring-cyan-500/10 focus-within:border-cyan-500/30">
                <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-90 tooltip-trigger">
                   <i className="fa-solid fa-paperclip text-lg"></i>
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
                  className={`flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-lg py-3 md:py-4 px-2 dark:text-white placeholder:text-slate-400 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`}
                />
                
                <button 
                   onClick={() => handleSend()} 
                   disabled={isTyping || (!localInput.trim() && !selectedFile && activeTab !== 'studio')} 
                   className="w-12 h-12 md:w-14 md:h-14 rounded-[20px] md:rounded-[32px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-lg hover:shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100"
                >
                   <i className="fa-solid fa-paper-plane text-sm md:text-lg"></i>
                </button>
              </div>
              <div className="text-center mt-3 hidden md:block">
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">Orin AI Neural Core v4.0 • Secure Transmission</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWorkspace;
