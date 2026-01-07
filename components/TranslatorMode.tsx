
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { Language } from '../types';
import { translations } from '../translations';
import { LiveServerMessage } from '@google/genai';

interface TranslatorModeProps {
  onClose: () => void;
  lang: Language;
}

const TranslatorMode: React.FC<TranslatorModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpeakerSide, setLastSpeakerSide] = useState<'A' | 'B' | null>(null); 
  
  const [transcriptA, setTranscriptA] = useState("");
  const [transcriptB, setTranscriptB] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const [volumeA, setVolumeA] = useState(0);
  const [volumeB, setVolumeB] = useState(0);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  function decodeBase64(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function encodeBase64(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  }

  const updateVisualizer = useCallback(() => {
    if (inputAnalyserRef.current && isActive) {
       const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
       inputAnalyserRef.current.getByteFrequencyData(data);
       const avg = data.reduce((a, b) => a + b) / data.length;
       
       if (!isSpeaking) {
          setVolumeA(Math.max(10, avg * 1.5));
          setVolumeB(Math.max(10, avg * 1.5));
       } else {
          if (lastSpeakerSide === 'A') {
             setVolumeB(Math.max(10, avg * 2));
             setVolumeA(10);
          } else {
             setVolumeA(Math.max(10, avg * 2));
             setVolumeB(10);
          }
       }
    }
    animationRef.current = requestAnimationFrame(updateVisualizer);
  }, [isActive, isSpeaking, lastSpeakerSide]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animationRef.current);
  }, [updateVisualizer]);

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      inputAudioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });

      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 64;

      const sessionPromise = geminiService.connectTranslator({
        onopen: () => {
          setIsConnecting(false);
          setIsActive(true);
          const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
          const processor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          source.connect(inputAnalyserRef.current!);
          source.connect(processor);
          processor.connect(inputAudioContextRef.current!.destination);

          processor.onaudioprocess = (e) => {
             const inputData = e.inputBuffer.getChannelData(0);
             const int16 = new Int16Array(inputData.length);
             for(let i=0; i<inputData.length; i++) int16[i] = inputData[i] * 32768;
             sessionPromise.then(session => {
                if (session) session.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
             });
          };
        },
        onmessage: async (msg: LiveServerMessage) => {
           if (msg.serverContent?.outputTranscription) {
              const text = msg.serverContent.outputTranscription.text;
              const isSinhala = /[\u0D80-\u0DFF]/.test(text);
              if (isSinhala) {
                 setTranscriptB(text);
                 setLastSpeakerSide('A');
              } else {
                 setTranscriptA(text);
                 setLastSpeakerSide('B');
              }
           }
           
           const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
           if (audioData && audioContextRef.current && audioContextRef.current.state !== 'closed') {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decodeBase64(audioData), audioContextRef.current);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              const now = audioContextRef.current.currentTime;
              if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              source.onended = () => setIsSpeaking(false);
              sourcesRef.current.add(source);
           }
        },
        onclose: () => {
           setIsActive(false);
           setIsConnecting(false);
        },
        onerror: (e: any) => {
           console.error("Translator Error", e);
           setIsActive(false);
           setIsConnecting(false);
        }
      }, { source: 'English', target: 'Sinhala' });

      sessionRef.current = await sessionPromise;
    } catch (e) {
       console.error("Failed to start translator", e);
       setIsConnecting(false);
    }
  };

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e) {}
        sessionRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch(e) {}
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        try { inputAudioContextRef.current.close(); } catch(e) {}
    }
    setIsActive(false);
    setIsSpeaking(false);
    setTranscriptA("");
    setTranscriptB("");
  }, []);

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal overflow-hidden">
       <div className={`flex-1 flex ${isMobile ? 'flex-col' : 'flex-row'}`}>
          <div className={`flex-1 relative transition-all duration-500 flex flex-col items-center justify-center p-10 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5 ${lastSpeakerSide === 'B' ? 'bg-blue-500/5' : 'bg-transparent'} ${isMobile ? 'rotate-180' : ''}`}>
             <div className="absolute top-10 left-10 flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                 <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t.transMode.sideA}</span>
             </div>
             <div className="w-40 h-40 md:w-56 md:h-56 rounded-full border border-slate-200 dark:border-white/5 flex items-center justify-center relative mb-12">
                <div className="w-full h-full rounded-full bg-blue-500/10 transition-all duration-150 absolute" style={{ transform: `scale(${1 + volumeA / 120})`, opacity: isActive ? 1 : 0 }}></div>
                <div className="w-4/5 h-4/5 rounded-full bg-blue-500/5 absolute animate-soft-pulse"></div>
                <i className={`fa-solid fa-microphone text-4xl md:text-6xl ${isActive ? 'text-blue-500' : 'text-slate-300'}`}></i>
             </div>
             <div className="text-center min-h-[100px] max-w-md">
                <p className={`text-2xl md:text-3xl font-black text-slate-900 dark:text-white transition-opacity duration-300 ${transcriptA ? 'opacity-100' : 'opacity-30'}`}>
                   {transcriptA || (isActive ? t.transMode.listening : "Ready")}
                </p>
             </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] flex flex-col items-center gap-6 w-full pointer-events-none">
             <div className="pointer-events-auto">
                {!isActive ? (
                    <button onClick={startSession} disabled={isConnecting} className="w-24 h-24 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-8 border-slate-50 dark:border-slate-900 group">
                        {isConnecting ? <i className="fa-solid fa-circle-notch animate-spin text-2xl"></i> : <i className="fa-solid fa-play text-2xl ml-1 group-hover:scale-110 transition-transform"></i>}
                    </button>
                ) : (
                    <button onClick={stopSession} className="w-24 h-24 rounded-full bg-red-500 text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-8 border-slate-50 dark:border-slate-900 animate-pulse">
                        <i className="fa-solid fa-stop text-2xl"></i>
                    </button>
                )}
             </div>
             {isActive && (
                <div className="glass-panel px-6 py-2 rounded-full border border-white/20 shadow-2xl backdrop-blur-3xl animate-reveal">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 flex items-center gap-3">
                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                       {t.transMode.autoDetect}
                    </span>
                </div>
             )}
          </div>

          <div className={`flex-1 relative transition-all duration-500 flex flex-col items-center justify-center p-10 ${lastSpeakerSide === 'A' ? 'bg-emerald-500/5' : 'bg-transparent'}`}>
             <div className="absolute top-10 left-10 flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                 <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t.transMode.sideB}</span>
             </div>
             <div className="w-40 h-40 md:w-56 md:h-56 rounded-full border border-slate-200 dark:border-white/5 flex items-center justify-center relative mb-12">
                <div className="w-full h-full rounded-full bg-emerald-500/10 transition-all duration-150 absolute" style={{ transform: `scale(${1 + volumeB / 120})`, opacity: isActive ? 1 : 0 }}></div>
                <div className="w-4/5 h-4/5 rounded-full bg-emerald-500/5 absolute animate-soft-pulse" style={{ animationDelay: '1s' }}></div>
                <i className={`fa-solid fa-microphone text-4xl md:text-6xl ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}></i>
             </div>
             <div className="text-center min-h-[100px] max-w-md">
                <p className={`text-2xl md:text-3xl font-black text-slate-900 dark:text-white sinhala-text transition-opacity duration-300 ${transcriptB ? 'opacity-100' : 'opacity-30'}`}>
                   {transcriptB || (isActive ? t.transMode.listening : "සූදානම්")}
                </p>
             </div>
          </div>
       </div>

       <button onClick={onClose} className="absolute top-8 right-8 w-12 h-12 rounded-full glass-panel flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all z-[80] shadow-xl border border-black/5 dark:border-white/10">
          <i className="fa-solid fa-xmark text-lg"></i>
       </button>
    </div>
  );
};

export default TranslatorMode;
