/**
 * CreationFeed — Full social platform for Orin AI creations.
 * Facebook/Instagram-style: feed, likes, comments, share, edit, delete, points.
 * Markov chain + tag extraction for AI-assisted prompt completion.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, UserAccount } from '../types';
import { geminiService } from '../services/geminiService';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface FeedComment {
  id: string; userId: string; userName: string; userAvatar?: string;
  text: string; createdAt: number; likes: string[];
}
interface FeedPost {
  id: string; userId: string; userName: string; userAvatar?: string;
  type: 'image' | 'video' | 'music' | 'text';
  mediaUrl?: string; caption: string; prompt?: string;
  tags: string[]; aiGenerated: boolean;
  likes: string[]; comments: FeedComment[];
  createdAt: number; points: number; editedAt?: number;
}
interface CreationFeedProps { onClose: () => void; lang: Language; user: UserAccount | null; }

/* ─── Storage helpers ─────────────────────────────────────────────────────── */
const FEED_KEY = 'orin_feed_v3';
const PTS_KEY  = 'orin_creator_pts';
const HIST_KEY = 'orin_feed_prompt_hist'; // for markov

function loadPosts(): FeedPost[] {
  try { return JSON.parse(localStorage.getItem(FEED_KEY) || '[]'); } catch { return []; }
}
function savePosts(p: FeedPost[]) {
  try { localStorage.setItem(FEED_KEY, JSON.stringify(p.slice(0, 300))); } catch {}
}
function getPoints(uid: string): number {
  try { return JSON.parse(localStorage.getItem(PTS_KEY) || '{}')[uid] || 0; } catch { return 0; }
}
function addPoints(uid: string, d: number): number {
  try {
    const all = JSON.parse(localStorage.getItem(PTS_KEY) || '{}');
    all[uid] = Math.max(0, (all[uid] || 0) + d);
    localStorage.setItem(PTS_KEY, JSON.stringify(all));
    return all[uid];
  } catch { return 0; }
}
function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: string[]) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 200))); } catch {}
}

/* ─── Markov chain (client-side, no API call) ───────────────────────────── */
function buildMarkov(texts: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const t of texts) {
    const ws = t.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i < ws.length - 1; i++) {
      const k = ws[i]; const v = ws[i + 1];
      m.set(k, [...(m.get(k) || []), v]);
    }
    m.set('__start__', [...(m.get('__start__') || []), ws[0]]);
  }
  return m;
}
function markovSuggest(model: Map<string, string[]>, seed: string, n = 3): string[] {
  if (model.size === 0) return [];
  const ws = seed.toLowerCase().split(/\s+/);
  const last = ws[ws.length - 1] || '';
  const nexts = model.get(last) || [];
  const unique = [...new Set(nexts)].slice(0, n);
  return unique;
}

/* ─── Tag extraction (fast, no API) ─────────────────────────────────────── */
const TAG_KEYWORDS: Record<string, string[]> = {
  portrait:   ['portrait', 'face', 'person', 'man', 'woman', 'girl', 'boy', 'selfie'],
  landscape:  ['landscape', 'nature', 'mountain', 'ocean', 'forest', 'sky', 'sunset', 'beach'],
  abstract:   ['abstract', 'art', 'colorful', 'geometric', 'pattern', 'shapes'],
  anime:      ['anime', 'manga', 'cartoon', 'illustration', 'character'],
  architecture: ['building', 'architecture', 'city', 'urban', 'interior', 'room'],
  fantasy:    ['fantasy', 'dragon', 'magic', 'wizard', 'mythical', 'creature', 'epic'],
  'sci-fi':   ['futuristic', 'robot', 'space', 'cyberpunk', 'neon', 'spaceship', 'sci-fi'],
  realistic:  ['realistic', 'photorealistic', 'photo', 'lifelike', 'detailed'],
  minimal:    ['minimal', 'simple', 'clean', 'white', 'monochrome', 'flat'],
  dark:       ['dark', 'gothic', 'shadow', 'night', 'horror', 'moody'],
};
function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  for (const [tag, kws] of Object.entries(TAG_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) tags.push(tag);
  }
  return [...new Set(tags)].slice(0, 5);
}

/* ─── Prioritized generation suggestions (Markov + history) ─────────────── */
function buildSuggestions(prompt: string, history: string[], markov: Map<string, string[]>): string[] {
  if (!prompt.trim()) return history.slice(0, 3);
  const suggestions: string[] = [];
  // 1. completions from markov
  const completions = markovSuggest(markov, prompt, 5);
  completions.forEach(w => suggestions.push(`${prompt} ${w}`));
  // 2. recent history that starts with typed text
  history.filter(h => h.toLowerCase().startsWith(prompt.toLowerCase()) && h !== prompt)
    .slice(0, 3).forEach(h => { if (!suggestions.includes(h)) suggestions.push(h); });
  return [...new Set(suggestions)].slice(0, 5);
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const POINTS = { image: 10, video: 20, music: 15, text: 5, like: 2, comment: 1 };
const REDEEM_COST = 20;
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function MediaIcon({ type }: { type: FeedPost['type'] }) {
  const m: Record<string, [string, string]> = {
    image: ['fa-image', 'text-cyan-500'], video: ['fa-video', 'text-indigo-500'],
    music: ['fa-music', 'text-pink-500'], text: ['fa-pen-nib', 'text-amber-500'],
  };
  const [ic, cl] = m[type] || m.text;
  return <i className={`fa-solid ${ic} ${cl} text-xs`} />;
}
const TAG_COLORS: Record<string, string> = {
  portrait: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  landscape: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  abstract: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  anime: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  architecture: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  fantasy: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  'sci-fi': 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  realistic: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  minimal: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  dark: 'bg-slate-900 text-slate-300',
};
function TagPill({ tag }: { tag: string }) {
  return (
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag] || 'bg-slate-100 text-slate-500'}`}>
      #{tag}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
const CreationFeed: React.FC<CreationFeedProps> = ({ onClose, user }) => {
  const [posts, setPosts]           = useState<FeedPost[]>([]);
  const [activeTab, setActiveTab]   = useState<'feed' | 'upload' | 'points'>('feed');
  const [points, setPoints]         = useState(0);

  // Upload form state
  const [caption, setCaption]       = useState('');
  const [prompt, setPrompt]         = useState('');
  const [postType, setPostType]     = useState<FeedPost['type']>('image');
  const [tags, setTags]             = useState<string[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [preview, setPreview]       = useState<string | null>(null);
  const [fileData, setFileData]     = useState<{ data: string; mimeType: string; name: string } | null>(null);

  // Auto-complete
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [markovModel, setMarkovModel]     = useState<Map<string, string[]>>(new Map());
  const [suggestions, setSuggestions]     = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Feed interaction state
  const [expandedPost, setExpandedPost]   = useState<string | null>(null);
  const [commentText, setCommentText]     = useState<Record<string, string>>({});
  const [editingPost, setEditingPost]     = useState<string | null>(null);
  const [editCaption, setEditCaption]     = useState('');
  const [editPrompt, setEditPrompt]       = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [shareToast, setShareToast]       = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef    = useRef<HTMLTextAreaElement>(null);

  /* ── Init ── */
  useEffect(() => {
    const stored = loadPosts();
    if (stored.length === 0) {
      const sample: FeedPost = {
        id: 'sample-1', userId: 'orin-system', userName: 'Orin AI',
        type: 'text', caption: '🎨 Welcome to Orin Creations! Share your art, earn points, redeem free Studio generations.',
        prompt: '', tags: ['minimal'], aiGenerated: false,
        likes: [], comments: [], createdAt: Date.now() - 7200000, points: 5,
      };
      savePosts([sample]);
      setPosts([sample]);
    } else {
      setPosts(stored);
    }
    if (user?.id) setPoints(getPoints(user.id));
    const hist = loadHistory();
    setPromptHistory(hist);
    setMarkovModel(buildMarkov(hist));
  }, [user?.id]);

  /* ── Prompt → tags + suggestions ── */
  useEffect(() => {
    setTags(extractTags(prompt));
    const sugg = buildSuggestions(prompt, promptHistory, markovModel);
    setSuggestions(sugg);
    setShowSuggestions(sugg.length > 0 && prompt.length > 2);
  }, [prompt, promptHistory, markovModel]);

  /* ── File pick ── */
  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setFileData({ data: result.split(',')[1], mimeType: file.type, name: file.name });
      setPreview(result);
      if (file.type.startsWith('video')) setPostType('video');
      else if (file.type.startsWith('audio')) setPostType('music');
      else setPostType('image');
    };
    reader.readAsDataURL(file);
  }, []);

  /* ── Post ── */
  const handlePost = async () => {
    if (!user || (!caption.trim() && !fileData)) return;
    setUploading(true);
    try {
      const post: FeedPost = {
        id: `${Date.now()}-${user.id}`,
        userId: user.id,
        userName: user.name || user.email || 'User',
        userAvatar: user.avatar,
        type: postType,
        mediaUrl: preview || '',
        caption,
        prompt,
        tags: extractTags(prompt + ' ' + caption),
        aiGenerated: !!prompt.trim(),
        likes: [], comments: [],
        createdAt: Date.now(),
        points: POINTS[postType],
      };
      const updated = [post, ...posts];
      setPosts(updated); savePosts(updated);
      const newPts = addPoints(user.id, POINTS[postType]);
      setPoints(newPts);
      // save prompt to history for markov
      if (prompt.trim()) {
        const newHist = [prompt, ...promptHistory].slice(0, 200);
        setPromptHistory(newHist); saveHistory(newHist);
        setMarkovModel(buildMarkov(newHist));
      }
      setCaption(''); setPrompt(''); setPreview(null); setFileData(null); setTags([]);
      setActiveTab('feed');
    } finally { setUploading(false); }
  };

  /* ── Like (toggle) ── */
  const handleLike = (postId: string) => {
    if (!user) return;
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      const liked = p.likes.includes(user.id);
      if (!liked && p.userId !== user.id) addPoints(p.userId, POINTS.like);
      return { ...p, likes: liked ? p.likes.filter(id => id !== user.id) : [...p.likes, user.id] };
    });
    setPosts(updated); savePosts(updated);
    if (user?.id) setPoints(getPoints(user.id));
  };

  /* ── Comment like ── */
  const handleCommentLike = (postId: string, commentId: string) => {
    if (!user) return;
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p, comments: p.comments.map(c => {
          if (c.id !== commentId) return c;
          const liked = c.likes.includes(user.id);
          return { ...c, likes: liked ? c.likes.filter(id => id !== user.id) : [...c.likes, user.id] };
        })
      };
    });
    setPosts(updated); savePosts(updated);
  };

  /* ── Comment ── */
  const handleComment = (postId: string) => {
    if (!user || !commentText[postId]?.trim()) return;
    const comment: FeedComment = {
      id: `${Date.now()}`, userId: user.id,
      userName: user.name || user.email || 'User',
      userAvatar: user.avatar, text: commentText[postId].trim(),
      createdAt: Date.now(), likes: [],
    };
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      if (p.userId !== user.id) addPoints(p.userId, POINTS.comment);
      return { ...p, comments: [...p.comments, comment] };
    });
    setPosts(updated); savePosts(updated);
    setCommentText(t => ({ ...t, [postId]: '' }));
    if (user?.id) setPoints(getPoints(user.id));
  };

  /* ── Edit ── */
  const startEdit = (post: FeedPost) => {
    setEditingPost(post.id);
    setEditCaption(post.caption);
    setEditPrompt(post.prompt || '');
  };
  const saveEdit = () => {
    const updated = posts.map(p =>
      p.id === editingPost
        ? { ...p, caption: editCaption, prompt: editPrompt, tags: extractTags(editPrompt + ' ' + editCaption), editedAt: Date.now() }
        : p
    );
    setPosts(updated); savePosts(updated);
    setEditingPost(null);
  };

  /* ── Delete ── */
  const handleDelete = (postId: string) => {
    const updated = posts.filter(p => p.id !== postId);
    setPosts(updated); savePosts(updated);
    setShowDeleteConfirm(null);
  };

  /* ── Share ── */
  const handleShare = async (post: FeedPost) => {
    const url = `${window.location.origin}/#community`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.userName}'s creation on Orin AI`, text: post.caption, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareToast(post.id);
        setTimeout(() => setShareToast(null), 2000);
      }
    } catch {}
  };

  /* ── Redeem ── */
  const handleRedeem = () => {
    if (!user || points < REDEEM_COST) return;
    const np = addPoints(user.id, -REDEEM_COST); setPoints(np);
    const key = `orin_free_gens_${user.id}`;
    localStorage.setItem(key, String(parseInt(localStorage.getItem(key) || '0', 10) + 1));
    alert('✅ 1 free Studio generation unlocked! Go to Studio Create to use it.');
  };

  const myPosts = posts.filter(p => p.userId === user?.id);

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow">
              <i className="fa-solid fa-fire text-white text-sm" />
            </div>
            <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">Creations</span>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button onClick={() => setActiveTab('points')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 text-[10px] font-black">
                <i className="fa-solid fa-star text-[9px]" />{points} pts
              </button>
            )}
            <button onClick={() => setActiveTab('upload')}
              className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-colors shadow">
              <i className="fa-solid fa-plus text-sm" />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex border-t border-slate-100 dark:border-white/5">
          {(['feed', 'upload', 'points'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}>
              {tab === 'feed' && <><i className="fa-solid fa-house mr-1.5" />Feed</>}
              {tab === 'upload' && <><i className="fa-solid fa-circle-plus mr-1.5" />Create</>}
              {tab === 'points' && <><i className="fa-solid fa-star mr-1.5" />Points</>}
            </button>
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* ══ FEED ══ */}
        {activeTab === 'feed' && (
          <div className="max-w-xl mx-auto pb-4">
            {posts.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-4 opacity-50 text-center">
                <i className="fa-solid fa-images text-5xl text-slate-300" />
                <p className="text-sm font-bold text-slate-400">No posts yet — be first!</p>
              </div>
            ) : posts.map(post => (
              <article key={post.id} className="border-b border-slate-100 dark:border-white/5">

                {/* Edit mode */}
                {editingPost === post.id ? (
                  <div className="p-4 space-y-3 bg-indigo-50 dark:bg-indigo-950/30">
                    <textarea
                      value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="Caption…"
                    />
                    <input
                      value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="AI prompt…"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500 transition-colors">Save</button>
                      <button onClick={() => setEditingPost(null)} className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-xs font-black">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Author row */}
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xs font-black shrink-0 overflow-hidden">
                          {post.userAvatar
                            ? <img src={post.userAvatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : (post.userName?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white leading-none">{post.userName}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <MediaIcon type={post.type} />
                            {timeAgo(post.createdAt)}
                            {post.editedAt && <span className="italic opacity-60">· edited</span>}
                            {post.aiGenerated && <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 rounded-full">AI</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-amber-500 flex items-center gap-0.5">
                          <i className="fa-solid fa-star text-[8px]" />+{post.points}
                        </span>
                        {user?.id === post.userId && (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(post)}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-indigo-500 flex items-center justify-center transition-colors">
                              <i className="fa-solid fa-pen text-[9px]" />
                            </button>
                            <button onClick={() => setShowDeleteConfirm(post.id)}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                              <i className="fa-solid fa-trash text-[9px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Media */}
                    {post.mediaUrl && (
                      <div className="bg-black">
                        {post.type === 'video'
                          ? <video src={post.mediaUrl} controls playsInline className="w-full max-h-[500px] object-contain" />
                          : post.type === 'music'
                          ? <div className="flex items-center gap-4 px-5 py-6 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                                <i className="fa-solid fa-music text-white text-lg" />
                              </div>
                              <audio src={post.mediaUrl} controls className="flex-1" />
                            </div>
                          : <img src={post.mediaUrl} alt={post.caption} loading="lazy" decoding="async"
                              className="w-full max-h-[600px] object-contain" />
                        }
                      </div>
                    )}

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-3 pt-2">
                        {post.tags.map(t => <TagPill key={t} tag={t} />)}
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="px-3 pt-2 pb-1">
                      <div className="flex items-center gap-4 mb-2">
                        {/* Like */}
                        <button onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-sm font-bold transition-all active:scale-90 ${
                            user && post.likes.includes(user.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
                          }`}>
                          <i className={`fa-${user && post.likes.includes(user.id) ? 'solid' : 'regular'} fa-heart text-lg`} />
                          {post.likes.length > 0 && <span className="text-xs">{post.likes.length}</span>}
                        </button>
                        {/* Comment */}
                        <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                          className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                          <i className="fa-regular fa-comment text-lg" />
                          {post.comments.length > 0 && <span className="text-xs">{post.comments.length}</span>}
                        </button>
                        {/* Share */}
                        <button onClick={() => handleShare(post)}
                          className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-indigo-500 transition-colors relative">
                          <i className="fa-solid fa-share-nodes text-lg" />
                          {shareToast === post.id && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
                              Link copied!
                            </span>
                          )}
                        </button>
                        {/* Like count label */}
                        {post.likes.length > 0 && (
                          <span className="ml-auto text-[10px] font-bold text-slate-400">
                            {post.likes.length === 1 ? '1 like' : `${post.likes.length} likes`}
                          </span>
                        )}
                      </div>

                      {/* Caption */}
                      {post.caption && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-1">
                          <span className="font-black text-slate-900 dark:text-white mr-1.5">{post.userName}</span>
                          {post.caption}
                        </p>
                      )}
                      {post.prompt && (
                        <p className="text-[10px] text-slate-400 italic mb-1.5">✦ {post.prompt}</p>
                      )}

                      {/* Comments */}
                      {expandedPost === post.id && (
                        <div className="mt-2 border-t border-slate-100 dark:border-white/5 pt-2 space-y-2">
                          {post.comments.map(c => (
                            <div key={c.id} className="flex items-start gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[9px] font-black shrink-0 overflow-hidden">
                                {c.userAvatar
                                  ? <img src={c.userAvatar} alt="" className="w-full h-full object-cover" />
                                  : (c.userName?.[0] || 'U').toUpperCase()}
                              </div>
                              <div className="flex-1 bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{c.userName}</p>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleCommentLike(post.id, c.id)}
                                      className={`text-[9px] font-black flex items-center gap-0.5 ${
                                        user && c.likes.includes(user.id) ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
                                      }`}>
                                      <i className={`fa-${user && c.likes.includes(user.id) ? 'solid' : 'regular'} fa-heart`} />
                                      {c.likes.length > 0 && c.likes.length}
                                    </button>
                                    <span className="text-[9px] text-slate-400">{timeAgo(c.createdAt)}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{c.text}</p>
                              </div>
                            </div>
                          ))}
                          {/* Add comment */}
                          {user ? (
                            <div className="flex items-center gap-2 pt-1">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-[9px] font-black shrink-0 overflow-hidden">
                                {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : (user.name?.[0] || 'U').toUpperCase()}
                              </div>
                              <input type="text" placeholder="Add a comment…"
                                value={commentText[post.id] || ''}
                                onChange={e => setCommentText(t => ({ ...t, [post.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                                className="flex-1 text-xs px-3 py-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 border-0"
                              />
                              <button onClick={() => handleComment(post.id)}
                                className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 hover:bg-indigo-500">
                                <i className="fa-solid fa-arrow-up text-[10px]" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 text-center py-1">Sign in to comment</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Delete confirm */}
                {showDeleteConfirm === post.id && (
                  <div className="mx-3 mb-3 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">Delete this post?</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(post.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-[10px] font-black hover:bg-red-600 transition-colors">Delete</button>
                      <button onClick={() => setShowDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] font-black">Cancel</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {/* ══ UPLOAD ══ */}
        {activeTab === 'upload' && (
          <div className="max-w-lg mx-auto p-4 space-y-4">
            {!user ? (
              <div className="text-center py-16">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3 block" />
                <p className="text-sm text-slate-500 font-bold">Sign in to post</p>
              </div>
            ) : (
              <>
                {/* Author */}
                <div className="flex items-center gap-2.5 px-1">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xs font-black overflow-hidden">
                    {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : (user.name?.[0] || 'U').toUpperCase()}
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{user.name || user.email}</p>
                </div>

                {/* Media upload zone */}
                <div onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl overflow-hidden cursor-pointer transition-all border-2 ${
                    preview ? 'border-transparent bg-black' : 'border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 bg-slate-50 dark:bg-white/5'
                  }`}>
                  {preview ? (
                    postType === 'video' ? <video src={preview} className="w-full max-h-72 object-contain" />
                    : postType === 'music' ? (
                      <div className="flex items-center gap-4 px-5 py-8 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                          <i className="fa-solid fa-music text-white text-xl" />
                        </div>
                        <p className="text-sm font-bold text-white">{fileData?.name}</p>
                      </div>
                    ) : <img src={preview} alt="" className="w-full max-h-72 object-contain" />
                  ) : (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-slate-300" />
                      <p className="text-sm font-black text-slate-500">Tap to upload</p>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-cyan-100 text-cyan-600">+{POINTS.image}pts photo</span>
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">+{POINTS.video}pts video</span>
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-pink-100 text-pink-600">+{POINTS.music}pts music</span>
                      </div>
                    </div>
                  )}
                  {preview && (
                    <button onClick={e => { e.stopPropagation(); setPreview(null); setFileData(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleFilePick} />

                {/* AI Prompt → caption field (single combined field) */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 px-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-wand-magic-sparkles text-[9px]" />
                    AI Prompt / Caption
                  </label>
                  <div className="relative">
                    <textarea
                      ref={promptRef}
                      value={prompt}
                      onChange={e => { setPrompt(e.target.value); setCaption(e.target.value); }}
                      onFocus={() => setShowSuggestions(suggestions.length > 0)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      rows={3}
                      placeholder="Describe your creation (auto-tags and suggests completions)…"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    {/* Auto-complete suggestions */}
                    {showSuggestions && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button key={i} onMouseDown={() => { setPrompt(s); setCaption(s); setShowSuggestions(false); }}
                            className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0">
                            <i className="fa-solid fa-rotate-left text-indigo-400 mr-2 text-[9px]" />{s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Live tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1 pt-0.5">
                      {tags.map(t => <TagPill key={t} tag={t} />)}
                    </div>
                  )}
                </div>

                {/* Post button */}
                <button onClick={handlePost} disabled={uploading || (!prompt.trim() && !fileData)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  {uploading
                    ? <><i className="fa-solid fa-circle-notch animate-spin" />Posting…</>
                    : <><i className="fa-solid fa-paper-plane" />Share Creation</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ POINTS ══ */}
        {activeTab === 'points' && (
          <div className="max-w-lg mx-auto p-4 space-y-4">
            {!user ? (
              <div className="text-center py-16">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3 block" />
                <p className="text-sm text-slate-500 font-bold">Sign in to see points</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Creator Points</p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black tabular-nums">{points}</span>
                    <span className="text-lg font-black opacity-70 mb-1.5">pts</span>
                  </div>
                  <p className="text-[10px] opacity-70 mt-1">{Math.floor(points / REDEEM_COST)} free Studio generations available</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">Redeem</p>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">1 Free Studio Generation</p>
                      <p className="text-[10px] text-slate-400">Use in Nano Banana or Veo</p>
                    </div>
                    <button onClick={handleRedeem} disabled={points < REDEEM_COST}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-500 transition-colors">
                      {REDEEM_COST} pts
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">Earn Points</p>
                  <div className="space-y-2">
                    {[
                      ['fa-image','text-cyan-500','Post a photo',POINTS.image],
                      ['fa-video','text-indigo-500','Post a video',POINTS.video],
                      ['fa-music','text-pink-500','Post music',POINTS.music],
                      ['fa-pen-nib','text-amber-500','Post text/art',POINTS.text],
                      ['fa-heart','text-red-500','Get a like',POINTS.like],
                      ['fa-comment','text-green-500','Get a comment',POINTS.comment],
                    ].map(([ic,cl,label,pts]) => (
                      <div key={String(label)} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <i className={`fa-solid ${ic} ${cl} w-4`} />
                          <span className="text-slate-600 dark:text-slate-400">{String(label)}</span>
                        </div>
                        <span className="font-black text-amber-500">+{pts} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
                {myPosts.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">My Creations ({myPosts.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {myPosts.slice(0, 9).map(p => (
                        <div key={p.id} onClick={() => setActiveTab('feed')}
                          className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 cursor-pointer relative">
                          {p.mediaUrl && p.type === 'image'
                            ? <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full flex items-center justify-center"><MediaIcon type={p.type} /></div>
                          }
                          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/50 rounded px-1 py-0.5 text-[8px] text-white font-black">
                            <i className="fa-solid fa-heart text-[7px]" />{p.likes.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreationFeed;
