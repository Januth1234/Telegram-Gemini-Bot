
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { ChatMessage, Language, HardwareStatus, WorkspaceMode, Conversation } from '../types';
import { translations } from '../translations';
import MathsMode from './MathsMode';
import GetHelpMode from './GetHelpMode';
import VoiceAssistant from './VoiceAssistant';
import LiveVisionMode from './LiveVisionMode';

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
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [localInput, setLocalInput] = useState(initialPrompt);

  // Pagination for History
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialPrompt !== undefined) setLocalInput(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab !== 'voice' && activeTab !== 'maths' && activeTab !== 'vision') {
        inputRef.current?.focus();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, activeConvId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleModeChange = (mode: WorkspaceMode) => {
    setActiveTab(mode);
    if (onModeSwitch) onModeSwitch(mode);
  };

  const handleClose = useCallback(() => {
    if ((localInput.trim() || selectedFile) && !window.confirm(lang === 'si' ? "ඔබ ලියූ දේ මකා දැමීමට අවශ්‍යද?" : "Discard your draft?")) {
      return;
    }
    onInputChange('');
    onClose();
  }, [onClose, onInputChange, localInput, selectedFile, lang]);

  const startProgress = (mode: WorkspaceMode) => {
    setProgress(0);
    const steps = mode === 'studio' 
      ? [{ threshold: 20, label: lang === 'si' ? "සූදානම්..." : "Wait..." }, { threshold: 50, label: lang === 'si' ? "අඳිමින්..." : "Drawing..." }, { threshold: 85, label: lang === 'si' ? "අවසන් කරමින්..." : "Finishing..." }]
      : [{ threshold: 30, label: lang === 'si' ? "බලමින්..." : "Reading..." }, { threshold: 60, label: lang === 'si' ? "සිතමින්..." : "Thinking..." }, { threshold: 90, label: lang === 'si' ? "ලියමින්..." : "Writing..." }];
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
    const fileToUse = overrideFile !== undefined ? overrideFile : selectedFile;
    
    if (!text.trim() && !fileToUse && activeTab !== 'studio') return;
    if (geminiService.hasReachedLimit()) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsTyping(true);
    startProgress(activeTab);
    setLocalInput('');
    onInputChange('');
    setSelectedFile(null); // Clear immediately for UI

    if (activeTab === 'studio') {
      try {
        const url = await geminiService.generateImagePro(text, "1:1", "1K", signal);
        const studioMsg: ChatMessage = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: lang === 'si' ? "ඔබේ පින්තූරය සූදානම්." : "Your picture is ready.", 
          imageUrl: url, 
          timestamp: new Date(), 
          type: 'image' 
        };
        setMessages(prev => [...prev, studioMsg]);
        const title = await geminiService.generateTitle([studioMsg], [activeTab], lang);
        onUpdateTitle(title, [activeTab]);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
      } finally { setIsTyping(false); stopProgress(); }
      return;
    }

    // CREATE USER MESSAGE WITH IMAGE DATA IF PRESENT
    const userMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'user', 
        content: text || "", 
        timestamp: new Date(), 
        type: fileToUse ? 'image' : 'text',
        imageUrl: fileToUse ? `data:${fileToUse.mimeType};base64,${fileToUse.data}` : undefined,
        fileName: fileToUse?.name 
    };

    const currentHistory = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await geminiService.chat(text || "Continue.", { 
        fileData: fileToUse || undefined, 
        grounding: 'search', 
        messageCount: currentHistory.filter(m => m.role === 'user').length,
        useThinking: true, 
        history: messages, 
        signal 
      });
      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text, timestamp: new Date(), type: 'text', links: res.links };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Update title if it's the start or occasionally
      if (messages.length < 2 || messages.length % 6 === 0) {
        const title = await geminiService.generateTitle([...messages, userMsg, assistantMsg], [activeTab], lang);
        onUpdateTitle(title, [activeTab]);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
    } finally { setIsTyping(false); stopProgress(); }
  }, [localInput, selectedFile, activeTab, onInputChange, setMessages, lang, messages, onUpdateTitle]);

  const getTabIcon = (tab: WorkspaceMode) => {
    switch(tab) {
      case 'studio': return 'fa-palette';
      case 'vision': return 'fa-camera';
      case 'maths': return 'fa-calculator';
      case 'gethelp': return 'fa-wand-sparkles';
      case 'voice': return 'fa-microphone-lines';
      default: return 'fa-message';
    }
  };

  const getHistoryIcon = (modes: WorkspaceMode[] | undefined, defaultMode: WorkspaceMode) => {
      const m = (modes && modes.length > 0) ? modes[modes.length - 1] : defaultMode;
      return getTabIcon(m);
  };

  const isBETA = (m: WorkspaceMode) => m === 'maths' || m === 'gethelp' || m === 'voice' || m === 'vision';

  // Pagination Logic
  const visibleConversations = conversations.slice(0, historyPage * ITEMS_PER_PAGE);
  const hasMoreHistory = visibleConversations.length < conversations.length;

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(lang === 'si' ? "මෙම සංවාදය මකා දැමීමට අවශ්‍යද?" : "Delete this conversation history?")) {
        onDeleteConv(id);
    }
  };

  const renderBody = () => {
    if (activeTab === 'voice') return <div className="flex-1 overflow-hidden"><VoiceAssistant onClose={handleClose} lang={lang} inline /></div>;
    if (activeTab === 'maths') return <div className="flex-1 flex flex-col overflow-hidden"><MathsMode onClose={handleClose} lang={lang} embedded messages={messages} onSend={handleSend} isTyping={isTyping} /></div>;
    if (activeTab === 'gethelp') return <div className="flex-1 flex flex-col overflow-hidden"><GetHelpMode onClose={handleClose} lang={lang} embedded messages={messages} onSend={handleSend} isTyping={isTyping} /></div>;
    if (activeTab === 'vision') return <div className="flex-1 overflow-hidden"><LiveVisionMode onClose={handleClose} lang={lang} /></div>;

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-10 relative bg-slate-50/30 dark:bg-slate-950/30 pb-48">
        <div className="max-w-3xl mx-auto space-y-10">
          {messages.length === 0 ? (
            <div className="py-24 text-center space-y-8 animate-reveal min-h-[500px] flex flex-col justify-center">
               <div className="w-20 h-20 md:w-24 md:h-24 rounded-[32px] bg-white dark:bg-slate-900 mx-auto flex items-center justify-center text-slate-200 dark:text-slate-800 border border-slate-100 dark:border-white/5 shadow-xl">
                  <i className={`fa-solid ${getTabIcon(activeTab)} text-5xl`}></i>
               </div>
               <div className="space-y-4">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ready to {activeTab === 'studio' ? 'Create' : activeTab === 'vision' ? 'Camera' : 'Chat'}</h2>
                  <div className="flex flex-wrap justify-center gap-2 px-4">
                     {(activeTab === 'studio' ? t.prompts.studio : activeTab === 'vision' ? t.prompts.vision : t.prompts.chat).map(s => (
                        <button key={s} onClick={() => handleSend(s)} className="px-5 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-cyan-600 hover:border-cyan-500/50 transition-all shadow-sm active:scale-95">{s}</button>
                     ))}
                  </div>
               </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                 <div className={`max-w-[92%] md:max-w-[85%] p-5 md:p-8 rounded-[24px] md:rounded-[32px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none border-transparent' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                    
                    {/* Render Image if exists */}
                    {msg.imageUrl && (
                      <div className="mb-4">
                         <div className="rounded-[20px] overflow-hidden border-2 border-white/10 shadow-lg bg-black/10 group max-w-sm">
                            <img src={msg.imageUrl} className="w-full h-auto object-cover" alt="Content" />
                         </div>
                         {msg.role === 'assistant' && (
                            <button onClick={() => geminiService.downloadImage(msg.imageUrl!)} className="mt-3 w-full py-3 bg-cyan-600/10 hover:bg-cyan-600 text-cyan-600 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Save Image</button>
                         )}
                      </div>
                    )}

                    <div className={`text-sm md:text-lg leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                    
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-2">
                         {msg.links.map((link, idx) => (
                           <a key={idx} href={link.uri} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-[10px] font-bold text-cyan-600 truncate border border-black/5 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-all">
                              <i className="fa-solid fa-link mr-2 opacity-50"></i> {link.title}
                           </a>
                         ))}
                      </div>
                    )}
                 </div>
                 <div className="mt-2 px-4 flex items-center gap-2 opacity-30 text-[8px] font-black uppercase tracking-widest">
                    <span>{msg.role === 'user' ? 'Sent' : 'Done'}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                 </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 w-fit shadow-sm">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => <div key={delay} className="w-1 h-1 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>)}
              </div>
              <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">{stepLabel || "Thinking..."}</span>
            </div>
          )}
          <div ref={scrollRef} className="h-4" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      
      {/* History Sidebar Backdrop */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[140] animate-fade" 
          onClick={() => setIsHistoryOpen(false)} 
        />
      )}

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[150] w-[85%] sm:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform duration-500 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl`}>
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">History</h3>
          <button onClick={() => setIsHistoryOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-4">
          <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {visibleConversations.map(conv => (
            <div 
              key={conv.id}
              onClick={() => { onSwitchConv(conv.id); setIsHistoryOpen(false); }} 
              className={`w-full text-left p-4 rounded-2xl transition-all border group relative cursor-pointer ${activeConvId === conv.id ? 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-500/20 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
            >
              <div className="flex items-start gap-3">
                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${activeConvId === conv.id ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                    <i className={`fa-solid ${getHistoryIcon(conv.modesUsed, conv.mode)}`}></i>
                 </div>
                 <div className="flex-1 min-w-0 pr-6">
                    <span className={`text-xs font-black uppercase truncate block ${activeConvId === conv.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>{conv.title}</span>
                    <p className="text-[10px] text-slate-400 truncate mt-1">{conv.messages[conv.messages.length - 1]?.content || "Empty"}</p>
                 </div>
              </div>
              
              {/* Delete Button */}
              <button 
                onClick={(e) => handleDeleteClick(e, conv.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Delete Conversation"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          ))}
          
          {hasMoreHistory && (
             <button 
               onClick={() => setHistoryPage(prev => prev + 1)}
               className="w-full py-4 mt-2 text-[9px] font-bold text-slate-400 hover:text-cyan-600 border border-dashed border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all uppercase tracking-widest"
             >
               Load Older Conversations
             </button>
          )}
          
          {conversations.length === 0 && (
             <div className="text-center py-20 opacity-40">
                <i className="fa-solid fa-box-open text-3xl mb-4 text-slate-300"></i>
                <p className="text-[9px] font-black uppercase tracking-widest">No History</p>
             </div>
          )}
        </div>
        {/* Sync Status in Sidebar Footer */}
        {isSyncing && (
           <div className="p-4 border-t border-slate-100 dark:border-white/5 text-center">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing with Cloud...</span>
           </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 md:h-20 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 md:px-10 z-[60] bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl">
          <div className="flex items-center gap-2 md:gap-4 flex-1 overflow-hidden">
            <button onClick={() => setIsHistoryOpen(true)} className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-cyan-600 transition-all"><i className="fa-solid fa-bars-staggered"></i></button>
            <nav className="flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl p-1 gap-1 overflow-x-auto no-scrollbar scroll-smooth">
              {(['chat', 'maths', 'studio', 'vision', 'gethelp', 'voice'] as WorkspaceMode[]).map(m => (
                <button 
                  key={m} 
                  onClick={() => handleModeChange(m)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl transition-all whitespace-nowrap relative ${activeTab === m ? 'bg-white dark:bg-slate-800 shadow-sm text-cyan-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                  <i className={`fa-solid ${getTabIcon(m)} text-xs md:text-sm`}></i>
                  <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                    {m === 'chat' ? 'Chat' : m === 'maths' ? 'Math' : m === 'studio' ? 'Create' : m === 'vision' ? 'Camera' : m === 'gethelp' ? 'Help' : 'Voice'}
                  </span>
                  {isBETA(m) && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                       <span className="animate-beta-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 ml-2">
             {isTyping && <button onClick={() => { abortControllerRef.current?.abort(); setIsTyping(false); stopProgress(); }} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-stop"></i></button>}
             <button onClick={handleClose} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-red-500 transition-all border border-slate-200 dark:border-white/10 shadow-sm"><i className="fa-solid fa-right-from-bracket rotate-180"></i></button>
          </div>
          {progress > 0 && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-100 dark:bg-slate-900"><div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }}></div></div>}
        </header>

        {renderBody()}

        {/* Optimized input bar layout for Mobile Safe Area */}
        {activeTab !== 'maths' && activeTab !== 'voice' && activeTab !== 'vision' && (
          <div className="fixed bottom-0 left-0 right-0 w-full p-4 md:p-8 pointer-events-none z-[100] bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/80 dark:via-slate-950/80 to-transparent safe-pb">
             <div className="max-w-3xl mx-auto pointer-events-auto">
                {/* File Preview in Input Bar */}
                {selectedFile && (
                  <div className="mb-2 mx-2 p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-black/5 dark:border-white/10 shadow-lg flex items-center gap-4 animate-slide-in-up">
                     <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="w-12 h-12 rounded-xl object-cover border border-black/5" alt="Preview" />
                     <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-900 dark:text-white truncate">{selectedFile.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Ready to send</p>
                     </div>
                     <button onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                )}

                <div className="glass-panel p-2 rounded-[28px] md:rounded-[32px] shadow-2xl border border-slate-300 dark:border-white/10 flex items-center gap-1 backdrop-blur-3xl bg-white/95 dark:bg-slate-900/95 relative">
                   <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 md:w-14 md:h-14 shrink-0 rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"><i className="fa-solid fa-paperclip text-base"></i></button>
                   <input 
                    ref={inputRef} 
                    value={localInput} 
                    onChange={e => { setLocalInput(e.target.value); onInputChange(e.target.value); }} 
                    onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
                    placeholder={activeTab === 'studio' ? t.placeholderStudio : activeTab === 'vision' ? t.placeholderVision : activeTab === 'gethelp' ? "How can I help you today?" : t.placeholderChat} 
                    className={`flex-1 bg-transparent border-none focus:ring-0 text-base py-3 px-2 dark:text-white placeholder:text-slate-400 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`} 
                   />
                   <button onClick={() => handleSend()} disabled={isTyping || (!localInput.trim() && !selectedFile && activeTab !== 'studio')} className="w-10 h-10 md:w-14 md:h-14 shrink-0 rounded-[18px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-20"><i className="fa-solid fa-arrow-up text-base"></i></button>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const r = new FileReader();
                        r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
                        r.readAsDataURL(file);
                      }
                      e.target.value = ''; // Reset input to allow re-selection
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
