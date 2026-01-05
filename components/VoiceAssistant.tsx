
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { Language } from '../types';
import { translations } from '../translations';
import { LiveServerMessage, Modality } from '@google/genai';

interface VoiceAssistantProps {
  onClose: () => void;
  lang: Language;
  inline?: boolean;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onClose, lang, inline = false }) => {
  const t = translations[lang];
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Visualizer: 7 Ultra-Wide "Fatty" Bars
  const BAR_COUNT = 7;
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(BAR_COUNT).fill(12));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Transcription
  const [transcription, setTranscription] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const scrollTranscriptionRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const updateVisualizer = useCallback(() => {
    const dataArray = new Uint8Array(BAR_COUNT);
    let hasSignal = false;

    if (isSpeaking && analyserRef.current) {
      analyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    } else if (isActive && inputAnalyserRef.current) {
      inputAnalyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    }

    if (hasSignal) {
      const levels = Array.from(dataArray).map(v => Math.max(16, (v / 255) * 100));
      setAudioLevels(levels);
    } else {
      setAudioLevels(prev => prev.map((v, i) => {
        const time = Date.now() / 1000;
        const idle = 15 + Math.sin(time * 2.5 + i) * 8;
        return v * 0.85 + idle * 0.15; 
      }));
    }

    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, [isActive, isSpeaking]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [updateVisualizer]);

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

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

  const stopAiSpeaking = useCallback(() => {
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
    setIsSpeaking(false);
  }, []);

  const stopSession = useCallback(() => {
    stopAiSpeaking();
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e) {}
      audioContextRef.current = null;
    }
    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch(e) {}
      inputAudioContextRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
  }, [stopAiSpeaking]);

  const startSession = async () => {
    setErrorMessage(null);
    setIsConnecting(true);
    setTranscription([]);
    
    try {
      // Ensure user interaction rules are satisfied
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (context.state === 'suspended') await context.resume();
      audioContextRef.current = context;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 32; 
      analyserRef.current.connect(audioContextRef.current.destination);

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 32;

      const sessionPromise = geminiService.connectLive({
        onopen: () => {
          setIsConnecting(false);
          setIsActive(true);
          const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
          const processor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          source.connect(inputAnalyserRef.current!);
          
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            sessionPromise.then(session => {
              try {
                session.sendRealtimeInput({ 
                  media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } 
                });
              } catch (err) {}
            });
          };
          source.connect(processor);
          processor.connect(inputAudioContextRef.current!.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          if (msg.serverContent?.inputTranscription) {
            const text = msg.serverContent.inputTranscription.text;
            setTranscription(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user') return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                return [...prev, { role: 'user', text }];
            });
          } else if (msg.serverContent?.outputTranscription) {
            const text = msg.serverContent.outputTranscription.text;
             setTranscription(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                return [...prev, { role: 'model', text }];
            });
          }

          const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData && audioContextRef.current && analyserRef.current) {
            setIsSpeaking(true);
            const buffer = await decodeAudioData(decodeBase64(audioData), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(analyserRef.current);
            
            const now = audioContextRef.current.currentTime;
            if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05; 
            
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) setIsSpeaking(false);
            };
          }
          if (msg.serverContent?.interrupted) stopAiSpeaking();
        },
        onclose: () => {
          setIsActive(false);
          setIsConnecting(false);
          setIsSpeaking(false);
        },
        onerror: (e: any) => {
          console.error("Voice Error:", e);
          const msg = e.message || "Endpoint unreachable. Check your API Key.";
          setErrorMessage(msg);
          setIsActive(false);
          setIsConnecting(false);
          if (msg.includes("API Key") && (window as any).aistudio) (window as any).aistudio.openSelectKey();
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e: any) {
      setErrorMessage(e.message || "Handshake failed.");
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  useEffect(() => {
    if (scrollTranscriptionRef.current) {
        scrollTranscriptionRef.current.scrollTop = scrollTranscriptionRef.current.scrollHeight;
    }
  }, [transcription]);

  const content = (
    <div className={`max-w-md w-full glass-panel rounded-[48px] p-8 md:p-12 border border-slate-200 dark:border-white/5 shadow-2xl relative z-10 flex flex-col items-center gap-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-2xl transition-all duration-700 ${isSpeaking ? 'ring-4 ring-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.15)]' : ''}`}>
      <div className="text-center space-y-4 relative w-full">
        {isActive && isSpeaking && (
          <button 
            onClick={stopAiSpeaking}
            className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl animate-reveal z-50 border-4 border-white dark:border-slate-900"
            title={t.stopSpeaking}
          >
            <i className="fa-solid fa-volume-xmark"></i>
          </button>
        )}

        <div className={`w-28 h-28 rounded-[40px] relative flex items-center justify-center mx-auto transition-all duration-700 ${
          isActive 
            ? 'bg-cyan-600 shadow-2xl shadow-cyan-600/40 text-white' 
            : 'bg-slate-200 dark:bg-white/10 text-slate-400'
          }`}>
          
          {isActive && (
            <div className={`absolute -inset-4 rounded-[48px] border-2 border-cyan-500/30 ${isSpeaking ? 'animate-pulse' : 'animate-soft-pulse'}`}></div>
          )}
          
          <i className={`fa-solid ${isActive ? 'fa-microphone-lines' : 'fa-microphone'} text-5xl transition-transform duration-500 ${isSpeaking ? 'scale-110' : ''}`}></i>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.voice}</h2>
            <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-600 text-[9px] font-black rounded-md uppercase tracking-widest border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse beta-glow">BETA</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isActive ? t.neuralBridgeActive : 'Ready to engage'}</p>
        </div>
      </div>

      {errorMessage && (
        <div className="w-full p-5 bg-red-500/10 border border-red-500/20 rounded-[28px] animate-reveal">
           <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-widest leading-relaxed">
             <i className="fa-solid fa-circle-exclamation mr-2"></i>
             {errorMessage}
           </p>
           <button onClick={startSession} className="w-full mt-3 text-[9px] font-black text-red-600 uppercase tracking-widest hover:underline">Retry Connection</button>
        </div>
      )}

      {/* Fatty Bars - 7 Ultra Wide Bars */}
      <div className="w-full h-28 flex items-end justify-center gap-3 md:gap-4 px-2 relative">
        {audioLevels.map((level, i) => (
          <div 
            key={i} 
            className={`w-10 md:w-12 rounded-full transition-all duration-150 ${isActive ? 'bg-gradient-to-t from-cyan-600 to-indigo-500 shadow-[0_0_30px_rgba(6,182,212,0.5)]' : 'bg-slate-300 dark:bg-slate-800 opacity-20'}`}
            style={{ 
              height: `${Math.max(16, level)}%`,
              opacity: isActive ? 0.7 + (level/100)*0.3 : 0.2
            }}
          ></div>
        ))}
      </div>

      {/* Transcription Area */}
      {isActive && (
        <div 
            ref={scrollTranscriptionRef}
            className="w-full h-36 overflow-y-auto custom-scrollbar bg-black/5 dark:bg-white/5 rounded-[28px] p-5 flex flex-col gap-3 border border-black/5 dark:border-white/5 shadow-inner"
        >
            {transcription.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                   <div className="w-8 h-1 bg-slate-300 dark:bg-slate-700 rounded-full animate-pulse"></div>
                   <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic text-center">Awaiting Input Stream</p>
                </div>
            ) : (
                transcription.map((item, i) => (
                    <div key={i} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-[12px] font-medium leading-relaxed max-w-[85%] ${item.role === 'user' ? 'bg-white/60 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-right' : 'text-cyan-600 dark:text-cyan-400 font-bold'}`}>
                            {item.text}
                        </div>
                    </div>
                ))
            )}
        </div>
      )}

      <div className="w-full space-y-4">
        {!isActive ? (
          <button 
            onClick={startSession} 
            disabled={isConnecting}
            className="w-full py-7 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
          >
            {isConnecting ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-microphone"></i>}
            {isConnecting ? t.establishingHandshake : 'Initialize Orin Voice'}
          </button>
        ) : (
          <button 
            onClick={stopSession} 
            className="w-full py-7 bg-red-500 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            <i className="fa-solid fa-phone-slash"></i>
            {t.endSession}
          </button>
        )}
        
        {!inline && (
          <button onClick={onClose} className="w-full text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors">{t.back}</button>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="h-full flex items-center justify-center p-6 animate-reveal">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 md:p-12 animate-reveal">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={onClose}></div>
      {content}
    </div>
  );
};

export default VoiceAssistant;
