
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { cacheService, CacheKey } from '../services/cacheService';
import { Language } from '../types';
import { translations } from '../translations';
import { LiveServerMessage } from '@google/genai';

interface VoiceAssistantProps {
  onClose: () => void;
  lang: Language;
  inline?: boolean;
}

type VoiceMode = 'assistant' | 'translator';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'si', label: 'Sinhala', flag: '🇱🇰' },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳' }
];

const VOICES = [
  { id: 'Zephyr', label: 'Zephyr (Female)' },
  { id: 'Puck', label: 'Puck (Playful)' },
  { id: 'Fenrir', label: 'Fenrir (Deep Male)' },
  { id: 'Kore', label: 'Kore (Gentle)' },
  { id: 'Charon', label: 'Charon (Deep)' },
];

const TONES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'unhinged', label: 'Unhinged (Chaotic)' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'argumentative', label: 'Argumentative' },
  { id: 'commanding', label: 'Commanding' },
  { id: 'counteractive', label: 'Skeptical' },
];

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onClose, lang, inline = false }) => {
  const t = translations[lang];
  const [mode, setMode] = useState<VoiceMode>('assistant');
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Settings (persisted via cacheService so they survive tab switch / unmount)
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSavedFeedback, setSettingsSavedFeedback] = useState(false);
  const [modeSwitchBlockedFeedback, setModeSwitchBlockedFeedback] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => cacheService.get(CacheKey.VOICE_NAME, 'Zephyr'));
  const [selectedTone, setSelectedTone] = useState(() => cacheService.get(CacheKey.VOICE_TONE, 'neutral'));
  const [proactiveAudio, setProactiveAudio] = useState(() => cacheService.get(CacheKey.VOICE_PROACTIVE_AUDIO, false));
  const [affectiveDialog, setAffectiveDialog] = useState(() => cacheService.get(CacheKey.VOICE_AFFECTIVE_DIALOG, false));

  const handleVoiceChange = useCallback((voice: string) => {
    setSelectedVoice(voice);
    cacheService.set(CacheKey.VOICE_NAME, voice);
  }, []);
  const handleToneChange = useCallback((tone: string) => {
    setSelectedTone(tone);
    cacheService.set(CacheKey.VOICE_TONE, tone);
  }, []);
  const handleProactiveAudioChange = useCallback((v: boolean) => {
    setProactiveAudio(v);
    cacheService.set(CacheKey.VOICE_PROACTIVE_AUDIO, v);
  }, []);
  const handleAffectiveDialogChange = useCallback((v: boolean) => {
    setAffectiveDialog(v);
    cacheService.set(CacheKey.VOICE_AFFECTIVE_DIALOG, v);
  }, []);

  const [langA, setLangA] = useState(LANGUAGES.find(l => l.code === 'en') || LANGUAGES[0]);
  const [langB, setLangB] = useState(LANGUAGES.find(l => l.code === 'si') || LANGUAGES[1]);

  const BAR_COUNT = 6; 
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  const [transcription, setTranscription] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const scrollTranscriptionRef = useRef<HTMLDivElement>(null);
  const prevTranscriptionLengthRef = useRef(0);
  const MAX_TRANSCRIPTION_ENTRIES = 100;

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioInputNodeRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const inputBufferRef = useRef<Float32Array[]>([]);
  const INPUT_BATCH_SAMPLES = 4096;

  const isActiveRef = useRef(isActive);
  const isSpeakingRef = useRef(isSpeaking);
  const isMutedRef = useRef(isMuted);
  isActiveRef.current = isActive;
  isSpeakingRef.current = isSpeaking;
  isMutedRef.current = isMuted;

  const updateVisualizer = useCallback(() => {
    const active = isActiveRef.current;
    if (!active) return;
    const dataArray = new Uint8Array(BAR_COUNT);
    let hasSignal = false;
    const speaking = isSpeakingRef.current;

    if (speaking && analyserRef.current) {
      analyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    } else if (active && inputAnalyserRef.current) {
      inputAnalyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    }

    if (barsRef.current) {
        const time = Date.now() / 1000;
        barsRef.current.forEach((bar, i) => {
            if (!bar) return;
            let height = 12;
            if (hasSignal) {
                const value = dataArray[i] || 0;
                height = Math.max(12, (value / 255) * 100);
            } else {
                height = 12 + Math.sin(time * 4 + i) * 6; 
            }
            bar.style.height = `${height}%`;
            bar.style.opacity = hasSignal ? '1' : '0.4';
        });
    }
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [updateVisualizer]);

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000); // Output remains 24k as per model default
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  }

  function decodeBase64(base64: string) {
    const b = atob(base64);
    const bytes = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
    return bytes;
  }

  function encodeBase64(bytes: Uint8Array) {
    let b = '';
    for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
    return btoa(b);
  }

  // Preview a given voice without starting a full live session.
  const previewVoice = useCallback(async (voiceId: string) => {
    if (isActive || isConnecting) return; // avoid clashing with live session
    try {
      const base64 = await geminiService.generateTts({
        text: `Hi, this is the ${voiceId} voice preview.`,
        voiceName: voiceId,
        model: 'flash',
      });

      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;
        analyserRef.current.connect(audioContextRef.current.destination);
        nextStartTimeRef.current = audioContextRef.current.currentTime;
      }

      const ctx = audioContextRef.current!;
      const buf = await decodeAudioData(decodeBase64(base64), ctx);
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(analyserRef.current!);
      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
      s.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buf.duration;
      sourcesRef.current.add(s);
      setIsSpeaking(true);
      s.onended = () => {
        sourcesRef.current.delete(s);
        if (sourcesRef.current.size === 0) setIsSpeaking(false);
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Voice preview failed';
      setErrorMessage(msg);
    }
  }, [isActive, isConnecting]);

  // Resample arbitrary input sample rate down to 16kHz mono PCM16.
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

  const stopAiSpeaking = useCallback(() => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    if (audioContextRef.current) nextStartTimeRef.current = audioContextRef.current.currentTime;
    setIsSpeaking(false);
  }, []);

  const isStoppingRef = useRef(false);

  const stopSession = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    stopAiSpeaking();
    if (sessionRef.current) { try { sessionRef.current.close(); } catch(e) {} sessionRef.current = null; }
    audioSourceRef.current?.disconnect();
    audioInputNodeRef.current?.disconnect();
    audioInputNodeRef.current = null;
    audioSourceRef.current = null;
    inputBufferRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') { try { audioContextRef.current.close(); } catch(e) {} }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') { try { inputAudioContextRef.current.close(); } catch(e) {} }
    setIsActive(false);
    setIsConnecting(false);
    setIsMuted(false);
    setTranscription([]);
    isStoppingRef.current = false;
  }, [stopAiSpeaking]);

  const getSessionContext = (): { timezone: string; localTime: string; country: string; currency: string; locale: string } => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const now = new Date();
    const localTime = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
    const locale = navigator.language || 'en';
    const region = (locale.split('-')[1] || '').toUpperCase();
    const countryByTz: Record<string, string> = { 'Asia/Colombo': 'Sri Lanka', 'Asia/Kolkata': 'India', 'America/New_York': 'United States', 'Europe/London': 'United Kingdom', 'Asia/Dubai': 'UAE' };
    const currencyByRegion: Record<string, string> = { LK: 'LKR', IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED' };
    let country = countryByTz[tz];
    if (!country && region) {
      try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(region) || 'user\'s region'; } catch { country = 'user\'s region'; }
    }
    if (!country) country = 'user\'s region';
    const currency = currencyByRegion[region] || (tz === 'Asia/Colombo' ? 'LKR' : 'USD');
    return { timezone: tz, localTime, country, currency, locale };
  };

  const startSession = async () => {
    if (isActive || isConnecting) return; // Prevent double taps during freezes
    
    setErrorMessage(null);
    setIsConnecting(true);
    setTranscription([]);
    const sessionContext = getSessionContext();
    
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Close any existing contexts (e.g. from previewVoice) so we don't orphan them.
      const prevOut = audioContextRef.current;
      if (prevOut && prevOut.state !== 'closed') { try { prevOut.close(); } catch {} }
      const prevIn = inputAudioContextRef.current;
      if (prevIn && prevIn.state !== 'closed') { try { prevIn.close(); } catch {} }
      // Use system default for output; input sample rate is read dynamically and resampled to 16kHz.
      audioContextRef.current = new AudioCtx();
      inputAudioContextRef.current = new AudioCtx(); 
      const inputSampleRate = inputAudioContextRef.current.sampleRate || 44100;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      streamRef.current = stream;

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64; 
      analyserRef.current.connect(audioContextRef.current.destination);

      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 64;

      const callbacks = {
        onopen: async () => {
          setIsConnecting(false);
          setIsActive(true);
          const ctx = inputAudioContextRef.current!;
          const src = ctx.createMediaStreamSource(stream);
          audioSourceRef.current = src;
          src.connect(inputAnalyserRef.current!);

          const sampleRate = inputSampleRate;
          const flushBuffer = () => {
            const chunks = inputBufferRef.current;
            if (chunks.length === 0) return;
            const total = chunks.reduce((n, c) => n + c.length, 0);
            const merged = new Float32Array(total);
            let offset = 0;
            for (const c of chunks) { merged.set(c, offset); offset += c.length; }
            inputBufferRef.current = [];
            if (!sessionRef.current || isMutedRef.current) return;
            const pcm16 = toPcm16At16k(merged, sampleRate);
            sessionRef.current.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(pcm16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
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
            // Fallback for browsers without AudioWorklet.
            // We only process input and DO NOT connect to destination to avoid microphone feedback.
            const proc = ctx.createScriptProcessor(4096, 1, 1);
            audioInputNodeRef.current = proc;
            proc.onaudioprocess = (e) => {
              if (!sessionRef.current || isMutedRef.current) return;
              const data = e.inputBuffer.getChannelData(0);
              const pcm16 = toPcm16At16k(data, sampleRate);
              sessionRef.current.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(pcm16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
            };
            src.connect(proc);
          }
        },
        onmessage: async (msg: LiveServerMessage) => {
          if (msg.serverContent?.inputTranscription) {
            const txt = msg.serverContent.inputTranscription.text;
            setTranscription(prev => {
              const next = [...prev, { role: 'user', text: txt }];
              return next.length > MAX_TRANSCRIPTION_ENTRIES ? next.slice(-MAX_TRANSCRIPTION_ENTRIES) : next;
            });
          } else if (msg.serverContent?.outputTranscription) {
            const txt = msg.serverContent.outputTranscription.text;
            setTranscription(prev => {
              const last = prev[prev.length - 1];
              const next = last?.role === 'model'
                ? [...prev.slice(0, -1), { role: 'model', text: last.text + txt }]
                : [...prev, { role: 'model', text: txt }];
              return next.length > MAX_TRANSCRIPTION_ENTRIES ? next.slice(-MAX_TRANSCRIPTION_ENTRIES) : next;
            });
          }

          const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && audioContextRef.current) {
            setIsSpeaking(true);
            try {
                const buf = await decodeAudioData(decodeBase64(audio), audioContextRef.current);
                const s = audioContextRef.current.createBufferSource();
                s.buffer = buf;
                s.connect(analyserRef.current!);
                const now = audioContextRef.current.currentTime;
                if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
                s.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buf.duration;
                sourcesRef.current.add(s);
                s.onended = () => { sourcesRef.current.delete(s); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
            } catch { /* skip failed chunk */ }
          }
          if (msg.serverContent?.interrupted) stopAiSpeaking();
        },
        onclose: () => { setIsActive(false); setIsConnecting(false); },
        onerror: (e: unknown) => {
            const errMsg = e instanceof Error ? e.message : 'Connection lost';
            setErrorMessage(errMsg.includes('model') || errMsg.includes('Model')
              ? 'Voice model unavailable. Please try again in a moment.'
              : errMsg || 'Connection error. Please retry.');
            stopSession();
        }
      };

      const p = mode === 'translator' 
        ? geminiService.connectTranslator(callbacks, { source: langA.label, target: langB.label, proactiveAudio, enableAffectiveDialog: affectiveDialog })
        : geminiService.connectLive(callbacks, { voiceName: selectedVoice, tone: selectedTone, sessionContext, proactiveAudio, enableAffectiveDialog: affectiveDialog });

      sessionRef.current = await p;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Microphone access failed';
      setErrorMessage(msg.includes('Permission') || msg.includes('permission') || msg.includes('denied')
        ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
        : msg.includes('NotFound') || msg.includes('not found')
        ? 'No microphone found. Please connect a microphone and try again.'
        : msg || 'Could not start voice session. Try again.');
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const prevLen = prevTranscriptionLengthRef.current;
    const currLen = transcription.length;
    prevTranscriptionLengthRef.current = currLen;
    // Only scroll when a new message is added (new bubble), not on every streaming chunk to the last model message.
    if (currLen > prevLen && scrollTranscriptionRef.current) {
      scrollTranscriptionRef.current.scrollTop = scrollTranscriptionRef.current.scrollHeight;
    }
  }, [transcription]);

  const activeColor = mode === 'translator' ? 'violet' : 'indigo';
  const containerClass = inline 
    ? "w-full h-full flex flex-col items-center p-4 overflow-hidden relative" 
    : "w-full max-w-lg glass-panel rounded-[40px] flex flex-col items-center p-4 md:p-6 bg-white dark:bg-slate-900/95 shadow-2xl transition-all duration-500 overflow-hidden relative max-h-[min(90vh,calc(var(--vh,1vh)*90))]";

  const applySettings = () => {
    setShowSettings(false);
    if (isActive) {
        stopSession();
        setTimeout(() => startSession(), 500);
    } else {
        setSettingsSavedFeedback(true);
    }
  };

  useEffect(() => {
    if (!settingsSavedFeedback) return;
    const t = setTimeout(() => setSettingsSavedFeedback(false), 2500);
    return () => clearTimeout(t);
  }, [settingsSavedFeedback]);

  useEffect(() => {
    if (!modeSwitchBlockedFeedback) return;
    const t = setTimeout(() => setModeSwitchBlockedFeedback(false), 2500);
    return () => clearTimeout(t);
  }, [modeSwitchBlockedFeedback]);

  return (
    <div className={inline ? "h-full w-full flex flex-col items-center justify-center min-h-0" : "fixed inset-0 z-[150] flex items-center justify-center p-4 safe-pt safe-pb bg-black/40 backdrop-blur-md overflow-y-auto"}>
      {!inline && <div className="absolute inset-0" onClick={onClose} aria-hidden />}
      
      <div className={containerClass}>
        
        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 z-[160] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex flex-col p-6 animate-fade">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Configuration</h3>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Voice Model</label>
                   <div className="grid grid-cols-1 gap-2">
                      {VOICES.map(v => (
                         <button 
                           key={v.id}
                           onClick={() => { setSelectedVoice(v.id); cacheService.set(CacheKey.VOICE_NAME, v.id); }}
                           className={`p-4 rounded-2xl text-left flex justify-between items-center transition-all ${selectedVoice === v.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}
                         >
                            <div className="flex items-center justify-between w-full gap-3">
                              <span className="text-xs font-bold">{v.label}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); previewVoice(v.id); }}
                                  className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] hover:bg-white/30 transition-colors"
                                  aria-label={`Preview ${v.label}`}
                                >
                                  <i className="fa-solid fa-play"></i>
                                </button>
                                {selectedVoice === v.id && <i className="fa-solid fa-check text-xs"></i>}
                              </div>
                            </div>
                         </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personality Tone</label>
                   <div className="grid grid-cols-2 gap-2">
                      {TONES.map(t => (
                         <button 
                           key={t.id}
                           onClick={() => handleToneChange(t.id)}
                           className={`p-3 rounded-xl text-xs font-bold text-center transition-all border ${selectedTone === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-500'}`}
                         >
                            {t.label}
                         </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Native audio</label>
                   <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
                         <input type="checkbox" checked={proactiveAudio} onChange={(e) => handleProactiveAudioChange(e.target.checked)} className="rounded accent-cyan-500" />
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Proactive Audio</span>
                         <span className="text-[10px] text-slate-500">Only respond when relevant; ignore background noise &amp; TV.</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
                         <input type="checkbox" checked={affectiveDialog} onChange={(e) => handleAffectiveDialogChange(e.target.checked)} className="rounded accent-cyan-500" />
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Affective Dialog</span>
                         <span className="text-[10px] text-slate-500">Adapt tone to your emotion (e.g. frustration, excitement).</span>
                      </label>
                   </div>
                </div>
             </div>

             <button onClick={applySettings} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest mt-4">
                 {isActive ? 'Restart Session' : 'Save Settings'}
             </button>
          </div>
        )}

        {/* Header - always visible */}
        <div className="w-full flex items-center justify-between shrink-0 py-2 pb-3">
           <div className={`px-3 py-1 rounded-full border transition-all ${isActive ? 'bg-slate-100 dark:bg-white/5 border-slate-200' : `bg-${activeColor}-500/10 border-${activeColor}-500/20`}`}>
              <span className={`text-[9px] font-black uppercase tracking-widest animate-beta-pulse ${isActive ? 'text-slate-400' : `text-${activeColor}-600`}`}>BETA v5.0</span>
           </div>
           
           <div className="flex flex-col items-end gap-1">
             <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-black/5 dark:border-white/5">
               <button onClick={() => { if (isActive && mode !== 'assistant') setModeSwitchBlockedFeedback(true); else if (!isActive) setMode('assistant'); }} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'assistant' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 opacity-50'}`}>{t.voiceMode.assistant}</button>
               <button onClick={() => { if (isActive && mode !== 'translator') setModeSwitchBlockedFeedback(true); else if (!isActive) setMode('translator'); }} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'translator' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 opacity-50'}`}>{t.voiceMode.interpreter}</button>
             </div>
             {modeSwitchBlockedFeedback && (
               <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest animate-fade">{t.voiceMode.stopSessionToChangeMode}</span>
             )}
           </div>
        </div>

        {/* Core Viewport - scrollable so upper part is never cut */}
        <div className="flex-1 w-full flex flex-col items-center min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar py-2">
            <div className="relative flex flex-col items-center justify-center py-4 md:py-6">
               <div className="relative">
                  <div className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-700 ${isActive ? 'opacity-25' : 'opacity-0'} ${mode === 'translator' ? 'bg-indigo-500' : 'bg-indigo-500'}`}></div>
                  <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full relative flex items-center justify-center transition-all duration-500 ${isActive ? (mode === 'translator' ? 'bg-indigo-600' : 'bg-indigo-600') + ' text-white shadow-2xl scale-105' : 'bg-slate-50 dark:bg-white/5 text-slate-300 border border-black/5 dark:border-white/5'}`}>
                    {isActive && <div className={`absolute -inset-4 rounded-full border-2 border-current opacity-10 ${isSpeaking ? 'animate-ping' : ''}`}></div>}
                    <i className={`fa-solid ${mode === 'translator' ? 'fa-language' : (isActive ? 'fa-microphone-lines' : 'fa-microphone')} text-5xl md:text-6xl`}></i>
                    
                    {isActive && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }}
                        className={`absolute -bottom-1 -left-1 w-12 h-12 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-2xl border-4 border-slate-50 dark:border-slate-950 animate-reveal ${isMuted ? 'bg-red-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                        title={isMuted ? 'Unmute mic' : 'Mute mic'}
                      >
                        <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                      </button>
                    )}
                    {isSpeaking && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); stopAiSpeaking(); }}
                        className="absolute -bottom-1 -right-1 w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-red-500 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-2xl border-4 border-slate-50 dark:border-slate-950 animate-reveal"
                      >
                        <i className="fa-solid fa-volume-xmark"></i>
                      </button>
                    )}
                  </div>
               </div>
               
               {/* Config Button (When Idle) */}
               {!isActive && mode === 'assistant' && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-full text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                       <i className="fa-solid fa-sliders"></i>
                       <span>{selectedVoice} • {selectedTone}</span>
                    </button>
                    {settingsSavedFeedback && (
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-fade">Settings saved</span>
                    )}
                  </div>
               )}
               
               {/* Language Selectors (Only in Translator Mode) */}
               {mode === 'translator' && !isActive && (
                 <div className="flex items-center gap-4 mt-8 animate-reveal z-20">
                    <div className="relative group">
                       <select 
                         value={langA.code} 
                         onChange={e => setLangA(LANGUAGES.find(l => l.code === e.target.value) || LANGUAGES[0])}
                         className="appearance-none bg-slate-100 dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                       >
                         {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                       </select>
                       <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                    <i className="fa-solid fa-arrow-right-arrow-left text-slate-400 text-[10px]"></i>
                    <div className="relative group">
                       <select 
                         value={langB.code} 
                         onChange={e => setLangB(LANGUAGES.find(l => l.code === e.target.value) || LANGUAGES[1])}
                         className="appearance-none bg-slate-100 dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                       >
                         {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                       </select>
                       <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                 </div>
               )}

               <div className="mt-6 text-center space-y-1">
                  <h2 className={`text-xl font-black uppercase tracking-tight transition-colors ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                      {isActive ? (isSpeaking ? "Speaking" : isMuted ? "Muted" : "Listening") : (mode === 'translator' ? "AI Interpreter" : t.voice)}
                  </h2>
                  {isActive && mode === 'translator' && (
                     <div className="flex justify-center gap-2 mt-2">
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">{langA.label}</span>
                        <span className="text-[10px] text-slate-400"><i className="fa-solid fa-arrow-right-arrow-left"></i></span>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">{langB.label}</span>
                     </div>
                  )}
               </div>
            </div>

            <div className={`w-full flex flex-col gap-4 transition-all duration-500 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 h-0 pointer-events-none overflow-hidden'}`}>
                <div className="w-full h-6 flex items-end justify-center gap-1.5 px-8">
                  {Array.from({ length: BAR_COUNT }).map((_, i) => (
                    <div key={i} ref={(el) => { barsRef.current[i] = el; }} className={`w-2.5 rounded-full transition-all duration-100 ${mode === 'translator' ? 'bg-indigo-500' : 'bg-indigo-500'}`} style={{ height: '10%' }}></div>
                  ))}
                </div>

                <div ref={scrollTranscriptionRef} className="w-full min-h-[8rem] max-h-40 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20 rounded-2xl p-4 flex flex-col gap-3 border border-black/5 dark:border-white/5 shadow-inner">
                  {transcription.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-4">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                           {mode === 'translator' ? `Detecting ${langA.label} or ${langB.label}...` : 'Live Neural Sync Active\nSay anything to begin'}
                         </p>
                      </div>
                  ) : (
                      transcription.map((item, i) => (
                          <div key={i} className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} animate-reveal`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-[11px] font-medium max-w-[90%] shadow-sm ${item.role === 'user' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-black/5 dark:border-white/5'}`}>
                                  <div className={/[\u0D80-\u0DFF]/.test(item.text) ? 'sinhala-text' : /[\u0B80-\u0BFF]/.test(item.text) ? 'tamil-text' : ''}>
                                    {item.text}
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
                </div>
            </div>
        </div>

        {/* Bottom Pinned Controls - always visible */}
        <div className="w-full pt-3 shrink-0 safe-pb">
          {!isActive ? (
            <button 
              onClick={startSession} 
              disabled={isConnecting}
              className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
            >
              {isConnecting ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className={`fa-solid ${mode === 'translator' ? 'fa-play' : 'fa-microphone'}`}></i>}
              <span>{isConnecting ? "HANDSHAKING..." : (mode === 'translator' ? t.transMode.start : t.voice)}</span>
            </button>
          ) : (
            <div className="flex gap-3">
               {mode === 'assistant' && (
                  <button onClick={() => setShowSettings(true)} className="w-16 h-16 rounded-[24px] bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all">
                     <i className="fa-solid fa-sliders"></i>
                  </button>
               )}
               <button 
                  onClick={stopSession} 
                  className="flex-1 py-5 bg-red-500 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
               >
                  <i className="fa-solid fa-power-off"></i>
                  <span>{t.endSession}</span>
               </button>
            </div>
          )}
          {!inline && (
            <button onClick={onClose} className="w-full text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors py-3 uppercase tracking-widest">Close Overlay</button>
          )}
        </div>

        {errorMessage && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center p-6 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl animate-fade">
             <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-[32px] mx-auto flex items-center justify-center text-red-500"><i className="fa-solid fa-triangle-exclamation text-3xl"></i></div>
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Audio Protocol Failure</h3>
                   <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">{errorMessage}</p>
                </div>
                <button onClick={() => setErrorMessage(null)} className="px-10 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Retry Handshake</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
