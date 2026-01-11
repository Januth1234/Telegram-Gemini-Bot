
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { Language } from '../types';
import { translations } from '../translations';
import { LiveServerMessage } from '@google/genai';

interface VoiceAssistantProps {
  onClose: () => void;
  lang: Language;
  inline?: boolean;
}

type VoiceMode = 'assistant' | 'translator';

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onClose, lang, inline = false }) => {
  const t = translations[lang];
  const [mode, setMode] = useState<VoiceMode>('assistant');
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // High-Performance Visualizer Settings
  const BAR_COUNT = 5; 
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
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

  // Optimized Visualizer Loop (Direct DOM manipulation)
  const updateVisualizer = useCallback(() => {
    if (!isActive) return;

    const dataArray = new Uint8Array(BAR_COUNT);
    let hasSignal = false;

    // Prioritize output audio visualization, fallback to input
    if (isSpeaking && analyserRef.current) {
      analyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    } else if (isActive && inputAnalyserRef.current) {
      inputAnalyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    }

    if (barsRef.current) {
        const time = Date.now() / 1000;
        barsRef.current.forEach((bar, i) => {
            if (!bar) return;
            let height = 15;
            if (hasSignal) {
                // Map 0-255 to percentage height
                const value = dataArray[i] || 0;
                height = Math.max(15, (value / 255) * 100);
            } else {
                // Idle breathing animation
                height = 15 + Math.sin(time * 3 + i) * 8; 
            }
            bar.style.height = `${height}%`;
            bar.style.opacity = hasSignal ? '1' : '0.4';
        });
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
    if (audioContextRef.current) {
      nextStartTimeRef.current = audioContextRef.current.currentTime || 0;
    }
    setIsSpeaking(false);
  }, []);

  const stopSession = useCallback(() => {
    stopAiSpeaking();
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
    setIsConnecting(false);
    setTranscription([]);
  }, [stopAiSpeaking]);

  const handleModeChange = (newMode: VoiceMode) => {
    if (newMode === mode) return;
    if (isActive) stopSession();
    setMode(newMode);
  };

  const startSession = async () => {
    setErrorMessage(null);
    setIsConnecting(true);
    setTranscription([]);
    
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error("Audio support not found.");

      const context = new AudioCtx({ sampleRate: 24000 });
      if (context.state === 'suspended') await context.resume();
      audioContextRef.current = context;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 32; 
      analyserRef.current.connect(audioContextRef.current.destination);

      inputAudioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 32;

      const callbacks = {
        onopen: () => {
          setIsConnecting(false);
          setIsActive(true);
          const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
          const processor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          source.connect(inputAnalyserRef.current!);
          
          processor.onaudioprocess = (e) => {
            if (!sessionRef.current) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            try {
               sessionRef.current.sendRealtimeInput({ 
                 media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } 
               });
            } catch (err) {}
          };
          source.connect(processor);
          processor.connect(inputAudioContextRef.current!.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          let incomingText = "";
          let role: 'user' | 'model' = 'model';
          if (msg.serverContent?.inputTranscription) {
            incomingText = msg.serverContent.inputTranscription.text;
            role = 'user';
          } else if (msg.serverContent?.outputTranscription) {
            incomingText = msg.serverContent.outputTranscription.text;
            role = 'model';
          }

          if (incomingText) {
             setTranscription(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === role) return [...prev.slice(0, -1), { ...last, text: last.text + incomingText }];
                return [...prev, { role, text: incomingText }];
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
          sessionRef.current = null;
        },
        onerror: (e: any) => {
          setErrorMessage(e.message || "Endpoint error.");
          setIsActive(false);
          setIsConnecting(false);
          sessionRef.current = null;
        }
      };

      const sessionPromise = mode === 'translator' 
        ? geminiService.connectTranslator(callbacks, { source: 'English', target: 'Sinhala' })
        : geminiService.connectLive(callbacks);

      sessionRef.current = await sessionPromise;
    } catch (e: any) {
      setErrorMessage(e.message || "Connection failed.");
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (scrollTranscriptionRef.current) {
        scrollTranscriptionRef.current.scrollTop = scrollTranscriptionRef.current.scrollHeight;
    }
  }, [transcription]);

  // Dynamic Aesthetics
  const activeColor = mode === 'translator' ? 'indigo' : 'cyan';
  
  // Conditional glow effect based on active state
  const glowClass = isActive 
    ? (mode === 'translator' ? 'shadow-[0_0_50px_rgba(99,102,241,0.25)] border-indigo-500/30' : 'shadow-[0_0_50px_rgba(6,182,212,0.25)] border-cyan-500/30')
    : 'shadow-2xl border-slate-200 dark:border-white/5';

  const containerClass = inline 
    ? "w-full h-full flex flex-col items-center justify-between py-6 px-4" 
    : `w-full max-w-lg glass-panel rounded-[40px] flex flex-col items-center justify-between p-6 bg-white/90 dark:bg-slate-900/90 ${glowClass} transition-all duration-700`;

  return (
    <div className={inline ? "h-full w-full" : "fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"}>
      {!inline && <div className="absolute inset-0" onClick={onClose}></div>}
      
      <div 
        className={containerClass}
        style={!inline ? { height: 'calc(var(--vh, 1vh) * 90)' } : undefined}
      >
        
        {/* Header - Compact */}
        <div className="w-full flex items-center justify-between z-10 shrink-0">
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors duration-500 ${isActive ? 'bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10' : `bg-${activeColor}-500/10 border-${activeColor}-500/20`}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-slate-500 dark:text-slate-300' : `text-${activeColor}-600 dark:text-${activeColor}-400`}`}>BETA v5.0</span>
           </div>
           
           <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-black/5 dark:border-white/5">
               <button onClick={() => handleModeChange('assistant')} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'assistant' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600 dark:text-cyan-300' : 'text-slate-400'}`}>{t.voiceMode.assistant}</button>
               <button onClick={() => handleModeChange('translator')} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'translator' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`}>{t.voiceMode.interpreter}</button>
           </div>
        </div>

        {/* Center Hub - Interactive Orb */}
        <div className="relative flex flex-col items-center justify-center flex-1 w-full my-4">
           <div className="relative">
              {/* Active State Glow */}
              <div className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-700 ${isActive ? 'opacity-40' : 'opacity-0'} ${mode === 'translator' ? 'bg-indigo-500' : 'bg-cyan-500'}`}></div>

              <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full relative flex items-center justify-center transition-all duration-500 ${isActive ? (mode === 'translator' ? 'bg-indigo-600' : 'bg-cyan-600') + ' text-white shadow-xl scale-105' : 'bg-slate-100 dark:bg-white/5 text-slate-300 border border-black/5 dark:border-white/5'}`}>
                
                {/* Speaking Ring Animation */}
                {isActive && <div className={`absolute -inset-3 rounded-full border-2 border-current opacity-20 ${isSpeaking ? 'animate-ping' : ''}`}></div>}
                
                <i className={`fa-solid ${mode === 'translator' ? 'fa-language' : (isActive ? 'fa-microphone-lines' : 'fa-microphone')} text-5xl md:text-6xl transition-transform duration-300 ${isSpeaking ? 'scale-110' : ''}`}></i>
                
                {/* --- STOP SPEAKING BUTTON --- */}
                {/* Only appears when AI is actively speaking (outputting audio) */}
                <div className={`absolute -bottom-2 -right-2 transition-all duration-300 ${isSpeaking ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-4 pointer-events-none'}`}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); stopAiSpeaking(); }}
                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-red-500 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-xl border-4 border-slate-50 dark:border-slate-900 z-20"
                    title={t.stopSpeaking}
                  >
                    <i className="fa-solid fa-volume-xmark text-lg"></i>
                  </button>
                </div>

              </div>
           </div>

           <div className="mt-8 text-center space-y-2 z-10 min-h-[4rem]">
              <h2 className={`text-2xl font-black uppercase tracking-tight transition-colors ${isActive ? (mode === 'translator' ? 'text-indigo-600 dark:text-indigo-400' : 'text-cyan-600 dark:text-cyan-400') : 'text-slate-900 dark:text-white'}`}>
                  {isActive ? (isSpeaking ? "Speaking..." : "Listening...") : (mode === 'translator' ? t.translator : t.voice)}
              </h2>
              {!isActive && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready to Connect</p>}
           </div>
        </div>

        {/* Visualizer & Transcription */}
        <div className={`w-full flex flex-col gap-4 transition-all duration-500 shrink-0 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <div className="w-full h-8 flex items-end justify-center gap-2">
              {/* High-Performance Visualizer Bars */}
              {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <div 
                  key={i} 
                  ref={(el) => { barsRef.current[i] = el; }}
                  className={`w-3 rounded-full transition-colors ${mode === 'translator' ? 'bg-indigo-500' : 'bg-cyan-500'}`}
                  style={{ height: '20%', opacity: 0.5 }}
                ></div>
              ))}
            </div>

            <div ref={scrollTranscriptionRef} className="w-full h-32 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20 rounded-3xl p-4 flex flex-col gap-2 border border-black/5 dark:border-white/5 shadow-inner">
              {transcription.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-40">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{isSpeaking ? 'AI is replying...' : 'Say something...'}</p>
                  </div>
              ) : (
                  transcription.map((item, i) => (
                      <div key={i} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                          <div className={`px-3 py-2 rounded-xl text-[11px] font-medium max-w-[90%] leading-relaxed ${item.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tr-sm' : (mode === 'translator' ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-tl-sm' : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 rounded-tl-sm')}`}>
                              {item.text}
                          </div>
                      </div>
                  ))
              )}
            </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full space-y-3 pt-4 z-10 shrink-0">
          {!isActive ? (
            <button 
              onClick={startSession} 
              disabled={isConnecting}
              className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-slate-800 dark:hover:bg-slate-200"
            >
              {isConnecting ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className={`fa-solid ${mode === 'translator' ? 'fa-play' : 'fa-microphone'}`}></i>}
              <span>{isConnecting ? t.establishingHandshake : (mode === 'translator' ? t.transMode.start : 'Start Voice')}</span>
            </button>
          ) : (
            <button 
              onClick={stopSession} 
              className="w-full py-4 bg-red-500 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:shadow-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-power-off"></i>
              <span>{t.endSession}</span>
            </button>
          )}
          
          {!inline && (
            <button onClick={onClose} className="w-full text-[10px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors py-2 uppercase tracking-widest">{t.back}</button>
          )}
        </div>

        {errorMessage && (
          <div className="absolute top-1/2 left-6 right-6 p-4 bg-red-500 text-white text-center z-50 rounded-2xl shadow-xl animate-reveal">
             <i className="fa-solid fa-triangle-exclamation mb-2"></i>
             <p className="text-xs font-bold">{errorMessage}</p>
             <button onClick={() => setErrorMessage(null)} className="mt-3 px-4 py-1 bg-white/20 rounded-full text-[10px] uppercase font-black hover:bg-white/30 transition-colors">Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
