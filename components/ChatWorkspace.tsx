
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { geminiService, AppError } from '../services/geminiService';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const norm = Math.sqrt(na) * Math.sqrt(nb);
  return norm === 0 ? 0 : dot / norm;
}
import {
  buildMarkovModel,
  generateSuggestions,
  serializeMarkovModel,
  deserializeMarkovModel,
  isMarkovCacheValid,
  type MarkovModel,
} from '../services/markovService';
import { cacheService, CacheKey } from '../services/cacheService';
import { ChatMessage, Language, WorkspaceMode, Conversation } from '../types';
import { translations } from '../translations';
import MathsMode from './MathsMode';
import VoiceAssistant from './VoiceAssistant';
import LiveVisionMode from './LiveVisionMode';
import FeatureCreate from './FeatureCreate';
import { detectGraphIntent } from '../services/graphIntentService';

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
  thinkingMode: boolean;
  descriptiveMode: boolean;
  onReasoningModeChange: (opts: { thinking?: boolean; descriptive?: boolean }) => void;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ 
  onClose, initialPrompt, initialMode, autoSubmit, onInputChange, messages, setMessages, lang,
  conversations, onSwitchConv, onNewConv, onDeleteConv, activeConvId, onUpdateTitle, onModeSwitch, isSyncing = false,
  thinkingMode, descriptiveMode, onReasoningModeChange
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticOrder, setSemanticOrder] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);
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

  // Markov: ref-based model, rebuild only when user message count changes; cache in localStorage for instant load
  const MARKOV_MAX_MESSAGES = 150;
  const markovModelRef = useRef<MarkovModel | null>(null);
  const prevMarkovMessageCountRef = useRef(0);
  const recentSuggestionsRef = useRef<Set<string>>(new Set());
  const RECENT_SUGGESTIONS_MAX = 12;

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

    // Detect graph intent from any mode and route into Maths when needed.
    if (text.trim()) {
      const graphDef = detectGraphIntent(text, activeTab);
      if (graphDef) {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem('pendingGraphExpression', graphDef.expressionLatex || '');
          }
        } catch {
          // Ignore storage errors; graphing is a best-effort enhancement.
        }
        onModeSwitch?.('maths');
      }
    }
    
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
      const isChatMode = activeTab === 'chat';
      const res = await geminiService.chat(text || "Continue.", { 
        fileData: fileToUse || undefined, 
        useThinking: isChatMode ? thinkingMode : false,
        descriptive: isChatMode ? descriptiveMode : false,
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
      const appErr = e as AppError;
      if (appErr?.type === 'plan_required' || appErr?.type === 'limit_reached') {
        setChatError(null);
        setUpgradeModalMessage(appErr.type === 'plan_required'
          ? 'This feature requires a Basic or Pro plan.'
          : "You've reached your plan limit. Upgrade for more.");
        setShowUpgradeModal(true);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setChatError(msg || 'Something went wrong. Try again.');
        alert(msg || 'Something went wrong. Try again.');
      }
    } finally { 
       setIsTyping(false); 
       stopProgress(); 
       setSelectedFile(null);
    }
  }, [localInput, selectedFile, activeTab, isPrivate, messages, privateMessages, thinkingMode, descriptiveMode, onModeSwitch, lang, onUpdateTitle, setMessages, onInputChange]);

  useEffect(() => {
    if (activeTab !== 'chat' && activeTab !== 'translator') return;

    const byTime = [...conversations].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const texts: string[] = [];
    const timestamps: number[] = [];
    for (const c of byTime) {
      if (texts.length >= MARKOV_MAX_MESSAGES) break;
      for (const m of c.messages || []) {
        if (texts.length >= MARKOV_MAX_MESSAGES) break;
        if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
          texts.push(m.content.trim());
          timestamps.push(new Date(m.timestamp).getTime());
        }
      }
    }
    const currentCount = texts.length;

    if (currentCount !== prevMarkovMessageCountRef.current) {
      prevMarkovMessageCountRef.current = currentCount;
      const useCache = currentCount > 0;
      let loaded = false;
      if (useCache) {
        const cached = cacheService.get<unknown>(CacheKey.USER_MARKOV, null);
        const parsed = cached ? deserializeMarkovModel(cached) : null;
        const withBuiltAt = cached && typeof cached === 'object' && 'builtAt' in cached ? (cached as { builtAt: number }) : null;
        if (parsed && withBuiltAt && isMarkovCacheValid(withBuiltAt)) {
          markovModelRef.current = parsed;
          loaded = true;
        }
      }
      if (!loaded) {
        const model = buildMarkovModel(texts, { timestamps, mode: activeTab });
        markovModelRef.current = model;
        if (currentCount > 0) {
          try {
            cacheService.set(CacheKey.USER_MARKOV, serializeMarkovModel(model));
          } catch {
            // quota or private mode
          }
        }
      }
    }

    const model = markovModelRef.current;
    if (model) {
      const exclude = recentSuggestionsRef.current;
      const next = generateSuggestions(model, 3, exclude);
      setSuggestions(next);
      next.forEach(s => exclude.add(s));
      const arr = [...exclude];
      if (arr.length > RECENT_SUGGESTIONS_MAX) {
        recentSuggestionsRef.current = new Set(arr.slice(-RECENT_SUGGESTIONS_MAX));
      }
    } else {
      setSuggestions([]);
    }
  }, [activeTab, conversations]);

  // Semantic search: embed query and sort conversations by similarity.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSemanticOrder(null);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const [queryVec] = await geminiService.embedText([q]);
        if (!queryVec?.length) {
          setSemanticOrder(null);
          return;
        }
        const withEmbedding = conversations.filter((c): c is Conversation & { embedding: number[] } => Array.isArray(c.embedding) && c.embedding.length > 0);
        const scored = withEmbedding.map((c) => ({ id: c.id, score: cosineSimilarity(queryVec, c.embedding) }));
        scored.sort((a, b) => b.score - a.score);
        const order = scored.map((x) => x.id);
        const withoutEmbedding = conversations.filter((c) => !order.includes(c.id));
        setSemanticOrder([...order, ...withoutEmbedding.map((c) => c.id)]);
      } catch {
        setSemanticOrder(null);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, conversations]);

  // One-shot auto-submit when landing transitions into a workspace with an initial prompt.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!autoSubmit || autoSubmittedRef.current) return;
    if (!localInput.trim()) return;
    autoSubmittedRef.current = true;
    // Fire and forget; handleSend will clear input and propagate change upward.
    void handleSend(localInput);
  }, [autoSubmit, localInput, handleSend, activeTab]);

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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-20 md:p-10 relative bg-white/30 dark:bg-slate-950/60 backdrop-blur-xl border-t border-white/10 dark:border-white/5 pb-40 md:pb-48">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-10">
          {currentMessages.length === 0 ? (
            <div className="py-24 text-center space-y-6 min-h-[400px] flex flex-col justify-center">
               <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl mx-auto flex items-center justify-center border shadow-lg ${isPrivate ? 'bg-slate-900 text-white border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400'}`}>
                  <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-message'} text-2xl md:text-3xl`} />
               </div>
               <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{isPrivate ? 'Private Mode' : 'Orin Workspace'}</h2>
                  <p className="text-sm text-slate-500 mt-1">{isPrivate ? 'Messages are not saved.' : 'Ask anything below.'}</p>
               </div>
            </div>
          ) : (
            currentMessages.map((msg, i) => (
              <div key={msg.id || i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                 <div className={`max-w-[92%] p-5 md:p-6 rounded-2xl shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                  <div className={`whitespace-pre-wrap text-sm md:text-base leading-relaxed ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text' : ''}`}>{msg.content}</div>
                  {msg.links && msg.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-200/50 dark:border-white/10">
                      {msg.links.slice(0, 5).map((link, j) => (
                        <a
                          key={j}
                          href={link.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                        >
                          <span className="truncate max-w-[160px]">{link.title || link.uri}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" aria-hidden />
                        </a>
                      ))}
                    </div>
                  )}
                 </div>
              </div>
            ))
          )}
          {isTyping && <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 text-center">{stepLabel}</div>}
          <div ref={scrollRef} className="h-4" />
        </div>
      </div>
    );
  };

  return (
    <>
    {showUpgradeModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 animate-fade" onClick={() => setShowUpgradeModal(false)}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <i className="fa-solid fa-crown text-cyan-500 text-xl" aria-hidden />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Upgrade to continue</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{upgradeModalMessage}</p>
          <div className="flex gap-3">
            <a href="#pricing" onClick={(e) => { e.preventDefault(); setShowUpgradeModal(false); window.location.hash = '#pricing'; }} className="flex-1 py-3 px-4 rounded-xl bg-cyan-600 text-white text-center text-sm font-black uppercase tracking-wider hover:bg-cyan-500 transition-colors">
              View plans
            </a>
            <button onClick={() => setShowUpgradeModal(false)} className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="flex h-full w-full bg-transparent text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      
      {/* Sidebar Overlay */}
      {isHistoryOpen && <div className="fixed inset-0 bg-black/50 z-[140]" onClick={() => setIsHistoryOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-[150] w-72 md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 transition-transform flex flex-col ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex justify-between items-center shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">History</span>
            <button onClick={() => setIsHistoryOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="p-3 space-y-2 shrink-0">
            <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest">+ New Chat</button>
            <button onClick={() => { togglePrivate(); setIsHistoryOpen(false); }} className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border ${isPrivate ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}>
               {isPrivate ? 'Turn Off Private' : 'Private Mode'}
            </button>
        </div>
        <div className="px-2 pb-2 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by meaning..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none"
              aria-label="Semantic search conversations"
            />
            {isSearching && <p className="text-[9px] text-slate-400 mt-1">Searching...</p>}
            {searchQuery.trim() && semanticOrder && !isSearching && <p className="text-[9px] text-cyan-600 dark:text-cyan-400 mt-1">Sorted by relevance</p>}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 p-2">
            {(semanticOrder ? semanticOrder.map((id) => conversations.find((c) => c.id === id)).filter(Boolean) as Conversation[] : [...conversations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())).map(c => (
                <div key={c.id} className={`group relative mb-1.5 rounded-xl ${activeConvId === c.id ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <button 
                        onClick={() => { onSwitchConv(c.id); setIsHistoryOpen(false); }} 
                        className={`w-full text-left p-3 pr-9 text-xs font-bold truncate ${activeConvId === c.id ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`}
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
        <header className="h-14 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 z-[60] bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
          <button onClick={() => setIsHistoryOpen(true)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center" aria-label="History"><i className="fa-solid fa-bars" /></button>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePrivate}
              title={isPrivate ? 'Private — messages not saved (tap to turn off)' : 'Public (tap for Private)'}
              aria-label={isPrivate ? 'Turn off private' : 'Private mode'}
              className={`p-2 md:px-3 md:py-2 rounded-xl border flex items-center gap-2 transition-all ${isPrivate ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/60 shadow-md' : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}
            >
              <i className={`fa-solid ${isPrivate ? 'fa-user-secret' : 'fa-eye'}`} />
              <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">{isPrivate ? 'Private · Not saved' : 'Public'}</span>
            </button>
          </div>
        </header>

        {renderBody()}

        {/* Input Bar - Hide when in studio/video/maths mode */}
        {activeTab !== 'studio' && activeTab !== 'vision' && activeTab !== 'voice' && activeTab !== 'maths' && (
          <div className="fixed bottom-0 left-0 right-0 w-full p-2 md:p-8 pointer-events-none z-[100] safe-pb mb-0">
               <div className="max-w-3xl mx-auto pointer-events-auto relative">
                  {isPrivate && (
                    <div className="absolute -top-12 left-0 right-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold uppercase tracking-wider">
                      <i className="fa-solid fa-lock" aria-hidden />
                      <span>Private chat — messages are not saved</span>
                    </div>
                  )}
                  {chatError && (
                    <div className={`absolute left-0 right-0 flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-red-500/15 dark:bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium animate-reveal ${isPrivate ? '-top-24' : '-top-14'}`}>
                      <span>{chatError}</span>
                      <button type="button" onClick={() => setChatError(null)} className="shrink-0 p-1 rounded hover:bg-red-500/20" aria-label="Dismiss"><i className="fa-solid fa-xmark" /></button>
                    </div>
                  )}
                  {/* Markov Chain Suggestions */}
                  {!localInput && currentMessages.length === 0 && !isPrivate && (
                     <div className="absolute -top-10 left-0 right-0 flex justify-center gap-2 overflow-x-auto no-scrollbar pb-2 px-2">
                        {suggestions.map((s, i) => (
                           <button 
                             key={i} 
                             type="button"
                             onClick={() => { setLocalInput(s); onInputChange(s); inputRef.current?.focus(); }}
                             className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-bold text-slate-500 hover:text-cyan-600 whitespace-nowrap"
                           >
                             {s}
                           </button>
                        ))}
                     </div>
                  )}

                  <div className={`glass-panel p-2 rounded-2xl shadow-lg border flex flex-wrap items-center gap-2 backdrop-blur-xl ${isPrivate ? 'bg-slate-900/70 border-slate-600/50' : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-white/10'}`}>
                     <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400" aria-label="Attach file or image"><i className="fa-solid fa-paperclip" /></button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.txt,application/pdf,text/plain" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB for PDFs/documents
                       const isDoc = file.type === 'application/pdf' || file.type === 'text/plain' || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.txt');
                       if (isDoc && file.size > MAX_DOCUMENT_BYTES) {
                         setChatError('File too large. PDFs and documents must be under 20MB.');
                         e.target.value = '';
                         return;
                       }
                       setChatError(null);
                       const r = new FileReader();
                       r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'), name: file.name });
                       r.readAsDataURL(file);
                       e.target.value = '';
                     }} />
                     {selectedFile && (
                       <span className="flex items-center gap-1.5 shrink-0 max-w-[140px] md:max-w-[200px] px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-[10px] font-bold truncate" title={selectedFile.name}>
                         <i className="fa-solid fa-file-lines text-cyan-500 shrink-0" />
                         <span className="truncate">{selectedFile.name}</span>
                         <button type="button" onClick={() => setSelectedFile(null)} className="shrink-0 p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-600" aria-label="Remove file"><i className="fa-solid fa-xmark text-[8px]" /></button>
                       </span>
                     )}
                     <input 
                      ref={inputRef} 
                      value={localInput} 
                      onChange={e => { setLocalInput(e.target.value); onInputChange(e.target.value); }} 
                      onKeyDown={e => e.key === 'Enter' && !isTyping && handleSend()}
                      placeholder={isPrivate ? "Private (not saved)..." : "Ask Orin AI..."}
                      className={`flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 focus:outline-none text-base py-2.5 px-2 font-medium ${isPrivate ? 'text-white placeholder:text-slate-500' : 'text-slate-900 dark:text-white placeholder:text-slate-400'}`} 
                     />
                     {/* Thinking & Descriptive in input bar (chat only), visible on all screen sizes */}
                     {activeTab === 'chat' && (
                       <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                         <button
                           type="button"
                           onClick={() => onReasoningModeChange({ thinking: !thinkingMode })}
                           title="Deeper reasoning"
                           className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-colors ${
                             thinkingMode
                               ? 'bg-cyan-600 text-white border-cyan-600'
                               : 'bg-transparent text-slate-400 border-slate-300/50 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20'
                           }`}
                         >
                           Thinking
                         </button>
                         <button
                           type="button"
                           onClick={() => onReasoningModeChange({ descriptive: !descriptiveMode })}
                           title="More detailed answers"
                           className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-colors ${
                             descriptiveMode
                               ? 'bg-cyan-600 text-white border-cyan-600'
                               : 'bg-transparent text-slate-400 border-slate-300/50 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20'
                           }`}
                         >
                           Descriptive
                         </button>
                       </div>
                     )}
                     <button
                       onClick={() => handleSend()}
                       disabled={isTyping}
                       className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-950 disabled:opacity-50"
                       aria-label="Send"
                     >
                       {isTyping ? <i className="fa-solid fa-circle-notch fa-spin text-sm" /> : <i className="fa-solid fa-arrow-up text-sm" />}
                     </button>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2 select-none" aria-hidden>{contextTime} Sri Lanka · Orin AI</p>
               </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ChatWorkspace;
