/**
 * CreationFeed — Social feed for Orin AI creations.
 * Instagram/Facebook-style: photo, video, music posts with likes, comments, points.
 * Points system: upload earns credits redeemable for Studio generations.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, UserAccount } from '../types';
import { firebaseService } from '../services/firebaseService';

interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: 'image' | 'video' | 'music' | 'text';
  mediaUrl?: string;
  thumbnail?: string;
  caption: string;
  prompt?: string;
  aiGenerated: boolean;
  likes: string[];       // user IDs
  comments: FeedComment[];
  createdAt: number;
  points: number;        // points this post earned the creator
}

interface FeedComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: number;
}

interface CreationFeedProps {
  onClose: () => void;
  lang: Language;
  user: UserAccount | null;
}

// ── Local storage helpers (Firestore-ready, runs offline for now) ──
const FEED_KEY = 'orin_feed_posts_v2';
const POINTS_KEY = 'orin_creator_points';

function loadPosts(): FeedPost[] {
  try { return JSON.parse(localStorage.getItem(FEED_KEY) || '[]'); } catch { return []; }
}
function savePosts(posts: FeedPost[]) {
  try { localStorage.setItem(FEED_KEY, JSON.stringify(posts.slice(0, 200))); } catch {}
}
function getPoints(uid: string): number {
  try { return JSON.parse(localStorage.getItem(POINTS_KEY) || '{}')[uid] || 0; } catch { return 0; }
}
function addPoints(uid: string, delta: number): number {
  try {
    const all = JSON.parse(localStorage.getItem(POINTS_KEY) || '{}');
    all[uid] = Math.max(0, (all[uid] || 0) + delta);
    localStorage.setItem(POINTS_KEY, JSON.stringify(all));
    return all[uid];
  } catch { return 0; }
}

// ── Point values ──
const POINTS = { image: 10, video: 20, music: 15, text: 5, like_received: 2, comment_received: 1 };
const COST_PER_GENERATION = 20; // spend 20 pts to get 1 free Studio generation

// ── Media type icon ──
function MediaIcon({ type }: { type: FeedPost['type'] }) {
  const icons: Record<FeedPost['type'], string> = {
    image: 'fa-image', video: 'fa-video', music: 'fa-music', text: 'fa-pen-nib'
  };
  const colors: Record<FeedPost['type'], string> = {
    image: 'text-cyan-500', video: 'text-indigo-500', music: 'text-pink-500', text: 'text-amber-500'
  };
  return <i className={`fa-solid ${icons[type]} ${colors[type]} text-xs`} />;
}

// ── Time ago helper ──
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
const CreationFeed: React.FC<CreationFeedProps> = ({ onClose, user }) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'upload' | 'points'>('feed');
  const [points, setPoints] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ caption: '', prompt: '', type: 'image' as FeedPost['type'] });
  const [uploadFile, setUploadFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = loadPosts();
    // Add a few sample posts if feed is empty
    if (stored.length === 0) {
      const samples: FeedPost[] = [
        {
          id: 'sample-1', userId: 'orin-bot', userName: 'Orin AI', type: 'image',
          caption: 'Welcome to Orin Creations! Share your AI-generated art here and earn points 🎨',
          aiGenerated: true, likes: [], comments: [], createdAt: Date.now() - 3600000, points: 10,
          mediaUrl: '',
          prompt: 'A vibrant digital art piece celebrating creativity'
        },
      ];
      savePosts(samples);
      setPosts(samples);
    } else {
      setPosts(stored);
    }
    if (user?.id) setPoints(getPoints(user.id));
  }, [user?.id]);

  // ── File pick ──
  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = (ev.target?.result as string).split(',')[1];
      const mimeType = file.type;
      setUploadFile({ data, mimeType, name: file.name });
      setUploadPreview(ev.target?.result as string);
      // Auto-detect type
      if (mimeType.startsWith('video')) setUploadForm(f => ({ ...f, type: 'video' }));
      else if (mimeType.startsWith('audio')) setUploadForm(f => ({ ...f, type: 'music' }));
      else setUploadForm(f => ({ ...f, type: 'image' }));
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Post ──
  const handlePost = async () => {
    if (!user) return;
    if (!uploadForm.caption.trim() && !uploadFile) return;
    setUploading(true);
    try {
      const post: FeedPost = {
        id: `${Date.now()}-${user.id}`,
        userId: user.id,
        userName: user.name || user.email || 'User',
        userAvatar: user.avatar,
        type: uploadForm.type,
        mediaUrl: uploadPreview || '',
        caption: uploadForm.caption,
        prompt: uploadForm.prompt,
        aiGenerated: !!uploadForm.prompt,
        likes: [],
        comments: [],
        createdAt: Date.now(),
        points: POINTS[uploadForm.type],
      };
      const updated = [post, ...posts];
      setPosts(updated);
      savePosts(updated);
      // Award points
      const newPts = addPoints(user.id, POINTS[uploadForm.type]);
      setPoints(newPts);
      // Reset form
      setUploadForm({ caption: '', prompt: '', type: 'image' });
      setUploadFile(null);
      setUploadPreview(null);
      setActiveTab('feed');
    } finally {
      setUploading(false);
    }
  };

  // ── Like ──
  const handleLike = (postId: string) => {
    if (!user) return;
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      const liked = p.likes.includes(user.id);
      const likes = liked ? p.likes.filter(id => id !== user.id) : [...p.likes, user.id];
      // Award points to creator
      if (!liked && p.userId !== user.id) addPoints(p.userId, POINTS.like_received);
      return { ...p, likes };
    });
    setPosts(updated);
    savePosts(updated);
  };

  // ── Comment ──
  const handleComment = (postId: string) => {
    if (!user || !commentText[postId]?.trim()) return;
    const comment: FeedComment = {
      id: `${Date.now()}`, userId: user.id,
      userName: user.name || user.email || 'User',
      userAvatar: user.avatar,
      text: commentText[postId].trim(),
      createdAt: Date.now(),
    };
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      if (p.userId !== user.id) addPoints(p.userId, POINTS.comment_received);
      return { ...p, comments: [...p.comments, comment] };
    });
    setPosts(updated);
    savePosts(updated);
    setCommentText(t => ({ ...t, [postId]: '' }));
  };

  // ── Redeem points ──
  const handleRedeem = () => {
    if (!user || points < COST_PER_GENERATION) return;
    const newPts = addPoints(user.id, -COST_PER_GENERATION);
    setPoints(newPts);
    // Store redeemed generation token
    const key = `orin_free_gens_${user.id}`;
    const curr = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, String(curr + 1));
    alert(`✅ Redeemed! You have 1 free Studio generation. Visit Studio Create to use it.`);
  };

  const myPosts = posts.filter(p => p.userId === user?.id);

  // ─────────────────────── RENDER ───────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
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
                <i className="fa-solid fa-star text-[9px]" />
                {points} pts
              </button>
            )}
            <button onClick={() => setActiveTab('upload')}
              className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow hover:bg-indigo-500 transition-colors">
              <i className="fa-solid fa-plus text-sm" />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-slate-100 dark:border-white/5">
          {(['feed', 'upload', 'points'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}>
              {tab === 'feed' ? <><i className="fa-solid fa-house mr-1" />Feed</>
               : tab === 'upload' ? <><i className="fa-solid fa-circle-plus mr-1" />Create Post</>
               : <><i className="fa-solid fa-star mr-1" />My Points</>}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain" ref={feedRef}>

        {/* ══ FEED TAB ══ */}
        {activeTab === 'feed' && (
          <div className="max-w-xl mx-auto py-2">
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4 opacity-50">
                <i className="fa-solid fa-images text-5xl text-slate-300" />
                <p className="text-sm font-bold text-slate-400">No creations yet. Be the first to post!</p>
              </div>
            ) : (
              posts.map(post => (
                <article key={post.id} className="border-b border-slate-100 dark:border-white/5 pb-1 mb-1">
                  {/* Author */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xs font-black shrink-0 overflow-hidden">
                        {post.userAvatar
                          ? <img src={post.userAvatar} alt="" className="w-full h-full object-cover" />
                          : (post.userName?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white leading-none">{post.userName}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <MediaIcon type={post.type} />
                          {timeAgo(post.createdAt)}
                          {post.aiGenerated && <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 rounded-full ml-1">AI</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-black text-amber-500">
                      <i className="fa-solid fa-star text-[8px]" />
                      +{post.points}pts
                    </div>
                  </div>

                  {/* Media */}
                  {post.mediaUrl && (
                    <div className="relative bg-black">
                      {post.type === 'video' ? (
                        <video src={post.mediaUrl} controls playsInline className="w-full max-h-[500px] object-contain" />
                      ) : post.type === 'music' ? (
                        <div className="flex items-center gap-4 px-4 py-6 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                            <i className="fa-solid fa-music text-white text-xl" />
                          </div>
                          <audio src={post.mediaUrl} controls className="flex-1" />
                        </div>
                      ) : (
                        <img src={post.mediaUrl} alt={post.caption}
                          className="w-full max-h-[600px] object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-3 pt-2 pb-1">
                    <div className="flex items-center gap-4 mb-2">
                      <button onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-1.5 text-xs font-bold transition-all active:scale-90 ${
                          user && post.likes.includes(user.id)
                            ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
                        }`}>
                        <i className={`fa-${user && post.likes.includes(user.id) ? 'solid' : 'regular'} fa-heart`} />
                        {post.likes.length > 0 && <span>{post.likes.length}</span>}
                      </button>
                      <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                        <i className="fa-regular fa-comment" />
                        {post.comments.length > 0 && <span>{post.comments.length}</span>}
                      </button>
                      <button className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors ml-auto">
                        <i className="fa-solid fa-share-nodes" />
                      </button>
                    </div>

                    {/* Caption */}
                    {post.caption && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-1">
                        <span className="font-black text-slate-900 dark:text-white mr-1.5">{post.userName}</span>
                        {post.caption}
                      </p>
                    )}
                    {post.prompt && (
                      <p className="text-[10px] text-slate-400 italic mb-1">"{post.prompt}"</p>
                    )}

                    {/* Comments */}
                    {expandedPost === post.id && (
                      <div className="mt-2 space-y-1.5 border-t border-slate-100 dark:border-white/5 pt-2">
                        {post.comments.map(c => (
                          <div key={c.id} className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[8px] font-black shrink-0 overflow-hidden">
                              {c.userAvatar
                                ? <img src={c.userAvatar} alt="" className="w-full h-full object-cover" />
                                : (c.userName?.[0] || 'U').toUpperCase()}
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-white/5 rounded-xl px-2.5 py-1.5">
                              <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{c.userName}</p>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">{c.text}</p>
                            </div>
                          </div>
                        ))}
                        {user ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              placeholder="Add a comment…"
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
                </article>
              ))
            )}
          </div>
        )}

        {/* ══ UPLOAD TAB ══ */}
        {activeTab === 'upload' && (
          <div className="max-w-lg mx-auto p-4 space-y-4">
            {!user ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3 block" />
                <p className="text-sm text-slate-500 font-bold">Sign in to post creations</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xs font-black overflow-hidden">
                    {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : (user.name?.[0] || 'U').toUpperCase()}
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{user.name || user.email}</p>
                </div>

                {/* Media upload */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all ${
                    uploadPreview ? 'bg-black' : 'border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 bg-slate-50 dark:bg-white/5'
                  }`}
                >
                  {uploadPreview ? (
                    uploadForm.type === 'video' ? (
                      <video src={uploadPreview} className="w-full max-h-80 object-contain" />
                    ) : uploadForm.type === 'music' ? (
                      <div className="flex items-center gap-4 px-5 py-8 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                          <i className="fa-solid fa-music text-white text-2xl" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{uploadFile?.name}</p>
                          <p className="text-xs text-slate-400">Audio ready</p>
                        </div>
                      </div>
                    ) : (
                      <img src={uploadPreview} alt="Preview" className="w-full max-h-80 object-contain" />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-slate-300" />
                      <div>
                        <p className="text-sm font-black text-slate-500">Tap to upload</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Photo, Video, or Music</p>
                      </div>
                      <div className="flex gap-2 text-[9px] font-black mt-1">
                        <span className="px-2 py-1 rounded-full bg-cyan-100 text-cyan-600">+{POINTS.image}pts photo</span>
                        <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">+{POINTS.video}pts video</span>
                        <span className="px-2 py-1 rounded-full bg-pink-100 text-pink-600">+{POINTS.music}pts music</span>
                      </div>
                    </div>
                  )}
                  {uploadPreview && (
                    <button onClick={e => { e.stopPropagation(); setUploadPreview(null); setUploadFile(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,video/*,audio/*"
                  onChange={handleFilePick} />

                {/* Caption */}
                <textarea
                  value={uploadForm.caption}
                  onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="Write a caption…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />

                {/* AI prompt (optional) */}
                <input
                  type="text"
                  value={uploadForm.prompt}
                  onChange={e => setUploadForm(f => ({ ...f, prompt: e.target.value }))}
                  placeholder="AI prompt used (optional) — marks post as AI generated"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />

                <button
                  onClick={handlePost}
                  disabled={uploading || (!uploadForm.caption.trim() && !uploadFile)}
                  className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {uploading
                    ? <><i className="fa-solid fa-circle-notch animate-spin" />Posting…</>
                    : <><i className="fa-solid fa-paper-plane" />Share Creation</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ POINTS TAB ══ */}
        {activeTab === 'points' && (
          <div className="max-w-lg mx-auto p-4 space-y-4">
            {!user ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3 block" />
                <p className="text-sm text-slate-500 font-bold">Sign in to see your points</p>
              </div>
            ) : (
              <>
                {/* Points balance */}
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Creator Points</p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black tabular-nums">{points}</span>
                    <span className="text-lg font-black opacity-70 mb-1.5">pts</span>
                  </div>
                  <p className="text-[10px] opacity-70 mt-2">{Math.floor(points / COST_PER_GENERATION)} free Studio generations available</p>
                </div>

                {/* Redeem */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">Redeem Points</p>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">1 Free Studio Generation</p>
                      <p className="text-[10px] text-slate-400">Use in Nano Banana or Veo</p>
                    </div>
                    <button
                      onClick={handleRedeem}
                      disabled={points < COST_PER_GENERATION}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-500 transition-colors"
                    >
                      {COST_PER_GENERATION} pts
                    </button>
                  </div>
                </div>

                {/* How to earn */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">How to Earn Points</p>
                  <div className="space-y-2">
                    {[
                      { icon: 'fa-image', color: 'text-cyan-500', label: 'Post a photo', pts: POINTS.image },
                      { icon: 'fa-video', color: 'text-indigo-500', label: 'Post a video', pts: POINTS.video },
                      { icon: 'fa-music', color: 'text-pink-500', label: 'Post music', pts: POINTS.music },
                      { icon: 'fa-pen-nib', color: 'text-amber-500', label: 'Post text/art', pts: POINTS.text },
                      { icon: 'fa-heart', color: 'text-red-500', label: 'Get a like', pts: POINTS.like_received },
                      { icon: 'fa-comment', color: 'text-green-500', label: 'Get a comment', pts: POINTS.comment_received },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <i className={`fa-solid ${item.icon} ${item.color} w-4`} />
                          <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                        </div>
                        <span className="font-black text-amber-500">+{item.pts} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* My posts stats */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">My Creations ({myPosts.length})</p>
                  {myPosts.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-3">Post your first creation to start earning!</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {myPosts.slice(0, 9).map(p => (
                        <div key={p.id} onClick={() => { setActiveTab('feed'); }}
                          className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 cursor-pointer relative">
                          {p.mediaUrl && p.type === 'image'
                            ? <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <MediaIcon type={p.type} />
                              </div>
                          }
                          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/50 rounded px-1 py-0.5 text-[8px] text-white font-black">
                            <i className="fa-solid fa-heart text-[7px]" />{p.likes.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreationFeed;
