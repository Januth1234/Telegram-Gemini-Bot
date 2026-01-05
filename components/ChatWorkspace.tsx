
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
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
  onUpdateTitle: (title: string) => void;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ 
  onClose, initialPrompt, initialMode, autoSubmit, onInputChange, messages, setMessages, lang,
  conversations, onSwitchConv, onNewConv, onDeleteConv, activeConvId, onUpdateTitle
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<WorkspaceMode>(initialMode);
  const [isTyping, setIsTyping] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [localInput, setLocalInput] = useState(initialPrompt);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPrompt && !localInput) setLocalInput(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (autoSubmit && initialPrompt && messages.length === 0) {
      handleSend(initialPrompt);
    }
  }, []);

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput !== undefined ? overrideInput : localInput;
    if (!text.trim() && activeTab !== 'studio') return;

    if (activeTab === 'studio') {
      setIsTyping(true);
      try {
        const url = await geminiService.generateImagePro(text, "1:1", "1K");
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: lang === 'si' ? "නිර්මාණය අවසන්." : "Synthesis complete.", 
          imageUrl: url, 
          timestamp: new Date(), 
          type: 'image' 
        }]);
        setLocalInput('');
        onInputChange('');
      } catch (e: any) {
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: `Studio error: ${e.message}`, 
          timestamp: new Date(), 
          type: 'text' 
        }]);
      } finally { setIsTyping(false); }
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date(), type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setLocalInput('');
    onInputChange('');

    try {
      const res = await geminiService.chat(text);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: res.text, 
        timestamp: new Date(), 
        type: 'text' 
      }]);
      
      if (messages.length < 2) {
        const title = await geminiService.generateTitle([...messages, userMsg]);
        onUpdateTitle(title);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: `Neural Error: ${e.message}`, 
        timestamp: new Date(), 
        type: 'text' 
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [localInput, activeTab, setMessages, lang, messages, onUpdateTitle, onInputChange]);

  const isSinhala = (text: string) => /[^\u0000-\u007F]/.test(text);

  return (
    <div className="flex h-[100dvh] bg-white dark:bg-slate-950 overflow-hidden relative">
      {/* Mobile History Drawer */}
      <div className={`fixed inset-y-0 left-0 z-[150] w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transform transition-transform duration-300 md:translate-x-0 ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.memoryHistory}</h3>
            <button onClick={() => setIsHistoryOpen(false)} className="md:hidden text-slate-400"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="p-4">
            <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <i className="fa-solid fa-plus"></i> {t.newNeuralChat}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
            {conversations.map(conv => (
              <button 
                key={conv.id}
                onClick={() => { onSwitchConv(conv.id); setIsHistoryOpen(false); }}
                className={`w-full text-left p-4 rounded-2xl transition-all ${activeConvId === conv.id ? 'bg-cyan-500/10 text-cyan-600' : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                <p className="text-[11px] font-black truncate">{conv.title}</p>
                <p className="text-[8px] opacity-40 uppercase mt-1">{conv.timestamp.toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 md:ml-0">
        <header className="h-16 md:h-20 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0 z-40">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsHistoryOpen(true)} className="md:hidden w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center"><i className="fa-solid fa-bars-staggered"></i></button>
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
              {(['chat', 'studio', 'vision'] as WorkspaceMode[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {tab === 'chat' ? t.reasoning : tab === 'studio' ? t.creative : t.vision}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-500 transition-all"><i className="fa-solid fa-house"></i></button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-8 overscroll-contain custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
               <div className="w-20 h-20 rounded-[32px] border-2 border-dashed border-slate-300 dark:border-white/10 flex items-center justify-center text-3xl mb-6">
                <i className={`fa-solid ${activeTab === 'chat' ? 'fa-message' : activeTab === 'studio' ? 'fa-palette' : 'fa-camera'}`}></i>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-center">{t.howHelp}</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-10 pb-32">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade`}>
                  <div className={`max-w-[85%] md:max-w-[70%] p-5 md:p-7 rounded-[32px] ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none shadow-xl' : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border border-black/5 dark:border-white/5'}`}>
                    <p className={`text-sm md:text-lg leading-relaxed ${isSinhala(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</p>
                    {msg.imageUrl && (
                      <div className="mt-5 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                        <img src={msg.imageUrl} className="w-full h-auto object-contain" alt="Generated" />
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] font-black uppercase opacity-40 mt-3 px-3 tracking-widest">{msg.role === 'user' ? t.sent : t.analyst}</span>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 p-5 bg-slate-100 dark:bg-slate-900 rounded-[24px] w-fit animate-pulse border border-black/5 dark:border-white/5">
                  <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </main>

        <div className="p-4 md:p-8 shrink-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 z-40">
          <div className="max-w-4xl mx-auto flex items-center gap-3 bg-slate-100 dark:bg-white/5 p-2 rounded-[28px] md:rounded-[36px] shadow-inner focus-within:ring-2 ring-cyan-500/50 transition-all border border-transparent">
            <input 
              ref={inputRef}
              value={localInput}
              onChange={e => setLocalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={t.inputPrompt}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-xl py-4 px-6 dark:text-white"
            />
            <button onClick={() => handleSend()} className="w-14 h-14 md:w-20 md:h-20 rounded-[22px] md:rounded-[28px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
              <i className="fa-solid fa-paper-plane text-xl"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWorkspace;
