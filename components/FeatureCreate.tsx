
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

interface GeneratedAsset {
  url: string;
  prompt: string;
  timestamp: number;
  type: 'image' | 'video';
}

type StudioTab = 'image' | 'video';

const FeatureCreate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Loading messages
    const imageMessages = ["Synthesizing pixels...", "Refining details...", "Applying aesthetics...", "Final polish..."];
    const videoMessages = ["Initializing Veo 3.1...", "Simulating physics...", "Rendering frames...", "Encoding stream..."];
    const msgs = activeTab === 'video' ? videoMessages : imageMessages;
    setLoadingMessage(msgs[0]);
    
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % msgs.length;
        setLoadingMessage(msgs[msgIdx]);
    }, 3000);

    try {
      let url = "";
      if (activeTab === 'image') {
        url = await geminiService.generateImagePro(finalPrompt, aspectRatio, imageSize);
      } else {
        // Map UI aspect ratio to Veo supported ratios (16:9 or 9:16)
        // If user selects something else, fallback to 16:9 or 9:16
        const veoRatio = (aspectRatio === '9:16' || aspectRatio === '3:4') ? '9:16' : '16:9';
        url = await geminiService.generateVideo(finalPrompt, veoRatio, videoResolution);
      }

      const newAsset: GeneratedAsset = {
        url,
        prompt: finalPrompt,
        timestamp: Date.now(),
        type: activeTab
      };
      setHistory(prev => [newAsset, ...prev]);
      setPrompt(''); 
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      clearInterval(msgInterval);
      setIsLoading(false);
    }
  };

  const handleDownload = async (asset: GeneratedAsset) => {
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `orin-${asset.type}-${asset.timestamp}.${asset.type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const inputStyle = "w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs md:text-sm font-semibold focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm";

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-reveal pb-12 px-2 sm:px-6 lg:px-8 pt-4 h-full flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl">
            <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Studio Create</h2>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
              <button 
                onClick={() => setActiveTab('image')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${activeTab === 'image' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Images
              </button>
              <button 
                onClick={() => setActiveTab('video')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${activeTab === 'video' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Veo
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 transition-all shadow-sm border border-black/5 dark:border-white/5">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6 items-start overflow-hidden">
          {/* Left Control Panel */}
          <div className="space-y-4 lg:overflow-y-auto custom-scrollbar h-full lg:pr-2">
            <div className="glass-panel p-6 rounded-[32px] border border-slate-200 dark:border-white/10 shadow-xl relative bg-white dark:bg-slate-900/90 backdrop-blur-3xl">
              <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest px-1">
                    <i className="fa-solid fa-terminal text-cyan-500"></i>
                    {activeTab === 'video' ? 'Motion Prompt' : 'Neural Input Prompt'}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={activeTab === 'video' ? "Describe the motion, camera angle, and scene..." : "Describe your vision in high detail..."}
                    className={`${inputStyle} h-32 resize-none leading-relaxed text-sm`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Ratio</label>
                    <div className="relative group">
                      <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                      >
                        {activeTab === 'image' ? (
                            ['1:1', '16:9', '9:16', '4:3', '21:9', '3:2'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)
                        ) : (
                            ['16:9', '9:16'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)
                        )}
                      </select>
                      <i className="fa-solid fa-shapes absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none text-[10px]"></i>
                    </div>
                  </div>
                  
                  {activeTab === 'image' ? (
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Quality</label>
                        <div className="relative group">
                        <select 
                            value={imageSize} 
                            onChange={(e) => setImageSize(e.target.value as ImageSize)}
                            className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                        >
                            {['1K', '2K', '4K'].map(s => <option key={s} value={s} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{s}</option>)}
                        </select>
                        <i className="fa-solid fa-microchip absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none text-[10px]"></i>
                        </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Resolution</label>
                        <div className="relative group">
                        <select 
                            value={videoResolution} 
                            onChange={(e) => setVideoResolution(e.target.value as '720p' | '1080p')}
                            className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                        >
                            <option value="720p" className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">720p (Fast)</option>
                            <option value="1080p" className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">1080p (HD)</option>
                        </select>
                        <i className="fa-solid fa-film absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none text-[10px]"></i>
                        </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => handleGenerate()}
                  disabled={isLoading || !prompt.trim()}
                  className="w-full py-4 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-dna animate-spin"></i>
                      <span>{activeTab === 'video' ? 'Rendering...' : 'Synthesizing...'}</span>
                    </>
                  ) : (
                    <>
                      <i className={`fa-solid ${activeTab === 'video' ? 'fa-clapperboard' : 'fa-sparkles'} transition-transform group-hover:rotate-12`}></i>
                      <span>{activeTab === 'video' ? 'Generate Video' : 'Generate Asset'}</span>
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-reveal">
                    <p className="text-[9px] text-red-500 font-black uppercase tracking-widest text-center leading-relaxed">{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 glass-panel rounded-3xl border border-black/5 dark:border-white/5 opacity-80">
               <div className="flex items-start gap-3">
                  <i className="fa-solid fa-shield-halved text-cyan-600 text-base mt-0.5"></i>
                  <div>
                    <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Neural Safety Core Active</p>
                    <p className="text-[8px] text-slate-500 dark:text-slate-500 font-bold mt-1">All generated content is private and adheres to safety protocols.</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Preview Area */}
          <div className="min-h-[500px] h-full glass-panel rounded-[40px] overflow-hidden flex flex-col items-center justify-start p-6 relative border border-slate-200 dark:border-white/5 animate-reveal bg-white dark:bg-slate-950 shadow-inner overflow-y-auto custom-scrollbar">
            <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '48px 48px' }}></div>
            
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl animate-fade">
                <div className="text-center space-y-6 animate-reveal">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-2 border-cyan-500/10 border-t-cyan-500 animate-spin mx-auto flex items-center justify-center shadow-2xl">
                      <i className={`fa-solid ${activeTab === 'video' ? 'fa-video' : 'fa-layer-group'} text-2xl text-cyan-500/40`}></i>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tighter">Neural Handshake Active</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] font-black animate-pulse">{loadingMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {history.length > 0 ? (
              <div className="w-full space-y-20 relative z-10 py-6">
                {history.map((asset, idx) => (
                  <div key={asset.timestamp} className="w-full flex flex-col items-center gap-8 animate-scale-in max-w-4xl mx-auto group/item">
                    <div className="relative group/img w-full">
                      <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/10 to-indigo-500/10 rounded-[48px] blur opacity-0 group-hover/img:opacity-100 transition-opacity duration-700"></div>
                      <div className="relative rounded-[40px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-center transition-all duration-700 min-h-[300px]">
                        {asset.type === 'video' ? (
                            <video 
                                src={asset.url} 
                                controls 
                                className="max-w-full max-h-[70vh] object-contain"
                                poster={asset.url + "#t=0.5"} // Trick to show thumbnail
                            />
                        ) : (
                            <img 
                                src={asset.url} 
                                className="max-w-full max-h-[70vh] object-contain transition-transform duration-1000 ease-out group-hover/item:scale-[1.02]" 
                                alt={asset.prompt} 
                            />
                        )}
                      </div>
                    </div>

                    <div className="w-full max-w-lg flex flex-col items-center gap-6">
                      <div className="w-full">
                        <button 
                          onClick={() => handleDownload(asset)}
                          className="w-full py-4 bg-cyan-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-cyan-600/10 hover:bg-cyan-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                          <i className="fa-solid fa-download text-base"></i>
                          <span>Secure Download</span>
                        </button>
                      </div>

                      <div className="text-center px-6">
                        <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Generation Script</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 italic leading-relaxed line-clamp-3">"{asset.prompt}"</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">{asset.type.toUpperCase()}</p>
                      </div>
                    </div>
                    {idx < history.length - 1 && <div className="w-24 h-[1px] bg-slate-200 dark:bg-white/5 rounded-full mt-8"></div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 relative z-10 opacity-40">
                <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-[32px] flex items-center justify-center text-slate-300 dark:text-slate-700 shadow-inner">
                  <i className="fa-solid fa-cube text-4xl"></i>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400 dark:text-slate-500 translate-x-1">Idle Mode</p>
                  <p className="text-xs font-bold text-slate-400/80 dark:text-slate-600 max-w-xs mx-auto leading-relaxed">Synthesis pipeline ready.</p>
                </div>
              </div>
            )}
            
            {/* Aesthetic Borders */}
            <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-slate-200 dark:border-white/5 rounded-tl-[32px] pointer-events-none"></div>
            <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-slate-200 dark:border-white/5 rounded-tr-[32px] pointer-events-none"></div>
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-slate-200 dark:border-white/5 rounded-bl-[32px] pointer-events-none"></div>
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-slate-200 dark:border-white/5 rounded-br-[32px] pointer-events-none"></div>
          </div>
      </div>
    </div>
  );
};

export default FeatureCreate;
