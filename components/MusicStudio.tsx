import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geminiService, AppError } from '../services/geminiService';
function writeWavHeader(pcm: Uint8Array, sampleRate: number, channels: number, bitDepth: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcm.byteLength, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcm.byteLength, true);

  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav.buffer;
}

const SCALES = [
  { value: 'SCALE_UNSPECIFIED', label: 'Auto' },
  { value: 'C_MAJOR', label: 'C Major' },
  { value: 'A_MINOR', label: 'A Minor' },
  { value: 'G_MAJOR', label: 'G Major' },
  { value: 'E_MINOR', label: 'E Minor' },
  { value: 'D_MAJOR', label: 'D Major' },
  { value: 'B_MINOR', label: 'B Minor' },
  { value: 'DORIAN', label: 'Dorian (moody)' },
  { value: 'PHRYGIAN', label: 'Phrygian (dark)' },
  { value: 'PENTATONIC', label: 'Pentatonic' },
];

const BAR_COUNT = 6;

function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel: () => void } {
  let last = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;
  const run = (...args: Parameters<T>) => {
    pendingArgs = args;
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed >= ms || last === 0) {
      if (timeout) clearTimeout(timeout);
      timeout = null;
      last = now;
      pendingArgs = null;
      fn(...args);
    } else if (timeout == null) {
      timeout = setTimeout(() => {
        timeout = null;
        last = Date.now();
        if (pendingArgs) {
          const a = pendingArgs;
          pendingArgs = null;
          fn(...a);
        }
      }, ms - elapsed);
    }
  };
  run.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    pendingArgs = null;
  };
  return run as T & { cancel: () => void };
}

const MusicStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [steerPrompt, setSteerPrompt] = useState('');
  const [steerWeight, setSteerWeight] = useState(0.5);
  const [bpm, setBpm] = useState(90);
  const [density, setDensity] = useState(0.5);
  const [brightness, setBrightness] = useState(0.5);
  const [scale, setScale] = useState('SCALE_UNSPECIFIED');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasRecordedChunks, setHasRecordedChunks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Awaited<ReturnType<typeof geminiService.connectMusicSession>> | null>(null);
  const lastPromptRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef(0);
  const steerThrottleRef = useRef<ReturnType<typeof throttle> | null>(null);
  const bpmThrottleRef = useRef<ReturnType<typeof throttle> | null>(null);

  /** Lyria: 48kHz stereo PCM → AudioContext. Music is different from voice (24k mono); decode inline. */
  const playChunk = useCallback((base64: string) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 48000 });
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
    }
    const ctx = audioCtxRef.current;

    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    chunksRef.current.push(bytes.buffer.slice(0));
    if (chunksRef.current.length === 1) setHasRecordedChunks(true);

    const int16 = new Int16Array(bytes.buffer);
    const frameCount = int16.length / 2;
    const buffer = ctx.createBuffer(2, frameCount, 48000);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < frameCount; i++) {
      left[i] = int16[i * 2] / 32768;
      right[i] = int16[i * 2 + 1] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);
    sourcesRef.current.add(source);
    source.onended = () => sourcesRef.current.delete(source);

    if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime + 0.1;
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  }, []);

  const updateVisualizer = useCallback(() => {
    let hasSignal = false;
    const dataArray = new Uint8Array(BAR_COUNT);
    if (isPlaying && analyserRef.current) {
      analyserRef.current.getByteFrequencyData(dataArray);
      hasSignal = true;
    }
    const time = Date.now() / 1000;
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      let height = 12;
      if (hasSignal) {
        const value = dataArray[i] ?? 0;
        height = Math.max(12, (value / 255) * 100);
      } else {
        height = 12 + Math.sin(time * 4 + i) * 6;
      }
      bar.style.height = `${height}%`;
      bar.style.opacity = hasSignal ? '1' : '0.4';
    });
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, [isPlaying]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [updateVisualizer]);

  const stopSession = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      try { s.stop(); } catch {}
    });
    sourcesRef.current.clear();
    if (sessionRef.current) {
      try { sessionRef.current.stop(); } catch {}
      sessionRef.current = null;
    }
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    chunksRef.current = [];
    setHasRecordedChunks(false);
    setIsPlaying(false);
    // Defer close so stopped nodes and their onended callbacks don't run against a closed context.
    if (ctx && ctx.state !== 'closed') {
      setTimeout(() => {
        try { ctx.close(); } catch {}
      }, 0);
    }
  }, []);

  useEffect(() => () => stopSession(), [stopSession]);

  // Cancel pending throttle timeouts on unmount so stale closures never fire (e.g. after tab switch).
  useEffect(() => () => {
    steerThrottleRef.current?.cancel?.();
    bpmThrottleRef.current?.cancel?.();
  }, []);

  const handlePlay = async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt to start.');
      return;
    }
    setError(null);
    if (sessionRef.current && lastPromptRef.current === prompt.trim()) {
      sessionRef.current.play();
      setIsPlaying(true);
      return;
    }
    setIsConnecting(true);
    try {
      chunksRef.current = [];
      setHasRecordedChunks(false);
      lastPromptRef.current = prompt.trim();

      const session = await geminiService.connectMusicSession(
        prompt.trim(),
        {
          bpm,
          density,
          brightness,
          scale,
        },
        {
          onAudioChunk: (data) => playChunk(data),
          onError: (e) => setError(String(e)),
          onClose: () => setIsPlaying(false),
        }
      );
      sessionRef.current = session;
      setIsPlaying(true);
    } catch (e) {
      const msg = e instanceof AppError ? e.message : e instanceof Error ? e.message : 'Failed to connect.';
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSteer = useMemo(
    () => {
      const t = throttle(async (mainPrompt: string, steerPrompt: string, steerWeight: number) => {
        if (!sessionRef.current) return;
        const main = mainPrompt.trim();
        const steer = steerPrompt.trim();
        const w = Math.max(0, Math.min(1, steerWeight));
        const weightedPrompts = steer
          ? [
              { text: main, weight: 1.0 - w },
              { text: steer, weight: w },
            ]
          : [{ text: main, weight: 1.0 }];
        await sessionRef.current.setWeightedPrompts({ weightedPrompts });
      }, 300);
      steerThrottleRef.current = t;
      return t;
    },
    []
  );

  useEffect(() => {
    if (!sessionRef.current) return;
    handleSteer(prompt, steerPrompt, steerWeight);
  }, [steerWeight, steerPrompt, prompt, handleSteer]);

  const handlePause = () => {
    if (sessionRef.current) {
      sessionRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    stopSession();
  };

  /** BPM and Scale are structural — must reset context for changes to take effect. */
  const handleBpmOrScaleChange = useCallback(
    async (newBpm: number, newScale: string) => {
      if (!sessionRef.current) return;
      sessionRef.current.resetContext();
      await sessionRef.current.setMusicGenerationConfig({
        musicGenerationConfig: {
          bpm: newBpm,
          scale: newScale as any,
          density,
          brightness,
        },
      });
    },
    [density, brightness]
  );
  const handleBpmOrScaleChangeThrottled = useMemo(() => {
    bpmThrottleRef.current?.cancel?.();
    const t = throttle((newBpm: number, newScale: string) => {
      handleBpmOrScaleChange(newBpm, newScale);
    }, 400);
    bpmThrottleRef.current = t;
    return t;
  }, [handleBpmOrScaleChange]);

  function downloadRecording() {
    const allChunks = chunksRef.current;
    if (allChunks.length === 0) {
      setError('No audio recorded yet. Play first.');
      return;
    }

    const totalLength = allChunks.reduce((sum, b) => sum + b.byteLength, 0);
    const pcm = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of allChunks) {
      pcm.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    const wav = writeWavHeader(pcm, 48000, 2, 16);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orin-music-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputStyle =
    'w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs md:text-sm font-semibold focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm';
  const labelStyle = 'text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1';

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6 items-start overflow-hidden">
      {/* Left: Controls */}
      <div className="space-y-4 lg:overflow-y-auto custom-scrollbar h-full lg:pr-2">
        <div className="glass-panel p-6 rounded-[32px] border border-slate-200 dark:border-white/10 shadow-xl bg-white dark:bg-slate-900/90 backdrop-blur-3xl">
          <div className="space-y-6">
            <div className="space-y-3">
              <label className={`flex items-center gap-3 ${labelStyle}`}>
                <i className="fa-solid fa-music text-cyan-500"></i>
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. lo-fi hip hop with rain sounds"
                className={`${inputStyle} h-24 resize-none`}
                disabled={!!sessionRef.current}
              />
            </div>
            <div className="space-y-3">
              <label className={labelStyle}>Steer (blends in live)</label>
              <textarea
                value={steerPrompt}
                onChange={(e) => setSteerPrompt(e.target.value)}
                placeholder="e.g. add soft piano"
                className={`${inputStyle} h-16 resize-none`}
              />
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-500">Weight</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={steerWeight}
                  onChange={(e) => setSteerWeight(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 accent-cyan-500"
                />
                <span className="text-[9px] font-mono w-8">{steerWeight.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelStyle}>BPM (60–200)</label>
              <input
                type="range"
                min={60}
                max={200}
                value={bpm}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBpm(v);
                  if (sessionRef.current) handleBpmOrScaleChangeThrottled(v, scale);
                }}
                className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 accent-cyan-500"
              />
              <span className="text-[9px] font-mono text-slate-500">{bpm}</span>
            </div>
            <div className="space-y-2">
              <label className={labelStyle}>Density (0–1)</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 accent-cyan-500"
                disabled={!!sessionRef.current}
              />
            </div>
            <div className="space-y-2">
              <label className={labelStyle}>Brightness (0–1)</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 accent-cyan-500"
                disabled={!!sessionRef.current}
              />
            </div>
            <div className="space-y-2">
              <label className={labelStyle}>Scale</label>
              <select
                value={scale}
                onChange={(e) => {
                  const v = e.target.value;
                  setScale(v);
                  if (sessionRef.current) handleBpmOrScaleChangeThrottled(bpm, v);
                }}
                className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
              >
                {SCALES.map((opt) => (
                  <option key={opt.value || 'auto'} value={opt.value} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePlay}
                disabled={isConnecting || !prompt.trim()}
                className="flex-1 py-3 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-play"></i>}
                {isConnecting ? 'Connecting...' : 'Play'}
              </button>
              <button
                onClick={handlePause}
                disabled={!sessionRef.current}
                className="py-3 px-4 rounded-xl bg-slate-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-slate-500 disabled:opacity-50"
              >
                <i className="fa-solid fa-pause"></i>
              </button>
              <button
                onClick={handleStop}
                disabled={!sessionRef.current}
                className="py-3 px-4 rounded-xl bg-red-600/90 text-white text-[10px] font-black uppercase tracking-wider hover:bg-red-500 disabled:opacity-50"
              >
                <i className="fa-solid fa-stop"></i>
              </button>
            </div>
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-[9px] text-red-500 font-black uppercase tracking-widest">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Visualizer + Download */}
      <div className="min-h-[400px] glass-panel rounded-[40px] overflow-hidden flex flex-col items-center justify-center p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950 shadow-inner">
        <div className="w-full h-8 flex items-end justify-center gap-1.5 mb-6">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <div
              key={i}
              ref={(el) => { barsRef.current[i] = el; }}
              className="w-2.5 rounded-full transition-all duration-100 bg-cyan-500"
              style={{ height: '12%' }}
            />
          ))}
        </div>
        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
          {isPlaying ? 'Lyria RealTime' : 'Idle'}
        </p>
        <button
          onClick={downloadRecording}
          disabled={!hasRecordedChunks}
          className="py-3 px-6 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-cyan-500 disabled:opacity-50 flex items-center gap-2"
        >
          <i className="fa-solid fa-download"></i>
          Download WAV
        </button>
      </div>
    </div>
  );
};

export default MusicStudio;
