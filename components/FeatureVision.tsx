
import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { GroundingLink, Language } from '../types';

const FeatureVision: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<{ text: string; links: GroundingLink[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsLoading(true);
    setError(null);
    try {
      // Extract base64 and mimeType from data URL
      const base64 = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      
      // Fix: Added lang property from document attribute to satisfy geminiService.chat requirements.
      const lang = document.documentElement.lang as Language || 'en';
      const res = await geminiService.chat(prompt || "Analyze this image and extract any text.", {
        lang,
        fileData: { data: base64, mimeType: mimeType || 'image/jpeg' }
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vision & OCR</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`aspect-square rounded-[32px] border-4 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
              image ? 'border-blue-500 bg-blue-50/20' : 'border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200'
            }`}
          >
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
            {image ? (
              <img src={image} className="w-full h-full object-cover rounded-[28px]" alt="Source" />
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-sm text-slate-400">
                  <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Click to upload image</p>
              </div>
            )}
          </div>
          
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should I look for? (Optional)"
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm focus:border-blue-500 transition-all outline-none"
          />

          <button 
            onClick={handleAnalyze}
            disabled={isLoading || !image}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? <i className="fa-solid fa-spinner-third animate-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
            Analyze Visual
          </button>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs flex items-center gap-3">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
            </div>
          )}

          {result ? (
            <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm min-h-[400px] flex flex-col gap-6">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intelligence Report</div>
               <div className="flex-1 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap sinhala-text">
                 {result.text}
               </div>
               {result.links.length > 0 && (
                 <div className="pt-6 border-t border-slate-50 space-y-2">
                   {result.links.map((link, i) => (
                     <a key={i} href={link.uri} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[11px] font-bold text-blue-600 hover:underline">
                        <i className="fa-solid fa-link text-[10px]"></i>
                        {link.title}
                     </a>
                   ))}
                 </div>
               )}
            </div>
          ) : (
            <div className="h-full bg-slate-50/50 border border-slate-100 border-dashed rounded-[32px] flex items-center justify-center text-slate-300 text-xs italic">
              Result will appear here after analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureVision;
