import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, lazy, Suspense } from 'react';
import LandingPage from './components/LandingPage';
import { ChatMessage, Language, AppView, WorkspaceMode, Conversation, UserAccount, conversationHasUserMessage, UserThemeId } from './types';
import { geminiService } from './services/geminiService';
import { firebaseService } from './services/firebaseService';
import { notificationService } from './services/notificationService';
import { cacheService, CacheKey } from './services/cacheService';
import { translations } from './translations';

// Lazy-load heavy views so initial bundle is smaller (BFF-style: less JS on first paint).
import { AuroraBg, SilkBg, MidnightBg, TerminalBg, SunsetBg, PaperBg, NeonBg } from './components/backgrounds/CSSBackgrounds';
const FilesWorkspace = lazy(() => import('./components/FilesWorkspace'));
const CreationFeed = lazy(() => import('./components/CreationFeed'));
const ChatWorkspace = lazy(() => import('./components/ChatWorkspace'));
const AccountSettings = lazy(() => import('./components/AccountSettings').then(m => ({ default: m.default })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(m => ({ default: m.default })));
const TermsPage = lazy(() => import('./components/TermsPage').then(m => ({ default: m.default })));
const ReleasesPage = lazy(() => import('./components/ReleasesPage').then(m => ({ default: m.default })));
const LogicFlowPage = lazy(() => import('./components/LogicFlowPage').then(m => ({ default: m.default })));
const CreatorPage = lazy(() => import('./components/CreatorPage').then(m => ({ default: m.default })));
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.default })));
const DownloadsPage = lazy(() => import('./components/DownloadsPage').then(m => ({ default: m.default })));
const VoiceAssistant = lazy(() => import('./components/VoiceAssistant').then(m => ({ default: m.default })));
const ExecutorControllerPage = lazy(() => import('./components/ExecutorControllerPage').then(m => ({ default: m.default })));
const AgentWorkspace = lazy(() => import('./components/AgentWorkspace').then(m => ({ default: m.default })));
const AdminPortal = lazy(() => import('./components/AdminPortal').then(m => ({ default: m.default })));
const TelegramBotPage = lazy(() => import('./components/TelegramBotPage').then(m => ({ default: m.default })));
const DeviceAuthPage = lazy(() => import('./components/DeviceAuthPage').then(m => ({ default: m.default })));

// Lazy-load heavy WebGL/Three.js background shaders so only the active theme's canvas loads

const PageFallback = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-950">
    <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Loading…</span>
  </div>
);

/** Build searchable text for a conversation (title + user messages) for embedding. Max ~4k chars for context. */
function conversationToSearchText(c: Conversation): string {
  const parts = [c.title ?? 'Chat'];
  for (const m of (c.messages ?? [])) {
    if (m.role === 'user' && typeof m.content === 'string') parts.push(m.content);
  }
  const text = parts.join('\n');
  return text.length > 4000 ? text.slice(0, 4000) : text;
}

const WORKSPACE_TO_VIEW: Record<WorkspaceMode, AppView> = { studio: 'art', vision: 'camera', voice: 'voice', maths: 'math', chat: 'chat', translator: 'translator', agent: 'agent', files: 'chat' };
// Only workspace views map to workspace modes; static pages shouldn't force-chat.
const VIEW_TO_MODE: Record<AppView, WorkspaceMode> = {
  art: 'studio',
  camera: 'vision',
  math: 'maths',
  chat: 'chat',
  translator: 'translator',
  voice: 'voice',
  agent: 'agent',
  files: 'files',
  landing: 'chat', // landing CTA opens chat by default
  account: 'chat',
  privacy: 'chat',
  terms: 'chat',
  releases: 'chat',
  logic: 'chat',
  creator: 'chat',
  pricing: 'chat',
  downloads: 'chat',
  'admin-portal': 'chat',
  'telegram-bot': 'chat',
  community: 'chat',
  executor: 'agent',
  'device-auth': 'chat',
};
const WORKSPACE_VIEWS: AppView[] = ['chat', 'translator', 'art', 'camera', 'voice', 'math', 'agent', 'files'];
const VALID_VIEWS: AppView[] = ['landing', 'chat', 'translator', 'art', 'camera', 'voice', 'math', 'agent', 'account', 'privacy', 'terms', 'releases', 'logic', 'creator', 'pricing', 'downloads', 'admin-portal', 'telegram-bot', 'files', 'community', 'executor', 'device-auth'];
const AUTH_TIMEOUT_MS = 25000; // iOS redirect needs up to 15s

type AuthUserLike = { uid: string; email: string | null; displayName: string | null; photoURL: string | null };

/** Local-only user used when Firestore sync fails — keeps the UI working offline. */
function makeFallbackUser(authUser: AuthUserLike): UserAccount {
  return {
    id: authUser.uid,
    name: authUser.displayName || authUser.email?.split('@')[0] || 'User',
    email: authUser.email || 'user@orin.ai',
    avatar: authUser.photoURL || undefined,
    tier: 'Free',
    plan: 'free',
    role: 'visitor',
    approved: false,
    dailyUsage: { text: 0, images: 0, videos: 0 },
  };
}

/** Clear localStorage keys + SW caches that are irrelevant to signed-out guests.
 *  Prevents iOS Safari from serving stale auth state from a cached page load. */
async function clearGuestCaches() {
  // Remove user-specific localStorage keys (keep lang/theme prefs)
  const keepKeys = new Set([CacheKey.LANG, CacheKey.THEME, CacheKey.USER_THEME]);
  Object.keys(localStorage)
    .filter(k => k.startsWith('orin_') && !keepKeys.has(k as CacheKey))
    .forEach(k => localStorage.removeItem(k));
  // Nuke SW caches so iOS doesn't serve a stale index.html with embedded auth state
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {}
}
const SAVE_DEBOUNCE_MS = 3000;
// Treat local conversations from the last 7 days as eligible to merge into cloud
const RECENT_LOCAL_MS = 7 * 24 * 60 * 60 * 1000;

type ThemeMode = 'light' | 'dark' | 'auto';

const getIsNightByLocalTime = (): boolean => {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 18; // 6am–6pm = day (light), else night (dark)
};

const VALID_USER_THEMES: UserThemeId[] = ['classic', 'midnight', 'aurora', 'terminal', 'paper', 'ocean', 'sunset', 'neon'];
const normalizeUserTheme = (value: unknown): UserThemeId => {
  if (value && typeof value === 'string' && VALID_USER_THEMES.includes(value as UserThemeId)) return value as UserThemeId;
  return 'classic'; // new users or invalid → classic so animations and theme always work
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => cacheService.get<Language>(CacheKey.LANG, 'en'));
  const [theme, setTheme] = useState<ThemeMode>(() => (cacheService.get<string | null>(CacheKey.THEME, null) as ThemeMode | null) || 'light');
  const [autoDark, setAutoDark] = useState(() => getIsNightByLocalTime()); // when theme === 'auto', true = dark
  const [userTheme, setUserTheme] = useState<UserThemeId>(() => normalizeUserTheme(cacheService.get(CacheKey.USER_THEME, 'classic')));
  const t = translations[lang];

  const effectiveDark = theme === 'auto' ? autoDark : theme === 'dark';

  // Global Auth State
  const [user, setUser] = useState<UserAccount | null>(null);
  const [upgradePopup, setUpgradePopup] = useState<{ plan: string } | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // App State
  const [view, setView] = useState<AppView>('landing');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [authError, setAuthError] = useState<string | null>(null);

  // Global reasoning style for chat workspace
  const [thinkingMode, setThinkingMode] = useState(false);
  const [descriptiveMode, setDescriptiveMode] = useState(false);

  // Viewport Scaling & Height Fix for Small Devices
  useLayoutEffect(() => {
    const handleResize = () => {
      const root = document.getElementById('root');
      if (!root) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
      const MIN_WIDTH = 375;
      if (width < MIN_WIDTH) {
         const scale = width / MIN_WIDTH;
         root.style.transform = `scale(${scale})`;
         root.style.transformOrigin = 'top left';
         root.style.width = `${MIN_WIDTH}px`;
         root.style.height = `${height / scale}px`;
         root.style.position = 'absolute'; 
         root.style.overflow = 'hidden';
      } else {
         root.style.transform = '';
         root.style.transformOrigin = '';
         root.style.width = '';
         root.style.height = '';
         root.style.position = '';
         root.style.overflow = '';
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'si' ? 'si' : lang === 'ta' ? 'ta' : 'en';
  }, [lang]);

  // OAuth callback — route code to the correct backend handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Google OAuth callback (path-based)
    if (window.location.pathname.includes('/auth/google/callback')) {
      import('./services/googleIntegrationService').then(({ handleOAuthCallback }) => {
        handleOAuthCallback().then(result => {
          if (result) window.location.hash = 'account';
        });
      });
      return;
    }

    // Spotify callback — store code for AIProviderSettings to exchange via /api/auth/spotify
    sessionStorage.setItem('oauth_callback_code', code);
    window.history.replaceState({}, '', '/');
    if (!window.location.hash.includes('account')) window.location.hash = 'account';
  }, []);

  // When theme is 'auto', update autoDark from local time every minute
  useEffect(() => {
    if (theme !== 'auto') return;
    const update = () => setAutoDark(getIsNightByLocalTime());
    update();
    const id = setInterval(update, 60 * 1000);
    return () => clearInterval(id);
  }, [theme]);

  // Keep HTML dark class in sync with effective mode (light/dark/auto by time)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', effectiveDark);
  }, [effectiveDark]);

  // --- 1. AUTH INITIALIZATION & SYNC ---
  // applyUser lives further down (needs mergeHistory); effects run after render,
  // so we reach it through a ref to keep this subscription early.
  const applyUserRef = useRef<(authUser: AuthUserLike) => Promise<void>>(async () => {});

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (!authInitialized) {
        // Allow the app to render as guest and surface a clear message instead of
        // leaving the user on an endless spinner with no explanation.
        setAuthError('Taking longer than usual to connect. Showing guest view while we finish signing you in.');
        setAuthInitialized(true);
      }
    }, AUTH_TIMEOUT_MS);

    // Subscribe IMMEDIATELY — do not block on getRedirectResult first.
    // iOS Safari fires onAuthStateChanged during any async wait before subscription,
    // causing the user-restored event to be missed → infinite loading / signed out.
    let unsubscribe: (() => void) | undefined;
    let authHandled = false;
    unsubscribe = firebaseService.onAuthStateChanged(async (authUser) => {
      clearTimeout(safetyTimeout);
      setAuthError(null);
      if (authUser) {
        authHandled = true;
        await applyUserRef.current(authUser);
      } else {
        // On iOS after signInWithRedirect, onAuthStateChanged can fire null briefly
        // while Firebase is still reading the credential from the redirect result.
        // Give it 3s before declaring signed-out.
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && !authHandled) {
          await new Promise(r => setTimeout(r, 3000));
          const retryUser = firebaseService.currentUser();
          if (retryUser) { await applyUserRef.current(retryUser); return; }
        }
        setUser(null);
        geminiService.logout();
        // Clear stale guest caches so iOS doesn't serve old auth state from SW cache
        clearGuestCaches();
        setAuthInitialized(true);
      }
    });

    // getRedirectResult in background — result flows through onAuthStateChanged anyway
    firebaseService.getRedirectResult().then(({ error }) => {
      if (error) setAuthError(error);
    }).catch(() => {});

    return () => {
      unsubscribe?.();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // --- 2. ROUTING LOGIC ---
  useEffect(() => {
    const handleHash = () => {
      const hashPart = window.location.hash.replace(/^#+/, '');
      const [path, qs] = hashPart.includes('?') ? hashPart.split('?', 2) : [hashPart, ''];
      const hash = path;
      const params = new URLSearchParams(qs);

      // ADMIN PORTAL DETECTION
      if (hash === 'admin-portal') {
          setView('admin-portal');
          return;
      }

      if (user && (hash === '' || hash === '/')) {
         window.location.hash = 'chat';
         return;
      }
      if (hash === 'home') {
          setView('landing');
          return;
      }
      if (VALID_VIEWS.includes(hash as AppView)) {
          if (WORKSPACE_VIEWS.includes(hash as AppView) && !user && authInitialized) {
              window.location.hash = ''; 
              return;
          }
          setView(hash as AppView);
          if (hash === 'chat') {
            const promptFromUrl = params.get('prompt');
            if (promptFromUrl !== null) {
              try { setGlobalPrompt(decodeURIComponent(promptFromUrl)); } catch { /* ignore malformed */ }
            }
          }
      } else {
          setView('landing');
      }
    };
    if (authInitialized) handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [user, authInitialized]);

  // Re-verify user plan after Stripe success (webhook has updated Firestore)
  useEffect(() => {
    if (view !== 'pricing') return;
    const hashPart = window.location.hash;
    const qs = hashPart.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    if (params.get('success') !== 'true') return;
    const authUser = firebaseService.currentUser();
    if (!authUser) return;
    (async () => {
      try {
        const syncedUser = await firebaseService.syncUserSession(authUser.uid, authUser.email || 'user@orin.ai', authUser.photoURL);
        geminiService.setSessionUser(syncedUser);
        setUser(syncedUser);
        if (syncedUser.theme) {
          setUserTheme(normalizeUserTheme(syncedUser.theme));
          cacheService.set(CacheKey.USER_THEME, syncedUser.theme);
        }
        window.history.replaceState(null, '', window.location.pathname + '#pricing');
      } catch {
        // keep current user state on sync failure
      }
    })();
  }, [view]);

  // --- 3. CONVERSATION STATE (only load conversations that have at least one message) ---
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = cacheService.get<any[]>(CacheKey.HISTORY, []);
      if (!Array.isArray(saved)) return [];
      return saved
        .map((c: any) => ({
          ...c,
          timestamp: new Date(c.timestamp),
          messages: (c.messages || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
        }))
        .filter((c: any) => (c.messages || []).some((m: { role: string }) => m.role === 'user'));
    } catch { return []; }
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null); // always fresh on load

  const saveTimeoutRef = useRef<number | null>(null);
  const bootstrappedConvRef = useRef(false);

  // Drop conversations with no user messages when switching away
  useEffect(() => {
    setConversations(prev => {
      const keep = prev.filter(c => c.id === activeConversationId || conversationHasUserMessage(c));
      return keep.length === prev.length ? prev : keep;
    });
  }, [activeConversationId]);

  // Also sweep empties 500ms after any conversation count change (catches abandoned chats)
  useEffect(() => {
    const t = setTimeout(() => {
      setConversations(prev => {
        const keep = prev.filter(c => c.id === activeConversationId || conversationHasUserMessage(c));
        return keep.length === prev.length ? prev : keep;
      });
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  useEffect(() => {
    const meaningfulConversations = conversations.filter(conversationHasUserMessage);
    cacheService.set(CacheKey.HISTORY, meaningfulConversations);
    if (activeConversationId) cacheService.set(CacheKey.ACTIVE_CONV, activeConversationId);
    if (user?.id) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          // Compute embeddings first when due (2–4s) so the sync spinner is only shown for the actual write.
          let embeddingsByConvId: Record<string, number[]> | undefined;
          const EMBEDDING_MIN_INTERVAL_MS = 2 * 60 * 1000;
          if (meaningfulConversations.length > 0 && Date.now() - lastEmbeddingAtRef.current >= EMBEDDING_MIN_INTERVAL_MS) {
            lastEmbeddingAtRef.current = Date.now();
            try {
              const texts = meaningfulConversations.map(conversationToSearchText);
              const vectors = await geminiService.embedText(texts).catch(() => []);
              if (vectors.length === meaningfulConversations.length) {
                embeddingsByConvId = {};
                meaningfulConversations.forEach((c, i) => {
                  if (vectors[i]?.length) embeddingsByConvId![c.id] = vectors[i];
                });
                if (Object.keys(embeddingsByConvId).length === 0) embeddingsByConvId = undefined;
              }
            } catch {
              // Ignore; search will fall back to recency.
            }
          }
          setSyncStatus('syncing');
          await firebaseService.saveHistory(user.id, meaningfulConversations, []);
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } catch {
          setSyncStatus('error');
        }
      }, SAVE_DEBOUNCE_MS);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [conversations, activeConversationId, user?.id]);

  useEffect(() => {
    if (!activeConversationId) return;
    const exists = conversations.some(c => c.id === activeConversationId);
    if (!exists) setActiveConversationId(conversations[0]?.id ?? null);
  }, [conversations, activeConversationId]);

  // Sync global reasoning toggles from the active conversation so switching convs restores that conv's modes.
  useEffect(() => {
    if (!activeConversationId) return;
    const active = conversations.find(c => c.id === activeConversationId);
    setThinkingMode(active?.thinkingMode ?? false);
    setDescriptiveMode(active?.descriptiveMode ?? false);
  }, [activeConversationId, conversations]);

  // When on chat (or workspace) with no active conversation, create one so the first message isn't dropped.
  // Agent view manages its own state and does not use conversations; skip to avoid zombie "New Chat" entries.
  useEffect(() => {
    if (view === 'agent') return;
    if (view !== 'chat' && !WORKSPACE_VIEWS.includes(view)) return;
    if (activeConversationId != null || bootstrappedConvRef.current) return;
    const newId = Date.now().toString();
    const mode = VIEW_TO_MODE[view];
    setConversations(prev => [{ id: newId, title: 'New Chat', messages: [], timestamp: new Date(), mode, modesUsed: [mode], thinkingMode, descriptiveMode }, ...prev]);
    setActiveConversationId(newId);
    bootstrappedConvRef.current = true;
  }, [view, activeConversationId, thinkingMode, descriptiveMode]);

  const mergeHistory = useCallback((cloudHistory: Conversation[]) => {
    const withUserMessages = (cloudHistory || []).filter(c => conversationHasUserMessage(c));
    const cloudIds = new Set(withUserMessages.map(c => c.id));
    setConversations(prev => {
      const prevMeaningful = prev.filter(conversationHasUserMessage);
      const combined = new Map<string, Conversation>();
      for (const c of withUserMessages) combined.set(c.id, c);
      for (const c of prevMeaningful) {
        const inCloud = cloudIds.has(c.id);
        const time = new Date(c.timestamp).getTime();
        const recent = Date.now() - time < RECENT_LOCAL_MS;
        if (inCloud) {
          const cloud = combined.get(c.id)!;
          const cloudMsg = (cloud.messages || []).length;
          const localMsg = c.messages.length;
          const cloudTime = new Date(cloud.timestamp).getTime();
          const localTime = time;
          if (localMsg > cloudMsg || (localMsg === cloudMsg && localTime > cloudTime)) combined.set(c.id, c);
        } else if (recent) {
          combined.set(c.id, c);
        }
      }
      return [...combined.values()].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
  }, []);

  const SYNC_PULL_INTERVAL_MS = 5 * 60 * 1000; // 5 min to avoid burning Firestore read quota
  const MIN_PULL_GAP_MS = 2 * 60 * 1000; // don't pull on every tab focus; at least 2 min since last pull
  const lastPullTimeRef = useRef<number>(0);
  const lastCloudRef = useRef<Conversation[] | null>(null);
  // Throttle expensive embedding calls so we don't re-embed all conversations on every keystroke.
  const lastEmbeddingAtRef = useRef<number>(0);
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const pull = async () => {
      const now = Date.now();
      // Skip background pulls when the tab isn't visible to reduce Firestore reads.
      if (document.visibilityState !== 'visible') return;
      if (now - lastPullTimeRef.current < MIN_PULL_GAP_MS) return;
      lastPullTimeRef.current = now;
      try {
        const cloud = await firebaseService.getHistory(uid);
        if (cloud?.length !== undefined) {
          lastCloudRef.current = cloud;
          mergeHistory(cloud);
        }
      } catch {
        // ignore; will retry on next focus or interval
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pull();
    };
    document.addEventListener('visibilitychange', onVisibility);
    pull(); // initial pull (only if tab is visible)
    const intervalId = window.setInterval(pull, SYNC_PULL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [user?.id, mergeHistory]);

  /** Single sign-in/restore path — used by onAuthStateChanged AND explicit sign-in callbacks. */
  const applyUser = useCallback(async (authUser: AuthUserLike) => {
    const fallbackUser = makeFallbackUser(authUser);
    try {
      const syncedUser = await firebaseService.syncUserSession(authUser.uid, authUser.email || 'user@orin.ai', authUser.photoURL);
      geminiService.setSessionUser(syncedUser);
      setUser(syncedUser);
      (window as any).__orinUser = syncedUser; // used by internal protocol override
      // Show upgrade greeting if plan changed since last visit
      const lastSeenPlan = localStorage.getItem(`orin_last_plan_${authUser.uid}`);
      if (lastSeenPlan && lastSeenPlan !== syncedUser.plan &&
          (syncedUser.plan === 'basic' || syncedUser.plan === 'pro' || syncedUser.plan?.includes('yearly'))) {
        setUpgradePopup({ plan: syncedUser.plan });
      }
      localStorage.setItem(`orin_last_plan_${authUser.uid}`, syncedUser.plan || 'free');
      if (syncedUser.theme) {
        setUserTheme(normalizeUserTheme(syncedUser.theme));
        cacheService.set(CacheKey.USER_THEME, syncedUser.theme);
      }
      setSyncStatus('syncing');
      const cloudHistory = await firebaseService.getHistory(authUser.uid);
      if (cloudHistory) {
        lastCloudRef.current = cloudHistory;
        mergeHistory(cloudHistory);
      }
      setSyncStatus('success');
      notificationService.setupForUser().catch(() => {});
    } catch {
      // Firestore unavailable: degrade gracefully to a local-only user but keep
      // Gemini in guest mode so usage limits stay honest.
      setUser(fallbackUser);
      setSyncStatus('error');
    }
    setAuthInitialized(true);
    setAuthError(null);
  }, [mergeHistory]);

  useEffect(() => { applyUserRef.current = applyUser; }, [applyUser]);

  // SW-triggered plan recheck (catches missed upgrade notifications).
  // Registered ONCE per page load — previously every sign-in stacked another listener.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = async (e: MessageEvent) => {
      if (e.data?.type !== 'RECHECK_PLAN') return;
      const authUser = firebaseService.currentUser();
      if (!authUser) return;
      try {
        const refreshed = await firebaseService.syncUserSession(authUser.uid, authUser.email || '', authUser.photoURL);
        const lastSeenPlan = localStorage.getItem(`orin_last_plan_${authUser.uid}`);
        if (lastSeenPlan && lastSeenPlan !== refreshed.plan &&
            (refreshed.plan === 'basic' || refreshed.plan === 'pro' || refreshed.plan?.includes('yearly'))) {
          setUpgradePopup({ plan: refreshed.plan });
        }
        localStorage.setItem(`orin_last_plan_${authUser.uid}`, refreshed.plan || 'free');
        setUser(refreshed);
        geminiService.setSessionUser(refreshed);
      } catch { /* non-blocking */ }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, []);

  const handleStartWorkspace = (prompt: string, mode: WorkspaceMode = 'chat', autoSubmit: boolean = false) => {
    if (!user) {
        setGlobalPrompt(prompt);
        return; 
    }
    setGlobalPrompt(prompt);
    setShouldAutoSubmit(autoSubmit);
    if (mode !== 'agent') {
      const activeConv = conversations.find(c => c.id === activeConversationId);
      const canReuseActive = activeConv && !conversationHasUserMessage(activeConv) && activeConv.mode === mode;
      if (!canReuseActive) {
         const newId = Date.now().toString();
         setConversations(prev => [{ id: newId, title: "New Chat", messages: [], timestamp: new Date(), mode, modesUsed: [mode] }, ...prev]);
         setActiveConversationId(newId);
      }
    }
    window.location.hash = WORKSPACE_TO_VIEW[mode];
  };

  const handleDeleteConversation = async (id: string) => {
    const prevConversations = conversations;
    const prevActiveId = activeConversationId;
    const next = conversations.filter(c => c.id !== id);
    setConversations(next);
    if (activeConversationId === id) setActiveConversationId(next[0]?.id || null);
    const meaningful = next.filter(conversationHasUserMessage);
    if (user?.id) {
      try {
        setSyncStatus('syncing');
        await firebaseService.saveHistory(user.id, meaningful, [id]);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch {
        alert('Failed to delete conversation. Your history was not updated in the cloud.');
        setSyncStatus('error');
        // revert UI so next sync does not resurrect the conversation unexpectedly
        setConversations(prevConversations);
        setActiveConversationId(prevActiveId);
      }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to delete all chat history?")) {
       setConversations([]);
       setActiveConversationId(null);
       cacheService.remove(CacheKey.HISTORY);
       cacheService.remove(CacheKey.ACTIVE_CONV);
       if (user?.id) await firebaseService.saveHistory(user.id, [], []);
       window.location.hash = 'chat';
    }
  };

  const updateReasoningModes = (opts: { thinking?: boolean; descriptive?: boolean }) => {
    const nextThinking = opts.thinking ?? thinkingMode;
    const nextDescriptive = opts.descriptive ?? descriptiveMode;
    setThinkingMode(nextThinking);
    setDescriptiveMode(nextDescriptive);
    if (activeConversationId) {
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, thinkingMode: nextThinking, descriptiveMode: nextDescriptive } : c));
    }
  };

  const handleThemeChange = async (nextTheme: UserThemeId) => {
    // Themes now have light + dark variants; no need to force mode.
    setUserTheme(nextTheme);
    cacheService.set(CacheKey.USER_THEME, nextTheme);
    if (user?.id) {
      // theme saved locally only — no separate Firestore field needed
    }
  };

  const NavTab = ({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`mode-pill flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-150 ${
        active
          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-500/20 active'
          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
      }`}
    >
      <i className={`fa-solid ${icon} text-[11px]`} />
      <span className="hidden md:inline-block">{label}</span>
    </button>
  );

  const renderContent = () => {
    if (!authInitialized) return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-slate-50 dark:bg-slate-950">
         <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-10 h-10 rounded-full bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.6)] animate-pulse"></div>
            </div>
         </div>
         <div className="text-center space-y-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Orin AI</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing...</p>
         </div>
      </div>
    );

    if (view === 'admin-portal') return <AdminPortal user={user} onClose={() => window.location.hash = 'home'} />;
    if (view === 'device-auth') return <DeviceAuthPage user={user} onClose={() => window.location.hash = 'home'} />;
    if (view === 'telegram-bot') return <TelegramBotPage onClose={() => window.location.hash = 'home'} lang={lang} />;

    switch (view) {
      case 'executor':
        return <ExecutorControllerPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'agent':
        return <AgentWorkspace user={user} onClose={() => window.location.hash = 'chat'} lang={lang} initialPrompt={globalPrompt} />;
      case 'chat': case 'translator': case 'art': case 'camera': case 'math':
        return (
          <ChatWorkspace 
            onClose={() => window.location.hash = 'chat'}
            initialPrompt={globalPrompt}
            initialMode={VIEW_TO_MODE[view]}
            autoSubmit={shouldAutoSubmit}
            onInputChange={setGlobalPrompt}
            messages={conversations.find(c => c.id === activeConversationId)?.messages || []}
            setMessages={(updater) => {
               if (!activeConversationId) return;
               const mode = VIEW_TO_MODE[view];
               setConversations(prev => {
                  const existing = prev.find(c => c.id === activeConversationId);
                  const newMessages = typeof updater === 'function' ? updater(existing?.messages || []) : updater;
                  if (!existing) {
                      const newConv: Conversation = {
                          id: activeConversationId, title: "New Chat", messages: newMessages, timestamp: new Date(), mode, modesUsed: [mode], thinkingMode, descriptiveMode
                      };
                      return [newConv, ...prev];
                  }
                  return prev.map(c => c.id === activeConversationId ? { ...c, messages: newMessages, timestamp: new Date() } : c);
               });
            }}
            lang={lang}
            conversations={conversations}
            onSwitchConv={setActiveConversationId}
            onNewConv={() => handleStartWorkspace('', 'chat')}
            onDeleteConv={handleDeleteConversation}
            activeConvId={activeConversationId || ""}
            onUpdateTitle={(title, modes) => setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title, modesUsed: modes ? [...new Set([...(c.modesUsed || []), ...modes])] : c.modesUsed } : c))}
            onModeSwitch={(m) => {
              setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, mode: m } : c));
              window.location.hash = WORKSPACE_TO_VIEW[m];
            }}
            isSyncing={syncStatus === 'syncing'}
            thinkingMode={thinkingMode}
            descriptiveMode={descriptiveMode}
            onReasoningModeChange={updateReasoningModes}
          />
        );
      case 'voice': return <VoiceAssistant onClose={() => window.location.hash = 'chat'} lang={lang} inline={false} />;
      case 'files': return (
        <Suspense fallback={null}>
          <FilesWorkspace onClose={() => window.location.hash = 'chat'} lang={lang} user={user} />
        </Suspense>
      );
      case 'community': return (
        <Suspense fallback={null}>
          <CreationFeed onClose={() => window.location.hash = 'chat'} lang={lang} user={user} onUsePrompt={(prompt) => { setGlobalPrompt(prompt); window.location.hash = 'chat'; }} />
        </Suspense>
      );
      case 'account': return <AccountSettings onClose={() => window.location.hash = 'chat'} lang={lang} user={user} onClearHistory={handleClearHistory} conversationsCount={conversations.filter(conversationHasUserMessage).length} authError={authError} onDismissAuthError={() => setAuthError(null)} onSignInWithUser={applyUser} userTheme={userTheme} onThemeChange={handleThemeChange} themeMode={theme} onThemeModeChange={(mode) => { setTheme(mode); cacheService.set(CacheKey.THEME, mode); }} />;
      case 'privacy': return <PrivacyPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'terms': return <TermsPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'releases': return <ReleasesPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'logic': return <LogicFlowPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'creator': return <CreatorPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'pricing': return <PricingPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'downloads': return <DownloadsPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      default: return (
        <LandingPage
          prompt={globalPrompt}
          onPromptChange={setGlobalPrompt}
          onStartChat={handleStartWorkspace}
          onVoiceOpen={() => handleStartWorkspace('', 'voice')}
          lang={lang}
          user={user}
          onLogin={() => window.location.hash = 'account'}
          onSignInWithUser={applyUser}
          thinkingMode={thinkingMode}
          descriptiveMode={descriptiveMode}
          onReasoningModeChange={updateReasoningModes}
          userTheme={userTheme}
          isDark={effectiveDark}
        />
      );
    }
  };

  // Refined base backgrounds: smooth gradients, cohesive palettes per theme.
  const themeBgByMode: Record<UserThemeId, { light: string; dark: string }> = {
    // Classic: warm off-white / deep charcoal (not pure black/white)
    classic: {
      light: 'bg-[#f7f7f5]',
      dark:  'bg-[#1a1a1f]',
    },
    // Midnight: soft indigo-tinted
    midnight: {
      light: 'bg-gradient-to-br from-[#eef0ff] via-[#f2f0ff] to-[#ece8ff]',
      dark:  'bg-gradient-to-b from-[#10102a] via-[#13112a] to-[#0e0c22]',
    },
    // Aurora: soft teal-green wash
    aurora: {
      light: 'bg-gradient-to-br from-[#edfdf8] via-[#f0fdf9] to-[#e8faf5]',
      dark:  'bg-gradient-to-b from-[#0d1a16] via-[#101f1b] to-[#0c1814]',
    },
    // Terminal: deep forest green tinted
    terminal: {
      light: 'bg-gradient-to-b from-[#f0faf2] via-[#edf9ef] to-[#f0faf2]',
      dark:  'bg-[#080f08]',
    },
    // Paper: warm parchment / deep mahogany
    paper: {
      light: 'bg-gradient-to-br from-[#fdf8f0] via-[#fef6ec] to-[#fdf3e8]',
      dark:  'bg-gradient-to-br from-[#1a1008] via-[#1f140a] to-[#1a100a]',
    },
    // Ocean: pale arctic blue / deep ocean
    ocean: {
      light: 'bg-gradient-to-br from-[#eef9ff] via-[#eaf6ff] to-[#e8f4ff]',
      dark:  'bg-gradient-to-b from-[#080f1c] via-[#0b1528] to-[#091220]',
    },
    // Sunset: warm cream / deep ember
    sunset: {
      light: 'bg-gradient-to-br from-[#fff8f0] via-[#fff5ec] to-[#fff2e8]',
      dark:  'bg-gradient-to-b from-[#1a0a00] via-[#200d00] to-[#1c0a00]',
    },
    // Neon: pure dark (always)
    neon: {
      light: 'bg-[#0a0018]',
      dark:  'bg-[#06000f]',
    },
  };
  const themeBg = themeBgByMode[userTheme]?.[effectiveDark ? 'dark' : 'light'] ?? themeBgByMode.classic[effectiveDark ? 'dark' : 'light'];

const renderLandingBackground = () => {
    switch (userTheme) {
      case 'aurora':   return <AuroraBg dark={effectiveDark} />;
      case 'midnight': return <MidnightBg dark={effectiveDark} />;
      case 'terminal': return <TerminalBg dark={effectiveDark} />;
      case 'ocean':    return <SilkBg color={effectiveDark ? '#0ea5e9' : '#22d3ee'} dark={effectiveDark} />;
      case 'sunset':   return <SunsetBg dark={effectiveDark} />;
      case 'paper':    return <PaperBg dark={effectiveDark} />;
      case 'neon':     return <NeonBg dark={effectiveDark} />;
      default: return null;
    }
  };

  const rootBgClass = themeBg;

  return (
    <div
      className={`flex flex-col relative ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : 'font-sans'} ${rootBgClass} overflow-hidden`}
      style={{ minWidth: '100vw', width: '100%', height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {view !== 'admin-portal' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          style={{ minWidth: '100%', minHeight: '100%' }}
        >
          {view === 'landing' ? (
            renderLandingBackground()
          ) : (
            <div className="absolute inset-0 w-full h-full scale-110 opacity-40">
              {renderLandingBackground()}
            </div>
          )}
        </div>
      )}
      {view !== 'admin-portal' && (
        <header className="h-14 md:h-16 shrink-0 flex items-center justify-between px-4 z-[100] border-b border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-950 safe-pt relative">
          <div className="flex items-center gap-2 cursor-pointer group/logo tap-target" onClick={() => window.location.hash = user ? 'home' : ''}>
            <img src="/favicon.svg" alt="Logo" className="w-8 h-8 rounded-lg shadow-lg transition-transform duration-200 group-hover/logo:scale-105" />
            <h1 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white hidden xs:block">{t.appName}</h1>
          </div>
          {user && WORKSPACE_VIEWS.includes(view) && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl absolute left-1/2 -translate-x-1/2 shadow-sm border border-black/[0.06] dark:border-white/[0.06] z-50 transition-all duration-300 top-[3.75rem] md:top-1/2 md:-translate-y-1/2 w-max max-w-[90vw] overflow-x-auto no-scrollbar">
              <NavTab active={view === 'chat' || view === 'translator'} icon="fa-message" label={t.reasoning} onClick={() => handleStartWorkspace('', 'chat')} />
              <NavTab active={view === 'art'} icon="fa-palette" label={t.creative} onClick={() => handleStartWorkspace('', 'studio')} />
              <NavTab active={view === 'camera'} icon="fa-camera" label={t.vision} onClick={() => handleStartWorkspace('', 'vision')} />
              <NavTab active={view === 'voice'} icon="fa-microphone" label={t.voice} onClick={() => handleStartWorkspace('', 'voice')} />
              <NavTab
                active={view === 'math'}
                icon="fa-calculator"
                label={`${t.maths} (Beta)`}
                onClick={() => handleStartWorkspace('', 'maths')}
              />
              <NavTab
                active={view === 'agent'}
                icon="fa-robot"
                label="Agent"
                onClick={() => handleStartWorkspace(globalPrompt, 'agent')}
              />
              <NavTab
                active={view === 'community'}
                icon="fa-fire"
                label="Creations"
                onClick={() => { window.location.hash = 'community'; }}
              />

            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next: ThemeMode = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
                setTheme(next);
                cacheService.set(CacheKey.THEME, next);
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-500"
              aria-label={theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'Auto (by time)'}
              title={theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}
            >
              <i className={`fa-solid ${theme === 'light' ? 'fa-sun' : theme === 'dark' ? 'fa-moon' : 'fa-circle-half-stroke'}`} />
            </button>
            <button onClick={() => setLang(l => { const next = l === 'en' ? 'si' : l === 'si' ? 'ta' : 'en'; cacheService.set(CacheKey.LANG, next); return next; })} className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2 border border-slate-200 dark:border-white/5 rounded-full py-1.5">{lang === 'en' ? 'සිංහල' : lang === 'si' ? 'தமிழ்' : 'English'}</button>
            {user ? (
              <button onClick={() => window.location.hash = 'account'} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden flex items-center justify-center border-2 border-emerald-500/30 shadow-sm tap-target ring-2 ring-emerald-400/20" title="Signed in">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="font-bold text-xs text-slate-500">{user.name[0]}</span>}
              </button>
            ) : (
              <button onClick={() => window.location.hash = 'account'} className="px-4 py-2 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest tap-target shadow-md hover:bg-indigo-500 transition-colors">Sign In</button>
            )}
          </div>
        </header>
      )}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div key={view} className="flex-1 flex flex-col min-h-0 view-enter">
          <Suspense fallback={<PageFallback />}>
            {renderContent()}
          </Suspense>
        </div>
      </main>

      {/* Upgrade Greeting Popup */}
      {upgradePopup && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setUpgradePopup(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 dark:border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <i className="fa-solid fa-crown text-white text-2xl" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
              {upgradePopup.plan?.includes('pro') ? '🎉 Welcome to Pro!' : '🎉 Welcome to Basic!'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {upgradePopup.plan?.includes('pro')
                ? 'You now have unlimited access to all Orin AI features. Enjoy the full experience!'
                : 'You now have enhanced access to Orin AI. More chats, more generations!'}
            </p>
            <button onClick={() => setUpgradePopup(null)} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-colors">
              Let's Go!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
