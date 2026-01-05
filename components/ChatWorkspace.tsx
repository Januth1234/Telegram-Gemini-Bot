
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { ChatMessage, Language, HardwareStatus, WorkspaceMode, Conversation } from '../types';
import { translations } from '../translations';
import VoiceAssistant from './VoiceAssistant';

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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [localInput, setLocalInput] = useState(initialPrompt);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(ITEMS_PER_PAGE);

  // Track modes used in the current conversation
  const [modesUsed, setModesUsed] = useState<Set<WorkspaceMode>>(new Set([initialMode]));

  const hasReachedLimit = geminiService.hasReachedLimit();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus input on load and tab change
  useEffect(() => {
    if (activeTab !== 'voice') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  // Sync internal input with global prompt for continuity
  useEffect(() => {
    if (initialPrompt && initialPrompt !== localInput) {
      setLocalInput(initialPrompt);
    }
  }, [initialPrompt]);

  const handleInputChange = (val: string) => {
    setLocalInput(val);
    onInputChange(val); // Sync to storage via App component
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

  useEffect(() => {
    if (autoSubmit && initialPrompt && !hasReachedLimit && messages.length === 0 && activeTab === 'chat') {
      handleSend(initialPrompt);
    }
  }, []);

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput !== undefined ? overrideInput : localInput;
    if (!text.trim() && !selectedFile && activeTab !== 'studio') return;
    if (hasReachedLimit) return;

    // Track active mode for complexity titling
    const currentModes = new Set([...Array.from(modesUsed), activeTab]);
    setModesUsed(currentModes);

    if (activeTab === 'studio') {
      setIsTyping(true);
      try {
        const url = await geminiService.generateImagePro(text, "1:1", "1K");
        const studioMsg: ChatMessage = { id: Date.now().toString(), role: 'assistant', content: lang === 'si' ? "නිර්මාණය අවසන්." : "Synthesis complete.", imageUrl: url, timestamp: new Date(), type: 'image' };
        setMessages(prev => [...prev, studioMsg]);
        handleInputChange('');
        
        // Always attempt to refresh title if complexity changes or its the first message
        const title = await geminiService.generateTitle([studioMsg], Array.from(currentModes));
        onUpdateTitle(title, Array.from(currentModes));
      } catch (e: any) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
      } finally { setIsTyping(false); }
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text || "", timestamp: new Date(), type: 'text', fileName: selectedFile?.name };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    handleInputChange('');

    try {
      const res = await geminiService.chat(text || "Explain.", { fileData: selectedFile || undefined, grounding: 'search' });
      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text, timestamp: new Date(), type: 'text', links: res.links };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Update title with more context
      if (messages.length < 4) {
        const title = await geminiService.generateTitle([...messages, userMsg, assistantMsg], Array.from(currentModes));
        onUpdateTitle(title, Array.from(currentModes));
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date(), type: 'text' }]);
    } finally {
      setIsTyping(false);
      setSelectedFile(null);
    }
  }, [localInput, selectedFile, activeTab, hasReachedLimit, onInputChange, setMessages, lang, messages, onUpdateTitle, modesUsed]);

  const isSinhala = (text: string) => /[^\u0000-\u007F]/.test(text);

  const handleTabChange = (tab: WorkspaceMode) => {
    setActiveTab(tab);
    setModesUsed(prev => new Set([...Array.from(prev), tab]));
  };

  return (
    <div className="flex flex-row h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative">
      {/* Sidebar - Mobile Drawer with Overlay */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45] md:hidden" 
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      <div className={`fixed md:relative inset-y-0 left-0 z-50 w-64 md:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform duration-300 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full md:hidden'} flex flex-col shadow-2xl md:shadow-none`}>
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">{t.memoryHistory}</h3>
          <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-slate-400 p-2"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-4 space-y-2">
          <button 
            onClick={() => { onNewConv(); setIsHistoryOpen(false); }}
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-plus text-[10px]"></i> {t.newNeuralChat}
          </button>
          
          {/* Internal close button for mobile History sidebar */}
          <button 
            onClick={() => setIsHistoryOpen(false)}
            className="md:hidden w-full py-2 border border-slate-200 dark:border-white/10 rounded-xl text-[8px] font-black text-slate-400 uppercase tracking-widest"
          >
            Close History
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 overscroll-contain">
          {conversations.slice(0, visibleHistoryCount).map(conv => (
            <div key={conv.id} className="group relative">
               <button 
                onClick={() => { onSwitchConv(conv.id); setIsHistoryOpen(false); }}
                className={`w-full text-left p-3.5 rounded-2xl transition-all flex flex-col gap-0.5 border border-transparent ${activeConvId === conv.id ? 'bg-cyan-600/10 border-cyan-600/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className={`text-[10px] font-black truncate max-w-[160px] ${activeConvId === conv.id ? 'text-cyan-600' : 'text-slate-700 dark:text-slate-300'}`}>
                    {conv.title}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                    {conv.timestamp.toLocaleDateString()}
                  </span>
                  {conv.modesUsed && conv.modesUsed.length > 1 && (
                    <span className="text-[6px] px-1 bg-cyan-600/10 text-cyan-600 rounded-sm font-black uppercase">Multi-Mode</span>
                  )}
                </div>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteConv(conv.id); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                <i className="fa-solid fa-trash-can text-[9px]"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="shrink-0 h-16 md:h-20 glass-panel p-3 md:p-4 flex items-center justify-between z-30 border-b border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <button 
              onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-cyan-600 transition-all"
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
            </button>
            <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar py-1">
              {(['chat', 'studio', 'vision', 'voice'] as WorkspaceMode[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 relative ${
                    activeTab === tab ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <i className={`fa-solid ${tab === 'chat' ? 'fa-message' : tab === 'studio' ? 'fa-palette' : tab === 'vision' ? 'fa-camera' : 'fa-microphone-lines'} text-[8px] md:text-[9px]`}></i>
                  <span>{tab === 'chat' ? t.reasoning : tab === 'studio' ? t.creative : tab === 'vision' ? t.vision : t.voice}</span>
                  {tab === 'voice' && (
                    <span className="absolute -top-1 -right-1 px-1 bg-cyan-600 text-white text-[5px] font-black rounded-sm border border-white/20 scale-75 md:scale-100">BETA</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="w-9 h-9 md:w-10 md:h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 ml-2 transition-colors"><i className="fa-solid fa-house"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain relative">
          {activeTab === 'voice' ? (
            <div className="h-full">
              <VoiceAssistant inline onClose={() => handleTabChange('chat')} lang={lang} />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center animate-reveal px-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] glass-panel flex items-center justify-center text-slate-400 dark:text-slate-600 mb-6 md:mb-8 animate-soft-pulse border-slate-200 dark:border-white/10">
                <i className={`fa-solid ${activeTab === 'chat' ? 'fa-message' : activeTab === 'studio' ? 'fa-palette' : 'fa-camera'} text-3xl md:text-4xl`}></i>
              </div>
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-8">{activeTab === 'chat' ? t.reasoning : activeTab === 'studio' ? t.creative : t.vision}</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                 {t.prompts[activeTab === 'chat' ? 'chat' : activeTab === 'studio' ? 'studio' : 'vision' as keyof typeof t.prompts]?.map(p => (
                   <button key={p} onClick={() => { handleInputChange(p); }} className="px-3 py-1.5 bg-slate-200/50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-lg text-[9px] font-bold text-slate-500 hover:text-cyan-600 transition-all">{p}</button>
                 ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-32 p-4 md:p-8">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                  <div className={`max-w-[95%] md:max-w-[90%] p-5 md:p-8 rounded-[24px] md:rounded-[40px] shadow-sm glass-panel border border-slate-200 dark:border-white/10 ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'rounded-tl-none text-slate-800 dark:text-slate-200'}`}>
                    {msg.role === 'assistant' && isSinhala(msg.content) && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-black/5 dark:border-white/5">
                        <div className="w-0.5 h-3 bg-cyan-600 rounded-full"></div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-cyan-600">{lang === 'si' ? 'සිංහල' : 'Sinhala'}</span>
                      </div>
                    )}
                    <p className={`text-[13px] md:text-base leading-relaxed ${isSinhala(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</p>
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex flex-wrap gap-2">
                        {msg.links.map((link, idx) => (
                          <a key={idx} href={link.uri} target="_blank" className="px-2 py-1 bg-black/5 dark:bg-white/5 rounded-lg text-[8px] font-bold flex items-center gap-1.5 hover:bg-cyan-600 hover:text-white transition-all"><i className="fa-solid fa-link text-[7px]"></i> {link.title}</a>
                        ))}
                      </div>
                    )}
                    {msg.imageUrl && (
                      <div className="mt-4 md:mt-6 rounded-2xl md:rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/20 shadow-xl bg-black/5">
                        <img src={msg.imageUrl} className="w-full h-auto object-contain" alt="Asset" />
                      </div>
                    )}
                  </div>
                  <span className="text-[7px] font-black text-slate-500 mt-1.5 uppercase tracking-widest px-2">{msg.role === 'user' ? t.sent : t.analyst} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
              {isTyping && <div className="flex items-center gap-3 bg-slate-200/50 dark:bg-white/5 px-6 py-3 rounded-full w-fit border border-slate-200 dark:border-white/5 animate-pulse"><div className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce"></div><span className="text-[8px] font-black uppercase tracking-widest text-cyan-600">{t.calculating}</span></div>}
              <div ref={scrollRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Dynamic Input Bar - Only for Chat, Studio, Vision */}
        {activeTab !== 'voice' && (
          <div className="shrink-0 p-4 md:p-10 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/90 dark:via-slate-950/90 to-transparent z-40">
            <div className="max-w-4xl mx-auto">
              <div className="glass-panel p-1.5 md:p-2 rounded-[24px] md:rounded-[40px] shadow-2xl border border-slate-300 dark:border-white/10 flex items-center gap-1 md:gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"><i className="fa-solid fa-paperclip text-base md:text-lg"></i></button>
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
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] md:text-lg py-3 md:py-5 px-1 md:px-3 text-slate-900 dark:text-white font-medium"
                />
                <button onClick={() => handleSend()} disabled={isTyping || (!localInput.trim() && !selectedFile && activeTab !== 'studio')} className="w-11 h-11 md:w-16 md:h-16 rounded-xl md:rounded-[24px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-20"><i className="fa-solid fa-paper-plane text-base md:text-lg"></i></button>
              </div>
              {selectedFile && (
                <div className="mt-3 flex items-center justify-between px-4 py-2.5 bg-cyan-600/10 border border-cyan-600/20 rounded-xl animate-reveal">
                   <span className="text-[9px] font-black text-cyan-600 uppercase truncate max-w-[200px]">{selectedFile.name}</span>
                   <button onClick={() => setSelectedFile(null)} className="text-red-500 text-[8px] font-black uppercase hover:underline">Remove</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWorkspace;
