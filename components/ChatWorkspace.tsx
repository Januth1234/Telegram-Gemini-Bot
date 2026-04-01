
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

// ─── Message renderer: markdown + inline URLs as pill buttons ──────────────
const URL_RE = /https?:\/\/[^\s)"'<>\]]+/g;

function renderInline(text: string, isUser: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0].replace(/[.,;:!?)]$/, '');
    const label = (() => {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0,30); }
    })();
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 mx-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors no-underline
          ${isUser
            ? 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
            : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-800/40'
          }`}>
        <i className="fa-solid fa-link text-[8px]" />
        {label}
        <i className="fa-solid fa-arrow-up-right-from-square text-[8px]" />
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parseLine(line: string, isUser: boolean, key: number): React.ReactNode {
  // Bold **text**
  const segments: React.ReactNode[] = [];
  const boldRe = /\*\*(.*?)\*\*/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = boldRe.exec(line)) !== null) {
    if (m.index > last) segments.push(...renderInline(line.slice(last, m.index), isUser));
    segments.push(<strong key={m.index}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < line.length) segments.push(...renderInline(line.slice(last), isUser));
  return <React.Fragment key={key}>{segments}</React.Fragment>;
}

const MessageContent: React.FC<{ content: string; isUser: boolean }> = ({ content, isUser }) => {
  const hasSinhala = /[\u0D80-\u0DFF]/.test(content);
  const hasTamil   = /[\u0B80-\u0BFF]/.test(content);
  const langClass  = hasSinhala ? 'sinhala-text' : hasTamil ? 'tamil-text' : '';

  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    if (/^#{1,3} /.test(line)) {
      const lvl = (line.match(/^#+/) || [''])[0].length;
      const txt = line.replace(/^#+\s*/, '');
      const cls = lvl === 1 ? 'text-base font-black mt-4 mb-1 text-indigo-600 dark:text-indigo-400' 
                : lvl === 2 ? 'text-sm font-black mt-3 mb-1 text-slate-600 dark:text-slate-400' 
                : 'text-xs font-black mt-2 mb-0.5 uppercase tracking-wider text-slate-500';
      nodes.push(<p key={i} className={cls}>{renderInline(txt, isUser)}</p>);
    }
    // ALL-CAPS section headers like "PART (A) FINDING THE ANGLE"
    else if (/^[A-Z][A-Z\s\(\)]+[A-Z]$/.test(line.trim()) && line.trim().length > 4) {
      nodes.push(
        <div key={i} className="mt-3 mb-1 pb-1 border-b border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">{line.trim()}</span>
        </div>
      );
    }
    // Bullet
    else if (/^[\-\*•] /.test(line)) {
      const txt = line.replace(/^[\-\*•]\s*/, '');
      nodes.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0 opacity-50"/>
          <span>{parseLine(txt, isUser, i)}</span>
        </div>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const num = (line.match(/^(\d+)/) || ['',''])[1];
      const txt = line.replace(/^\d+\.\s*/, '');
      const isFinalAnswer = /^final answer/i.test(txt);
      nodes.push(
        <div key={i} className={`flex gap-2 my-0.5 ${isFinalAnswer ? 'mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800' : ''}`}>
          {isFinalAnswer ? (
            <div className="w-full flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg px-3 py-2">
              <i className="fa-solid fa-check-circle text-indigo-500 text-xs shrink-0" />
              <span className="font-black text-indigo-700 dark:text-indigo-300 text-sm font-mono">{txt.replace(/^final answer[:\s]*/i,'')}</span>
            </div>
          ) : (
            <>
              <span className="shrink-0 font-black text-indigo-400 dark:text-indigo-600 text-xs mt-1 min-w-[1.4rem] text-right tabular-nums">{num}.</span>
              <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{parseLine(txt, isUser, i)}</span>
            </>
          )}
        </div>
      );
    }
    // Inline code or code block
    else if (line.trimStart().startsWith('```')) {
      const lang = line.replace(/```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={`code-${i}`} className="my-2 p-3 rounded-xl bg-slate-900 text-green-400 dark:bg-black/60 text-xs overflow-x-auto font-mono leading-relaxed">
          {lang && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">{lang}</div>}
          {codeLines.join('\n')}
        </pre>
      );
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-2 border-current opacity-10" />);
    }
    // Empty line
    else if (!line.trim()) {
      if (nodes.length > 0) nodes.push(<div key={i} className="h-1.5" />);
    }
    // Normal paragraph line
    else {
      nodes.push(<p key={i} className="leading-relaxed">{parseLine(line, isUser, i)}</p>);
    }
    i++;
  }

  return (
    <div className={`text-sm md:text-base space-y-0.5 ${langClass}`}>
      {nodes}
    </div>
  );
};


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
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryPopup, setSummaryPopup] = useState<string | null>(null);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);

  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [localInput, setLocalInput] = useState(initialPrompt);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [urlContextInput, setUrlContextInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [deepResearchActive, setDeepResearchActive] = useState(false);
  const [deepResearchResult, setDeepResearchResult] = useState('');
  const [codeExecMode, setCodeExecMode] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticOrder, setSemanticOrder] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);
  const [contextTime, setContextTime] = useState(() =>
    new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
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

  const handleGenerateSummary = async () => {
    if (summaryLoading || messages.length < 2) return;
    setSummaryLoading(true);
    try {
      const transcript = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-30) // last 30 msgs
        .map(m => `${m.role === 'user' ? 'User' : 'Orin'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
        .join('\n');
      const result = await geminiService.chat(
        `Summarize this conversation in 5–8 bullet points. Be concise. Focus only on what was discussed and decided. Skip greetings and filler.\n\nCONVERSATION:\n${transcript}`,
        { isPrivate: true }
      );
      const text = typeof result === 'string' ? result : result?.text || 'No summary generated.';
      setSummaryPopup(text);
    } catch (e: any) {
      setSummaryPopup('Could not generate summary: ' + (e?.message || 'Unknown error'));
    } finally {
      setSummaryLoading(false);
    }
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
            // Store expression if we have one; store flag so MathsMode opens graphs tab
            window.sessionStorage.setItem('pendingGraphExpression', graphDef.expressionLatex || '');
            if (!graphDef.expressionLatex) {
              // No expression extracted — tell MathsMode to just open the graphs tab
              window.sessionStorage.setItem('openGraphsTab', '1');
            }
          }
        } catch {}
        onModeSwitch?.('maths');
        return;
      }
    }
    
    // Handle URL context if URL input is shown
    if (showUrlInput && urlContextInput.trim()) {
      const today = new Date().toDateString();
      const urlKey = `orin_url_used_${today}`;
      const used = parseInt(localStorage.getItem(urlKey) || '0', 10);
      const cachedUser = JSON.parse(localStorage.getItem('orin_user') || '{}');
      const plan = (cachedUser?.plan || 'free').toLowerCase();
      const limit = plan === 'pro' || plan === 'pro_yearly' ? 10 : plan.includes('basic') ? 3 : 1;
      if (used >= limit) {
        setChatError(`URL context limit (${limit}/day) reached. Upgrade for more.`);
        return;
      }
      localStorage.setItem(urlKey, String(used + 1));
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
      let resText = '';
      let resLinks: any[] = [];

      // ── URL Context mode ────────────────────────────────────────────────
      if (showUrlInput && urlContextInput.trim()) {
        const urlRes = await geminiService.fetchUrlContext({
          url: urlContextInput.trim(),
          question: text || 'Summarise this page',
          history: isPrivate ? privateMessages : messages,
        });
        resText = urlRes.text;
        if (urlRes.urlSource) resLinks = [{ title: urlRes.urlSource, uri: urlContextInput.trim() }];
        setShowUrlInput(false);
        setUrlContextInput('');
      }
      // ── Code Execution mode ─────────────────────────────────────────────
      else if (codeExecMode) {
        const codeRes = await geminiService.executeCode({
          prompt: text || '',
          history: isPrivate ? privateMessages : messages,
        });
        resText = [
          codeRes.text,
          codeRes.code ? `\`\`\`python\n${codeRes.code}\n\`\`\`` : '',
          codeRes.output ? `**Output:**\n\`\`\`\n${codeRes.output}\n\`\`\`` : '',
        ].filter(Boolean).join('\n\n');
      }
      // ── Deep Research mode ─────────────────────────────────────────────
      else if (deepResearchActive) {
        const today = new Date().toISOString().slice(0, 7); // YYYY-MM
        const drKey = `orin_deep_research_${today}`;
        const cachedUser = JSON.parse(localStorage.getItem('orin_user') || '{}');
        const plan = (cachedUser?.plan || 'free').toLowerCase();
        const drLimit = plan === 'pro' || plan === 'pro_yearly' ? 10 : plan.includes('basic') ? 3 : 1;
        const drUsed = parseInt(localStorage.getItem(drKey) || '0', 10);
        if (drUsed >= drLimit) {
          throw new Error(`Deep Research limit (${drLimit}/month) reached. Upgrade for more.`);
        }
        let accumulated = '';
        await geminiService.deepResearch({
          prompt: text || '',
          onChunk: (chunk) => { accumulated += chunk; },
          onDone: (full) => { resText = full; },
          signal: abortControllerRef.current?.signal,
        });
        if (!resText) resText = accumulated;
        localStorage.setItem(drKey, String(drUsed + 1));
        setDeepResearchActive(false);
      }
      // ── Standard chat ──────────────────────────────────────────────────
      else {
        const res = await geminiService.chat(text || "Continue.", {
          fileData: fileToUse || undefined,
          useThinking: isChatMode ? thinkingMode : false,
          descriptive: isChatMode ? descriptiveMode : false,
          history: isPrivate ? privateMessages : messages,
          signal: abortControllerRef.current.signal,
          isPrivate: isPrivate,
        });
        resText = res.text;
        resLinks = res.links || [];
      }

      const botMsg: ChatMessage = { 
         id: (Date.now() + 1).toString(), 
         role: 'assistant', 
         content: resText, 
         timestamp: new Date(), 
         type: 'text', 
         links: resLinks 
      };

      if (isPrivate) {
         setPrivateMessages(prev => [...prev, botMsg]);
      } else {
        setMessages(prev => [...prev, botMsg]);
        // Only generate a title once, when the conversation is empty (first user+bot turn).
        if (messages.length === 0) {
          const title = await geminiService.generateTitle([userMsg, botMsg], [activeTab], lang);
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
        if (msg && (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED'))) {
          // Firestore permission issue — non-fatal, still try to chat
          setChatError(null);
        } else if (msg && (msg.includes('API Key') || msg.includes('API_KEY') || msg.includes('api key'))) {
          setChatError('AI service not configured. Contact support.');
        } else if (msg && (msg.includes('quota') || msg.includes('QUOTA'))) {
          setChatError('Rate limit reached. Try again in a moment.');
        } else {
          setChatError(msg || 'Something went wrong. Try again.');
        }
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
        const withEmbedding = conversations.filter(
          (c): c is Conversation & { embedding: number[] } =>
            Array.isArray(c.embedding) && c.embedding.length > 0
        );
        if (!withEmbedding.length) {
          // No embeddings available yet; fall back to default ordering.
          setSemanticOrder(null);
          return;
        }
        const scored = withEmbedding.map((c) => ({
          id: c.id,
          score: cosineSimilarity(queryVec, c.embedding),
        }));
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

  // Keep a stable ref to handleSend so auto-submit logic isn't sensitive to callback identity changes.
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // One-shot auto-submit when landing transitions into a workspace with an initial prompt.
  const autoSubmittedRef = useRef(false);
  // Reset auto-submit flag when switching conversations so a new initialPrompt can fire again.
  useEffect(() => {
    autoSubmittedRef.current = false;
  }, [activeConvId, initialPrompt]);
  useEffect(() => {
    if (!autoSubmit || autoSubmittedRef.current) return;
    if (!localInput.trim()) return;
    autoSubmittedRef.current = true;
    // Fire and forget; handleSend will clear input and propagate change upward.
    void handleSendRef.current(localInput);
  }, [autoSubmit, localInput, activeTab]);

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
    const update = () => setContextTime(new Date().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }));
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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-20 md:p-10 relative bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-white/5 pb-40 md:pb-48">
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
                  <MessageContent content={msg.content} isUser={msg.role === 'user'} />
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
          {isTyping && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <span className="typing-dot w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block" />
                <span className="typing-dot w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block" />
                <span className="typing-dot w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block" />
                {stepLabel && <span className="ml-2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{stepLabel}</span>}
              </div>
            </div>
          )}
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
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <i className="fa-solid fa-crown text-cyan-500 text-xl" aria-hidden />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Upgrade to continue</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{upgradeModalMessage}</p>
          <div className="flex gap-3">
          <button type="button" onClick={() => { setShowUpgradeModal(false); window.location.hash = 'pricing'; }} className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white text-center text-sm font-black uppercase tracking-wider hover:bg-indigo-500 transition-colors">
              View plans
            </button>
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
            <button onClick={() => { onNewConv(); setIsHistoryOpen(false); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shadow-sm">+ New Chat</button>
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
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
              aria-label="Semantic search conversations"
            />
            {isSearching && <p className="text-[9px] text-slate-400 mt-1">Searching...</p>}
            {searchQuery.trim() && semanticOrder && !isSearching && <p className="text-[9px] text-indigo-600 dark:text-indigo-400 mt-1">Sorted by relevance</p>}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 p-2">
            {(semanticOrder ? semanticOrder.map((id) => conversations.find((c) => c.id === id)).filter(Boolean) as Conversation[] : [...conversations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())).map(c => (
                <div key={c.id} className={`group relative mb-1.5 rounded-xl ${activeConvId === c.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <button 
                        onClick={() => { onSwitchConv(c.id); setIsHistoryOpen(false); }} 
                        className={`w-full text-left p-3 pr-9 text-xs font-bold flex items-center gap-1.5 min-w-0 ${activeConvId === c.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                    >
                        <span className="truncate min-w-0">{c.title}</span>
                        {(c.thinkingMode || c.descriptiveMode) && (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] opacity-70" title={[c.thinkingMode && 'Thinking mode', c.descriptiveMode && 'Descriptive mode'].filter(Boolean).join(' · ')}>
                            {c.thinkingMode && <i className="fa-solid fa-brain" />}
                            {c.descriptiveMode && <i className="fa-solid fa-align-left" />}
                          </span>
                        )}
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
        <header className="h-14 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 z-[60] bg-white dark:bg-slate-950 relative">
          <button onClick={() => setIsHistoryOpen(true)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center" aria-label="History"><i className="fa-solid fa-bars" /></button>
          <div className="flex items-center gap-2">
            {/* Generate Summary — visible only when there are messages */}
            {messages.length >= 2 && (
              <button
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                title="Generate a summary of this chat"
                className="p-2 md:px-3 md:py-2 rounded-xl border bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 flex items-center gap-2 transition-all hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50"
              >
                {summaryLoading
                  ? <i className="fa-solid fa-circle-notch animate-spin text-sm" />
                  : <i className="fa-solid fa-list-check text-sm" />}
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Summary</span>
              </button>
            )}
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
          {progress > 0 && (
            <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-slate-200/40 dark:bg-slate-800/80 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
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
                             className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-bold text-slate-500 hover:text-indigo-600 whitespace-nowrap"
                           >
                             {s}
                           </button>
                        ))}
                     </div>
                  )}

                  {/* URL Context input row */}
                {showUrlInput && (
                  <div className="flex gap-2 px-1 pb-2">
                    <input
                      type="url"
                      placeholder="Paste URL to fetch context from… (1/day free)"
                      value={urlContextInput}
                      onChange={e => setUrlContextInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-indigo-200 dark:border-indigo-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button onClick={() => setShowUrlInput(false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  </div>
                )}
                {deepResearchActive && (
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                      <i className="fa-solid fa-microscope text-xs" />
                      Deep Research mode — sends a comprehensive research request (1/month free)
                    </div>
                    <button onClick={() => setDeepResearchActive(false)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center shrink-0 text-xs">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                )}
                <div className={`p-2 rounded-2xl shadow-lg border flex flex-wrap items-center gap-2 ${isPrivate ? 'bg-slate-900 border-slate-600/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10'}`}>
                     <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400" aria-label="Attach file or image"><i className="fa-solid fa-paperclip" /></button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.txt,application/pdf,text/plain" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB for PDFs/documents
                       const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10MB for images to avoid freezing the tab
                       const lowerName = file.name.toLowerCase();
                       const isDoc = file.type === 'application/pdf' || file.type === 'text/plain' || lowerName.endsWith('.pdf') || lowerName.endsWith('.txt');
                       const isImage = file.type.startsWith('image/');
                       if (isDoc && file.size > MAX_DOCUMENT_BYTES) {
                         setChatError('File too large. PDFs and documents must be under 20MB.');
                         e.target.value = '';
                         return;
                       }
                       if (isImage && file.size > MAX_IMAGE_BYTES) {
                         setChatError('Image too large. Please upload an image under 10MB.');
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
                               ? 'bg-indigo-600 text-white border-cyan-600'
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
                               ? 'bg-indigo-600 text-white border-cyan-600'
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
                       className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors shadow-sm"
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

      {/* Summary Popup */}
      {summaryPopup && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSummaryPopup(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-list-check text-indigo-500" />Chat Summary
              </h3>
              <button onClick={() => setSummaryPopup(null)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500">
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {summaryPopup}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(summaryPopup || ''); }}
              className="mt-4 w-full py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5">
              <i className="fa-solid fa-copy text-[9px]" />Copy Summary
            </button>
          </div>
        </div>
      )}
    </>
  );
};
export default ChatWorkspace;
