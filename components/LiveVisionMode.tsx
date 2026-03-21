
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { cacheService, CacheKey } from '../services/cacheService';
import { Language } from '../types';
import { translations } from '../translations';
import { LiveServerMessage } from '@google/genai';

interface LiveVisionModeProps {
  onClose: () => void;
  lang: Language;
}

const VOICES = [
  { id: 'Zephyr', label: 'Zephyr (Female)', gender: 'F' },
  { id: 'Puck', label: 'Puck (Playful)', gender: 'M' },
  { id: 'Fenrir', label: 'Fenrir (Deep Male)', gender: 'M' },
  { id: 'Kore', label: 'Kore (Gentle)', gender: 'F' },
  { id: 'Charon', label: 'Charon (Deep)', gender: 'M' },
];

const TONES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'unhinged', label: 'Unhinged (Chaotic)' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'argumentative', label: 'Argumentative' },
  { id: 'commanding', label: 'Commanding' },
  { id: 'counteractive', label: 'Skeptical' },
];

const LiveVisionMode: React.FC<LiveVisionModeProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  
  // Settings (persisted via cacheService so they survive tab switch / unmount)
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => cacheService.get(CacheKey.VOICE_NAME, 'Zephyr'));
  const [selectedTone, setSelectedTone] = useState(() => cacheService.get(CacheKey.VOICE_TONE, 'neutral'));

  useEffect(() => {
    setSelectedVoice(cacheService.get(CacheKey.VOICE_NAME, 'Zephyr'));
    setSelectedTone(cacheService.get(CacheKey.VOICE_TONE, 'neutral'));
  }, []);

  const handleVoiceChange = useCallback((voice: string) => {
    setSelectedVoice(voice);
    cacheService.set(CacheKey.VOICE_NAME, voice);
  }, []);
  const handleToneChange = useCallback((tone: string) => {
    setSelectedTone(tone);
    cacheService.set(CacheKey.VOICE_TONE, tone);
  }, []);

  // Transcripts
  const [latestUser, setLatestUser] = useState("");
  const [latestAI, setLatestAI] = useState("");

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<unknown> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioInputNodeRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const inputBufferRef = useRef<Float32Array[]>([]);
  const INPUT_BATCH_SAMPLES = 4096;

  // Stream & Intervals
  const streamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // Visualizer
  const visualizerRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const aiSpeakingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    // Safety check: enumerateDevices / devicechange might not exist in some webviews
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return () => stopSession();
    }

    const refreshCameras = () => {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const cams = devices.filter(d => d.kind === 'videoinput');
        setCameraList(cams);
        if (cams.length > 0) setActiveCameraId(prev => prev || cams[0].deviceId);
      }).catch(() => {});
    };

    refreshCameras();

    const handleDeviceChange = () => {
      refreshCameras();
    };

    try {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    } catch {
      // older browsers: ignore, we still have initial list
    }

    return () => {
      try {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      } catch {
        // ignore
      }
      stopSession();
    };
  }, []);

  const updateVisualizer = useCallback(() => {
    if (!visualizerRef.current || !analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Simple 3-bar visualization based on frequency bands
    const bars = Array.from(visualizerRef.current.children) as HTMLDivElement[];
    if (bars.length >= 3) {
       const avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
       const scale = Math.max(0.2, avg / 128); // 0.2 to 2.0 scale
       
       bars[0].style.height = `${20 * scale}px`;
       bars[1].style.height = `${35 * scale}px`;
       bars[2].style.height = `${20 * scale}px`;
    }
    
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  // Helpers for Audio/Video Encoding
  function encodeBase64(bytes: Uint8Array) {
    let b = '';
    for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
    return btoa(b);
  }

  function decodeBase64(base64: string) {
    const b = atob(base64);
    const bytes = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    try {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length;
        const buffer = ctx.createBuffer(1, frameCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
        return buffer;
    } catch (e) {
        throw e;
    }
  }

  // Resample audio input to 16kHz mono PCM16 for Gemini Live.
  function toPcm16At16k(source: Float32Array, sourceSampleRate: number): Int16Array {
    const targetRate = 16000;
    if (!sourceSampleRate || sourceSampleRate === targetRate) {
      const out = new Int16Array(source.length);
      for (let i = 0; i < source.length; i++) {
        const s = Math.max(-1, Math.min(1, source[i] || 0));
        out[i] = s * 32767;
      }
      return out;
    }
    const ratio = sourceSampleRate / targetRate;
    const targetLength = Math.floor(source.length / ratio);
    const out = new Int16Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, source.length - 1);
      const frac = srcIndex - i0;
      const s0 = source[i0] || 0;
      const s1 = source[i1] || 0;
      const s = Math.max(-1, Math.min(1, s0 + (s1 - s0) * frac));
      out[i] = s * 32767;
    }
    return out;
  }
  // --- Main Logic ---

  const startSession = async () => {
    // If re-starting with new settings, ensure clean slate
    stopSession();
    
    setIsConnecting(true);
    setLatestAI("");
    setLatestUser("");

    try {
      // 1. Setup Audio Contexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Use system defaults; resample microphone audio to 16kHz before sending to Gemini.
      audioContextRef.current = new AudioCtx(); 
      inputAudioContextRef.current = new AudioCtx(); 
      const inputSampleRate = inputAudioContextRef.current.sampleRate || 44100;

      // 2. Setup Media Stream (Video + Audio)
      if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Media devices API not available");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: activeCameraId ? { exact: activeCameraId } : undefined, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      // 3. Connect Video to Preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // 4. Setup Output Visualizer
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      analyserRef.current.connect(audioContextRef.current.destination);
      updateVisualizer();

      // 5. Connect to Gemini Live (ref set by service before any callback runs, so onopen can use it safely)
      const sessionPromise = geminiService.connectMultimodal({
        __setSessionPromise: (p: Promise<unknown>) => { sessionPromiseRef.current = p; },
        onopen: async () => {
          setIsConnecting(false);
          setIsActive(true);

          const ctx = inputAudioContextRef.current!;
          const src = ctx.createMediaStreamSource(stream);
          audioSourceRef.current = src;

          const sampleRate = inputSampleRate;
          const flushBuffer = () => {
            const chunks = inputBufferRef.current;
            if (chunks.length === 0) return;
            const total = chunks.reduce((n, c) => n + c.length, 0);
            const merged = new Float32Array(total);
            let offset = 0;
            for (const c of chunks) { merged.set(c, offset); offset += c.length; }
            inputBufferRef.current = [];
            sessionPromiseRef.current?.then((session: { sendRealtimeInput: (arg: unknown) => void }) => {
              const pcm16 = toPcm16At16k(merged, sampleRate);
              session.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(pcm16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
            }).catch(() => {});
          };

          try {
            await ctx.audioWorklet.addModule('/voice-input-processor.js');
            const workletNode = new AudioWorkletNode(ctx, 'voice-input-processor', { processorOptions: { sampleRate } });
            audioInputNodeRef.current = workletNode;
            workletNode.port.onmessage = (e: MessageEvent<{ samples: ArrayBuffer; sampleRate: number }>) => {
              if (isMutedRef.current) return;
              const { samples } = e.data;
              inputBufferRef.current.push(new Float32Array(samples));
              let total = 0;
              for (const c of inputBufferRef.current) total += c.length;
              if (total >= INPUT_BATCH_SAMPLES) flushBuffer();
            };
            src.connect(workletNode);
          } catch {
            // Fallback for environments without AudioWorklet.
            // We only tap the microphone stream and DO NOT connect to destination to avoid feedback loops.
            const proc = ctx.createScriptProcessor(4096, 1, 1);
            audioInputNodeRef.current = proc;
            proc.onaudioprocess = (e) => {
              if (isMutedRef.current) return;
              const data = e.inputBuffer.getChannelData(0);
              const pcm16 = toPcm16At16k(data, sampleRate);
              sessionPromiseRef.current?.then((session: { sendRealtimeInput: (arg: unknown) => void }) => {
                session.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(pcm16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
              }).catch(() => {});
            };
            src.connect(proc);
          }

          // --- Input Video Pipeline (1 FPS) ---
          videoIntervalRef.current = window.setInterval(() => {
             if (!videoRef.current || !canvasRef.current) return;
             // Avoid sending vision frames while the model is speaking back to the user.
             // This reduces bandwidth and prevents the model from reacting to its own output.
             if (aiSpeakingRef.current) return;
             
             const ctx = canvasRef.current.getContext('2d');
             if (!ctx) return;

             // Draw frame to hidden canvas
             canvasRef.current.width = videoRef.current.videoWidth / 2; // Downscale for bandwidth
             canvasRef.current.height = videoRef.current.videoHeight / 2;
             ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
             
             // Compress to JPEG and send
             const base64 = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
             sessionPromiseRef.current?.then((session: { sendRealtimeInput: (arg: unknown) => void }) => {
              session.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
            }).catch(() => {});

          }, 1000); // 1 Frame per second
        },
        onmessage: async (msg: LiveServerMessage) => {
          // Transcriptions
          if (msg.serverContent?.inputTranscription) {
             setLatestUser(msg.serverContent.inputTranscription.text);
          }
          if (msg.serverContent?.outputTranscription) {
             setLatestAI(prev => prev + msg.serverContent!.outputTranscription!.text);
          }
          
          // Audio Output
          const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && audioContextRef.current) {
            setAiSpeaking(true);
            aiSpeakingRef.current = true;
            try {
                const buf = await decodeAudioData(decodeBase64(audio), audioContextRef.current);
                const s = audioContextRef.current.createBufferSource();
                s.buffer = buf;
                s.connect(analyserRef.current!);
                
                const now = audioContextRef.current.currentTime;
                if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05; // Small buffer
                
                s.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buf.duration;
                
                sourcesRef.current.add(s);
                s.onended = () => {
                   sourcesRef.current.delete(s);
                   if (sourcesRef.current.size === 0) {
                     setAiSpeaking(false);
                     aiSpeakingRef.current = false;
                   }
                };
            } catch { /* skip failed chunk */ }
          }
          
          if (msg.serverContent?.interrupted) {
             sourcesRef.current.forEach(s => s.stop());
             sourcesRef.current.clear();
             setAiSpeaking(false);
             nextStartTimeRef.current = 0;
          }
        },
        onclose: () => stopSession(),
        onerror: (e: unknown) => {
          const msg = e instanceof Error ? e.message : 'Connection failed';
          setErrorMessage(
            msg.includes('Permission') || msg.includes('denied')
              ? 'Camera/mic permission denied. Check browser settings.'
              : msg.includes('model') || msg.includes('Model')
              ? 'Live AI model unavailable. Please try again.'
              : msg || 'Connection failed. Please try again.'
          );
          stopSession();
        }
      }, { voiceName: selectedVoice, tone: selectedTone });
      
      sessionPromise.then(session => {
        sessionRef.current = session;
      }).catch(() => {
        const errMsg = e instanceof Error ? e.message : 'Connection failed';
        setErrorMessage(
          errMsg.includes('Permission') || errMsg.includes('denied')
            ? 'Camera/microphone permission denied. Check your browser settings.'
            : errMsg.includes('NotFound') || errMsg.includes('not found')
            ? 'No camera found. Please connect a camera and try again.'
            : errMsg || 'Connection failed. Please try again.'
        );
        stopSession();
      });

    } catch {
      setIsConnecting(false);
      alert("Could not access camera/mic. Please check permissions.");
    }
  };

  const stopSession = () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setIsActive(false);
    setIsConnecting(false);
    setAiSpeaking(false);
    setLatestAI("");
    setLatestUser("");

    const videoIntervalId = videoIntervalRef.current;
    if (videoIntervalId != null) {
      clearInterval(videoIntervalId);
      videoIntervalRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    sessionPromiseRef.current = null;
    if (sessionRef.current) { try { sessionRef.current.close(); } catch {} sessionRef.current = null; }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();

    audioSourceRef.current?.disconnect();
    audioInputNodeRef.current?.disconnect();
    audioInputNodeRef.current = null;
    audioSourceRef.current = null;
    inputBufferRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') inputAudioContextRef.current.close();
    isStoppingRef.current = false;
  };

  const toggleMute = () => {
    if (streamRef.current) {
       streamRef.current.getAudioTracks().forEach(track => track.enabled = isMuted); // If was muted (true), enabled becomes true
       setIsMuted(!isMuted);
    }
  };

  const switchCamera = () => {
     if (cameraList.length < 2) return;
     const idx = cameraList.findIndex(c => c.deviceId === activeCameraId);
     const next = cameraList[(idx + 1) % cameraList.length];
     setActiveCameraId(next.deviceId);
     stopSession();
     // Give mobile browsers enough time to fully release the previous camera.
     setTimeout(() => startSession(), 1000);
  };

  const applySettings = () => {
    setShowSettings(false);
    if (isActive) {
        stopSession();
        setTimeout(() => startSession(), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center overflow-hidden">
      
      {/* Video Viewfinder */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        playsInline 
        muted // Muted locally to prevent feedback loop
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent h-32">
         <div>
            <div className="flex items-center gap-2 mb-1">
               <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></div>
               <span className="text-white font-black uppercase text-[10px] tracking-[0.2em]">{isActive ? 'Live Feed' : 'Camera Ready'}</span>
            </div>
            {isActive && <div className="text-[9px] text-white/60 font-mono uppercase">1 FPS Stream • {selectedVoice}</div>}
         </div>
         <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500 transition-colors">
            <i className="fa-solid fa-xmark"></i>
         </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade">
           <div className="bg-slate-900 border border-white/10 p-8 rounded-[32px] w-full max-w-sm space-y-6">
              <h3 className="text-white font-black uppercase text-lg tracking-tight">Audio Profile</h3>
              
              <div className="space-y-3">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voice Model</label>
                 <div className="grid grid-cols-1 gap-2">
                    {VOICES.map(v => (
                       <button 
                         key={v.id}
                         onClick={() => handleVoiceChange(v.id)}
                         className={`p-3 rounded-xl text-left flex justify-between items-center transition-all ${selectedVoice === v.id ? 'bg-cyan-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                       >
                          <span className="text-xs font-bold">{v.label}</span>
                          {selectedVoice === v.id && <i className="fa-solid fa-check text-xs"></i>}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personality Tone</label>
                 <div className="grid grid-cols-2 gap-2">
                    {TONES.map(t => (
                       <button 
                         key={t.id}
                         onClick={() => handleToneChange(t.id)}
                         className={`p-3 rounded-xl text-xs font-bold text-center transition-all ${selectedTone === t.id ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                       >
                          {t.label}
                       </button>
                    ))}
                 </div>
              </div>

              <button onClick={applySettings} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest">
                 {isActive ? 'Reconnect with New Settings' : 'Save Configuration'}
              </button>
           </div>
        </div>
      )}

      {/* Transcriptions Overlay */}
      {isActive && (
         <div className="absolute bottom-32 left-6 right-6 space-y-3 z-20 pointer-events-none">
            {latestUser && (
               <div className="flex justify-end">
                  <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm max-w-[80%] animate-slide-in-up">
                     {latestUser}
                  </div>
               </div>
            )}
            {latestAI && (
               <div className="flex justify-start">
                  <div className="bg-cyan-600/80 backdrop-blur-md text-white px-4 py-2 rounded-2xl rounded-tl-none text-sm max-w-[80%] animate-slide-in-up border border-cyan-400/30">
                     {latestAI}
                  </div>
               </div>
            )}
         </div>
      )}

      {/* Center Status when inactive */}
      {!isActive && !isConnecting && (
         <div className="relative z-20 text-center space-y-6 max-w-sm px-6">
            <div className="w-20 h-20 rounded-[32px] bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mx-auto shadow-2xl">
               <i className="fa-solid fa-eye text-4xl text-white"></i>
            </div>
            <div className="space-y-2">
               <h2 className="text-2xl font-black text-white uppercase tracking-tight">Vision Chat</h2>
               <p className="text-xs text-white/60 font-medium leading-relaxed">
                  I can see what you see. Show me anything and ask questions in real-time.
               </p>
            </div>
            <button 
               onClick={startSession}
               className="px-10 py-4 bg-white text-black rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
               Start Stream
            </button>
         </div>
      )}

      {isConnecting && (
         <div className="relative z-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/20 border-t-cyan-500 rounded-full animate-spin"></div>
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Connecting Neural Vision...</span>
         </div>
      )}

      {/* Controls Footer */}
      {isActive && (
         <div className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-6 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
            
            <button onClick={() => setShowSettings(true)} className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all">
               <i className="fa-solid fa-sliders"></i>
            </button>

            <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
               <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            </button>

            <button onClick={stopSession} className="w-20 h-20 rounded-full bg-red-600 border-4 border-red-900/50 flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all">
               <i className="fa-solid fa-stop text-2xl"></i>
            </button>

            <button onClick={switchCamera} disabled={cameraList.length < 2} className="w-14 h-14 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-30">
               <i className="fa-solid fa-camera-rotate"></i>
            </button>
         </div>
      )}
      
      {/* Settings Button when inactive */}
      {!isActive && !isConnecting && (
         <button onClick={() => setShowSettings(true)} className="absolute bottom-10 z-20 px-6 py-2 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 backdrop-blur-md">
            <i className="fa-solid fa-sliders mr-2"></i> Configure Voice
         </button>
      )}
    </div>
  );
};

export default LiveVisionMode;
