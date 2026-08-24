
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { geminiService, AppError } from '../services/geminiService';
import { cacheService, CacheKey } from '../services/cacheService';
import { AspectRatio, ImageSize } from '../types';
import MusicStudio from './MusicStudio';

interface GeneratedAsset {
  url: string;
  prompt: string;
  timestamp: number;
  type: 'image' | 'video' | 'audio';
  /** For video assets: aspect ratio used (needed for Extend). */
  videoAspectRatio?: '16:9' | '9:16';
  /** For image assets: embedding for semantic search (Gemini Embedding 2). */
  embedding?: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const norm = Math.sqrt(na) * Math.sqrt(nb);
  return norm === 0 ? 0 : dot / norm;
}

type StudioTab = 'image' | 'video' | 'audio' | 'audio' | 'narration';

const TTS_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe',
  'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix',
  'Sadachbia', 'Sadaltager', 'Sulafat',
] as const;

const FeatureCreate: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [videoMode, setVideoMode] = useState<'text' | 'image' | 'frames'>('text');
  const [videoImage, setVideoImage] = useState<{ imageBytes: string; mimeType: string } | null>(null);
  const [videoFirstFrame, setVideoFirstFrame] = useState<{ imageBytes: string; mimeType: string } | null>(null);
  const [videoLastFrame, setVideoLastFrame] = useState<{ imageBytes: string; mimeType: string } | null>(null);
  const [extendingTimestamp, setExtendingTimestamp] = useState<number | null>(null);
  const [extendPrompt, setExtendPrompt] = useState('');
  // Studio history is kept in-memory only; persisting large data URLs to localStorage quickly hits quota.
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchOrder, setImageSearchOrder] = useState<number[] | null>(null);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const imageSearchDebounceRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Reference image for image-to-image generation
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const [publishModal, setPublishModal] = useState<{ url: string; prompt: string } | null>(null);
  const [publishCaption, setPublishCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  // Narration (TTS) state
  const [narrationText, setNarrationText] = useState('');
  const [narrationStyle, setNarrationStyle] = useState('');
  const [narrationVoice, setNarrationVoice] = useState<string>(TTS_VOICES[0]);
  const [narrationModel, setNarrationModel] = useState<'flash' | 'pro'>('flash');
  const [narrationDialogue, setNarrationDialogue] = useState(false);
  const [dialogueSpeaker1, setDialogueSpeaker1] = useState('Speaker1');
  const [dialogueVoice1, setDialogueVoice1] = useState<string>(TTS_VOICES[0]);
  const [dialogueSpeaker2, setDialogueSpeaker2] = useState('Speaker2');
  const [dialogueVoice2, setDialogueVoice2] = useState<string>(TTS_VOICES[1]);

  // NOTE: We intentionally do NOT persist full studio history (data URLs) to localStorage.
  // A few 4K base64 images can exceed typical 5–10MB quotas and break storage for the whole app.

  // Reset aspect ratio when switching tabs to ensure valid state for the selected mode
  useEffect(() => {
    if (activeTab === 'video') {
      // Veo only supports 16:9 or 9:16
      if (aspectRatio !== '16:9' && aspectRatio !== '9:16') {
        setAspectRatio('16:9');
      }
    }
    // Intentionally omit aspectRatio: we only normalize when switching TO video tab, not on every aspect ratio change on video (which would re-run unnecessarily).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Image semantic search: embed query and sort image assets by similarity
  useEffect(() => {
    const q = imageSearchQuery.trim();
    if (!q) {
      setImageSearchOrder(null);
      return;
    }
    if (imageSearchDebounceRef.current) clearTimeout(imageSearchDebounceRef.current);
    imageSearchDebounceRef.current = window.setTimeout(async () => {
      setIsImageSearching(true);
      try {
        const [queryVec] = await geminiService.embedText([q]);
        if (!queryVec?.length) {
          setImageSearchOrder(null);
          return;
        }
        const images = history.filter((a) => a.type === 'image');
        const indexed = images.filter((a): a is GeneratedAsset & { embedding: number[] } => Array.isArray(a.embedding) && a.embedding.length > 0);
        if (!indexed.length) {
          // No embeddings yet (e.g. user searched immediately after generation) – fall back to recency order.
          setImageSearchOrder(images.map((a) => a.timestamp));
          return;
        }
        const scored = indexed.map((a) => ({ timestamp: a.timestamp, score: cosineSimilarity(queryVec, a.embedding) }));
        scored.sort((a, b) => b.score - a.score);
        setImageSearchOrder(scored.map((x) => x.timestamp));
      } catch {
        setImageSearchOrder(null);
      } finally {
        setIsImageSearching(false);
      }
    }, 400);
    return () => {
      if (imageSearchDebounceRef.current) clearTimeout(imageSearchDebounceRef.current);
    };
  }, [imageSearchQuery, history]);

  // For image tab: show only images, optionally sorted by search relevance
  const displayHistory = useMemo(() => {
    if (activeTab === 'image') {
      const images = history.filter((a) => a.type === 'image');
      if (imageSearchOrder && imageSearchOrder.length) {
        const orderSet = new Set(imageSearchOrder);
        const byOrder = imageSearchOrder.map((ts) => images.find((a) => a.timestamp === ts)).filter(Boolean) as GeneratedAsset[];
        const rest = images.filter((a) => !orderSet.has(a.timestamp)).sort((a, b) => b.timestamp - a.timestamp);
        return [...byOrder, ...rest];
      }
      return [...images].sort((a, b) => b.timestamp - a.timestamp);
    }
    return [...history].sort((a, b) => b.timestamp - a.timestamp);
  }, [activeTab, history, imageSearchOrder]);

  function buildWavFromPcmBase64(base64: string): string {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const numSamples = pcm.length;
    const dataLength = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    const write = (offset: number, value: number) => view.setUint32(offset, value, true);
    const write16 = (offset: number, value: number) => view.setUint16(offset, value, true);
    const writeStr = (offset: number, str: string) => str.split('').forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    const sampleRate = 24000;
    const channels = 1;
    writeStr(0, 'RIFF');
    write(4, 36 + dataLength);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    write(16, 16);
    write16(20, 1);
    write16(22, channels);
    write(24, sampleRate);
    write(28, sampleRate * channels * 2);
    write16(32, channels * 2);
    write16(34, 16);
    writeStr(36, 'data');
    write(40, dataLength);
    new Int16Array(buffer, 44).set(pcm);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  const handleGenerate = async (customPrompt?: string) => {
    if (activeTab === 'narration') {
      if (!narrationText.trim()) return;
      setIsLoading(true);
      setError(null);
      const msgs = ["Preparing voice...", "Synthesizing speech...", "Encoding audio..."];
      setLoadingMessage(msgs[0]);
      let msgIdx = 0;
      const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % msgs.length;
        setLoadingMessage(msgs[msgIdx]);
      }, 2500);
      try {
        const s1 = dialogueSpeaker1.trim() || 'Speaker1';
        const s2 = dialogueSpeaker2.trim() || 'Speaker2';
        const textForTts = narrationDialogue
          ? `TTS the following conversation between ${s1} and ${s2}:\n\n${narrationText.trim()}`
          : narrationText.trim();
        const base64 = await geminiService.generateTts({
          text: textForTts,
          stylePrompt: narrationStyle.trim() || undefined,
          voiceName: narrationDialogue ? undefined : narrationVoice,
          multiSpeaker: narrationDialogue
            ? [
                { speaker: s1, voiceName: dialogueVoice1 },
                { speaker: s2, voiceName: dialogueVoice2 },
              ]
            : undefined,
          model: narrationModel,
        });
        const url = buildWavFromPcmBase64(base64);
        const promptLabel = narrationStyle.trim() ? `${narrationStyle.slice(0, 40)}... — ${narrationText.slice(0, 30)}...` : narrationText.slice(0, 80);
        setHistory(prev => [{ url, prompt: promptLabel, timestamp: Date.now(), type: 'audio' }, ...prev]);
        setNarrationText('');
      } catch (e: unknown) {
        clearInterval(msgInterval);
        setIsLoading(false);
        const appErr = e as AppError;
        if (appErr?.type === 'plan_required' || appErr?.type === 'limit_reached') {
          setError(null);
          setUpgradeModalMessage(appErr.type === 'plan_required' ? "This feature requires a Basic or Pro plan." : "You've reached your plan limit. Upgrade for more.");
          setShowUpgradeModal(true);
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        }
        return;
      }
      clearInterval(msgInterval);
      setIsLoading(false);
      return;
    }

    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    const imageMessages = ["Synthesizing pixels...", "Refining details...", "Applying aesthetics...", "Final polish..."];
    const videoMessages = ["Initializing Veo 3.1...", "Simulating physics...", "Rendering frames...", "Encoding stream..."];
    const msgs = activeTab === 'video' ? videoMessages : imageMessages;
    setLoadingMessage(msgs[0]);
    
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % msgs.length;
        setLoadingMessage(msgs[msgIdx]);
    }, 3000);

    try {
      let url = "";
      if (activeTab === 'image') {
        url = await geminiService.generateImagePro(finalPrompt, aspectRatio, imageSize, undefined, referenceImage ? { data: referenceImage.data, mimeType: referenceImage.mimeType } : undefined);
      } else {
        const veoRatio = (aspectRatio === '9:16') ? '9:16' : '16:9';
        const videoOpts: Parameters<typeof geminiService.generateVideo>[0] = { prompt: finalPrompt, aspectRatio: veoRatio, resolution: videoResolution };
        if (videoMode === 'image' && videoImage) videoOpts.image = videoImage;
        if (videoMode === 'frames') {
          if (videoFirstFrame) videoOpts.image = videoFirstFrame;
          if (videoLastFrame) videoOpts.lastFrame = videoLastFrame;
        }
        url = await geminiService.generateVideo(videoOpts);
      }

      const ts = Date.now();
      const newAsset: GeneratedAsset = {
        url,
        prompt: finalPrompt,
        timestamp: ts,
        type: activeTab,
        ...(activeTab === 'video' && { videoAspectRatio: (aspectRatio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16' }),
      };
      setHistory(prev => [newAsset, ...prev]);
      setPrompt('');
      if (activeTab === 'video') {
        setVideoImage(null);
        setVideoFirstFrame(null);
        setVideoLastFrame(null);
      }

      // ── Auto-save every generation to Creations (background, silent) ──────
      autoSaveToCreations(url, finalPrompt, activeTab as 'image' | 'video' | 'music' | 'text').catch(() => {});
      // Generate embedding for new images (same vector space as text for search)
      if (activeTab === 'image' && url.startsWith('data:image')) {
        const base64 = url.split(',')[1];
        if (base64) {
          geminiService.embedImage(base64, 'image/png').then((vec) => {
            if (vec.length) setHistory(prev => prev.map(a => a.timestamp === ts && a.type === 'image' ? { ...a, embedding: vec } : a));
          });
        }
      }
    } catch (e: unknown) {
      const appErr = e as AppError;
      if (appErr?.type === 'plan_required' || appErr?.type === 'limit_reached') {
        setError(null);
        setUpgradeModalMessage(appErr.type === 'plan_required'
          ? "This feature requires a Basic or Pro plan."
          : "You've reached your plan limit. Upgrade for more.");
        setShowUpgradeModal(true);
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      clearInterval(msgInterval);
      setIsLoading(false);
    }
  };

  /** Get a Blob from a URL that may be a data: URI (fetch of data: fails in Firefox/Safari). */
  const urlToBlob = async (url: string): Promise<Blob> => {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      const base64 = comma >= 0 ? url.slice(comma + 1) : '';
      const header = url.slice(0, comma >= 0 ? comma : url.length);
      const mimeMatch = header.match(/data:([^;]+)/);
      const mime = (mimeMatch?.[1]?.trim() || 'image/png').replace(/;base64$/i, '');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  };

  const handleDownload = async (asset: GeneratedAsset) => {
    try {
      const blob = await urlToBlob(asset.url);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `orin-${asset.type}-${asset.timestamp}.${asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'wav' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError('Download failed. Try again or use a different browser.');
    }
  };

  const handleClearHistory = () => {
    setShowClearHistoryConfirm(true);
  };

  const readFileAsBase64 = (file: File): Promise<{ imageBytes: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result as string;
        const [header, base64] = dataUrl.split(',');
        const mimeType = (header?.match(/data:([^;]+)/)?.[1] || 'image/png').trim();
        resolve({ imageBytes: base64 || '', mimeType });
      };
      r.onerror = () => reject(new Error('Failed to read file'));
      r.readAsDataURL(file);
    });
  };

  const handleExtendVideo = async (asset: GeneratedAsset) => {
    if (asset.type !== 'video') return;
    const aspect = asset.videoAspectRatio ?? '16:9';
    const promptToUse = extendPrompt.trim() || 'Continue the scene naturally.';
    setExtendingTimestamp(asset.timestamp);
    setError(null);
    setIsLoading(true);
    setLoadingMessage('Extending video...');
    try {
      let base64: string;
      if (asset.url.startsWith('data:')) {
        const comma = asset.url.indexOf(',');
        base64 = comma >= 0 ? asset.url.slice(comma + 1) : '';
      } else {
        const res = await fetch(asset.url);
        const blob = await res.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => { const d = (r.result as string).split(',')[1]; resolve(d || ''); };
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
      }
      const url = await geminiService.generateVideo({
        prompt: promptToUse,
        aspectRatio: asset.videoAspectRatio,
        video: { videoBytes: base64, mimeType: 'video/mp4' },
      });
      setHistory(prev => [{ url, prompt: promptToUse, timestamp: Date.now(), type: 'video', videoAspectRatio: asset.videoAspectRatio }, ...prev]);
      setExtendPrompt('');
      setExtendingTimestamp(null);
    } catch (e: unknown) {
      const appErr = e as AppError;
      if (appErr?.type === 'plan_required' || appErr?.type === 'limit_reached') {
        setError(null);
        setUpgradeModalMessage(appErr.type === 'plan_required' ? "This feature requires a Basic or Pro plan." : "You've reached your plan limit. Upgrade for more.");
        setShowUpgradeModal(true);
      } else {
        setError(e instanceof Error ? e.message : "Video extension failed.");
      }
    } finally {
      setIsLoading(false);
      setExtendingTimestamp(null);
    }
  };

  /** Auto-saves every generation to Creations (background, no popup) */
  const autoSaveToCreations = async (url: string, prompt: string, mediaType: 'image' | 'video' | 'music' | 'text') => {
    try {
      const cachedUser = JSON.parse(localStorage.getItem('orin_user') || '{}');
      const uid = cachedUser?.id || 'guest';
      if (uid === 'guest') return; // don't save for guests

      const { firebaseService } = await import('../services/firebaseService');

      // Upload to Vercel Blob (convert base64 data URL to blob)
      let mediaUrl = url;
      if (url.startsWith('data:')) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const ext = mediaType === 'video' ? 'mp4' : mediaType === 'music' ? 'wav' : 'png';
          const mime = mediaType === 'video' ? 'video/mp4' : mediaType === 'music' ? 'audio/wav' : 'image/png';
          const file = new File([blob], `orin-gen-${Date.now()}.${ext}`, { type: mime });
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await fetch('/api/upload-blob', { method: 'POST', body: fd });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            if (data.url) mediaUrl = data.url;
          }
        } catch { /* keep data URL as fallback */ }
      }

      await (firebaseService as any).createCreation({
        title: prompt.slice(0, 60) || 'Generated',
        caption: '',
        originalPrompt: prompt,
        mediaUrl,
        mediaType,
        tags: [],
        aiGenerated: true,
        userId: uid,
        userName: cachedUser?.name || cachedUser?.email || 'Creator',
        userAvatar: cachedUser?.avatar || '',
      });

      // Award creator points
      const PTS_KEY = 'orin_creator_pts';
      const pts = JSON.parse(localStorage.getItem(PTS_KEY) || '{}');
      pts[uid] = (pts[uid] || 0) + (mediaType === 'video' ? 20 : mediaType === 'music' ? 15 : 10);
      localStorage.setItem(PTS_KEY, JSON.stringify(pts));
    } catch { /* silent — never block generation */ }
  };

  const publishToFeed = async () => {
    if (!publishModal) return;
    setPublishing(true);
    try {
      const cachedUser = JSON.parse(localStorage.getItem('orin_user') || '{}');
      const uid = cachedUser?.id || 'guest';
      const userName = cachedUser?.name || cachedUser?.email || 'Creator';
      const userAvatar = cachedUser?.avatar || '';

      // Upload AI-generated image (base64 data URL) to Vercel Blob
      let mediaUrl = publishModal.url;
      try {
        const res = await fetch(publishModal.url);
        const blob = await res.blob();
        const file = new File([blob], `ai-gen-${Date.now()}.png`, { type: 'image/png' });
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch('/api/upload-blob', { method: 'POST', body: fd });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.url) mediaUrl = data.url;
        }
      } catch { /* keep base64 as fallback */ }

      // Save to Firestore
      const { firebaseService } = await import('../services/firebaseService');
      await (firebaseService as any).createCreation({
        title: publishCaption || 'AI Studio Generation',
        caption: publishCaption || 'Generated with Orin AI Studio',
        originalPrompt: publishModal.prompt,
        mediaUrl,
        mediaType: 'image' as const,
        tags: [] as string[],
        aiGenerated: true,
        userId: uid,
        userName,
        userAvatar,
      });

      // Award creator points
      const PTS_KEY = 'orin_creator_pts';
      const pts = JSON.parse(localStorage.getItem(PTS_KEY) || '{}');
      pts[uid] = (pts[uid] || 0) + 10;
      localStorage.setItem(PTS_KEY, JSON.stringify(pts));
    } catch (e) {
      console.error('Publish to feed failed:', e);
    } finally {
      setPublishing(false);
      setPublishModal(null);
    }
  };

  const inputStyle = "w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs md:text-sm font-semibold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm";

  return (
    <>
    {showUpgradeModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 animate-fade" onClick={() => setShowUpgradeModal(false)}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <i className="fa-solid fa-crown text-indigo-500 text-xl"></i>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Upgrade to continue</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{upgradeModalMessage}</p>
          <div className="flex gap-3">
            <button onClick={() => setShowUpgradeModal(false)} className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white text-sm font-black uppercase tracking-wider hover:bg-indigo-500 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    {showClearHistoryConfirm && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 animate-fade" onClick={() => setShowClearHistoryConfirm(false)}>
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
            Clear studio history?
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            This will remove all generated images, videos, and audio from this session. Files you've downloaded are not affected.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowClearHistoryConfirm(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setHistory([]);
                setShowClearHistoryConfirm(false);
              }}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-black uppercase tracking-widest hover:bg-red-500 transition-colors"
            >
              Clear history
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="w-full h-full flex flex-col overflow-hidden px-3 sm:px-5 pt-3">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl">
            <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Studio Create</h2>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
              <button 
                onClick={() => setActiveTab('image')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${activeTab === 'image' ? 'bg-indigo-600 text-white border-cyan-600 shadow-md' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                🍌 Nano Banana
              </button>
              <button 
                onClick={() => setActiveTab('video')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${activeTab === 'video' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Veo
              </button>
              <button 
                onClick={() => setActiveTab('audio')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${activeTab === 'audio' ? 'bg-indigo-600 text-white border-cyan-600 shadow-md' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Music
              </button>
              <button 
                onClick={() => setActiveTab('narration')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all border ${activeTab === 'narration' ? 'bg-indigo-600 text-white border-cyan-600 shadow-md' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                Narration
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors border border-slate-200 dark:border-white/10">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'audio' ? (
          <MusicStudio />
        ) : activeTab === 'narration' ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar min-h-0 pb-2">
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                <div className="space-y-6 relative z-10">
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest px-1">
                      <i className="fa-solid fa-align-left text-indigo-500" /> Script / text to read
                    </label>
                    <textarea
                      value={narrationText}
                      onChange={(e) => setNarrationText(e.target.value)}
                      placeholder="Paste essay, article, or dialogue. For multi-speaker use: Speaker1: Hello. Speaker2: Hi there."
                      className={`${inputStyle} h-24 sm:h-28 resize-none leading-relaxed text-sm`}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Style (optional)</label>
                    <input
                      type="text"
                      value={narrationStyle}
                      onChange={(e) => setNarrationStyle(e.target.value)}
                      placeholder="e.g. Read like a BBC news anchor / Sri Lankan English accent / slowly for notes"
                      className={inputStyle}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="dialogue" checked={narrationDialogue} onChange={(e) => setNarrationDialogue(e.target.checked)} className="rounded accent-cyan-500" />
                    <label htmlFor="dialogue" className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Dialogue (two speakers)</label>
                  </div>
                  {!narrationDialogue ? (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Voice</label>
                      <select value={narrationVoice} onChange={(e) => setNarrationVoice(e.target.value)} className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}>
                        {TTS_VOICES.map((v) => <option key={v} value={v} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{v}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Speaker 1 name</label>
                        <input type="text" value={dialogueSpeaker1} onChange={(e) => setDialogueSpeaker1(e.target.value)} className={inputStyle} placeholder="e.g. Joe" />
                        <select value={dialogueVoice1} onChange={(e) => setDialogueVoice1(e.target.value)} className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}>
                          {TTS_VOICES.map((v) => <option key={v} value={v} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{v}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Speaker 2 name</label>
                        <input type="text" value={dialogueSpeaker2} onChange={(e) => setDialogueSpeaker2(e.target.value)} className={inputStyle} placeholder="e.g. Jane" />
                        <select value={dialogueVoice2} onChange={(e) => setDialogueVoice2(e.target.value)} className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}>
                          {TTS_VOICES.map((v) => <option key={v} value={v} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{v}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Model</label>
                    <select value={narrationModel} onChange={(e) => setNarrationModel(e.target.value as 'flash' | 'pro')} className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}>
                      <option value="flash" className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">Fast (Flash)</option>
                      <option value="pro" className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">Quality (Pro)</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isLoading || !narrationText.trim()}
                    className="w-full py-4 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
                  >
                    {isLoading ? <><i className="fa-solid fa-waveform-lines animate-pulse" /><span>Generating...</span></> : <><i className="fa-solid fa-microphone" /><span>Generate audio</span></>}
                  </button>
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-reveal">
                      <p className="text-[9px] text-red-500 font-black uppercase tracking-widest text-center leading-relaxed">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Narration preview reuses same right panel as image/video; history includes audio */}
            <div className="min-h-0 h-full rounded-3xl overflow-hidden flex flex-col items-center justify-start p-5 relative border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950">
              
              {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-slate-950/95 animate-fade">
                  <div className="text-center space-y-6 animate-reveal">
                    <div className="w-24 h-24 rounded-full border-2 border-indigo-500/10 border-t-cyan-500 animate-spin mx-auto flex items-center justify-center shadow-2xl">
                      <i className="fa-solid fa-waveform-lines text-2xl text-indigo-500/40" />
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] font-black animate-pulse">{loadingMessage}</p>
                  </div>
                </div>
              )}
              {history.filter((a) => a.type === 'audio').length > 0 ? (
                <div className="w-full space-y-8 relative z-10 py-6">
                  {history.filter((a) => a.type === 'audio').map((asset) => (
                    <div key={asset.timestamp} className="w-full flex flex-col items-center gap-6 animate-scale-in max-w-2xl mx-auto">
                      <div className="relative w-full rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 p-6">
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 rounded-lg text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                          <i className="fa-solid fa-headphones" /> audio
                        </div>
                        <audio src={asset.url} controls className="w-full mt-8" />
                        <div className="mt-4 flex justify-center">
                          <button onClick={() => { const a = document.createElement('a'); a.href = asset.url; a.download = `orin-narration-${asset.timestamp}.wav`; a.click(); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500 transition-colors">
                            <i className="fa-solid fa-download mr-2" /> Download WAV
                          </button>
                        </div>
                        <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-2 line-clamp-2">"{asset.prompt}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 relative z-10">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-[32px] flex items-center justify-center text-slate-300 dark:text-slate-700 shadow-inner">
                    <i className="fa-solid fa-microphone-slash text-4xl" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400 dark:text-slate-500">Narration & podcast studio</p>
                  <p className="text-xs font-bold text-slate-400/80 dark:text-slate-600 max-w-xs mx-auto">Paste text, set style and voice, then generate. 24kHz WAV.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 min-h-0 overflow-hidden">
          {/* Left Control Panel */}
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar min-h-0 pb-2">
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
              <div className="space-y-6 relative z-10">
                {activeTab === 'image' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Search images by meaning</label>
                    <input
                      type="text"
                      value={imageSearchQuery}
                      onChange={(e) => setImageSearchQuery(e.target.value)}
                      placeholder="e.g. beach, sunset, diagrams..."
                      className={inputStyle}
                      aria-label="Search generated images by description"
                    />
                    {isImageSearching && <p className="text-[9px] text-slate-400">Searching...</p>}
                    {imageSearchQuery.trim() && imageSearchOrder && !isImageSearching && <p className="text-[9px] text-indigo-600 dark:text-indigo-400">Sorted by relevance</p>}
                  </div>
                )}
                {activeTab === 'video' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Mode</label>
                    <div className="flex flex-wrap gap-2">
                      {(['text', 'image', 'frames'] as const).map((m) => (
                        <button key={m} type="button" onClick={() => setVideoMode(m)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${videoMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                          {m === 'text' ? 'Text to video' : m === 'image' ? 'Image to video' : 'First & last frame'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'video' && videoMode === 'image' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Reference image</label>
                    <input type="file" accept="image/*" className="text-[10px] w-full" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsBase64(f).then(setVideoImage); e.target.value = ''; }} />
                    {videoImage && <p className="text-[9px] text-emerald-600 dark:text-emerald-400">Image loaded</p>}
                  </div>
                )}
                {activeTab === 'video' && videoMode === 'frames' && (
                  <div className="space-y-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">First frame</label>
                      <input type="file" accept="image/*" className="text-[10px] w-full mt-1" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsBase64(f).then(setVideoFirstFrame); e.target.value = ''; }} />
                      {videoFirstFrame && <p className="text-[8px] text-emerald-600 mt-1">Loaded</p>}
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Last frame</label>
                      <input type="file" accept="image/*" className="text-[10px] w-full mt-1" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsBase64(f).then(setVideoLastFrame); e.target.value = ''; }} />
                      {videoLastFrame && <p className="text-[8px] text-emerald-600 mt-1">Loaded</p>}
                    </div>
                  </div>
                )}
                {/* Reference image upload — image tab only */}
                {activeTab === 'image' && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest px-1">
                      <i className="fa-solid fa-image text-violet-500"></i>
                      Reference Image <span className="font-normal normal-case text-slate-400">(optional — for editing)</span>
                    </label>
                    {referenceImage ? (
                      <div className="relative rounded-2xl overflow-hidden border border-violet-200 dark:border-violet-800 group">
                        <img src={referenceImage.preview} alt="Reference" className="w-full max-h-48 object-contain bg-slate-50 dark:bg-black/40" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                          <button
                            onClick={() => setReferenceImage(null)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-violet-600 text-white text-[9px] font-black">
                          Reference set
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => refImageInputRef.current?.click()}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-violet-400 dark:hover:border-violet-600 transition-colors flex items-center justify-center gap-3 text-slate-400 hover:text-violet-500 group"
                      >
                        <i className="fa-solid fa-upload text-lg group-hover:scale-110 transition-transform" />
                        <div className="text-left">
                          <p className="text-xs font-black">Add your photo or image</p>
                          <p className="text-[10px] opacity-70">AI will use it as a starting point</p>
                        </div>
                      </button>
                    )}
                    <input
                      ref={refImageInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) { setError('Reference image must be under 10 MB.'); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          const data = result.split(',')[1];
                          setReferenceImage({ data, mimeType: file.type, preview: result });
                          setError(null);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <label className="flex items-center gap-3 text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest px-1">
                    <i className="fa-solid fa-terminal text-indigo-500"></i>
                    {activeTab === 'video' ? (videoMode === 'image' ? 'How to animate' : videoMode === 'frames' ? 'Scene description' : 'Motion Prompt') : referenceImage ? 'Edit Instruction' : 'Neural Input Prompt'}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={activeTab === 'video' ? (videoMode === 'image' ? "e.g. The person in this photo starts walking towards the camera" : videoMode === 'frames' ? "Describe what happens between first and last frame..." : "Describe the motion, camera angle, and scene...") : referenceImage ? "e.g. Make it look like a watercolor painting, add a sunset background, change hair to blonde..." : "Describe your vision in high detail..."}
                    className={`${inputStyle} h-24 sm:h-28 resize-none leading-relaxed text-sm`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Ratio</label>
                    <div className="relative group">
                      <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                      >
                        {activeTab === 'image' ? (
                            ['1:1', '16:9', '9:16', '4:3', '21:9', '3:2'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)
                        ) : (
                            ['16:9', '9:16'].map(r => <option key={r} value={r} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{r}</option>)
                        )}
                      </select>
                      <i className="fa-solid fa-shapes absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none text-[10px]"></i>
                    </div>
                  </div>
                  
                  {activeTab === 'image' ? (
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Quality</label>
                        <div className="relative group">
                        <select 
                            value={imageSize} 
                            onChange={(e) => setImageSize(e.target.value as ImageSize)}
                            className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                        >
                            {['1K', '2K', '4K'].map(s => <option key={s} value={s} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">{s}</option>)}
                        </select>
                        <i className="fa-solid fa-microchip absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none text-[10px]"></i>
                        </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest px-1">Resolution</label>
                        <div className="relative group">
                        <select 
                            value={videoResolution} 
                            onChange={(e) => setVideoResolution(e.target.value as '720p' | '1080p')}
                            className={`${inputStyle} pr-8 appearance-none cursor-pointer bg-slate-50/50 dark:bg-black/40`}
                        >
                            <option value="720p" className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">720p (Fast)</option>
                            <option value="1080p" className="text-slate-900 dark:text-white bg-white dark:bg-slate-900">1080p (HD)</option>
                        </select>
                        <i className="fa-solid fa-film absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none text-[10px]"></i>
                        </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => handleGenerate()}
                  disabled={isLoading || (activeTab === 'video' ? (videoMode === 'image' ? !prompt.trim() || !videoImage : videoMode === 'frames' ? !prompt.trim() || !videoFirstFrame : !prompt.trim()) : !prompt.trim())}
                  className="w-full py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-dna animate-spin"></i>
                      <span>{activeTab === 'video' ? 'Rendering...' : 'Synthesizing...'}</span>
                    </>
                  ) : (
                    <>
                      <i className={`fa-solid ${activeTab === 'video' ? 'fa-clapperboard' : 'fa-sparkles'} transition-transform group-hover:rotate-12`}></i>
                      <span>{activeTab === 'video' ? 'Generate Video' : 'Generate Asset'}</span>
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-reveal">
                    <p className="text-[9px] text-red-500 font-black uppercase tracking-widest text-center leading-relaxed">{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/3 opacity-80">
               <div className="flex items-start gap-3">
                  <i className="fa-solid fa-shield-halved text-indigo-600 text-base mt-0.5"></i>
                  <div>
                    <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Neural Safety Core Active</p>
                    <p className="text-[8px] text-slate-500 dark:text-slate-500 font-bold mt-1">All generated content is private and adheres to safety protocols.</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Preview Area */}
          <div className="min-h-0 h-full rounded-3xl overflow-hidden flex flex-col items-center justify-start p-5 relative border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950">
            
            
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-slate-950/95 animate-fade">
                <div className="text-center space-y-6 animate-reveal">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-2 border-indigo-500/10 border-t-cyan-500 animate-spin mx-auto flex items-center justify-center shadow-2xl">
                      <i className={`fa-solid ${activeTab === 'video' ? 'fa-video' : 'fa-layer-group'} text-2xl text-indigo-500/40`}></i>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tighter">Neural Handshake Active</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] font-black animate-pulse">{loadingMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {displayHistory.length > 0 ? (
              <div className="w-full space-y-20 relative z-10 py-6">
                
                {/* Clear History Button */}
                <div className="absolute top-0 right-0 z-30">
                    <button onClick={handleClearHistory} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors shadow-sm flex items-center gap-2">
                        <i className="fa-solid fa-trash"></i>
                        Clear
                    </button>
                </div>

                {displayHistory.map((asset, idx) => (
                  <div key={asset.timestamp} className="w-full flex flex-col items-center gap-8 animate-scale-in max-w-4xl mx-auto group/item">
                    <div className="relative group/img w-full">
                      
                      <div className="relative rounded-[40px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-center transition-all duration-700 min-h-[300px]">
                        
                        {/* Type Badge */}
                        {/* Auto-saved badge */}
                        <div className="absolute top-3 right-3 z-20 px-2 py-1 bg-emerald-500 rounded-lg text-white text-[8px] font-black flex items-center gap-1 opacity-80">
                          <i className="fa-solid fa-check text-[7px]" /> Saved to Creations
                        </div>
                        <div className="absolute top-6 left-6 z-20 px-3 py-1.5 bg-black/70 rounded-lg text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                           <i className={`fa-solid ${asset.type === 'video' ? 'fa-video' : asset.type === 'audio' ? 'fa-headphones' : 'fa-image'}`}></i>
                           {asset.type}
                        </div>

                        {asset.type === 'video' ? (
                            <>
                              <video 
                                  src={asset.url} 
                                  controls 
                                  loop
                                  playsInline
                                  className="max-w-full max-h-[70vh] object-contain"
                                  poster={asset.url + "#t=0.5"} 
                              />
                              {asset.type === 'video' && (
                                <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2">
                                  {extendingTimestamp === asset.timestamp ? (
                                    <div className="flex flex-col gap-2 p-2 bg-black/60 rounded-xl">
                                      <input type="text" value={extendPrompt} onChange={(e) => setExtendPrompt(e.target.value)} placeholder="Continue the scene..." className="w-full px-3 py-2 rounded-lg text-xs bg-white/10 border border-white/20 text-white placeholder:text-white/60" />
                                      <div className="flex gap-2">
                                        <button onClick={() => handleExtendVideo(asset)} disabled={isLoading} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase disabled:opacity-50">Extend</button>
                                        <button onClick={() => { setExtendingTimestamp(null); setExtendPrompt(''); }} className="px-3 py-2 rounded-lg bg-white/10 text-[10px] font-bold">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => { setExtendingTimestamp(asset.timestamp); setExtendPrompt(''); }} className="py-2 px-4 rounded-lg bg-indigo-600/90 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-colors">Extend (+8s)</button>
                                  )}
                                </div>
                              )}
                            </>
                        ) : asset.type === 'audio' ? (
                            <div className="flex flex-col items-center justify-center p-8 w-full">
                              <audio src={asset.url} controls className="w-full max-w-md" />
                            </div>
                        ) : (
                            <img 
                                src={asset.url} 
                                className="max-w-full max-h-[70vh] object-contain transition-transform duration-1000 ease-out group-hover/item:scale-[1.02]" 
                                alt={asset.prompt} 
                            />
                        )}
                      </div>
                    </div>

                    <div className="w-full max-w-lg flex flex-col items-center gap-6">
                      <div className="w-full">
                        <button 
                          onClick={() => handleDownload(asset)}
                          className="w-full py-4 bg-indigo-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-cyan-600/10 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                          <i className="fa-solid fa-download text-base"></i>
                          <span>Secure Download</span>
                        </button>
                      </div>

                      <div className="text-center px-6">
                        <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Generation Script</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 italic leading-relaxed line-clamp-3">"{asset.prompt}"</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">{asset.type.toUpperCase()}</p>
                      </div>
                    </div>
                    {idx < displayHistory.length - 1 && <div className="w-24 h-[1px] bg-slate-200 dark:bg-white/5 rounded-full mt-8"></div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 relative z-10">
                <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-[32px] flex items-center justify-center text-slate-300 dark:text-slate-700 shadow-inner">
                  <i className="fa-solid fa-wand-magic-sparkles text-4xl text-slate-300 dark:text-slate-600"></i>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400 dark:text-slate-500 ">Synthesis Pipeline Ready</p>
                  <p className="text-xs font-bold text-slate-400/80 dark:text-slate-600 max-w-xs mx-auto leading-relaxed">Synthesis pipeline ready.</p>
                </div>
              </div>
            )}
            
            {/* Aesthetic Borders */}
            <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-slate-200 dark:border-white/5 rounded-tl-[32px] pointer-events-none"></div>
            <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-slate-200 dark:border-white/5 rounded-tr-[32px] pointer-events-none"></div>
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-slate-200 dark:border-white/5 rounded-bl-[32px] pointer-events-none"></div>
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-slate-200 dark:border-white/5 rounded-br-[32px] pointer-events-none"></div>
          </div>
      </div>
        )}
      </div>
    </div>
    </>
  );
      {/* ── Publish to Feed modal (slides up after image gen) ── */}
      {publishModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 bg-black/40 backdrop-blur-sm animate-fade">
          <div className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-fire text-orange-500" />
                <span className="text-sm font-black text-slate-900 dark:text-white">Share to Creations Feed</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">+10 pts</span>
              </div>
              <button onClick={() => setPublishModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <img src={publishModal.url} alt="Generated" className="w-full max-h-40 object-contain rounded-xl bg-slate-50 dark:bg-black/20" />
              <input
                type="text"
                placeholder="Add a caption… (optional)"
                value={publishCaption}
                onChange={e => setPublishCaption(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPublishModal(null)}
                  className="py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                  Skip
                </button>
                <button onClick={publishToFeed} disabled={publishing}
                  className="py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-1.5">
                  {publishing ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-paper-plane" />}
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

};

export default FeatureCreate;
