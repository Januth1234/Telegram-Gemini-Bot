
import React, { useState, useEffect, useRef } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { ChatMessage } from '../types';

interface ChatPreviewProps {
  initialPrompt: string;
  onClose: () => void;
}

const ChatPreview: React.FC<ChatPreviewProps> = ({ initialPrompt, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages, isTyping]);

  useEffect(() => {
    if (initialPrompt) {
      handleSend(initialPrompt);
    }
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Pass the thinking configuration as part of the options object
      const response = await geminiService.chat(text, { useThinking: true }); // Always use thinking for preview
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        links: response.links,
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${e.message}`,
        timestamp: new Date(),
        type: 'text'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[75vh] flex flex-col bg-white dark:bg-slate-800 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
      {/* Chat Header */}
      <div className="px-8 py-5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between glass sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
            <i className="fa-solid fa-robot"></i>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">Reasoning Cycle</h3>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Aura Intelligence Protocol</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-xmark text-slate-400"></i>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-[28px] p-6 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800'
            }`}>
              <div className={`text-sm leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(msg.content) ? 'sinhala-text text-base' : ''}`}>
                {msg.content}
              </div>
              {msg.links && msg.links.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200/50 space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Knowledge Map</span>
                  {msg.links.map((link, i) => (
                    <a key={i} href={link.uri} target="_blank" className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold truncate transition-colors">
                      <i className="fa-solid fa-link"></i> {link.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">
              {msg.role === 'user' ? 'Analyzed' : 'Generated'} at {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800 flex items-center gap-2">
               <div className="flex gap-1">
                 <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                 <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                 <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
               </div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Calculating</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-slate-50 dark:border-slate-700 glass">
        <div className="relative flex items-center gap-3 bg-slate-100 dark:bg-slate-900/80 p-2 rounded-2xl border border-transparent focus-within:border-blue-500 transition-all">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Ask a follow up question..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 dark:text-white"
          />
          <button 
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPreview;
