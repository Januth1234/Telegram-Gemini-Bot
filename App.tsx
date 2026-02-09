import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import LandingPage from './components/LandingPage';
import ChatWorkspace from './components/ChatWorkspace';
import AccountSettings from './components/AccountSettings';
import PrivacyPage from './components/PrivacyPage';
import TermsPage from './components/TermsPage';
import ReleasesPage from './components/ReleasesPage';
import LogicFlowPage from './components/LogicFlowPage';
import CreatorPage from './components/CreatorPage';
import PricingPage from './components/PricingPage';
import DownloadsPage from './components/DownloadsPage';
import VoiceAssistant from './components/VoiceAssistant';
import AdminPortal from './components/AdminPortal';
import TelegramBotPage from './components/TelegramBotPage';
import { ChatMessage, Language, AppView, WorkspaceMode, Conversation, UserAccount } from './types';
import { geminiService } from './services/geminiService';
import { firebaseService } from './services/firebaseService';
import { cacheService, CacheKey } from './services/cacheService';
import { translations } from './translations';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => cacheService.get<Language>(CacheKey.LANG, 'en'));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => cacheService.get<string | null>(CacheKey.THEME, null) as any || 'light');
  const t = translations[lang];

  // Global Auth State
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // App State
  const [view, setView] = useState<AppView>('landing');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

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

  // --- 1. AUTH INITIALIZATION & SYNC ---
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (!authInitialized) {
        console.warn("Auth initialization timed out.");
        setAuthInitialized(true);
      }
    }, 8000);

    const unsubscribe = firebaseService.onAuthStateChanged(async (authUser) => {
      clearTimeout(safetyTimeout);
      if (authUser) {
         try {
           const syncedUser = await firebaseService.syncUserSession(authUser.uid, authUser.email || "user@orin.ai", authUser.photoURL);
           geminiService.setSessionUser(syncedUser);
           setUser(syncedUser);
           setSyncStatus('syncing');
           const cloudHistory = await firebaseService.getHistory(authUser.uid);
           if (cloudHistory) mergeHistory(cloudHistory);
           setSyncStatus('success');
         } catch (e) {
           console.error("User Sync Failed", e);
           setSyncStatus('error');
         }
      } else {
        setUser(null);
        geminiService.logout();
      }
      setAuthInitialized(true);
    });
    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // --- 2. ROUTING LOGIC ---
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').split('?')[0];
      
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
      const validViews: AppView[] = ['landing', 'chat', 'art', 'camera', 'voice', 'math', 'account', 'privacy', 'terms', 'releases', 'logic', 'creator', 'pricing', 'downloads', 'admin-portal', 'telegram-bot'];
      if (validViews.includes(hash as any)) {
          if (['chat', 'art', 'camera', 'voice', 'math'].includes(hash) && !user && authInitialized) {
              window.location.hash = ''; 
              return;
          }
          setView(hash as AppView);
      } else {
          setView('landing');
      }
    };
    if (authInitialized) handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [user, authInitialized]);

  // --- 3. CONVERSATION STATE ---
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = cacheService.get<any[]>(CacheKey.HISTORY, []);
      return Array.isArray(saved) ? saved.map((c: any) => ({
        ...c, timestamp: new Date(c.timestamp), messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      })) : [];
    } catch { return []; }
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => cacheService.get<string | null>(CacheKey.ACTIVE_CONV, null));

  const saveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    const meaningfulConversations = conversations.filter(c => c.messages.length > 0);
    cacheService.set(CacheKey.HISTORY, meaningfulConversations);
    if (activeConversationId) cacheService.set(CacheKey.ACTIVE_CONV, activeConversationId);
    if (user?.id) {
       if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
       saveTimeoutRef.current = window.setTimeout(() => {
          setSyncStatus('syncing');
          firebaseService.saveHistory(user.id, meaningfulConversations).then(() => {
             setSyncStatus('success');
             setTimeout(() => setSyncStatus('idle'), 2000);
          }).catch(() => setSyncStatus('error'));
       }, 3000);
    }
  }, [conversations, activeConversationId, user?.id]);

  const mergeHistory = (cloudHistory: Conversation[]) => {
      setConversations(prev => {
         const combined = new Map();
         [...prev, ...cloudHistory].forEach(c => combined.set(c.id, c));
         return Array.from(combined.values()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
  };

  const handleStartWorkspace = (prompt: string, mode: WorkspaceMode = 'chat', autoSubmit: boolean = false) => {
    if (!user) {
        setGlobalPrompt(prompt);
        return; 
    }
    setGlobalPrompt(prompt);
    setShouldAutoSubmit(autoSubmit);
    const activeConv = conversations.find(c => c.id === activeConversationId);
    const canReuseActive = activeConv && activeConv.messages.length === 0 && activeConv.mode === mode;
    if (!canReuseActive) {
       const newId = Date.now().toString();
       setConversations(prev => [{ id: newId, title: "New Chat", messages: [], timestamp: new Date(), mode, modesUsed: [mode] }, ...prev]);
       setActiveConversationId(newId);
    }
    const modeMap: Record<WorkspaceMode, AppView> = { studio: 'art', vision: 'camera', voice: 'voice', maths: 'math', chat: 'chat', translator: 'chat' };
    window.location.hash = modeMap[mode];
  };

  const handleDeleteConversation = (id: string) => {
     setConversations(prev => {
        const next = prev.filter(c => c.id !== id);
        if (activeConversationId === id) setActiveConversationId(next[0]?.id || null);
        return next;
     });
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to delete all chat history?")) {
       setConversations([]);
       setActiveConversationId(null);
       cacheService.remove(CacheKey.HISTORY);
       cacheService.remove(CacheKey.ACTIVE_CONV);
       if (user?.id) await firebaseService.saveHistory(user.id, []);
       window.location.hash = 'chat';
    }
  };

  const NavTab = ({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${active ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
      <i className={`fa-solid ${icon} text-xs`}></i>
      <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline-block">{label}</span>
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
    if (view === 'telegram-bot') return <TelegramBotPage onClose={() => window.location.hash = 'home'} lang={lang} />;

    switch (view) {
      case 'chat': case 'art': case 'camera': case 'math':
        const modeMap: Record<AppView, WorkspaceMode> = { 'art': 'studio', 'camera': 'vision', 'math': 'maths', 'chat': 'chat', 'landing': 'chat', 'voice': 'voice', 'account': 'chat', 'privacy': 'chat', 'terms': 'chat', 'releases': 'chat', 'logic': 'chat', 'creator': 'chat', 'pricing': 'chat', 'downloads': 'chat', 'admin-portal': 'chat', 'telegram-bot': 'chat' };
        return (
          <ChatWorkspace 
            onClose={() => window.location.hash = 'chat'}
            hwStatus={{ mode: 'GPU', label: 'Ready' }} 
            initialPrompt={globalPrompt}
            initialMode={modeMap[view]}
            autoSubmit={shouldAutoSubmit}
            onInputChange={setGlobalPrompt}
            messages={conversations.find(c => c.id === activeConversationId)?.messages || []}
            setMessages={(updater) => {
               if(!activeConversationId) return;
               setConversations(prev => {
                  const existing = prev.find(c => c.id === activeConversationId);
                  const newMessages = typeof updater === 'function' ? updater(existing?.messages || []) : updater;
                  if (!existing) {
                      const newConv: Conversation = {
                          id: activeConversationId, title: "New Chat", messages: newMessages, timestamp: new Date(), mode: modeMap[view], modesUsed: [modeMap[view]]
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
            onModeSwitch={(m) => setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, mode: m } : c))}
            isSyncing={syncStatus === 'syncing'}
          />
        );
      case 'voice': return <VoiceAssistant onClose={() => window.location.hash = 'chat'} lang={lang} inline={false} />;
      case 'account': return <AccountSettings onClose={() => window.location.hash = 'chat'} lang={lang} user={user} onClearHistory={handleClearHistory} />;
      case 'privacy': return <PrivacyPage onClose={() => window.location.hash = 'chat'} />;
      case 'terms': return <TermsPage onClose={() => window.location.hash = 'chat'} />;
      case 'releases': return <ReleasesPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'logic': return <LogicFlowPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'creator': return <CreatorPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'pricing': return <PricingPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'downloads': return <DownloadsPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      default: return <LandingPage prompt={globalPrompt} onPromptChange={setGlobalPrompt} onStartChat={handleStartWorkspace} onVoiceOpen={() => handleStartWorkspace('', 'voice')} lang={lang} user={user} onLogin={() => window.location.hash = 'account'} />;
    }
  };

  return (
    <div className={`w-screen h-[100dvh] flex flex-col ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : 'font-sans'} bg-slate-50 dark:bg-slate-950 overflow-hidden`} style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {view !== 'admin-portal' && (
        <header className="h-14 md:h-16 shrink-0 glass-panel flex items-center justify-between px-4 z-[100] border-b border-black/5 dark:border-white/5 safe-pt relative">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.hash = user ? 'home' : ''}>
            <img src="favicon.svg" alt="Logo" className="w-8 h-8 rounded-lg shadow-lg" />
            <h1 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white hidden xs:block">{t.appName}</h1>
          </div>
          {user && ['chat', 'art', 'camera', 'voice', 'math'].includes(view) && (
            <div className="flex items-center bg-slate-100/90 dark:bg-white/5 backdrop-blur-md p-1 rounded-xl absolute left-1/2 -translate-x-1/2 shadow-inner border border-black/5 dark:border-white/5 z-50 transition-all duration-300 top-[3.75rem] md:top-1/2 md:-translate-y-1/2 w-max max-w-[90vw] overflow-x-auto no-scrollbar">
              <NavTab active={view === 'chat'} icon="fa-message" label={t.reasoning} onClick={() => handleStartWorkspace('', 'chat')} />
              <NavTab active={view === 'art'} icon="fa-palette" label={t.creative} onClick={() => handleStartWorkspace('', 'studio')} />
              <NavTab active={view === 'camera'} icon="fa-camera" label={t.vision} onClick={() => handleStartWorkspace('', 'vision')} />
              <NavTab active={view === 'voice'} icon="fa-microphone" label={t.voice} onClick={() => handleStartWorkspace('', 'voice')} />
              <NavTab active={view === 'math'} icon="fa-calculator" label={t.maths} onClick={() => handleStartWorkspace('', 'maths')} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); cacheService.set(CacheKey.THEME, n); document.documentElement.classList.toggle('dark', n === 'dark'); }} className="w-9 h-9 flex items-center justify-center text-slate-500"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i></button>
            <button onClick={() => setLang(l => l === 'en' ? 'si' : l === 'si' ? 'ta' : 'en')} className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2 border border-slate-200 dark:border-white/5 rounded-full py-1.5">{lang === 'en' ? 'සිංහල' : lang === 'si' ? 'தமிழ்' : 'English'}</button>
            {user ? (
              <button onClick={() => window.location.hash = 'account'} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden flex items-center justify-center border border-black/5 dark:border-white/10 shadow-sm active:scale-95 transition-all">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <span className="font-bold text-xs text-slate-500">{user.name[0]}</span>}
              </button>
            ) : (
              <button onClick={() => window.location.hash = 'account'} className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md">Sign In</button>
            )}
          </div>
        </header>
      )}
      <main className="flex-1 overflow-hidden relative flex flex-col">{renderContent()}</main>
    </div>
  );
};

export default App;