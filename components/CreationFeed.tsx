/**
 * CreationFeed — Instagram/Facebook-style social feed for Orin AI creations.
 * Backed by Firestore. Supports: create, edit, delete, like, comment, comment-like,
 * share, infinite scroll, "Use it" prompt reuse, Markov autocomplete, tag extraction.
 */
import React, {
  useState, useEffect, useRef, useCallback, useReducer
} from 'react';
import { Language, UserAccount } from '../types';
import { firebaseService } from '../services/firebaseService';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface Creation {
  id: string;
  title: string;
  caption: string;
  originalPrompt: string;   // the exact prompt — used by "Use it"
  output?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'music' | 'text';
  tags: string[];
  aiGenerated: boolean;
  userId: string;
  userName: string;
  userAvatar?: string;
  likes: string[];          // array of userIds
  likeCount: number;
  commentCount: number;
  createdAt: any;
  updatedAt?: any;
}
interface Comment {
  id: string;
  userId: string; userName: string; userAvatar?: string;
  text: string; createdAt: any; likes: string[];
}
interface CreationFeedProps {
  onClose: () => void;
  lang: Language;
  user: UserAccount | null;
  onUsePrompt?: (prompt: string) => void; // navigate to chat with prompt prefilled
}

/* ─── Upload form state ───────────────────────────────────────────────────── */
interface UploadForm {
  title: string;
  caption: string;
  originalPrompt: string;
  file: File | null;
  preview: string | null;
  mediaType: Creation['mediaType'];
  submitting: boolean;
  error: string | null;
}
type UploadAction =
  | { type: 'set'; key: keyof UploadForm; value: any }
  | { type: 'reset' }
  | { type: 'setFile'; file: File; preview: string; mediaType: Creation['mediaType'] };

const uploadInitial: UploadForm = {
  title: '', caption: '', originalPrompt: '',
  file: null, preview: null, mediaType: 'image',
  submitting: false, error: null,
};
function uploadReducer(s: UploadForm, a: UploadAction): UploadForm {
  if (a.type === 'reset') return uploadInitial;
  if (a.type === 'set') return { ...s, [a.key]: a.value };
  if (a.type === 'setFile') return { ...s, file: a.file, preview: a.preview, mediaType: a.mediaType };
  return s;
}

/* ─── Tag extraction (instant, no API) ───────────────────────────────────── */
const TAG_MAP: Record<string, string[]> = {
  portrait:     ['portrait','face','person','man','woman','girl','boy','selfie','model'],
  landscape:    ['landscape','nature','mountain','ocean','forest','sky','sunset','beach','field'],
  abstract:     ['abstract','art','colorful','geometric','pattern','shapes','surreal'],
  anime:        ['anime','manga','cartoon','illustration','character','chibi'],
  architecture: ['building','architecture','city','urban','interior','room','house'],
  fantasy:      ['fantasy','dragon','magic','wizard','mythical','creature','epic','elf'],
  'sci-fi':     ['futuristic','robot','space','cyberpunk','neon','spaceship','sci-fi','android'],
  realistic:    ['realistic','photorealistic','photo','lifelike','detailed','hyperreal'],
  minimal:      ['minimal','simple','clean','white','monochrome','flat','negative space'],
  dark:         ['dark','gothic','shadow','night','horror','moody','noir','black'],
};
function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  return [...new Set(
    Object.entries(TAG_MAP)
      .filter(([, kws]) => kws.some(kw => lower.includes(kw)))
      .map(([tag]) => tag)
  )].slice(0, 5);
}
const TAG_COLORS: Record<string, string> = {
  portrait:'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  landscape:'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  abstract:'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  anime:'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  architecture:'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  fantasy:'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  'sci-fi':'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  realistic:'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  minimal:'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  dark:'bg-slate-900 text-slate-300 dark:bg-black dark:text-slate-400',
};

/* ─── Markov autocomplete ─────────────────────────────────────────────────── */
const HIST_KEY = 'orin_creation_prompt_hist';
function buildMarkov(texts: string[]): Map<string,string[]> {
  const m = new Map<string,string[]>();
  for (const t of texts) {
    const ws = t.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i=0; i<ws.length-1; i++) m.set(ws[i],[...(m.get(ws[i])||[]),ws[i+1]]);
    if (ws[0]) m.set('__start__',[...(m.get('__start__')||[]),ws[0]]);
  }
  return m;
}
function markovNext(m: Map<string,string[]>, word: string): string[] {
  return [...new Set(m.get(word)||[])].slice(0,5);
}
function getSuggestions(prompt: string, hist: string[], m: Map<string,string[]>): string[] {
  if (!prompt.trim()) return hist.slice(0,3);
  const ws = prompt.trim().toLowerCase().split(/\s+/);
  const last = ws[ws.length-1];
  const nexts = markovNext(m, last).map(w => `${prompt.trim()} ${w}`);
  const fromHist = hist.filter(h => h.toLowerCase().startsWith(prompt.toLowerCase()) && h !== prompt).slice(0,3);
  return [...new Set([...nexts,...fromHist])].slice(0,5);
}

/* ─── Points (localStorage, lightweight) ─────────────────────────────────── */
const PTS_KEY = 'orin_creator_pts';
const POINTS = { image:10, video:20, music:15, text:5, like:2, comment:1 };
const REDEEM  = 20;
function getPts(uid:string) { try { return JSON.parse(localStorage.getItem(PTS_KEY)||'{}')[uid]||0; } catch { return 0; } }
function addPts(uid:string,d:number) {
  try {
    const a = JSON.parse(localStorage.getItem(PTS_KEY)||'{}');
    a[uid]=Math.max(0,(a[uid]||0)+d);
    localStorage.setItem(PTS_KEY,JSON.stringify(a));
    return a[uid];
  } catch { return 0; }
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(ts: any) {
  const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds*1000) : new Date(ts||0));
  const s = Math.floor((Date.now()-d.getTime())/1000);
  if (s<60) return 'just now';
  if (s<3600) return `${Math.floor(s/60)}m`;
  if (s<86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}
const MAX_MB = 20;
const ALLOWED = ['image/','video/','audio/'];
function validateFile(f: File): string|null {
  if (!ALLOWED.some(t => f.type.startsWith(t))) return 'Only images, videos and audio files are allowed.';
  if (f.size > MAX_MB*1024*1024) return `File must be under ${MAX_MB} MB.`;
  return null;
}

function Avatar({ name, avatar, size='md' }: { name:string; avatar?:string; size?:'sm'|'md' }) {
  const sz = size==='sm' ? 'w-7 h-7 text-[9px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white font-black shrink-0 overflow-hidden`}>
      {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" loading="lazy" /> : (name?.[0]||'?').toUpperCase()}
    </div>
  );
}
function TagPill({ tag }:{ tag:string }) {
  return <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag]||'bg-slate-100 text-slate-500'}`}>#{tag}</span>;
}
function Spinner() { return <i className="fa-solid fa-circle-notch animate-spin" />; }

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════════════════ */
const CreationFeed: React.FC<CreationFeedProps> = ({ onClose, user, onUsePrompt }) => {
  const [tab, setTab]               = useState<'feed'|'create'|'mine'|'points'>('feed');
  const [posts, setPosts]           = useState<Creation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [lastDoc, setLastDoc]       = useState<any>(null);
  const [feedError, setFeedError]   = useState<string|null>(null);
  const [points, setPoints]         = useState(0);

  // Detail / interaction state
  const [selectedPost, setSelectedPost]     = useState<Creation|null>(null);
  const [comments, setComments]             = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText]       = useState('');
  const [commentError, setCommentError]     = useState<string|null>(null);
  const [editingPost, setEditingPost]       = useState<string|null>(null);
  const [editData, setEditData]             = useState({ caption:'', originalPrompt:'' });
  const [deleteConfirm, setDeleteConfirm]   = useState<string|null>(null);
  const [shareToast, setShareToast]         = useState<string|null>(null);
  const [useItToast, setUseItToast]         = useState(false);

  // Upload form
  const [form, dispatch] = useReducer(uploadReducer, uploadInitial);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autocomplete
  const [promptHist, setPromptHist]     = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(HIST_KEY)||'[]'); } catch { return []; } });
  const [markov, setMarkov]             = useState(() => buildMarkov([]));
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showSugg, setShowSugg]         = useState(false);

  const PAGE = 12;
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadingLockRef = useRef(false); // prevent concurrent load calls = duplicate posts

  // Build markov from history
  useEffect(() => { setMarkov(buildMarkov(promptHist)); }, [promptHist]);
  // Suggestions update with prompt
  useEffect(() => {
    const s = getSuggestions(form.originalPrompt, promptHist, markov);
    setSuggestions(s);
    setShowSugg(s.length>0 && form.originalPrompt.length>2);
  }, [form.originalPrompt, promptHist, markov]);

  // Load points
  useEffect(() => { if (user?.id) setPoints(getPts(user.id)); }, [user?.id]);

  /* ── Initial feed load ── */
  const loadPosts = useCallback(async (reset=false) => {
    if (loadingLockRef.current) return; // prevent concurrent calls → duplicates
    loadingLockRef.current = true;
    if (reset) { setLoading(true); setFeedError(null); setLastDoc(null); }
    else setLoadingMore(true);
    try {
      const { posts: newPosts, lastDoc: ld } = await firebaseService.getCreations(PAGE, reset ? undefined : lastDoc);
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setLastDoc(ld);
      setHasMore(newPosts.length === PAGE);
    } catch(e:any) {
      setFeedError(e?.message || 'Failed to load creations.');
    } finally {
      setLoading(false); setLoadingMore(false);
      loadingLockRef.current = false;
    }
  }, [lastDoc]);

  useEffect(() => { loadPosts(true); }, []); // eslint-disable-line

  /* ── Infinite scroll ── */
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && !loadingLockRef.current) loadPosts();
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loadPosts]);

  /* ── Open detail ── */
  const openDetail = async (post: Creation) => {
    setSelectedPost(post);
    setCommentsLoading(true);
    try {
      const c = await firebaseService.getCreationComments(post.id);
      setComments(c);
    } finally { setCommentsLoading(false); }
  };

  /* ── File pick ── */
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const err = validateFile(f);
    if (err) { dispatch({type:'set',key:'error',value:err}); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = ev.target?.result as string;
      const mediaType: Creation['mediaType'] = f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'music' : 'image';
      dispatch({ type:'setFile', file:f, preview, mediaType });
    };
    reader.readAsDataURL(f);
  };

  /* ── Upload file to Vercel Blob, then save to Firestore ── */
  const uploadToBlob = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload-blob', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed (${res.status})`);
    }
    const { url } = await res.json();
    if (!url) throw new Error('No URL returned from blob upload');
    return url;
  };

  /* ── Submit creation ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (!form.originalPrompt.trim() && !form.caption.trim() && !form.file) {
      dispatch({type:'set',key:'error',value:'Enter a prompt, caption, or upload a file.'}); return;
    }
    dispatch({type:'set',key:'submitting',value:true});
    dispatch({type:'set',key:'error',value:null});
    try {
      const tags = extractTags(form.originalPrompt + ' ' + form.caption);
      // Upload file to Vercel Blob if one is selected
      let mediaUrl: string | undefined;
      if (form.file) {
        dispatch({type:'set',key:'error',value:null});
        mediaUrl = await uploadToBlob(form.file);
      }
      const id = await firebaseService.createCreation({
        title: form.title || form.originalPrompt.slice(0,60) || 'Untitled',
        caption: form.caption,
        originalPrompt: form.originalPrompt,
        mediaUrl,
        mediaType: form.file ? form.mediaType : 'text',
        tags,
        userId: user.id,
        userName: user.name || user.email || 'User',
        userAvatar: user.avatar,
      });
      // Award points
      const mediaType = form.file ? form.mediaType! : 'text';
      const newPts = addPts(user.id, POINTS[mediaType] ?? POINTS.text);
      setPoints(newPts);
      // Save prompt to history
      if (form.originalPrompt.trim()) {
        const h = [form.originalPrompt, ...promptHist].slice(0,200);
        setPromptHist(h); localStorage.setItem(HIST_KEY, JSON.stringify(h));
      }
      dispatch({type:'reset'});
      setTab('feed');
      loadPosts(true);
    } catch(e:any) {
      dispatch({type:'set',key:'error',value:e?.message||'Failed to post.'});
    } finally {
      dispatch({type:'set',key:'submitting',value:false});
    }
  };

  /* ── Like ── */
  const handleLike = async (post: Creation) => {
    if (!user) return;
    const optimistic = post.likes.includes(user.id)
      ? post.likes.filter(id=>id!==user.id)
      : [...post.likes, user.id];
    const update = (p: Creation) => p.id===post.id ? { ...p, likes:optimistic, likeCount:optimistic.length } : p;
    setPosts(prev => prev.map(update));
    if (selectedPost?.id===post.id) setSelectedPost(p => p ? update(p) : p);
    try {
      const liked = await firebaseService.toggleCreationLike(post.id, user.id);
      if (liked && post.userId!==user.id) addPts(post.userId, POINTS.like);
      setPoints(getPts(user.id));
    } catch {}
  };

  /* ── Comment ── */
  const handleComment = async () => {
    if (!user || !selectedPost) return;
    if (!commentText.trim()) { setCommentError('Comment cannot be empty.'); return; }
    setCommentError(null);
    try {
      const c = await firebaseService.addCreationComment(selectedPost.id, {
        userId: user.id, userName: user.name||user.email||'User',
        userAvatar: user.avatar, text: commentText.trim(),
      });
      setComments(prev => [...prev, c]);
      setPosts(prev => prev.map(p => p.id===selectedPost.id ? {...p, commentCount:p.commentCount+1} : p));
      if (selectedPost.userId!==user.id) addPts(selectedPost.userId, POINTS.comment);
      setCommentText('');
    } catch(e:any) { setCommentError(e?.message||'Failed to add comment.'); }
  };

  /* ── Comment like ── */
  const handleCommentLike = async (c: Comment) => {
    if (!user || !selectedPost) return;
    const liked = c.likes.includes(user.id);
    setComments(prev => prev.map(cm => cm.id!==c.id ? cm : {
      ...cm, likes: liked ? cm.likes.filter(id=>id!==user.id) : [...cm.likes, user.id]
    }));
    try { await firebaseService.toggleCommentLike(selectedPost.id, c.id, user.id); } catch {}
  };

  /* ── Edit ── */
  const startEdit = (post: Creation) => {
    setEditingPost(post.id);
    setEditData({ caption: post.caption, originalPrompt: post.originalPrompt });
  };
  const saveEdit = async () => {
    if (!editingPost) return;
    const tags = extractTags(editData.originalPrompt + ' ' + editData.caption);
    await firebaseService.updateCreation(editingPost, { ...editData, tags });
    const update = (p: Creation) => p.id===editingPost ? {...p, ...editData, tags} : p;
    setPosts(prev => prev.map(update));
    if (selectedPost?.id===editingPost) setSelectedPost(p => p ? update(p) : p);
    setEditingPost(null);
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    await firebaseService.deleteCreation(id);
    setPosts(prev => prev.filter(p => p.id!==id));
    if (selectedPost?.id===id) setSelectedPost(null);
    setDeleteConfirm(null);
  };

  /* ── Share ── */
  const handleShare = async (post: Creation) => {
    const url = `${window.location.origin}/#community`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, text: post.caption, url });
      else { await navigator.clipboard.writeText(url); setShareToast(post.id); setTimeout(()=>setShareToast(null),2000); }
    } catch {}
  };

  /* ── USE IT — routes to Studio Create for image prompts, Chat for text ── */
  const handleUseIt = (post: Creation) => {
    if (!post.originalPrompt) return;
    setUseItToast(true);
    setTimeout(() => setUseItToast(false), 2500);
    setSelectedPost(null);
    if (onUsePrompt) {
      onUsePrompt(post.originalPrompt);
    }
  };

  /* ─── Render helpers ─────────────────────────────────────────────────────── */
  const renderMedia = (post: Creation, maxH='max-h-[500px]') => {
    if (!post.mediaUrl) return null;
    if (post.mediaType==='video') return <video src={post.mediaUrl} controls playsInline className={`w-full ${maxH} object-contain bg-black`} />;
    if (post.mediaType==='music') return (
      <div className="flex items-center gap-4 px-5 py-6 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-music text-white text-lg" />
        </div>
        <audio src={post.mediaUrl} controls className="flex-1" />
      </div>
    );
    return <img src={post.mediaUrl} alt={post.title} loading="lazy" decoding="async" className={`w-full ${maxH} object-contain bg-black`} />;
  };

  const renderCard = (post: Creation) => {
    const isOwner = user?.id === post.userId;
    const liked = !!(user && post.likes.includes(user.id));
    return (
      <article key={post.id} className="border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
        {/* Edit inline */}
        {editingPost===post.id ? (
          <div className="p-4 space-y-3 bg-indigo-50 dark:bg-indigo-950/30">
            <textarea value={editData.caption} onChange={e=>setEditData(d=>({...d,caption:e.target.value}))} rows={2} placeholder="Caption…"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <input value={editData.originalPrompt} onChange={e=>setEditData(d=>({...d,originalPrompt:e.target.value}))} placeholder="AI prompt…"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500 transition-colors">Save</button>
              <button onClick={()=>setEditingPost(null)} className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-xs font-black">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button onClick={() => openDetail(post)} className="flex items-center gap-2.5 min-w-0">
                <Avatar name={post.userName} avatar={post.userAvatar} />
                <div className="min-w-0 text-left">
                  <p className="text-xs font-black text-slate-900 dark:text-white leading-none truncate">{post.userName}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                    {timeAgo(post.createdAt)}
                    {post.updatedAt && <span className="opacity-60 italic">· edited</span>}
                    {post.aiGenerated && <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 rounded-full font-black">AI</span>}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {/* "Use it" on card */}
                {post.originalPrompt ? (
                  <button onClick={() => handleUseIt(post)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white text-[9px] font-black hover:bg-indigo-500 transition-colors shadow-sm">
                    <i className="fa-solid fa-wand-magic-sparkles text-[8px]" />Use it
                  </button>
                ) : (
                  <span className="text-[9px] text-slate-400 px-2">No prompt</span>
                )}
                {isOwner && (
                  <>
                    <button onClick={()=>startEdit(post)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-indigo-500 flex items-center justify-center transition-colors">
                      <i className="fa-solid fa-pen text-[9px]" />
                    </button>
                    <button onClick={()=>setDeleteConfirm(post.id)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                      <i className="fa-solid fa-trash text-[9px]" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Media */}
            {renderMedia(post)}

            {/* Tags */}
            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 px-3 pt-2">
                {post.tags.map(t => <TagPill key={t} tag={t} />)}
              </div>
            )}

            {/* Actions */}
            <div className="px-3 pt-2 pb-3">
              <div className="flex items-center gap-4 mb-2">
                <button onClick={() => handleLike(post)}
                  className={`flex items-center gap-1.5 text-sm font-bold transition-all active:scale-90 ${liked ? 'text-red-500' : 'text-slate-400 hover:text-red-400'}`}>
                  <i className={`fa-${liked?'solid':'regular'} fa-heart text-lg`} />
                  {post.likeCount > 0 && <span className="text-xs">{post.likeCount}</span>}
                </button>
                <button onClick={() => openDetail(post)}
                  className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                  <i className="fa-regular fa-comment text-lg" />
                  {post.commentCount > 0 && <span className="text-xs">{post.commentCount}</span>}
                </button>
                <button onClick={() => handleShare(post)} className="relative flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                  <i className="fa-solid fa-share-nodes text-lg" />
                  {shareToast===post.id && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap">Copied!</span>
                  )}
                </button>
              </div>
              {post.likeCount>0 && <p className="text-[10px] font-bold text-slate-500 mb-1">{post.likeCount} {post.likeCount===1?'like':'likes'}</p>}
              {post.caption && (
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-black text-slate-900 dark:text-white mr-1.5">{post.userName}</span>
                  {post.caption}
                </p>
              )}
              {post.originalPrompt && (
                <p className="text-[10px] text-slate-400 italic mt-0.5 truncate">✦ {post.originalPrompt}</p>
              )}
              {post.commentCount>0 && (
                <button onClick={() => openDetail(post)} className="text-[10px] text-slate-400 hover:text-indigo-500 mt-1 transition-colors">
                  View all {post.commentCount} comments
                </button>
              )}
            </div>
          </>
        )}

        {/* Delete confirm */}
        {deleteConfirm===post.id && (
          <div className="mx-3 mb-3 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-red-600 dark:text-red-400">Delete this post?</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(post.id)} className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-[10px] font-black hover:bg-red-600">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-500 text-[10px] font-black">Cancel</button>
            </div>
          </div>
        )}
      </article>
    );
  };

  /* ════════════════════════════════════════════════════════════════════════════
     DETAIL MODAL
  ════════════════════════════════════════════════════════════════════════════ */
  const DetailModal = () => {
    if (!selectedPost) return null;
    const post = selectedPost;
    const liked = !!(user && post.likes.includes(user.id));
    return (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={e => { if (e.target===e.currentTarget) setSelectedPost(null); }}>
        <div className="w-full sm:max-w-2xl sm:max-h-[90vh] h-[95vh] sm:h-auto bg-white dark:bg-slate-900 sm:rounded-3xl overflow-hidden flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <Avatar name={post.userName} avatar={post.userAvatar} />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">{post.userName}</p>
                <p className="text-[9px] text-slate-400">{timeAgo(post.createdAt)}</p>
              </div>
            </div>
            <button onClick={()=>setSelectedPost(null)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Media */}
            {renderMedia(post, 'max-h-80')}

            {/* Tags */}
            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 px-4 pt-3">{post.tags.map(t => <TagPill key={t} tag={t} />)}</div>
            )}

            {/* Caption + prompt */}
            <div className="px-4 pt-3 pb-2 space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-black text-slate-900 dark:text-white mr-1.5">{post.userName}</span>
                {post.caption}
              </p>
              {post.originalPrompt && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1 flex items-center gap-1">
                    <i className="fa-solid fa-wand-magic-sparkles" />Original Prompt
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 italic">{post.originalPrompt}</p>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="px-4 pt-1 pb-3 flex items-center gap-4 border-b border-slate-100 dark:border-white/5">
              <button onClick={() => handleLike(post)}
                className={`flex items-center gap-1.5 text-sm font-bold transition-all active:scale-90 ${liked?'text-red-500':'text-slate-400 hover:text-red-400'}`}>
                <i className={`fa-${liked?'solid':'regular'} fa-heart text-xl`} />
                {post.likeCount>0 && <span className="text-sm font-black">{post.likeCount}</span>}
              </button>
              <button onClick={() => handleShare(post)} className="relative flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-500 transition-colors font-bold">
                <i className="fa-solid fa-share-nodes text-xl" />
                {shareToast===post.id && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap">Copied!</span>}
              </button>
              {/* USE IT — prominent in detail */}
              <div className="ml-auto">
                {post.originalPrompt ? (
                  <button onClick={() => handleUseIt(post)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black hover:opacity-90 transition-opacity shadow">
                    <i className="fa-solid fa-wand-magic-sparkles" />Use it in Chat
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">No prompt saved</span>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="px-4 py-3 space-y-3">
              {commentsLoading ? (
                <div className="text-center py-4 text-slate-400"><Spinner /></div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No comments yet. Be first!</p>
              ) : comments.map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar name={c.userName} avatar={c.userAvatar} size="sm" />
                  <div className="flex-1 bg-slate-50 dark:bg-white/5 rounded-2xl px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{c.userName}
                        <span className="font-normal text-slate-400 ml-1.5">{timeAgo(c.createdAt)}</span>
                      </p>
                      <button onClick={() => handleCommentLike(c)}
                        className={`flex items-center gap-0.5 text-[9px] font-black ${user&&c.likes.includes(user.id)?'text-red-500':'text-slate-400 hover:text-red-400'} transition-colors`}>
                        <i className={`fa-${user&&c.likes.includes(user.id)?'solid':'regular'} fa-heart`} />
                        {c.likes.length>0 && c.likes.length}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
              {commentError && <p className="text-[10px] text-red-500 font-bold">{commentError}</p>}
            </div>
          </div>

          {/* Comment input */}
          {user ? (
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-white/5">
              <Avatar name={user.name||''} avatar={user.avatar} size="sm" />
              <input type="text" placeholder="Add a comment…" value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key==='Enter' && handleComment()}
                className="flex-1 text-xs px-3 py-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 border-0" />
              <button onClick={handleComment}
                className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 shrink-0">
                <i className="fa-solid fa-arrow-up text-xs" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-3 border-t border-slate-100 dark:border-white/5">Sign in to comment</p>
          )}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════════════════
     MAIN RENDER
  ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* "Use it" global toast */}
      {useItToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-black flex items-center gap-2 animate-slide-up">
          <i className="fa-solid fa-wand-magic-sparkles" />Prompt copied — paste in Chat or Studio!
        </div>
      )}

      {/* Header */}
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
              <button onClick={() => setTab('points')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-600 dark:text-amber-400 text-[10px] font-black">
                <i className="fa-solid fa-star text-[9px]" />{points} pts
              </button>
            )}
            <button onClick={() => setTab('create')}
              className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-colors shadow">
              <i className="fa-solid fa-plus text-sm" />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        </div>
        <div className="flex border-t border-slate-100 dark:border-white/5">
          {(['feed','create','mine','points'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
                tab===t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}>
              {t==='feed'&&<><i className="fa-solid fa-house mr-1" />Feed</>}
              {t==='create'&&<><i className="fa-solid fa-circle-plus mr-1" />Create</>}
              {t==='mine'&&<><i className="fa-solid fa-images mr-1" />Mine</>}
              {t==='points'&&<><i className="fa-solid fa-star mr-1" />Points</>}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* ══ FEED ══ */}
        {tab==='feed' && (
          <div className="max-w-xl mx-auto">
            {loading && (
              <div className="flex items-center justify-center py-20 text-slate-400"><Spinner /></div>
            )}
            {feedError && !loading && (
              <div className="m-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-center">
                <p className="text-sm text-red-600 font-bold mb-2">{feedError}</p>
                <button onClick={() => loadPosts(true)} className="text-xs font-black text-indigo-600 hover:underline">Retry</button>
              </div>
            )}
            {!loading && !feedError && posts.length===0 && (
              <div className="flex flex-col items-center py-20 gap-4 text-center">
                <i className="fa-solid fa-images text-5xl text-slate-200 dark:text-slate-700" />
                <p className="text-sm font-bold text-slate-400">No creations yet — post the first one!</p>
                <button onClick={()=>setTab('create')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500">Create Now</button>
              </div>
            )}
            {posts.map(renderCard)}
            {/* Infinite scroll loader */}
            <div ref={loaderRef} className="py-6 flex items-center justify-center text-slate-400">
              {loadingMore && <Spinner />}
              {!hasMore && posts.length>0 && <p className="text-[10px] text-slate-400">You've seen it all</p>}
            </div>
          </div>
        )}

        {/* ══ CREATE ══ */}
        {tab==='create' && (
          <div className="max-w-lg mx-auto p-4 space-y-4">
            {!user ? (
              <div className="text-center py-16">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3 block" />
                <p className="text-sm text-slate-500 font-bold">Sign in to post creations</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 px-1">
                  <Avatar name={user.name||''} avatar={user.avatar} />
                  <p className="text-sm font-black text-slate-900 dark:text-white">{user.name||user.email}</p>
                </div>

                {/* Media upload */}
                <div onClick={() => fileRef.current?.click()}
                  className={`rounded-2xl overflow-hidden cursor-pointer transition-all border-2 ${
                    form.preview ? 'border-transparent bg-black' : 'border-dashed border-slate-200 dark:border-white/10 hover:border-indigo-400 bg-slate-50 dark:bg-white/5'
                  }`}>
                  {form.preview ? (
                    form.mediaType==='video' ? <video src={form.preview} className="w-full max-h-72 object-contain" />
                    : form.mediaType==='music' ? (
                      <div className="flex items-center gap-4 px-5 py-8 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-music text-white text-xl" />
                        </div>
                        <p className="text-sm font-bold text-white truncate">{form.file?.name}</p>
                      </div>
                    ) : <img src={form.preview} alt="" className="w-full max-h-72 object-contain" />
                  ) : (
                    <div className="flex flex-col items-center py-10 gap-3 text-center">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-slate-300" />
                      <div>
                        <p className="text-sm font-black text-slate-500">Tap to upload</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Images, videos, audio · max {MAX_MB} MB</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-cyan-100 text-cyan-600">+{POINTS.image}pts photo</span>
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">+{POINTS.video}pts video</span>
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-pink-100 text-pink-600">+{POINTS.music}pts music</span>
                      </div>
                    </div>
                  )}
                  {form.preview && (
                    <button onClick={e=>{e.stopPropagation();dispatch({type:'set',key:'preview',value:null});dispatch({type:'set',key:'file',value:null});}}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleFilePick} />

                {/* AI Prompt / Caption — single combined field */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 px-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-wand-magic-sparkles text-[9px]" />AI Prompt / Caption
                  </label>
                  <div className="relative">
                    <textarea
                      value={form.originalPrompt}
                      onChange={e => { dispatch({type:'set',key:'originalPrompt',value:e.target.value}); dispatch({type:'set',key:'caption',value:e.target.value}); }}
                      onFocus={() => setShowSugg(suggestions.length>0)}
                      onBlur={() => setTimeout(()=>setShowSugg(false),150)}
                      rows={3} placeholder="Describe your creation — autocomplete & tags appear as you type…"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    {showSugg && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
                        {suggestions.map((s,i) => (
                          <button key={i} onMouseDown={() => { dispatch({type:'set',key:'originalPrompt',value:s}); dispatch({type:'set',key:'caption',value:s}); setShowSugg(false); }}
                            className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-2">
                            <i className="fa-solid fa-clock-rotate-left text-indigo-400 text-[9px]" />{s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Live tags */}
                  {form.originalPrompt && extractTags(form.originalPrompt).length>0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {extractTags(form.originalPrompt).map(t=><TagPill key={t} tag={t} />)}
                    </div>
                  )}
                </div>

                {form.error && <p className="text-xs text-red-500 font-bold px-1">{form.error}</p>}

                <button onClick={handleSubmit} disabled={form.submitting || (!form.originalPrompt.trim() && !form.file)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  {form.submitting ? <><Spinner />{form.file ? 'Uploading…' : 'Posting…'}</> : <><i className="fa-solid fa-paper-plane" />Share Creation</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ POINTS ══ */}
        {tab==='points' && (
          <div className="max-w-lg mx-auto p-4 space-y-4">
            {!user ? (
              <div className="text-center py-16">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3 block" />
                <p className="text-sm text-slate-500 font-bold">Sign in to see your points</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Creator Points</p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black tabular-nums">{points}</span>
                    <span className="text-lg font-black opacity-70 mb-1.5">pts</span>
                  </div>
                  <p className="text-[10px] opacity-70 mt-1">{Math.floor(points/REDEEM)} free Studio generation{Math.floor(points/REDEEM)!==1?'s':''} available</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">Redeem</p>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">1 Free Studio Generation</p>
                      <p className="text-[10px] text-slate-400">Nano Banana · Veo</p>
                    </div>
                    <button onClick={() => {
                      if (points<REDEEM) return;
                      const np=addPts(user.id,-REDEEM); setPoints(np);
                      const k=`orin_free_gens_${user.id}`;
                      localStorage.setItem(k,String(parseInt(localStorage.getItem(k)||'0',10)+1));
                      alert('✅ 1 free Studio generation unlocked! Go to Studio Create to use it.');
                    }} disabled={points<REDEEM}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-500 transition-colors">
                      {REDEEM} pts
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">Earn Points</p>
                  <div className="space-y-2">
                    {([['fa-image','text-cyan-500','Post a photo',POINTS.image],['fa-video','text-indigo-500','Post a video',POINTS.video],
                       ['fa-music','text-pink-500','Post music',POINTS.music],['fa-pen-nib','text-amber-500','Post text',POINTS.text],
                       ['fa-heart','text-red-500','Get a like',POINTS.like],['fa-comment','text-green-500','Get a comment',POINTS.comment]
                    ] as [string,string,string,number][]).map(([ic,cl,label,pts]) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2"><i className={`fa-solid ${ic} ${cl} w-4`} /><span className="text-slate-600 dark:text-slate-400">{label}</span></div>
                        <span className="font-black text-amber-500">+{pts} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>


        {/* ══ YOUR CREATIONS ══ */}
        {tab==='mine' && (
          <div className="max-w-xl mx-auto pb-4">
            {!user ? (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <i className="fa-solid fa-lock text-4xl text-slate-200 dark:text-slate-700" />
                <p className="text-sm font-bold text-slate-400">Sign in to see your creations</p>
              </div>
            ) : (() => {
              const mine = posts.filter(p => p.userId === user.id);
              if (mine.length === 0) return (
                <div className="flex flex-col items-center py-16 gap-4 text-center">
                  <i className="fa-solid fa-image text-5xl text-slate-200 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-400">No creations yet</p>
                  <button onClick={() => setTab('create')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500">Create Now</button>
                </div>
              );
              return (
                <div className="space-y-0">
                  {mine.map(post => (
                    <article key={post.id} className="border-b border-slate-100 dark:border-white/5 p-4">
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/5 shrink-0">
                          {post.mediaUrl && post.mediaType === 'image'
                            ? <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : post.mediaType === 'video'
                            ? <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-video text-xl text-indigo-400" /></div>
                            : post.mediaType === 'music'
                            ? <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500/20 to-purple-600/20"><i className="fa-solid fa-music text-xl text-pink-400" /></div>
                            : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-pen-nib text-xl text-amber-400" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate mb-0.5">{post.title || post.caption || 'Untitled'}</p>
                          {post.originalPrompt && (
                            <p className="text-[10px] text-slate-400 italic line-clamp-2 mb-1.5">✦ {post.originalPrompt}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {post.tags?.slice(0,3).map(t => <TagPill key={t} tag={t} />)}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><i className="fa-solid fa-heart text-red-400" />{post.likeCount || 0}</span>
                            <span className="flex items-center gap-1"><i className="fa-regular fa-comment" />{post.commentCount || 0}</span>
                            <span className="ml-auto">{timeAgo(post.createdAt)}</span>
                          </div>
                          {/* Use it + Delete */}
                          <div className="flex gap-2 mt-2">
                            {post.originalPrompt && (
                              <button onClick={() => handleUseIt(post)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[9px] font-black hover:bg-indigo-500 transition-colors">
                                <i className="fa-solid fa-wand-magic-sparkles text-[8px]" />Use it
                              </button>
                            )}
                            <button onClick={() => setDeleteConfirm(post.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-[9px] font-black hover:bg-red-100 transition-colors">
                              <i className="fa-solid fa-trash text-[8px]" />Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      {deleteConfirm === post.id && (
                        <div className="mt-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-red-600">Delete this creation?</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleDelete(post.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-black">Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-500 text-[10px] font-black">Cancel</button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

      {/* Detail Modal */}
      <DetailModal />
    </div>
  );
};

export default CreationFeed;
