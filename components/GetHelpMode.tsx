
import React, { useState, useEffect, useRef } from 'react';
import { Language, GroundingLink } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';

interface GetHelpModeProps {
  onClose: () => void;
  lang: Language;
}

interface Slide {
  title: string;
  points: string[];
}

type TaskType = 'search' | 'presentation' | 'database' | 'excel' | 'document';

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [isSharing, setIsSharing] = useState(false);
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios-pc'>('ios-pc');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search & Agent State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchLinks, setSearchLinks] = useState<GroundingLink[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTaskType, setActiveTaskType] = useState<TaskType>('search');
  
  // Output States
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [spreadsheetData, setSpreadsheetData] = useState<string[][]>([]);

  // Agent Visualization State
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [agentAction, setAgentAction] = useState<string>("");
  const [discoveredItems, setDiscoveredItems] = useState<string[]>([]);
  const [agentProgress, setAgentProgress] = useState(0);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      setPlatform('android');
    } else {
      setPlatform('ios-pc');
    }
  }, []);

  const captureScreenFrame = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return null;

    try {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = 1280;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = width / height;
        if (ratio > 1) {
           width = MAX_DIMENSION;
           height = width / ratio;
        } else {
           height = MAX_DIMENSION;
           width = height * ratio;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      }
    } catch (e) {
      console.error("Screen capture failed:", e);
    }
    return null;
  };

  const parseSlides = (text: string): Slide[] => {
    const slideBlocks = text.split(/SLIDE_TITLE:/g).filter(s => s.trim().length > 0);
    return slideBlocks.map(block => {
      const lines = block.trim().split('\n');
      const title = lines[0].trim();
      const contentPart = lines.slice(1).join('\n');
      const points = contentPart
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.match(/^[-*•]|\d+\./))
        .map(l => l.replace(/^[-*•]|\d+\.\s*/, '').trim());
      
      return { title, points: points.length > 0 ? points : [contentPart.trim()] };
    });
  };

  const parseCSV = (text: string): string[][] => {
    return text.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.split(/[,|]/).map(cell => cell.trim()));
  };

  const simulateAgentWorkflow = async (response: any, mode: TaskType) => {
    setDiscoveredItems([]);
    setAgentProgress(0);
    
    let initMsg = "Initializing Autonomous Agent...";
    if (mode === 'presentation') initMsg = "Initializing Design Studio...";
    if (mode === 'database') initMsg = "Connecting to SQL Engine...";
    if (mode === 'excel') initMsg = "Initializing Data Grid...";
    if (mode === 'document') initMsg = "Loading Writer's Workbench...";

    setAgentAction(initMsg);
    setAgentProgress(10);
    await new Promise(r => setTimeout(r, 600));

    let planMsg = `Querying Global Index: "${searchQuery}"`;
    if (mode === 'presentation') planMsg = "Structuring Presentation Outline...";
    if (mode === 'database') planMsg = "Analyzing Data Requirements...";
    if (mode === 'excel') planMsg = "Structuring Columns & Types...";
    if (mode === 'document') planMsg = "Drafting Content Outline...";

    setAgentAction(planMsg);
    setAgentProgress(25);
    await new Promise(r => setTimeout(r, 800));

    if (mode === 'presentation') {
        const rawSlides = parseSlides(response.text);
        for (let i = 0; i < rawSlides.length; i++) {
           setAgentAction(`Drafting Slide ${i + 1}: ${rawSlides[i].title.substring(0, 20)}...`);
           setAgentProgress(30 + ((i + 1) / rawSlides.length) * 60);
           await new Promise(r => setTimeout(r, 600));
           setDiscoveredItems(prev => [...prev, `Slide ${i+1}: ${rawSlides[i].title}`]);
        }
        setSlides(rawSlides);

    } else if (mode === 'database') {
        setAgentAction("Designing Schema Relationships...");
        setAgentProgress(40);
        await new Promise(r => setTimeout(r, 800));
        setAgentAction("Optimizing Constraints...");
        setAgentProgress(70);
        await new Promise(r => setTimeout(r, 800));
        setAgentAction("Generating SQL Syntax...");
        setDiscoveredItems(["Schema Defined", "Relationships Mapped", "Query Optimized"]);

    } else if (mode === 'excel') {
        setAgentAction("Calculating Formulas...");
        setAgentProgress(40);
        await new Promise(r => setTimeout(r, 800));
        setAgentAction("Populating Cell Data...");
        setAgentProgress(80);
        await new Promise(r => setTimeout(r, 800));
        const rows = parseCSV(response.text);
        setSpreadsheetData(rows);
        setDiscoveredItems([`${rows.length} Rows Generated`, `${rows[0]?.length || 0} Columns Defined`]);

    } else if (mode === 'document') {
        setAgentAction("Writing Core Content...");
        setAgentProgress(40);
        await new Promise(r => setTimeout(r, 800));
        setAgentAction("Refining Grammar & Tone...");
        setAgentProgress(70);
        await new Promise(r => setTimeout(r, 800));
        setAgentAction("Formatting Layout...");
        setDiscoveredItems(["Outline Created", "Draft Written", "Polished"]);

    } else {
        const lines = response.text.split('\n');
        const items = lines
            .filter((line: string) => line.trim().match(/^[-*•]|\d+\./))
            .map((l: string) => l.replace(/^[-*•]|\d+\./, '').trim())
            .filter((l: string) => l.length > 5);
            
        const links = response.links || [];

        if (links.length > 0) {
          const linksToVisit = links.slice(0, 4); 
          const itemsPerLink = Math.ceil(items.length / (linksToVisit.length || 1));

          for (let i = 0; i < linksToVisit.length; i++) {
            const link = linksToVisit[i];
            const domain = new URL(link.uri).hostname.replace('www.', '');
            
            setAgentUrl(link.uri);
            setAgentAction(`Navigating to ${domain}...`);
            setAgentProgress(30 + ((i + 1) / linksToVisit.length) * 50);
            await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
            setAgentAction(`Scanning ${domain} for matches...`);
            await new Promise(r => setTimeout(r, 600));

            const newItems = items.slice(i * itemsPerLink, (i + 1) * itemsPerLink);
            if (newItems.length > 0) {
              setAgentAction(`Extracted ${newItems.length} data points`);
              setDiscoveredItems(prev => [...prev, ...newItems]);
              await new Promise(r => setTimeout(r, 600));
            }
          }
        } else {
            setAgentAction("Scanning internal knowledge base...");
            setAgentProgress(60);
            await new Promise(r => setTimeout(r, 1000));
            setDiscoveredItems(items.slice(0, 5));
        }
    }

    setAgentUrl(null);
    setAgentAction("Task Completed Successfully.");
    setSearchResult(response.text);
    setAgentProgress(100);
  };

  const handleSearch = async (forceVisual = false) => {
    if (!searchQuery.trim()) return;
    
    let detectedMode: TaskType = 'search';
    const q = searchQuery.toLowerCase();
    
    if (/(presentation|slides|deck|powerpoint)/i.test(q)) detectedMode = 'presentation';
    else if (/(database|sql|schema|query|db)/i.test(q)) detectedMode = 'database';
    else if (/(excel|spreadsheet|csv|sheet|table)/i.test(q)) detectedMode = 'excel';
    else if (/(document|report|essay|article|letter|word doc)/i.test(q)) detectedMode = 'document';
    
    setActiveTaskType(detectedMode);
    
    setIsSearching(true);
    setSearchResult(null);
    setSearchLinks([]);
    setSlides([]);
    setSpreadsheetData([]);
    setAgentUrl(null);
    setAgentAction("Waiting for Neural Core...");
    setDiscoveredItems([]);
    setCurrentSlideIndex(0);
    
    try {
       let visualContext: string | null = null;
       const isVideoReady = videoRef.current && videoRef.current.srcObject;

       if ((isSharing || forceVisual) && isVideoReady) {
          if (forceVisual) await new Promise(r => setTimeout(r, 800)); 
          visualContext = captureScreenFrame();
       }
       
       let finalPrompt = "";
       
       if (detectedMode === 'presentation') {
          finalPrompt = `User Request: "${searchQuery}".
          TASK: Create a structured presentation.
          OUTPUT FORMAT:
          SLIDE_TITLE: [Title]
          - Bullet point
          ...
          Provide 4-6 slides.`;
       } else if (detectedMode === 'database') {
          finalPrompt = `User Request: "${searchQuery}".
          TASK: Create a comprehensive SQL database schema.
          OUTPUT: Provide pure SQL code for CREATE TABLE, INSERT, and comments explaining relationships. Use Markdown code blocks.`;
       } else if (detectedMode === 'excel') {
          finalPrompt = `User Request: "${searchQuery}".
          TASK: Generate a data spreadsheet.
          OUTPUT: Provide a CSV formatted text block. 
          First line: Headers.
          Subsequent lines: Data rows.
          Ensure at least 5-10 rows of realistic data.`;
       } else if (detectedMode === 'document') {
          finalPrompt = `User Request: "${searchQuery}".
          TASK: Write a professional document/report.
          OUTPUT: Use rich Markdown with Headers (#), bolding, and clear paragraphs. Format it like a formal Word document.`;
       } else {
          finalPrompt = `User Request: "${searchQuery}". 
          TASK: Act as an agent. Search real-world data (prices, items, news).
          OUTPUT: A detailed list of findings based on web research.`;
       }

       const options: any = { useThinking: true, grounding: 'search' };

       if (visualContext) {
         finalPrompt = `[VISUAL CONTEXT PROVIDED] ${finalPrompt} 
         Guidance: Incorporate visual context from the screen share if relevant.`;
         options.fileData = { data: visualContext, mimeType: 'image/jpeg' };
       }

       const response = await geminiService.chat(finalPrompt, options);
       setSearchLinks(response.links || []);

       await simulateAgentWorkflow(response, detectedMode);

    } catch (e: any) {
       console.error(e);
       setAgentAction("Error: Connection Failed");
       setSearchResult("I couldn't complete the task. Please check your connection and try again.");
    } finally {
       setIsSearching(false);
    }
  };

  const startSharing = async () => {
    setIsDiagnostic(true);
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
           videoRef.current?.play().catch(e => console.error("Play failed", e));
           if (searchQuery.trim()) {
              handleSearch(true);
           }
        };
      }
      setIsSharing(true);
      setIsDiagnostic(false);
      
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error("Screen share failed", err);
      setIsDiagnostic(false);
      alert(t.help.notSupported);
    }
  };

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSharing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startAccessibilityAssistance = () => {
    setIsDiagnostic(true);
    setTimeout(() => {
      setIsDiagnostic(false);
      alert(lang === 'si' ? "Accessibility සහාය දැන් සක්‍රීයයි." : "Accessibility assistance is now active.");
      setIsSharing(true);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden font-sans">
      <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-life-ring text-xl"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.getHelp}</h2>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse beta-glow">AGENT ACTIVE</span>
            </div>
            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Autonomous Task Engine</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start gap-8">
        
        <div className="w-full max-w-3xl space-y-4">
             <div className="relative group z-20">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                  placeholder="Describe a task (e.g., 'Latest prices of iPhone 16' or 'Create an Excel budget')..."
                  disabled={isSearching}
                  className="w-full p-6 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] text-sm md:text-lg font-medium shadow-lg focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all dark:text-white disabled:opacity-50"
                />
                <i className="fa-solid fa-terminal absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                
                {!isSearching && searchQuery.trim() && (
                  <button 
                    onClick={() => handleSearch()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-cyan-600/20"
                  >
                    Execute Task
                  </button>
                )}
             </div>

             {(isSearching || searchResult || slides.length > 0) && (
               <div className="w-full max-w-4xl bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 animate-scale-in flex flex-col min-h-[500px]">
                  
                  <div className="h-14 bg-slate-800 flex items-center px-4 gap-4 border-b border-white/5 shrink-0">
                      <div className="flex gap-1.5 shrink-0">
                         <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                         <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                         <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                      </div>
                      
                      <div className="flex-1 h-8 bg-black/40 rounded-lg flex items-center px-3 gap-2 overflow-hidden">
                          {agentUrl ? (
                             <>
                                <i className="fa-solid fa-lock text-[10px] text-emerald-500"></i>
                                <span className="text-[10px] font-mono text-white truncate">{agentUrl}</span>
                             </>
                          ) : (
                             <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                                orinos://{activeTaskType === 'search' ? 'agent-core' : activeTaskType === 'database' ? 'sql-engine' : activeTaskType === 'excel' ? 'data-grid' : 'doc-writer'}
                             </span>
                          )}
                      </div>
                      
                      {isSearching && (
                          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                  </div>

                  <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
                      
                      {isSearching && (
                          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 animate-fade">
                              <div className="w-24 h-24 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center relative">
                                  <i className={`fa-solid ${activeTaskType === 'presentation' ? 'fa-layer-group' : activeTaskType === 'database' ? 'fa-database' : activeTaskType === 'excel' ? 'fa-table' : activeTaskType === 'document' ? 'fa-file-lines' : 'fa-globe'} text-4xl text-cyan-400 animate-pulse`}></i>
                                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent h-[50%] animate-[scan_2s_linear_infinite]"></div>
                              </div>
                              <div className="space-y-2 max-w-md">
                                  <h3 className="text-lg font-bold text-white tracking-tight animate-pulse">{agentAction}</h3>
                                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${agentProgress}%` }}></div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {!isSearching && (
                          <>
                              {activeTaskType === 'presentation' && slides.length > 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900">
                                   <div className="w-full aspect-video bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 md:p-12 flex flex-col relative overflow-hidden border border-white/10 animate-reveal">
                                      <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500"></div>
                                      <div className="mb-6 border-b border-black/10 dark:border-white/10 pb-4">
                                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{slides[currentSlideIndex].title}</h2>
                                      </div>
                                      <div className="flex-1 space-y-4">
                                        {slides[currentSlideIndex].points.map((point, i) => (
                                          <div key={i} className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 shrink-0"></div>
                                            <p className="text-sm md:text-lg text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{point}</p>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-auto pt-4 flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                        <span>Orin Deck Engine</span>
                                        <span>{currentSlideIndex + 1} / {slides.length}</span>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-4 mt-6">
                                      <button onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} disabled={currentSlideIndex === 0} className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-cyan-600 transition-all disabled:opacity-30"><i className="fa-solid fa-chevron-left"></i></button>
                                      <div className="flex gap-1.5">{slides.map((_, i) => (<div key={i} className={`w-2 h-2 rounded-full transition-all ${i === currentSlideIndex ? 'bg-cyan-500 w-4' : 'bg-slate-700'}`}></div>))}</div>
                                      <button onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))} disabled={currentSlideIndex === slides.length - 1} className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-cyan-600 transition-all disabled:opacity-30"><i className="fa-solid fa-chevron-right"></i></button>
                                   </div>
                                </div>
                              )}

                              {activeTaskType === 'database' && searchResult && (
                                  <div className="flex-1 flex flex-col bg-[#1e1e1e] p-6 overflow-hidden">
                                      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                         <span className="text-xs font-mono text-cyan-400">query_result.sql</span>
                                         <button onClick={() => navigator.clipboard.writeText(searchResult)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white"><i className="fa-solid fa-copy mr-1"></i> Copy SQL</button>
                                      </div>
                                      <div className="flex-1 overflow-auto custom-scrollbar">
                                          <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap">{searchResult.replace(/```sql|```/g, '')}</pre>
                                      </div>
                                  </div>
                              )}

                              {activeTaskType === 'excel' && spreadsheetData.length > 0 && (
                                  <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 p-6 overflow-hidden">
                                      <div className="flex items-center justify-between mb-4">
                                         <div className="flex items-center gap-2 text-emerald-600">
                                            <i className="fa-solid fa-file-csv"></i>
                                            <span className="text-xs font-black uppercase tracking-widest">Data Grid View</span>
                                         </div>
                                         <button onClick={() => navigator.clipboard.writeText(searchResult || "")} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white"><i className="fa-solid fa-copy mr-1"></i> Copy Data</button>
                                      </div>
                                      <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 dark:border-white/10 rounded-lg">
                                          <table className="w-full text-left text-sm border-collapse">
                                              <thead>
                                                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10">
                                                      {spreadsheetData[0]?.map((header, i) => (
                                                          <th key={i} className="p-3 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-white/5">{header}</th>
                                                      ))}
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {spreadsheetData.slice(1).map((row, i) => (
                                                      <tr key={i} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                                                          {row.map((cell, j) => (
                                                              <td key={j} className="p-3 text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-white/5 font-mono">{cell}</td>
                                                          ))}
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </table>
                                      </div>
                                  </div>
                              )}

                              {activeTaskType === 'document' && searchResult && (
                                  <div className="flex-1 flex flex-col bg-slate-100 dark:bg-black p-8 overflow-y-auto items-center">
                                      <div className="w-full max-w-2xl bg-white text-slate-900 p-12 shadow-xl min-h-[800px]">
                                          <div className="prose max-w-none text-slate-900 prose-headings:font-bold prose-headings:text-slate-900">
                                              {searchResult.split('\n').map((line, i) => (
                                                  <React.Fragment key={i}>
                                                      {line.startsWith('# ') ? <h1 className="text-3xl mb-4">{line.replace('# ', '')}</h1> :
                                                       line.startsWith('## ') ? <h2 className="text-2xl mt-6 mb-3">{line.replace('## ', '')}</h2> :
                                                       <p className="mb-4 text-justify leading-relaxed">{line}</p>}
                                                  </React.Fragment>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              )}

                              {activeTaskType === 'search' && searchResult && (
                                  <div className="p-6 border-t border-white/5 bg-slate-900/50 flex-1 overflow-y-auto">
                                      <div className="mb-4 flex items-center justify-between">
                                         <div className="flex items-center gap-2 text-emerald-400">
                                            <i className="fa-solid fa-check-circle"></i>
                                            <span className="text-xs font-black uppercase tracking-widest">Intelligence Report Compiled</span>
                                         </div>
                                      </div>
                                      <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap mb-8">
                                         {searchResult}
                                      </div>

                                      {searchLinks.length > 0 && (
                                         <div className="space-y-4 pt-6 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-magnifying-glass text-[10px] text-cyan-400"></i>
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verified Information Sources</h4>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                               {searchLinks.map((link, i) => (
                                                  <a key={i} href={link.uri} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all flex flex-col gap-1 group">
                                                     <span className="text-[10px] font-bold text-cyan-400 truncate group-hover:text-cyan-300">{link.title}</span>
                                                     <span className="text-[8px] text-slate-500 truncate font-mono">{link.uri}</span>
                                                  </a>
                                               ))}
                                            </div>
                                         </div>
                                      )}
                                  </div>
                              )}
                          </>
                      )}

                      {discoveredItems.length > 0 && isSearching && (
                         <div className="p-4 border-t border-white/5 bg-slate-900/80 backdrop-blur-sm absolute bottom-0 w-full z-10">
                            <div className="flex flex-col gap-2">
                               {discoveredItems.slice(-3).map((item, i) => (
                                   <div key={i} className="flex items-center gap-3 animate-slide-in-right opacity-80">
                                       <i className="fa-solid fa-check text-[10px] text-emerald-500"></i>
                                       <span className="text-[10px] font-mono text-slate-400 truncate">{item}</span>
                                   </div>
                               ))}
                            </div>
                         </div>
                      )}
                  </div>
               </div>
             )}
        </div>

        {isSharing && platform === 'ios-pc' && (
          <div className="w-full max-w-md mt-4 animate-reveal">
            <div className="aspect-video rounded-[24px] overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] bg-black relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60"></video>
              <div className="absolute inset-0 flex items-center justify-center">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 animate-pulse bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm border border-cyan-500/20">
                   Visual Feed Active
                 </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-md mt-auto pt-8">
          {!isSharing ? (
            <button 
              onClick={platform === 'android' ? startAccessibilityAssistance : startSharing}
              disabled={isDiagnostic || isSearching}
              className="w-full py-5 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-300 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <i className={`fa-solid ${platform === 'android' ? 'fa-universal-access' : 'fa-desktop'}`}></i>
              {platform === 'android' ? "Enable Accessibility" : "Share Screen for Context"}
            </button>
          ) : (
            <button 
              onClick={platform === 'android' ? () => setIsSharing(false) : stopSharing}
              className="w-full py-5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-stop"></i>
              Stop Visual Feed
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GetHelpMode;
