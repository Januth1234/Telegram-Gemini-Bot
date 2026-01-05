
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import React, { useEffect, useRef, useState } from 'react';
import { translations } from '../translations';
import { Language } from '../types';

interface VoiceAssistantProps {
  onClose: () => void;
  lang: Language;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
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
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const createBlob = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startSession = async () => {
    if (isConnecting || isActive) return;
    setIsConnecting(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => {
                try { s.sendRealtimeInput({ media: pcmBlob }); } catch {}
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContextRef.current.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => { console.error("Voice Sync Error", e); stopSession(); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are Orin AI, a helpful voice assistant. Answer strictly in ${lang === 'si' ? 'Sinhala' : 'English'}. Keep responses short and conversational. Never mix languages.`
        }
      });

      sessionRef.current = await sessionPromise;
      drawWave();
    } catch (e) {
      console.error(e);
      stopSession();
    }
  };

  const stopSession = () => {
    setIsActive(false);
    setIsConnecting(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch {}
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch {}
      outputAudioContextRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const drawWave = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = isActive ? '#06b6d4' : '#334155';
      ctx.lineWidth = 2;
      
      const time = Date.now() / 200;
      for (let x = 0; x < width; x++) {
        const amplitude = isActive ? (Math.sin(x * 0.05 + time) * 15) : 2;
        const y = height / 2 + amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-fade">
      <div className="max-w-md w-full glass-panel rounded-[60px] p-12 flex flex-col items-center gap-12 text-center border border-white/5 shadow-[0_0_100px_rgba(6,182,212,0.1)]">
        
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-cyan-500/20">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-500 animate-pulse' : 'bg-slate-500'}`}></span>
            {t.voiceBeta}
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{isActive ? t.neuralBridgeActive : t.voice}</h2>
          <p className="text-xs font-bold text-slate-400 px-6">{isActive ? t.listeningFrequency : t.placeholderVoice}</p>
        </div>

        <div className="relative w-full h-32 flex items-center justify-center">
          <canvas ref={canvasRef} width={300} height={100} className="w-full h-full opacity-60" />
          {isConnecting && (
             <div className="absolute inset-0 flex items-center justify-center">
                <i className="fa-solid fa-circle-notch animate-spin text-cyan-500 text-3xl"></i>
             </div>
          )}
        </div>

        <div className="flex flex-col gap-6 w-full">
          {!isActive ? (
            <button 
              onClick={startSession}
              disabled={isConnecting}
              className="w-full py-6 bg-white text-slate-950 rounded-[32px] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
            >
              <i className="fa-solid fa-microphone"></i>
              {isConnecting ? t.establishingHandshake : 'Initialize Neural Voice'}
            </button>
          ) : (
            <button 
              onClick={stopSession}
              className="w-full py-6 bg-red-500/10 text-red-500 border border-red-500/20 rounded-[32px] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-red-500/20 active:scale-95 transition-all"
            >
              {t.endSession}
            </button>
          )}
          
          <button onClick={onClose} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
            {t.back}
          </button>
        </div>

        <div className="pt-8 border-t border-white/5 w-full flex justify-center gap-8 opacity-40">
           <i className="fa-solid fa-shield-halved text-white text-sm"></i>
           <i className="fa-solid fa-bolt text-cyan-500 text-sm"></i>
           <i className="fa-solid fa-wifi text-white text-sm"></i>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
