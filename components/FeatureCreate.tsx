
import React from 'react';
import { geminiService } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

const StudioIcon = ({ className }: { className?: string }) => (
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M32 4V12M32 52V60M60 32H52M12 32H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M51.8 12.2L46.1 17.9M17.9 46.1L12.2 51.8M51.8 51.8L46.1 46.1M17.9 17.9L12.2 12.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="32" cy="32" r="8" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2"/>
    <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="animate-[spin_10s_linear_infinite]"/>
  </svg>
);

interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
}

const FeatureCreate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [prompt, setPrompt] = React.useState('');
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = React.useState<ImageSize>('1K');
  const [history, setHistory] = React.useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  const inputStyle = "w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-semibold focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm";

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
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black">Smart Design Engine</p>
              <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 text-[7px] font-black rounded border border-cyan-500/20">NEW</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Ready to Create</span>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shadow-sm border border-black/5 dark:border-white/5">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-8 items-start">
        {/* Left Control Panel */}
        <div className="space-y-6 lg:sticky lg:top-8 animate-reveal">
          <div className="glass-panel p-8 rounded-[40px] border border-slate-200 dark:border-white/5 shadow-2xl relative overflow-hidden bg-white dark:bg-slate-900/80 backdrop-blur-xl">
            <div className="space-y-6 relative z-10">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
                  <i className="fa-solid fa-pen-nib text-cyan-500 text-[8px]"></i>
                  Describe what you want
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: A futuristic city with flying cars and neon lights, high quality, cinematic look..."
                  className={`${inputStyle} h-48 resize-none text-base leading-relaxed focus:ring-cyan-500/10`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Shape</label>
                  <div className="relative group">
                    <select 
                      value={aspectRatio} 
                      onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                      className={`${inputStyle} pr-10 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/20`}
                    >
                      {['1:1', '16:9', '9:16', '4:3', '21:9'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Quality</label>
                  <div className="relative group">
                    <select 
                      value={imageSize} 
                      onChange={(e) => setImageSize(e.target.value as ImageSize)}
                      className={`${inputStyle} pr-10 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/20`}
                    >
                      {['1K', '2K', '4K'].map(s => <option key={s} value={s} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{s}</option>)}
                    </select>
                    <i className="fa-solid fa-star absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none text-[10px]"></i>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleGenerate()}
                disabled={isLoading || !prompt.trim()}
                className="w-full py-5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 group overflow-hidden relative"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-circle-notch animate-spin text-base"></i>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus text-base transition-transform group-hover:rotate-90"></i>
                    <span>Create Image</span>
                  </>
                )}
              </button>
              
              {error && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl animate-reveal">
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-4 glass-panel rounded-3xl border border-black/5 dark:border-white/5 opacity-70">
             <div className="flex items-center gap-3">
                <i className="fa-solid fa-shield-check text-cyan-600 text-xs"></i>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Images are private and safe.</p>
             </div>
          </div>
        </div>

        {/* Right Preview Area */}
        <div className="min-h-[600px] lg:min-h-[800px] glass-panel rounded-[56px] overflow-hidden flex flex-col items-center justify-start p-6 md:p-12 relative border border-slate-200 dark:border-white/5 animate-reveal bg-white dark:bg-slate-950 shadow-inner group/canvas transition-colors duration-500">
          {/* Subtle Background pattern */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none" style={{ 
            backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
          }}></div>
          
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-md animate-fade">
              <div className="text-center space-y-6 animate-reveal">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin mx-auto flex items-center justify-center">
                    <i className="fa-solid fa-palette text-2xl text-cyan-500/60"></i>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest animate-pulse">Designing your vision</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Please wait a moment...</p>
                </div>
              </div>
            </div>
          )}

          {history.length > 0 ? (
            <div className="w-full space-y-20 relative z-10">
              {history.map((img, idx) => (
                <div key={img.timestamp} className="w-full flex flex-col items-center gap-8 animate-scale-in max-w-4xl mx-auto">
                  <div className="relative group/img w-full">
                    <div className="absolute -inset-2 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 rounded-[48px] blur opacity-0 group-hover/img:opacity-100 transition-opacity duration-700"></div>
                    <div className="relative rounded-[40px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-black/5 flex items-center justify-center transition-all duration-700 hover:scale-[1.005]">
                      <img 
                        src={img.url} 
                        className="max-w-full max-h-[75vh] object-contain transition-transform duration-1000 ease-out" 
                        alt={img.prompt} 
                      />
                    </div>
                  </div>

                  <div className="w-full max-w-xl flex flex-col items-center gap-6">
                    <button 
                      onClick={() => handleDownload(img.url, `orin-studio-${img.timestamp}`)}
                      className="group/btn w-full py-4 bg-cyan-600 text-white rounded-3xl text-sm font-black uppercase tracking-[0.3em] shadow-xl hover:bg-cyan-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
                    >
                      <i className="fa-solid fa-cloud-arrow-down text-lg"></i>
                      <span>Download</span>
                    </button>

                    <div className="text-center px-6">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Prompt</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 italic leading-relaxed">"{img.prompt}"</p>
                    </div>
                    
                    {idx < history.length - 1 && (
                      <div className="w-24 h-1 bg-slate-200 dark:bg-white/5 rounded-full mt-12 opacity-30"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 relative z-10 py-24">
              <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-[40px] flex items-center justify-center text-slate-300 dark:text-slate-700">
                <i className="fa-solid fa-image text-5xl"></i>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.6em] text-slate-400 dark:text-slate-500 translate-x-1">Workspace Ready</p>
                <p className="text-sm font-bold text-slate-400/80 dark:text-slate-600 max-w-xs mx-auto leading-relaxed">Describe something to see it come to life.</p>
              </div>
            </div>
          )}
          
          {/* Corner frame decorations */}
          <div className="absolute top-10 left-10 w-12 h-12 border-t-2 border-l-2 border-slate-200 dark:border-white/10 rounded-tl-3xl pointer-events-none opacity-40"></div>
          <div className="absolute top-10 right-10 w-12 h-12 border-t-2 border-r-2 border-slate-200 dark:border-white/10 rounded-tr-3xl pointer-events-none opacity-40"></div>
          <div className="absolute bottom-10 left-10 w-12 h-12 border-b-2 border-l-2 border-slate-200 dark:border-white/10 rounded-bl-3xl pointer-events-none opacity-40"></div>
          <div className="absolute bottom-10 right-10 w-12 h-12 border-b-2 border-r-2 border-slate-200 dark:border-white/10 rounded-br-3xl pointer-events-none opacity-40"></div>
        </div>
      </div>
    </div>
  );
};

export default FeatureCreate;
