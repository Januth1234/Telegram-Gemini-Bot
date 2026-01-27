
import React, { useMemo } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../translations';

interface GetHelpModeProps {
  onClose: () => void;
  lang: Language;
  embedded?: boolean;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isTyping: boolean;
}

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const t = translations[lang];

  // Logic to handle file downloads with correct extensions
  const handleDownloadFile = (content: string, filename: string, language: string) => {
    let extension = '.txt';
    const langLower = language.toLowerCase();
    
    if (langLower.includes('python')) extension = '.py';
    else if (langLower.includes('javascript') || langLower.includes('js')) extension = '.js';
    else if (langLower.includes('typescript') || langLower.includes('ts')) extension = '.ts';
    else if (langLower.includes('html')) extension = '.html';
    else if (langLower.includes('css')) extension = '.css';
    else if (langLower.includes('sql')) extension = '.sql';
    else if (langLower.includes('java')) extension = '.java';
    else if (langLower.includes('cpp') || langLower.includes('c++')) extension = '.cpp';
    else if (langLower.includes('json')) extension = '.json';
    else if (langLower.includes('php')) extension = '.php';

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.includes('.') ? filename : `${filename}${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = (rows: string[][]) => {
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orin-data-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Robust parser for interleaved text and code blocks
  const parseMessageContent = (content: string) => {
    const segments = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Push text before code
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      // Push code block
      segments.push({ type: 'code', lang: match[1] || 'text', content: match[2].trim() });
      lastIndex = regex.lastIndex;
    }

    // Push remaining text
    if (lastIndex < content.length) {
      segments.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return segments;
  };

  const containerClass = embedded 
    ? "flex-1 flex flex-col p-4 md:p-10 overflow-y-auto custom-scrollbar items-center bg-slate-50/50 dark:bg-slate-950/50 pb-48" 
    : "fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden";

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl"><i className="fa-solid fa-wand-sparkles text-xl"></i></div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.getHelp}</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>
      )}

      <div className="w-full max-w-4xl space-y-12">
        {messages.length === 0 ? (
          <div className="py-24 text-center space-y-8 animate-reveal min-h-[500px] flex flex-col justify-center">
            <div className="w-24 h-24 rounded-[48px] bg-cyan-500/10 flex items-center justify-center text-cyan-600 mx-auto border border-cyan-500/20 shadow-inner">
               <i className="fa-solid fa-microchip text-5xl"></i>
            </div>
            <div className="space-y-4 px-6">
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">AI Agent Workspace</h2>
               <p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                 Start a multi-step project. Ask me to write code, design data tables, or troubleshoot complex issues. Your progress is saved automatically.
               </p>
               <div className="flex flex-wrap justify-center gap-3 pt-8">
                  {["Build a landing page", "Write a Python script", "Create a sales data table", "Design an SQL database"].map(s => (
                    <button key={s} onClick={() => onSend(s)} className="px-6 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black text-slate-500 hover:text-cyan-600 hover:border-cyan-500/50 transition-all shadow-sm active:scale-95 uppercase tracking-widest">{s}</button>
                  ))}
               </div>
            </div>
          </div>
        ) : (
          messages.map((msg, msgIndex) => {
            const segments = parseMessageContent(msg.content);
            
            return (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                 <div className={`w-full max-w-[95%] md:max-w-[85%] p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-white/10'}`}>
                    
                    <div className="space-y-6">
                      {segments.map((segment, segIndex) => {
                        if (segment.type === 'text') {
                          return (
                            <div key={segIndex} className={`text-sm md:text-lg leading-relaxed whitespace-pre-wrap ${/[^\u0000-\u007F]/.test(segment.content || '') ? 'sinhala-text' : ''}`}>
                              {segment.content}
                            </div>
                          );
                        } else {
                          const language = segment.lang || 'text';
                          const code = segment.content || '';
                          return (
                            <div key={segIndex} className="w-full bg-slate-950 rounded-[24px] overflow-hidden border border-white/10 shadow-xl group/block my-4">
                               <div className="h-12 bg-slate-900/80 flex items-center px-4 justify-between border-b border-white/5">
                                  <div className="flex items-center gap-3">
                                     <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                                     <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{language}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => navigator.clipboard.writeText(code)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Copy</button>
                                    <button onClick={() => handleDownloadFile(code, `orin-project-${msgIndex}-${segIndex}`, language)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2">
                                      <i className="fa-solid fa-download"></i>
                                    </button>
                                  </div>
                               </div>
                               <pre className="p-6 text-cyan-300 font-mono text-xs md:text-sm overflow-x-auto custom-scrollbar bg-slate-950/50 leading-loose"><code>{code}</code></pre>
                            </div>
                          );
                        }
                      })}

                      {/* Advanced Table Detection & CSV Export (Only for Assistant) */}
                      {msg.role === 'assistant' && msg.content.includes('|') && msg.content.split('\n').some(l => l.includes('---')) && (
                        <div className="w-full bg-slate-50 dark:bg-black/20 rounded-[24px] overflow-hidden border border-black/5 dark:border-white/5 shadow-lg mt-6">
                           <div className="h-12 bg-white dark:bg-slate-900/50 flex items-center px-4 justify-between border-b border-black/5 dark:border-white/5">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data Table</span>
                              <button 
                                onClick={() => {
                                  const tableLines = msg.content.split('\n').filter(l => l.includes('|') && !l.includes('---'));
                                  const rows = tableLines.map(l => l.split('|').filter(c => c.trim().length > 0).map(c => c.trim()));
                                  handleDownloadCSV(rows);
                                }} 
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2"
                              >
                                <i className="fa-solid fa-file-csv"></i>
                                Export
                              </button>
                           </div>
                           <div className="overflow-x-auto custom-scrollbar">
                             <table className="w-full text-left text-xs md:text-sm border-collapse">
                                <thead>
                                   <tr className="bg-slate-100/50 dark:bg-white/5">
                                      {msg.content.split('\n').find(l => l.includes('|'))?.split('|').filter(c => c.trim().length > 0).map((h, i) => (
                                        <th key={i} className="p-4 font-black text-slate-700 dark:text-slate-300 border-r border-black/5 dark:border-white/5 uppercase tracking-wider whitespace-nowrap">{h.trim()}</th>
                                      ))}
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                   {msg.content.split('\n').filter(l => l.includes('|') && !l.includes('---') && !l.toLowerCase().includes(msg.content.split('\n').find(l => l.includes('|'))!.toLowerCase())).map((row, ri) => (
                                     <tr key={ri} className="hover:bg-cyan-500/5 transition-colors">
                                        {row.split('|').filter(c => c.trim().length > 0).map((cell, ci) => (
                                          <td key={ci} className="p-4 font-medium text-slate-600 dark:text-slate-400 border-r border-black/5 dark:border-white/5 whitespace-nowrap">{cell.trim()}</td>
                                        ))}
                                     </tr>
                                   ))}
                                </tbody>
                             </table>
                           </div>
                        </div>
                      )}
                    </div>
                 </div>
              </div>
            );
          })
        )}
        
        {isTyping && (
          <div className="flex items-center gap-3 bg-white/80 dark:bg-white/5 px-6 py-3 rounded-full animate-pulse border border-slate-200 dark:border-white/5 w-fit shadow-sm">
            <div className="flex gap-1">
              {[0, 150, 300].map(delay => <div key={delay} className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>)}
            </div>
            <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">Agent Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GetHelpMode;
