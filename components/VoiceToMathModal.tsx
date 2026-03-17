import React, { useRef, useState, useCallback, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { LiveServerMessage } from '@google/genai';

const INPUT_BATCH_SAMPLES = 4096;

function encodeBase64(bytes: Uint8Array): string {
  let b = '';
  for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

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

interface VoiceToMathModalProps {
  onInsert: (latex: string) => void;
  onClose: () => void;
}

export const VoiceToMathModal: React.FC<VoiceToMathModalProps> = ({ onInsert, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'got'>('idle');
  const [sessionRequested, setSessionRequested] = useState(false);
  const [latexPreview, setLatexPreview] = useState('');
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioInputNodeRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const inputBufferRef = useRef<Float32Array[]>([]);
  const accumulatedLatexRef = useRef('');
  const flushTimeoutRef = useRef<number | null>(null);
  const onInsertRef = useRef(onInsert);
  const onCloseRef = useRef(onClose);
  onInsertRef.current = onInsert;
  onCloseRef.current = onClose;

  const COMPLETE_DELAY_MS = 1200;

  const stopSession = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch {}
      sessionRef.current = null;
    }
    audioSourceRef.current?.disconnect();
    audioInputNodeRef.current?.disconnect();
    audioInputNodeRef.current = null;
    audioSourceRef.current = null;
    inputBufferRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      try { inputAudioContextRef.current.close(); } catch {}
    }
    setStatus('idle');
  }, []);

  const finishAndInsert = useCallback(() => {
    const latex = accumulatedLatexRef.current.trim();
    if (latex) {
      const cleaned = latex.replace(/^```(?:latex|math)?\s*/i, '').replace(/\s*```$/i, '').trim();
      if (cleaned) onInsertRef.current(cleaned);
    }
    stopSession();
    onCloseRef.current();
  }, [stopSession]);

  useEffect(() => {
    if (!sessionRequested) return;
    let cancelled = false;
    const start = async () => {
      setStatus('connecting');
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AudioCtx();
        const inputSampleRate = inputAudioContextRef.current.sampleRate || 44100;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;

        const flushBuffer = () => {
          const chunks = inputBufferRef.current;
          if (chunks.length === 0) return;
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const merged = new Float32Array(total);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          inputBufferRef.current = [];
          if (!sessionRef.current) return;
          const pcm16 = toPcm16At16k(merged, inputSampleRate);
          sessionRef.current.sendRealtimeInput({
            media: { data: encodeBase64(new Uint8Array(pcm16.buffer)), mimeType: 'audio/pcm;rate=16000' },
          });
        };

        const callbacks = {
          onopen: async () => {
            if (cancelled) return;
            setStatus('listening');
            const ctx = inputAudioContextRef.current!;
            const src = ctx.createMediaStreamSource(stream);
            audioSourceRef.current = src;
            try {
              await ctx.audioWorklet.addModule('/voice-input-processor.js');
              const workletNode = new AudioWorkletNode(ctx, 'voice-input-processor', {
                processorOptions: { sampleRate: inputSampleRate },
              });
              audioInputNodeRef.current = workletNode;
              workletNode.port.onmessage = (e: MessageEvent<{ samples: ArrayBuffer; sampleRate: number }>) => {
                const { samples } = e.data;
                inputBufferRef.current.push(new Float32Array(samples));
                let total = 0;
                for (const c of inputBufferRef.current) total += c.length;
                if (total >= INPUT_BATCH_SAMPLES) flushBuffer();
              };
              src.connect(workletNode);
            } catch {
              // Fallback for browsers without AudioWorklet. Process mic only; do NOT connect to
              // ctx.destination to avoid mic→speakers feedback/echo when user is on speakers.
              const proc = ctx.createScriptProcessor(4096, 1, 1);
              audioInputNodeRef.current = proc;
              proc.onaudioprocess = (e: AudioProcessingEvent) => {
                if (!sessionRef.current) return;
                const data = e.inputBuffer.getChannelData(0);
                const pcm16 = toPcm16At16k(data, inputSampleRate);
                sessionRef.current.sendRealtimeInput({
                  media: { data: encodeBase64(new Uint8Array(pcm16.buffer)), mimeType: 'audio/pcm;rate=16000' },
                });
              };
              src.connect(proc);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (cancelled) return;
            if (msg.serverContent?.outputTranscription) {
              const txt = msg.serverContent.outputTranscription.text;
              accumulatedLatexRef.current = (accumulatedLatexRef.current + txt).trim();
              setLatexPreview(accumulatedLatexRef.current);
              if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
              flushTimeoutRef.current = window.setTimeout(() => {
                flushTimeoutRef.current = null;
                finishAndInsert();
              }, COMPLETE_DELAY_MS);
            }
          },
          onclose: () => {
            if (!cancelled) setStatus('idle');
          },
          onerror: () => {
            if (!cancelled) {
              setStatus('idle');
              stopSession();
              onCloseRef.current();
            }
          },
        };

        sessionRef.current = await geminiService.connectLiveMath(callbacks);
      } catch (e) {
        if (!cancelled) {
          setStatus('idle');
          alert(e instanceof Error ? e.message : 'Microphone error');
          onCloseRef.current();
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      stopSession();
    };
  }, [status, finishAndInsert, stopSession]);

  const handleStart = () => {
    setSessionRequested(true);
    setStatus('listening');
    setLatexPreview('');
    accumulatedLatexRef.current = '';
  };

  const handleStop = () => {
    finishAndInsert();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <i className="fa-solid fa-microphone text-indigo-500" />
            Voice to equation
          </span>
          <button
            type="button"
            onClick={() => { stopSession(); onCloseRef.current(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {status === 'idle' && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Say your equation in words, e.g. &ldquo;x squared plus 5x minus 6 equals zero&rdquo;. You&apos;ll need to allow the microphone.
            </p>
          )}
          {(status === 'connecting' || status === 'listening') && (
            <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-notch fa-spin text-indigo-500" />
              {status === 'connecting' ? 'Connecting…' : 'Say your equation…'}
            </p>
          )}
          {latexPreview && (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-sm font-mono text-slate-800 dark:text-slate-200 break-all">
              {latexPreview}
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          {status === 'idle' && (
            <button
              type="button"
              onClick={handleStart}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-indigo-500"
            >
              Start listening
            </button>
          )}
          {(status === 'connecting' || status === 'listening') && (
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:bg-slate-700 dark:hover:bg-slate-200"
            >
              Done & insert
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceToMathModal;
