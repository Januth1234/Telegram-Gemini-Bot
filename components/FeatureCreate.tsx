
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
}

type StudioTab = 'image' | 'video';

const FeatureCreate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const url = await geminiService.generateImagePro(finalPrompt, aspectRatio, imageSize);
      const newImage: GeneratedImage = {
        url,
        prompt: finalPrompt,
        timestamp: Date.now()
      };
      setHistory(prev => [newImage, ...prev]);
      setPrompt(''); 
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
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
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const inputStyle = "w-full p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl text-sm font-semibold focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm";

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-reveal pb-24 px-4 sm:px-6 lg:px-8 pt-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-black/5 dark:border-white/5 pb-8">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-3xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-2xl">
            <i className="fa-solid fa-wand-magic-sparkles text-2xl"></i>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Studio Create</h2>
            <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
              <button 
                onClick={() => setActiveTab('image')}
                className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all border ${activeTab === 'image' ? 'bg-cyan-600 text-white border-cyan-600 shadow-lg shadow-cyan-600/20' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Neural Images
              </button>
              <button 
                onClick={() => setActiveTab('video')}
                className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all border ${activeTab === 'video' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Motion Synth
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shadow-sm border border-black/5 dark:border-white/5">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      {activeTab === 'video' ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-10 animate-reveal">
           <div className="relative">
              <div className="w-32 h-32 rounded-[48px] bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700 animate-beta-pulse">
                <i className="fa-solid fa-clapperboard text-6xl"></i>
              </div>
              <div className="absolute -top-4 -right-4 px-3 py-1 bg-cyan-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg border-2 border-white dark:border-slate-950">In Progress</div>
           </div>
           <div className="text-center space-y-3">
             <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">AI Video Generation</h3>
             <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.5em] animate-pulse">Orin Neural Motion v5.0-Preview</p>
             <p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-sm pt-4 leading-relaxed mx-auto opacity-70">
               We are calibrating the neural pipeline for cinematic motion synthesis. This feature will be deployed in the upcoming major Orin update.
             </p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[440px,1fr] gap-10 items-start">
          {/* Left Control Panel */}
          <div className="space-y-6 lg:sticky lg:top-8 animate-reveal">
            <div className="glass-panel p-10 rounded-[48px] border border-slate-200 dark:border-white/10 shadow-2xl relative overflow-hidden bg-white dark:bg-slate-900/90 backdrop-blur-3xl">
              <div className="space-y-8 relative z-10">
                <div className="space-y-4">
                  <label className="flex items-center gap-3 text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest px-1">
                    <i className="fa-solid fa-terminal text-cyan-500"></i>
                    Neural Input Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your vision in high detail..."
                    className={`${inputStyle} h-56 resize-none leading-relaxed text-base`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Aspect Ratio</label>
                    <div className="relative group">
                      <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className={`${inputStyle} pr-12 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                      >
                        {['1:1', '16:9', '9:16', '4:3', '21:9', '3:2'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)}
                      </select>
                      <i className="fa-solid fa-shapes absolute right-5 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none text-[12px]"></i>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Synthesis Quality</label>
                    <div className="relative group">
                      <select 
                        value={imageSize} 
                        onChange={(e) => setImageSize(e.target.value as ImageSize)}
                        className={`${inputStyle} pr-12 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                      >
                        {['1K', '2K', '4K'].map(s => <option key={s} value={s} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{s}</option>)}
                      </select>
                      <i className="fa-solid fa-microchip absolute right-5 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none text-[12px]"></i>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleGenerate()}
                  disabled={isLoading || !prompt.trim()}
                  className="w-full py-6 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-4 group relative overflow-hidden"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-dna animate-spin"></i>
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-sparkles transition-transform group-hover:rotate-45"></i>
                      <span>Generate Asset</span>
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-3xl animate-reveal">
                    <p className="text-[10px] text-red-500 font-black uppercase tracking-widest text-center leading-relaxed">{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 glass-panel rounded-[32px] border border-black/5 dark:border-white/5 opacity-80">
               <div className="flex items-start gap-4">
                  <i className="fa-solid fa-shield-halved text-cyan-600 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Neural Safety Core Active</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-500 font-bold mt-1">All generated content is private and adheres to JN Global safety protocols.</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Preview Area */}
          <div className="min-h-[700px] glass-panel rounded-[64px] overflow-hidden flex flex-col items-center justify-start p-6 md:p-14 relative border border-slate-200 dark:border-white/5 animate-reveal bg-white dark:bg-slate-950 shadow-inner">
            <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '48px 48px' }}></div>
            
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl animate-fade">
                <div className="text-center space-y-8 animate-reveal">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-2 border-cyan-500/10 border-t-cyan-500 animate-spin mx-auto flex items-center justify-center shadow-2xl">
                      <i className="fa-solid fa-layer-group text-3xl text-cyan-500/40"></i>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Neural Handshake Active</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] font-black animate-pulse">Mapping Latent Space...</p>
                  </div>
                </div>
              </div>
            )}

            {history.length > 0 ? (
              <div className="w-full space-y-28 relative z-10">
                {history.map((img, idx) => (
                  <div key={img.timestamp} className="w-full flex flex-col items-center gap-12 animate-scale-in max-w-4xl mx-auto group/item">
                    <div className="relative group/img w-full">
                      <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/10 to-indigo-500/10 rounded-[56px] blur opacity-0 group-hover/img:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative rounded-[48px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-center transition-all duration-700">
                        <img 
                          src={img.url} 
                          className="max-w-full max-h-[80vh] object-contain transition-transform duration-1000 ease-out group-hover/item:scale-[1.04]" 
                          alt={img.prompt} 
                        />
                      </div>
                    </div>

                    <div className="w-full max-w-xl flex flex-col items-center gap-8">
                      <div className="w-full">
                        <button 
                          onClick={() => handleDownload(img.url, `orin-asset-${img.timestamp}`)}
                          className="w-full py-5 bg-cyan-600 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-cyan-600/10 hover:bg-cyan-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                        >
                          <i className="fa-solid fa-download text-lg"></i>
                          <span>Secure Download</span>
                        </button>
                      </div>

                      <div className="text-center px-10">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Generation Script</p>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-200 italic leading-relaxed">"{img.prompt}"</p>
                      </div>
                    </div>
                    {idx < history.length - 1 && <div className="w-32 h-[1px] bg-slate-200 dark:bg-white/5 rounded-full mt-10"></div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 relative z-10 py-32 opacity-40">
                <div className="w-28 h-28 bg-slate-100 dark:bg-white/5 rounded-[48px] flex items-center justify-center text-slate-300 dark:text-slate-700 shadow-inner">
                  <i className="fa-solid fa-cube text-5xl"></i>
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-black uppercase tracking-[0.8em] text-slate-400 dark:text-slate-500 translate-x-2">Idle Mode</p>
                  <p className="text-sm font-bold text-slate-400/80 dark:text-slate-600 max-w-xs mx-auto leading-relaxed">Synthesis pipeline ready for neural instruction.</p>
                </div>
              </div>
            )}
            
            {/* Aesthetic Borders */}
            <div className="absolute top-12 left-12 w-16 h-16 border-t border-l border-slate-200 dark:border-white/5 rounded-tl-[40px] pointer-events-none"></div>
            <div className="absolute top-12 right-12 w-16 h-16 border-t border-r border-slate-200 dark:border-white/5 rounded-tr-[40px] pointer-events-none"></div>
            <div className="absolute bottom-12 left-12 w-16 h-16 border-b border-l border-slate-200 dark:border-white/5 rounded-bl-[40px] pointer-events-none"></div>
            <div className="absolute bottom-12 right-12 w-16 h-16 border-b border-r border-slate-200 dark:border-white/5 rounded-br-[40px] pointer-events-none"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureCreate;
