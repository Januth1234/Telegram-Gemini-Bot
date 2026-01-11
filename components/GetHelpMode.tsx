
import React, { useState, useEffect, useRef } from 'react';
import { Language, GroundingLink } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';

interface GetHelpModeProps {
  onClose: () => void;
  lang: Language;
  embedded?: boolean;
}

interface Slide {
  title: string;
  points: string[];
}

type TaskType = 'search' | 'presentation' | 'database' | 'excel' | 'document' | 'coding';

const GetHelpMode: React.FC<GetHelpModeProps> = ({ onClose, lang, embedded = false }) => {
  const t = translations[lang];
  const [isSharing, setIsSharing] = useState(false);
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios-pc'>('ios-pc');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchLinks, setSearchLinks] = useState<GroundingLink[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTaskType, setActiveTaskType] = useState<TaskType>('search');
  
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [spreadsheetData, setSpreadsheetData] = useState<string[][]>([]);
  
  const [codeData, setCodeData] = useState<{ filename: string; lang: string; code: string } | null>(null);
  const [streamedCode, setStreamedCode] = useState("");
  const [showLivePreview, setShowLivePreview] = useState(false);

  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [agentAction, setAgentAction] = useState<string>("");
  const [discoveredItems, setDiscoveredItems] = useState<string[]>([]);
  const [agentProgress, setAgentProgress] = useState(0);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) setPlatform('android');
    else setPlatform('ios-pc');
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
        if (ratio > 1) { width = MAX_DIMENSION; height = width / ratio; }
        else { height = MAX_DIMENSION; width = height * ratio; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.drawImage(video, 0, 0, width, height); return canvas.toDataURL('image/jpeg', 0.7).split(',')[1]; }
    } catch (e) { console.error(e); }
    return null;
  };

  const simulateAgentWorkflow = async (response: any, mode: TaskType) => {
    setDiscoveredItems([]); setAgentProgress(0); setStreamedCode("");
    setAgentAction(lang === 'si' ? "අරඹමින්..." : "Initializing Agent...");
    setAgentProgress(10);
    await new Promise(r => setTimeout(r, 600));

    if (mode === 'coding') {
        const parsed = parseCode(response.text);
        setCodeData(parsed);
        setShowLivePreview(parsed.lang === 'html' || parsed.filename.endsWith('.html'));
        setAgentAction("Synthesizing Code...");
        const lines = parsed.code.split('\n');
        let displayed = "";
        for (let i = 0; i < lines.length; i++) {
            displayed += lines[i] + "\n";
            setStreamedCode(displayed);
            setAgentProgress(20 + (i / lines.length) * 70);
            await new Promise(r => setTimeout(r, Math.max(2, 30 - (lines.length / 5)))); 
        }
    } else if (mode === 'excel') {
        setSpreadsheetData(parseCSV(response.text));
        setAgentProgress(100);
    } else if (mode === 'presentation') {
        setSlides(parseSlides(response.text));
        setAgentProgress(100);
    } else {
        setAgentProgress(100);
    }
    setAgentAction(lang === 'si' ? "අවසන්." : "Ready.");
    setSearchResult(response.text);
  };

  const parseSlides = (text: string): Slide[] => {
    const slideBlocks = text.split(/SLIDE_TITLE:/g).filter(s => s.trim().length > 0);
    return slideBlocks.map(block => {
      const lines = block.trim().split('\n');
      const title = lines[0].trim();
      const points = lines.slice(1).map(l => l.trim()).filter(l => l.match(/^[-*•]|\d+\./)).map(l => l.replace(/^[-*•]|\d+\.\s*/, '').trim());
      return { title, points: points.length > 0 ? points : [lines.slice(1).join('\n')] };
    });
  };

  const parseCSV = (text: string): string[][] => text.split('\n').filter(l => l.trim().length > 0).map(l => l.split(/[,|]/).map(c => c.trim()));

  const parseCode = (text: string) => {
    const fnm = text.match(/FILENAME:\s*(.+)/);
    const lng = text.match(/LANGUAGE:\s*(.+)/);
    const codeBlock = text.match(/CODE_START\n([\s\S]*?)\nCODE_END/) || text.match(/```[\w]*\n([\s\S]*?)```/);
    return {
      filename: fnm ? fnm[1].trim() : 'script.txt',
      lang: lng ? lng[1].trim().toLowerCase() : 'plaintext',
      code: codeBlock ? codeBlock[1].trim() : text.trim()
    };
  };

  const handleSearch = async (forceVisual = false) => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    let detectedMode: TaskType = 'search';
    if (/(presentation|slides|deck|ppt)/i.test(q)) detectedMode = 'presentation';
    else if (/(database|sql|schema|query)/i.test(q)) detectedMode = 'database';
    else if (/(excel|spreadsheet|csv|sheet|table)/i.test(q)) detectedMode = 'excel';
    else if (/(document|report|essay|article|word doc)/i.test(q)) detectedMode = 'document';
    else if (/(code|program|app|website|script|html|css|python)/i.test(q)) detectedMode = 'coding';
    
    setActiveTaskType(detectedMode);
    setIsSearching(true); setSearchResult(null); setSearchLinks([]); setSlides([]); setSpreadsheetData([]); setCodeData(null);
    
    try {
       let visualContext: string | null = null;
       if ((isSharing || forceVisual) && videoRef.current?.srcObject) visualContext = captureScreenFrame();
       const options: any = { useThinking: true, grounding: 'search' };
       if (visualContext) options.fileData = { data: visualContext, mimeType: 'image/jpeg' };
       const response = await geminiService.chat(searchQuery, options);
       setSearchLinks(response.links || []);
       await simulateAgentWorkflow(response, detectedMode);
    } catch (e) { setAgentAction("Error"); } finally { setIsSearching(false); }
  };

  const containerClass = embedded 
    ? "flex-1 flex flex-col p-6 md:p-12 overflow-y-auto custom-scrollbar items-center bg-slate-50 dark:bg-slate-950" 
    : "fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden";

  return (
    <div className={containerClass}>
      {!embedded && (
        <header className="h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 shrink-0 z-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-xl"><i className="fa-solid fa-life-ring text-xl"></i></div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.getHelp}</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>
      )}

      <div className="w-full max-w-4xl space-y-6 pb-24">
        <div className="relative group z-20">
          <input 
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
            placeholder={lang === 'si' ? "මොකක්ද කරන්න ඕනේ?" : "What should I build? (App, Doc, Excel, Code)..."}
            className="w-full p-6 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] text-sm md:text-lg font-medium shadow-lg outline-none"
          />
          <i className="fa-solid fa-wand-sparkles absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
        </div>

        {(isSearching || searchResult || slides.length > 0) && (
          <div className="w-full bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 animate-scale-in flex flex-col min-h-[400px]">
             <div className="h-14 bg-slate-800 flex items-center px-4 justify-between">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">{agentAction}</span>
                {activeTaskType === 'coding' && codeData && (
                  <button onClick={() => setShowLivePreview(!showLivePreview)} className="px-4 py-1.5 bg-cyan-600 text-white rounded-lg text-[9px] font-black uppercase">{showLivePreview ? 'Code' : 'Preview'}</button>
                )}
             </div>
             <div className="flex-1 bg-slate-950 p-6 overflow-y-auto custom-scrollbar">
                {activeTaskType === 'coding' ? (
                   showLivePreview ? <iframe srcDoc={codeData?.code} className="w-full h-[400px] bg-white rounded-lg" /> : <pre className="text-cyan-400 font-mono text-xs whitespace-pre-wrap">{streamedCode}</pre>
                ) : <div className="text-slate-300 text-sm whitespace-pre-wrap">{searchResult}</div>}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GetHelpMode;
