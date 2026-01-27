
import React from 'react';
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

interface ParsedSegment {
  type: 'text' | 'code';
  content: string;
  lang?: string;
}

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang, embedded = false, messages, onSend, isTyping }) => {
  const t = translations[lang];

  // --- Logic: File Download ---
  const handleDownloadFile = (content: string, filename: string, language: string) => {
    let extension = '.txt';
    const langLower = language.toLowerCase();
    
    // Auto-detect extension based on language label
    const extMap: Record<string, string> = {
      python: '.py', javascript: '.js', typescript: '.ts',
      html: '.html', css: '.css', sql: '.sql',
      java: '.java', cpp: '.cpp', c: '.c',
      json: '.json', php: '.php', rust: '.rs',
      go: '.go', swift: '.swift', kotlin: '.kt',
      xml: '.xml', yaml: '.yaml', shell: '.sh', bash: '.sh'
    };
    
    Object.keys(extMap).forEach(key => {
        if (langLower.includes(key)) extension = extMap[key];
    });

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

  // --- Logic: CSV Download ---
  const handleDownloadCSV = (rows: string[][]) => {
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orin-data-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // --- Logic: Content Parsing ---
  const parseMessageContent = (content: string): ParsedSegment[] => {
    if (!content) return [];
    
    const segments: ParsedSegment[] = [];
    const parts = content.split(/```(\w*)\n([\s\S]*?)```/g);

    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        // Even index = Regular Text
        if (parts[i].trim()) segments.push({ type: 'text', content: parts[i] });
      } else if (i % 3 === 1) {
        // Index % 3 === 1 is the language tag
        const lang = parts[i] || 'text';
        const code = parts[i + 1] || '';
        segments.push({ type: 'code', lang, content: code.trim() });
        i++; // Skip the code part in the next loop iteration
      }
    }
    return segments;
  };

  const containerClass = embedded 
    ? "flex-1 flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar items-center bg-slate-50 dark:bg-slate-950 pb-40" 
    : "fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden";

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-16 shrink-0 border-b border-black/5 dark:border-white/5 flex items-center justify-between px-6 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white"><i className="fa-solid fa-code"></i></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Developer Mode</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
        </header>
      )}

      <div className="w-full max-w-5xl space-y-12">
        
        {/* Empty State */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 opacity-0 animate-reveal" style={{ animationFillMode: 'forwards' }}>
            <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-[32px] flex items-center justify-center shadow-inner">
               <i className="fa-solid fa-terminal text-4xl text-slate-400"></i>
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">Code & Data Workspace</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Paste errors, ask for snippets, or generate SQL.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg px-4">
               {["Explain this code", "Find the bug", "Write a Python script", "Convert JSON to SQL"].map(cmd => (
                 <button key={cmd} onClick={() => onSend(cmd)} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all text-xs font-bold text-slate-600 dark:text-slate-300 text-left">
                    {cmd}
                 </button>
               ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const parsed = parseMessageContent(msg.content);
            return (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                 
                 {/* Message Bubble */}
                 <div className={`w-full ${msg.role === 'user' ? 'max-w-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-[24px] rounded-tr-none' : 'max-w-full bg-transparent text-slate-800 dark:text-slate-200'} p-6`}>
                    {parsed.map((segment, segIdx) => {
                        if (segment.type === 'text') {
                            return (
                                <div key={segIdx} className="whitespace-pre-wrap leading-relaxed text-sm md:text-base font-medium">
                                    {segment.content}
                                </div>
                            );
                        } else {
                            // CODE BLOCK RENDER
                            return (
                                <div key={segIdx} className="my-6 rounded-2xl overflow-hidden border border-slate-300 dark:border-white/10 bg-[#1e293b] shadow-xl w-full max-w-4xl">
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#0f172a] border-b border-white/5">
                                        <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">{segment.lang || 'CODE'}</span>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(segment.content)} 
                                                className="text-[10px] font-bold text-slate-400 hover:text-white uppercase px-2 py-1 hover:bg-white/10 rounded transition-colors"
                                            >
                                                Copy
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadFile(segment.content, `snippet-${idx}-${segIdx}`, segment.lang || 'txt')} 
                                                className="text-[10px] font-bold text-cyan-500 hover:text-cyan-300 uppercase px-2 py-1 hover:bg-cyan-500/10 rounded transition-colors flex items-center gap-1"
                                            >
                                                <i className="fa-solid fa-download"></i> Save
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 overflow-x-auto custom-scrollbar">
                                        <pre className="font-mono text-xs md:text-sm text-slate-300 leading-loose">
                                            <code>{segment.content}</code>
                                        </pre>
                                    </div>
                                </div>
                            );
                        }
                    })}

                    {/* TABLE DETECTION (Assistant Only) */}
                    {msg.role === 'assistant' && msg.content.includes('|') && (
                        (() => {
                            const lines = msg.content.split('\n');
                            const tableLines = lines.filter(l => l.includes('|') && l.trim().length > 2);
                            // Simple heuristic: at least 3 lines of pipe-separated content
                            if (tableLines.length > 2) {
                                const headers = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim());
                                const rows = tableLines.slice(2).map(l => l.split('|').filter(c => c.trim()).map(c => c.trim())); // Slice 2 to skip header and separator line
                                
                                return (
                                    <div className="mt-6 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900 shadow-md max-w-4xl">
                                        <div className="bg-slate-50 dark:bg-white/5 px-4 py-2 flex justify-between items-center border-b border-black/5 dark:border-white/5">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data View</span>
                                            <button onClick={() => handleDownloadCSV([headers, ...rows])} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
                                                <i className="fa-solid fa-file-csv"></i> Export CSV
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto custom-scrollbar">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="bg-slate-100 dark:bg-black/20">
                                                        {headers.map((h, hi) => (
                                                            <th key={hi} className="p-3 font-black text-slate-700 dark:text-slate-300 border-r border-black/5 dark:border-white/5 whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, ri) => (
                                                        <tr key={ri} className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                                                            {row.map((cell, ci) => (
                                                                <td key={ci} className="p-3 font-medium text-slate-600 dark:text-slate-400 border-r border-black/5 dark:border-white/5 whitespace-nowrap">{cell}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()
                    )}
                 </div>
              </div>
            );
          })
        )}

        {isTyping && (
           <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-full w-fit">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce delay-150"></div>
           </div>
        )}
      </div>
    </div>
  );
};

export default GetHelpMode;
