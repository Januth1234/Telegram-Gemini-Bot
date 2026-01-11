
import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

interface GeneratedAsset {
  url: string;
  prompt: string;
  timestamp: number;
  type: 'image' | 'video' | 'audio';
}

type ModalType = 'image' | 'video' | 'animate' | 'audio';

const FeatureCreate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  // Modals State
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  
  // Inputs
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [selectedFile, setSelectedFile] = useState<{data: string, mimeType: string, name: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generation State
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggested Prompts - Updated for Whisk & Lyria
  const suggestions = [
    { label: "Cyberpunk City", type: 'image', prompt: "A futuristic cyberpunk city with neon lights and rain, hyper-realistic, 8k" },
    { label: "Lyria Melody", type: 'audio', prompt: "Generate a soulful lo-fi jazz melody with rain sounds" },
    { label: "Veo Action", type: 'video', prompt: "FPV drone shot flying through a narrow canyon at high speed" },
    { label: "Whisk Motion", type: 'animate', prompt: "Cinematic camera pan right, slow motion, 4k detail" }
  ];

  // --- HELPER: Parse Data URL ---
  const parseDataUrl = (url: string) => {
    const arr = url.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    let i = n;
    while (i--) {
        u8arr[i] = bstr.charCodeAt(i);
    }
    return { blob: new Blob([u8arr], { type: mime }), base64: arr[1], mime };
  };

  // --- ACTIONS ---

  const handleTransferToAnimate = (imgUrl: string) => {
    try {
      const { base64, mime } = parseDataUrl(imgUrl);
      setSelectedFile({ data: base64, mimeType: mime, name: 'Generated Asset' });
      setActiveModal('animate');
      setPrompt(''); // Clear prompt to let user describe movement
    } catch (e) {
      console.error("Failed to transfer image", e);
    }
  };

  const executeGeneration = async () => {
    if (!prompt.trim() && !selectedFile && activeModal !== 'animate') return;
    setIsLoading(true);
    setError(null);

    try {
      let url = "";
      let type: 'image' | 'video' | 'audio' = 'image';

      if (activeModal === 'image') {
        url = await geminiService.generateImagePro(prompt, aspectRatio, imageSize);
        type = 'image';
      } else if (activeModal === 'video') {
        url = await geminiService.generateVideo(prompt);
        type = 'video';
      } else if (activeModal === 'animate') {
        if (!selectedFile) throw new Error("Image required for Whisk animation.");
        const p = prompt.trim() || "Cinematic motion";
        url = await geminiService.animateImage(p, selectedFile.data, selectedFile.mimeType);
        type = 'video';
      } else if (activeModal === 'audio') {
        url = await geminiService.generateSpeech(prompt);
        type = 'audio';
      }

      setHistory(prev => [{ url, prompt: prompt || "Auto-Motion", timestamp: Date.now(), type }, ...prev]);
      
      // Reset after success
      if (activeModal !== 'image') {
         setPrompt('');
         setSelectedFile(null);
         setActiveModal(null);
      }
    } catch (e: any) {
      setError(e.message || "Generation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => setSelectedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, name: file.name });
      r.readAsDataURL(file);
    }
  };

  const handleSuggestion = (s: typeof suggestions[0]) => {
    setActiveModal(s.type as ModalType);
    setPrompt(s.prompt);
    if (s.type === 'animate') setSelectedFile(null); // Reset file for manual upload if suggestion clicked
  };

  const CardBtn = ({ icon, title, desc, color, onClick }: any) => {
    const colorClasses: Record<string, string> = {
        cyan: "bg-cyan-500/10 text-cyan-600 group-hover:scale-110",
        indigo: "bg-indigo-500/10 text-indigo-600 group-hover:scale-110",
        pink: "bg-pink-500/10 text-pink-600 group-hover:scale-110",
        amber: "bg-amber-500/10 text-amber-600 group-hover:scale-110",
    };

    return (
        <button onClick={onClick} className="glass-panel p-6 rounded-[32px] border border-black/5 dark:border-white/5 flex flex-col items-center gap-4 text-center hover:scale-[1.02] transition-all group hover:bg-white dark:hover:bg-slate-900 shadow-sm relative overflow-hidden h-full justify-center w-full">
            <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-inner transition-transform duration-500 ${colorClasses[color]}`}>
                <i className={`fa-solid ${icon} text-2xl`}></i>
            </div>
            <div className="space-y-1 relative z-10">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest opacity-80">{desc}</p>
            </div>
        </button>
    );
  };

  const isEmpty = history.length === 0;

  return (
    <div className={`max-w-7xl mx-auto h-full flex flex-col relative animate-reveal ${isEmpty ? 'overflow-hidden' : 'pb-24 px-4 sm:px-6 lg:px-8 pt-6 overflow-y-auto custom-scrollbar'}`}>
      
      {/* --- HEADER --- */}
      <div className={`flex items-center justify-between gap-6 border-b border-black/5 dark:border-white/5 shrink-0 z-20 ${isEmpty ? 'absolute top-0 left-0 right-0 p-6 md:p-8 border-none' : 'pb-6'}`}>
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-2xl">
            <i className="fa-solid fa-layer-group text-xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Creative Studio</h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">Multimodal Engine</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shadow-sm border border-black/5 dark:border-white/5">
           <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className={`flex-1 flex flex-col w-full ${isEmpty ? 'items-center justify-center' : 'pt-8'}`}>
        
        {/* DASHBOARD GRID */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 w-full ${isEmpty ? 'max-w-4xl scale-110 mb-12 -mt-16' : 'shrink-0'}`}>
           <CardBtn icon="fa-palette" title="Neural Canvas" desc="Text to Image" color="cyan" onClick={() => { setActiveModal('image'); setPrompt(''); }} />
           <CardBtn icon="fa-video" title="Veo Cinema" desc="Text to Video" color="indigo" onClick={() => { setActiveModal('video'); setPrompt(''); }} />
           <CardBtn icon="fa-wand-magic-sparkles" title="Whisk" desc="Animate Image" color="pink" onClick={() => { setActiveModal('animate'); setPrompt(''); setSelectedFile(null); }} />
           <CardBtn icon="fa-music" title="Lyria" desc="Music Generation" color="amber" onClick={() => { setActiveModal('audio'); setPrompt(''); }} />
        </div>

        {/* SUGGESTIONS (Visible only when empty) */}
        {isEmpty && (
           <div className="flex flex-wrap justify-center gap-3 max-w-2xl animate-reveal mt-8" style={{ animationDelay: '0.2s' }}>
              {suggestions.map((s, i) => (
                <button 
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="px-5 py-2.5 rounded-full glass-panel border border-black/5 dark:border-white/5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:bg-white dark:hover:bg-white/10 hover:scale-105 transition-all shadow-sm"
                >
                  <i className={`fa-solid ${s.type === 'image' ? 'fa-image' : s.type === 'video' ? 'fa-video' : s.type === 'animate' ? 'fa-wand-sparkles' : 'fa-music'} mr-2 opacity-50`}></i>
                  {s.label}
                </button>
              ))}
           </div>
        )}

        {/* --- HISTORY FEED (Visible only when has history) --- */}
        {!isEmpty && (
          <div className="flex-1 w-full pt-8">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 px-2">Gallery</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {history.map((item, i) => (
                   <div key={i} className="glass-panel p-4 rounded-[32px] border border-black/5 dark:border-white/5 space-y-4 animate-scale-in group">
                      {/* Media Display */}
                      <div className="aspect-square bg-slate-100 dark:bg-black/40 rounded-2xl overflow-hidden relative shadow-inner">
                         {item.type === 'image' && <img src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Generated" />}
                         {item.type === 'video' && <video src={item.url} controls className="w-full h-full object-cover" />}
                         {item.type === 'audio' && (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-amber-500/5">
                               <i className="fa-solid fa-music text-4xl text-amber-500 animate-bounce-subtle"></i>
                               <audio src={item.url} controls className="w-10/12" />
                            </div>
                         )}
                         <div className="absolute top-2 left-2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
                            {item.type}
                         </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2">
                         <button onClick={() => handleDownload(item.url, `orin-${item.type}-${item.timestamp}`)} className="flex-1 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                            Download
                         </button>
                         {item.type === 'image' && (
                            <button onClick={() => handleTransferToAnimate(item.url)} className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-pink-500/20">
                               <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Whisk
                            </button>
                         )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 line-clamp-2 px-1">"{item.prompt}"</p>
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* --- UNIFIED MODAL OVERLAY --- */}
      {activeModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-lg glass-panel bg-white dark:bg-slate-950 rounded-[48px] p-8 border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg ${
                       activeModal === 'image' ? 'bg-cyan-600' : activeModal === 'video' ? 'bg-indigo-600' : activeModal === 'animate' ? 'bg-pink-600' : 'bg-amber-500'
                    }`}>
                       <i className={`fa-solid ${activeModal === 'image' ? 'fa-palette' : activeModal === 'video' ? 'fa-video' : activeModal === 'animate' ? 'fa-wand-magic-sparkles' : 'fa-music'}`}></i>
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          {activeModal === 'image' ? 'Neural Canvas' : activeModal === 'video' ? 'Veo Cinema' : activeModal === 'animate' ? 'Whisk Animation' : 'Lyria Music'}
                       </h3>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                          {activeModal === 'image' ? 'Image Generation' : activeModal === 'video' ? 'Video Generation' : activeModal === 'animate' ? 'Image-to-Video' : 'Audio Synthesis'}
                       </p>
                    </div>
                 </div>
                 <button onClick={() => { setActiveModal(null); setError(null); setIsLoading(false); }} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:bg-red-500 hover:text-white transition-all">
                    <i className="fa-solid fa-xmark"></i>
                 </button>
              </div>

              <div className="space-y-6 overflow-y-auto custom-scrollbar px-1">
                 
                 {/* Image Upload Area for Animation */}
                 {activeModal === 'animate' && (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden group ${selectedFile ? 'border-pink-500 bg-pink-500/5' : 'border-slate-300 dark:border-white/20 hover:border-pink-400'}`}
                    >
                       {selectedFile ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                             <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" alt="Preview" />
                             <div className="z-10 bg-white/90 dark:bg-black/80 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                                <i className="fa-solid fa-check-circle text-pink-500"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Ready to Whisk</span>
                             </div>
                          </div>
                       ) : (
                          <div className="text-center text-slate-400">
                             <i className="fa-solid fa-cloud-arrow-up text-2xl mb-2"></i>
                             <p className="text-[10px] font-black uppercase tracking-widest">Upload Source Image</p>
                          </div>
                       )}
                       <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    </div>
                 )}

                 {/* Prompt Input */}
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                       {activeModal === 'animate' ? 'Motion Prompt (Optional)' : 'Description'}
                    </label>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={activeModal === 'image' ? "A futuristic cyberpunk city..." : activeModal === 'video' ? "A cat driving a car..." : activeModal === 'animate' ? "Pan camera right, cinematic lighting..." : "A cheerful jazz melody with saxophone..."}
                      className="w-full h-32 p-5 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-200 dark:border-white/10 outline-none resize-none text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                 </div>

                 {/* Image Specific Controls */}
                 {activeModal === 'image' && (
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Aspect Ratio</label>
                          <select 
                             value={aspectRatio} 
                             onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                             className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
                          >
                             {['1:1', '16:9', '9:16', '4:3', '3:4'].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Quality</label>
                          <select 
                             value={imageSize} 
                             onChange={(e) => setImageSize(e.target.value as ImageSize)}
                             className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold outline-none text-slate-700 dark:text-slate-300"
                          >
                             {['1K', '2K', '4K'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                       </div>
                    </div>
                 )}

                 {error && (
                   <div className="p-4 bg-red-500/10 rounded-2xl text-center border border-red-500/20">
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">{error}</p>
                   </div>
                 )}

                 <button 
                   onClick={executeGeneration}
                   disabled={isLoading || ((!prompt.trim() && !selectedFile) && activeModal !== 'animate')}
                   className={`w-full py-5 rounded-3xl text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-4 ${
                      activeModal === 'image' ? 'bg-cyan-600 hover:bg-cyan-500' : 
                      activeModal === 'video' ? 'bg-indigo-600 hover:bg-indigo-500' : 
                      activeModal === 'animate' ? 'bg-pink-600 hover:bg-pink-500' : 'bg-amber-500 hover:bg-amber-400'
                   }`}
                 >
                   {isLoading ? (
                      <>
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                        <span>Synthesizing...</span>
                      </>
                   ) : (
                      <>
                        <i className="fa-solid fa-bolt"></i>
                        <span>Generate</span>
                      </>
                   )}
                 </button>
                 
                 {activeModal !== 'audio' && <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest opacity-60">AI Generation takes time. Please wait.</p>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FeatureCreate;
