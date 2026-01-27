
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';

// --- TYPES & INTERFACES ---

interface GetHelpModeProps {
  onClose: () => void;
  lang: Language;
  embedded?: boolean;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isTyping: boolean;
}

type DevPersona = 'debugger' | 'architect' | 'refactor' | 'explainer' | 'security';

interface PersonaDef {
  id: DevPersona;
  label: string;
  icon: string;
  systemPrompt: string;
  color: string;
}

const PERSONAS: PersonaDef[] = [
  {
    id: 'debugger',
    label: 'Debug & Fix',
    icon: 'fa-bug',
    color: 'text-red-500',
    systemPrompt: "You are a Senior Debugging Engineer. Analyze the provided code/error strictly. Identify the root cause, explain it briefly, and provide the corrected code block. Focus on logic errors, syntax issues, and race conditions."
  },
  {
    id: 'architect',
    label: 'System Architect',
    icon: 'fa-sitemap',
    color: 'text-purple-500',
    systemPrompt: "You are a Software Architect. Design scalable, maintainable systems. Focus on patterns, data flow, security, and performance. Provide high-level structural advice and folder structures."
  },
  {
    id: 'refactor',
    label: 'Refactor & Clean',
    icon: 'fa-broom',
    color: 'text-emerald-500',
    systemPrompt: "You are a Code Quality Expert. Refactor the provided code for readability, performance, and modern best practices (DRY, SOLID). Do not change functionality unless asked."
  },
  {
    id: 'explainer',
    label: 'Code Explain',
    icon: 'fa-book-open',
    color: 'text-blue-500',
    systemPrompt: "You are a CS Professor. Explain the provided code or concept in simple, educational terms. Use analogies. Break down complex logic step-by-step."
  },
  {
    id: 'security',
    label: 'SecOps Audit',
    icon: 'fa-shield-halved',
    color: 'text-orange-500',
    systemPrompt: "You are a Security Auditor. Analyze code for vulnerabilities (XSS, Injection, Auth flaws). Suggest security hardening patches."
  }
];

// --- HOOK: LOGIC CONTROLLER ---

const useDevConsole = (messages: ChatMessage[], onSendParent: (text: string) => void) => {
  const [activePersona, setActivePersona] = useState<DevPersona>('debugger');
  const [contextCode, setContextCode] = useState("");
  const [showContext, setShowContext] = useState(true);

  const handleSend = (input: string) => {
    // Construct a rich prompt with context and persona instructions
    const persona = PERSONAS.find(p => p.id === activePersona)!;
    
    let finalPrompt = `[ROLE: ${persona.label}]\n${persona.systemPrompt}\n\n`;
    
    if (contextCode.trim()) {
      finalPrompt += `[CONTEXT/CODEBASE]:\n\`\`\`\n${contextCode}\n\`\`\`\n\n`;
    }
    
    finalPrompt += `[USER REQUEST]: ${input}`;
    
    // We send the 'finalPrompt' logic to the parent handler, 
    // but visually we might want to just show the user's input.
    // However, the parent App.tsx handles the message display based on what we pass.
    // To keep the UI clean, we might need to handle the display locally or accept that the prompt is long.
    // For this specific app structure, we'll send the raw input to onSend, 
    // and pre-pend the system instruction context in the `geminiService` or here.
    
    // Since we can't easily change the system instruction per message in the global chat without affecting history,
    // we will wrap the user prompt.
    onSendParent(finalPrompt);
  };

  return {
    activePersona,
    setActivePersona,
    contextCode,
    setContextCode,
    showContext,
    setShowContext,
    handleSend
  };
};

// --- COMPONENTS ---

const PersonaSelector: React.FC<{ 
  active: DevPersona; 
  onSelect: (p: DevPersona) => void; 
}> = ({ active, onSelect }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
    {PERSONAS.map(p => (
      <button
        key={p.id}
        onClick={() => onSelect(p.id)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
          active === p.id 
            ? `bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md` 
            : 'bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-300'
        }`}
      >
        <i className={`fa-solid ${p.icon} ${active === p.id ? 'text-inherit' : p.color}`}></i>
        {p.label}
      </button>
    ))}
  </div>
);

const CodeContextPanel: React.FC<{
  code: string;
  onChange: (val: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ code, onChange, isOpen, onToggle }) => (
  <div className={`border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'h-48 md:h-64' : 'h-10'}`}>
    <div 
      className="flex items-center justify-between px-4 h-10 shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        <i className="fa-solid fa-code"></i>
        <span>Context / Code Snippet</span>
        {code.trim() && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
      </div>
      <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? '' : 'rotate-180'} text-xs text-slate-400`}></i>
    </div>
    
    {isOpen && (
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        placeholder="// Paste relevant code, error logs, or JSON data here..."
        className="flex-1 w-full p-4 bg-transparent resize-none outline-none font-mono text-xs text-slate-800 dark:text-slate-300 leading-relaxed custom-scrollbar placeholder:text-slate-400/50"
        spellCheck={false}
      />
    )}
  </div>
);

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  // Simple syntax highlighting heuristic for code blocks
  const content = msg.content;
  const isUser = msg.role === 'user';
  
  // Clean up the prompt if it contains our injected tags
  const displayContent = isUser 
    ? content.replace(/\[ROLE:.*?\]\n.*?\n\n/s, '').replace(/\[CONTEXT\/CODEBASE\]:.*?\[USER REQUEST\]: /s, '') 
    : content;

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-6 group`}>
       <div className={`max-w-[95%] md:max-w-4xl relative ${isUser ? 'pl-12' : 'pr-12'}`}>
          {!isUser && (
            <div className="absolute -left-2 top-0 w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <i className="fa-solid fa-robot"></i>
            </div>
          )}
          
          <div className={`p-4 md:p-6 rounded-2xl text-sm md:text-base whitespace-pre-wrap font-medium leading-relaxed shadow-sm border ${
            isUser 
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent rounded-tr-sm' 
              : 'bg-white dark:bg-[#1e1e1e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 rounded-tl-sm font-mono'
          }`}>
             {displayContent}
          </div>
          
          <div className={`text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-600 mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
             {msg.timestamp.toLocaleTimeString()}
          </div>
       </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang, embedded, messages, onSend, isTyping }) => {
  const t = translations[lang];
  const { 
    activePersona, setActivePersona, 
    contextCode, setContextCode, 
    showContext, setShowContext, 
    handleSend 
  } = useDevConsole(messages, onSend);
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const onSubmit = () => {
    if (!input.trim()) return;
    handleSend(input);
    setInput("");
  };

  return (
    <div className={`flex flex-col h-full bg-slate-100 dark:bg-[#0d1117] ${!embedded && 'fixed inset-0 z-[120] animate-reveal'}`}>
      
      {/* Header */}
      <header className="h-14 shrink-0 bg-white dark:bg-[#161b22] border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <i className="fa-solid fa-life-ring"></i>
          </div>
          <div>
             <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Developer Console</h1>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Orin Debug Engine v2.0</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Messages Scroll Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 scroll-smooth">
           {messages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center opacity-60 space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-slate-200 dark:bg-white/5 flex items-center justify-center text-slate-400">
                   <i className="fa-solid fa-terminal text-4xl"></i>
                </div>
                <div className="text-center space-y-2">
                   <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Ready to Debug</h3>
                   <p className="text-xs font-medium text-slate-500 max-w-xs">Select a persona, paste your context, and describe the issue.</p>
                </div>
             </div>
           ) : (
             <div className="max-w-4xl mx-auto">
               {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
               {isTyping && (
                 <div className="flex items-center gap-3 pl-14 opacity-50">
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-150"></div>
                 </div>
               )}
             </div>
           )}
        </div>

        {/* Floating Persona Bar (if messages exist) */}
        <div className="absolute top-4 left-0 right-0 px-4 md:px-8 pointer-events-none">
           <div className="max-w-4xl mx-auto flex justify-end">
              <div className="pointer-events-auto bg-white/90 dark:bg-[#161b22]/90 backdrop-blur border border-slate-200 dark:border-white/10 p-1.5 rounded-xl shadow-sm">
                 <PersonaSelector active={activePersona} onSelect={setActivePersona} />
              </div>
           </div>
        </div>

        {/* Input & Context Section */}
        <div className="shrink-0 bg-white dark:bg-[#161b22] border-t border-slate-200 dark:border-white/10 z-30">
           
           <CodeContextPanel 
             code={contextCode} 
             onChange={setContextCode} 
             isOpen={showContext} 
             onToggle={() => setShowContext(!showContext)} 
           />

           <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">
              <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 rounded-2xl p-2 shadow-inner focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                 <textarea
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       onSubmit();
                     }
                   }}
                   placeholder={`Ask the ${PERSONAS.find(p => p.id === activePersona)?.label} something...`}
                   className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none outline-none text-sm font-medium text-slate-800 dark:text-slate-200 resize-none p-2 custom-scrollbar placeholder:text-slate-400"
                 />
                 <div className="flex items-center gap-2 pb-1 pr-1">
                    <button 
                      onClick={() => setInput("")} 
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ${!input && 'opacity-0 pointer-events-none'}`}
                    >
                       <i className="fa-solid fa-eraser"></i>
                    </button>
                    <button 
                      onClick={onSubmit}
                      disabled={!input.trim() || isTyping}
                      className="h-8 px-4 bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-orange-500 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                    >
                      {isTyping ? <i className="fa-solid fa-circle-notch animate-spin"></i> : 'RUN'}
                    </button>
                 </div>
              </div>
              <div className="flex justify-between items-center mt-2 px-2">
                 <span className="text-[9px] font-bold text-slate-400">
                    <i className="fa-brands fa-markdown mr-1"></i> Markdown Supported
                 </span>
                 <span className="text-[9px] font-bold text-slate-400">
                    {input.length} chars
                 </span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default GetHelpMode;
