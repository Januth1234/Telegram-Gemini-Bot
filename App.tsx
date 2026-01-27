
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
      
      // Update VH variable for 100vh calculation
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);

      // SCALING LOGIC:
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
        console.warn("Auth initialization timed out, falling back to guest mode.");
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
           
           // Sync History
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
      
      // 1. If user is logged in and visits root, redirect to chat
      if (user && (hash === '' || hash === '/')) {
         window.location.hash = 'chat';
         return;
      }

      // 2. Map specific hash '#home' to landing for logged in users
      if (hash === 'home') {
          setView('landing');
          return;
      }

      const validViews: AppView[] = ['landing', 'chat', 'art', 'camera', 'voice', 'math', 'account', 'privacy', 'terms', 'releases', 'logic', 'creator', 'pricing', 'downloads'];
      
      if (validViews.includes(hash as any)) {
          // 3. Security Check: Protect workspaces
          if (['chat', 'art', 'camera', 'voice', 'math'].includes(hash) && !user && authInitialized) {
              window.location.hash = ''; // Redirect guest to landing
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
    // FILTER: Only save conversations that actually have messages.
    // This prevents blank "New Chat" sessions from cluttering history/storage.
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
    
    // Switch or create chat logic
    const activeConv = conversations.find(c => c.id === activeConversationId);
    
    // Check if we can reuse the current empty conversation
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
        // Note: The useEffect will handle saving the updated list
        return next;
     });
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to delete all chat history? This cannot be undone.")) {
       setConversations([]);
       setActiveConversationId(null);
       cacheService.remove(CacheKey.HISTORY);
       cacheService.remove(CacheKey.ACTIVE_CONV);
       if (user?.id) {
           await firebaseService.saveHistory(user.id, []);
       }
       window.location.hash = 'chat';
    }
  };

  const NavTab = ({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${active ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
    >
      <i className={`fa-solid ${icon} text-xs`}></i>
      <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline-block">{label}</span>
    </button>
  );

  const renderContent = () => {
    // Magic Loading Screen - Orin AI
    if (!authInitialized) return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-slate-50 dark:bg-slate-950">
         <div className="relative">
            {/* Outer Orbital */}
            <div className="w-20 h-20 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
            {/* Inner Core */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-10 h-10 rounded-full bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.6)] animate-pulse"></div>
            </div>
            {/* Particles */}
            <div className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
         </div>
         <div className="text-center space-y-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Orin AI</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initializing...</p>
         </div>
      </div>
    );

    switch (view) {
      case 'chat': case 'art': case 'camera': case 'math':
        const modeMap: Record<AppView, WorkspaceMode> = { 'art': 'studio', 'camera': 'vision', 'math': 'maths', 'chat': 'chat', 'landing': 'chat', 'voice': 'voice', 'account': 'chat', 'privacy': 'chat', 'terms': 'chat', 'releases': 'chat', 'logic': 'chat', 'creator': 'chat', 'pricing': 'chat', 'downloads': 'chat' };
        return (
          <ChatWorkspace 
            // Closing a specific tool mode goes back to general chat
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
                  
                  // Resurrection Logic: If conversation was filtered out (empty), recreate it now that it has messages
                  if (!existing) {
                      const newConv: Conversation = {
                          id: activeConversationId,
                          title: "New Chat",
                          messages: newMessages,
                          timestamp: new Date(),
                          mode: modeMap[view],
                          modesUsed: [modeMap[view]]
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
      case 'voice': 
        // Closing voice mode goes back to chat
        return <VoiceAssistant onClose={() => window.location.hash = 'chat'} lang={lang} inline={false} />;
      case 'account': return <AccountSettings onClose={() => window.location.hash = 'chat'} lang={lang} user={user} onClearHistory={handleClearHistory} />;
      case 'privacy': return <PrivacyPage onClose={() => window.location.hash = 'chat'} />;
      case 'terms': return <TermsPage onClose={() => window.location.hash = 'chat'} />;
      case 'releases': return <ReleasesPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'logic': return <LogicFlowPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'creator': return <CreatorPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'pricing': return <PricingPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      case 'downloads': return <DownloadsPage onClose={() => window.location.hash = 'chat'} lang={lang} />;
      default: 
        return <LandingPage prompt={globalPrompt} onPromptChange={setGlobalPrompt} onStartChat={handleStartWorkspace} onVoiceOpen={() => handleStartWorkspace('', 'voice')} lang={lang} user={user} onLogin={() => window.location.hash = 'account'} />;
    }
  };

  return (
    <div className={`w-screen h-screen flex flex-col ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : 'font-sans'} bg-slate-50 dark:bg-slate-950 overflow-hidden`}>
      <header className="h-14 md:h-16 shrink-0 glass-panel flex items-center justify-between px-4 z-[100] border-b border-black/5 dark:border-white/5 safe-pt relative">
        {/* Logo redirect logic: If logged in -> Home, else -> Root */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.hash = user ? 'home' : ''}>
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-bolt text-xs"></i></div>
          <h1 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">{t.appName}</h1>
        </div>

        {/* TOP NAVIGATION BAR - Only show on workspace views, hide on informational pages (Downloads, Creator, etc.) */}
        {user && ['chat', 'art', 'camera', 'voice', 'math'].includes(view) && (
           <div className="hidden md:flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl absolute left-1/2 -translate-x-1/2 shadow-inner border border-black/5 dark:border-white/5 z-50">
              <NavTab active={view === 'chat'} icon="fa-message" label={t.reasoning} onClick={() => handleStartWorkspace('', 'chat')} />
              <NavTab active={view === 'art'} icon="fa-palette" label={t.creative} onClick={() => handleStartWorkspace('', 'studio')} />
              <NavTab active={view === 'camera'} icon="fa-camera" label={t.vision} onClick={() => handleStartWorkspace('', 'vision')} />
              <NavTab active={view === 'voice'} icon="fa-microphone" label={t.voice} onClick={() => handleStartWorkspace('', 'voice')} />
              <NavTab active={view === 'math'} icon="fa-calculator" label={t.maths} onClick={() => handleStartWorkspace('', 'maths')} />
           </div>
        )}

        <div className="flex items-center gap-2">
           {/* Landing Page Action Button for Logged In Users */}
           {user && view === 'landing' && (
              <button onClick={() => window.location.hash = 'chat'} className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md mr-2">
                 <span>Open Workspace</span>
                 <i className="fa-solid fa-arrow-right"></i>
              </button>
           )}

           {syncStatus !== 'idle' && user && (
             <div className="hidden tiny:flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5">
                <div className={`w-1 h-1 rounded-full ${syncStatus === 'syncing' ? 'bg-cyan-500 animate-pulse' : syncStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className="text-[7px] font-black uppercase tracking-widest">{syncStatus === 'syncing' ? 'Sync' : syncStatus === 'success' ? 'Saved' : 'Err'}</span>
             </div>
           )}
           <button onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); cacheService.set(CacheKey.THEME, n); document.documentElement.classList.toggle('dark', n === 'dark'); }} className="w-9 h-9 flex items-center justify-center text-slate-500"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i></button>
           <button onClick={() => setLang(l => l === 'en' ? 'si' : l === 'si' ? 'ta' : 'en')} className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2 border border-slate-200 dark:border-white/5 rounded-full py-1.5">{lang === 'en' ? 'සිංහල' : lang === 'si' ? 'தமிழ்' : 'English'}</button>
           
           {user ? (
             <button onClick={() => window.location.hash = 'account'} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden flex items-center justify-center border border-black/5 dark:border-white/10 shadow-sm active:scale-95 transition-all">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <span className="font-bold text-xs text-slate-500">{user.name[0]}</span>}
             </button>
           ) : (
             <button onClick={() => window.location.hash = 'account'} className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md">
                Sign In
             </button>
           )}
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative flex flex-col">{renderContent()}</main>
    </div>
  );
};

export default App;
