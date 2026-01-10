
import React from 'react';
import { geminiService } from '../services/geminiService';
import { AspectRatio, ImageSize } from '../types';

const StudioIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-soft-pulse">
    <path d="M32 4V12M32 52V60M60 32H52M12 32H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M51.8 12.2L46.1 17.9M17.9 46.1L12.2 51.8M51.8 51.8L46.1 46.1M17.9 17.9L12.2 12.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="32" cy="32" r="8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2"/>
    <path d="M32 20C38.6274 20 44 25.3726 44 32C44 38.6274 38.6274 44 32 44C25.3726 44 20 38.6274 20 32C20 25.3726 25.3726 20 32 20Z" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4"/>
  </svg>
);

const FeatureCreate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [prompt, setPrompt] = React.useState('');
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = React.useState<ImageSize>('1K');
  const [result, setResult] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const url = await geminiService.generateImagePro(finalPrompt, aspectRatio, imageSize);
      setResult(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const response = await fetch(result);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orin-creative-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const inputStyle = "w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-semibold focus:border-cyan-500 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner";

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-reveal pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-palette text-xl"></i>
          </div>
          <div className="space-y-0.5">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Studio</h2>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.4em] font-black">Official Creation Hub</p>
          </div>
        </div>
        <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all shadow-sm">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-10 items-start">
        <div className="space-y-8 glass-panel p-8 rounded-[40px] animate-reveal border border-slate-200 dark:border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-slate-900 dark:text-white">
            <StudioIcon />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Describe Concept</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the scene in detail..."
              className={`${inputStyle} h-40 resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Ratio</label>
              <select 
                value={aspectRatio} 
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className={inputStyle}
              >
                {['1:1', '16:9', '9:16', '4:3'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Quality</label>
              <select 
                value={imageSize} 
                onChange={(e) => setImageSize(e.target.value as ImageSize)}
                className={inputStyle}
              >
                {['1K', '2K', '4K'].map(s => <option key={s} value={s} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{s}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={() => handleGenerate()}
            disabled={isLoading || !prompt.trim()}
            className="w-full py-5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-[22px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-cyan-500/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
            Create Asset
          </button>
          
          {error && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center animate-bounce">{error}</p>}
        </div>

        <div className="min-h-[600px] glass-panel rounded-[48px] overflow-hidden flex flex-col items-center justify-center p-8 relative border border-slate-200 dark:border-white/5 animate-reveal bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.03)_0%,transparent_70%)]">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

          {isLoading ? (
            <div className="text-center space-y-6 relative z-10">
              <div className="w-20 h-20 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin mx-auto flex items-center justify-center">
                 <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-b-cyan-500 animate-spin-reverse"></div>
              </div>
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.5em] animate-pulse">Rendering Asset</p>
            </div>
          ) : result ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-8 animate-reveal relative z-10">
              <div className="group relative rounded-[40px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-black/5 hover:border-cyan-500/30 transition-all duration-500 max-w-full">
                <img 
                  src={result} 
                  className="max-w-full max-h-[60vh] object-contain transition-transform duration-700 ease-out group-hover:scale-[1.01]" 
                  alt="Generated Result" 
                />
              </div>
              <div className="w-full max-w-lg space-y-4">
                <button 
                  onClick={handleDownload}
                  className="w-full py-5 bg-cyan-600 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-cyan-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 group"
                >
                  <i className="fa-solid fa-cloud-arrow-down text-lg group-hover:translate-y-1 transition-transform"></i>
                  Download Result
                </button>
                <div className="flex items-center justify-center gap-2 opacity-40">
                  <i className="fa-solid fa-shield-check text-[10px] text-cyan-600"></i>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Neural synthesis verified by Orin Engine</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-8 relative z-10">
              <div className="text-slate-300 dark:text-slate-700 mx-auto transition-transform hover:scale-110 duration-500">
                <StudioIcon />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400 dark:text-slate-600">Studio Ready</p>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-700">Enter a concept prompt to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureCreate;
