
import React, { useState, useEffect, useCallback } from 'react';
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
import SitemapPage from './components/SitemapPage';
import AboutModal from './components/AboutModal';
import VoiceAssistant from './components/VoiceAssistant';
import GetHelpMode from './components/GetHelpMode';
import MathsMode from './components/MathsMode';
import { ChatMessage, Language, AppView, WorkspaceMode, Conversation, UserAccount } from './types';
import { geminiService } from './services/geminiService';
import { firebaseService } from './services/firebaseService';
import { cacheService, CacheKey } from './services/cacheService';
import { translations } from './translations';

const App: React.FC = () => {
  // Use CacheService for initial hydration
  const [lang, setLang] = useState<Language>(() => cacheService.get<Language>(CacheKey.LANG, 'en'));
  
  // Theme initialization with system preference fallback
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const cached = cacheService.get<string | null>(CacheKey.THEME, null);
    if (cached === 'dark' || cached === 'light') return cached as 'dark' | 'light';
    
    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const t = translations[lang];

  const getInitialView = (): AppView => {
    const hash = window.location.hash.replace('#', '').split('?')[0]; // Handle query params in hash
    const validViews: string[] = ['landing', 'chat', 'art', 'camera', 'voice', 'help', 'math', 'account', 'privacy', 'terms', 'releases', 'logic', 'creator', 'pricing', 'downloads', 'sitemap'];
    
    if (validViews.includes(hash)) return hash as AppView;
    if (hash === 'workspace') return 'chat';
    return 'landing';
  };

  const [view, setView] = useState<AppView>(getInitialView());
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

  // Parse Query Parameters for Developer API (e.g., ?prompt=hello)
  useEffect(() => {
    const handleUrlParams = () => {
      // Check both standard search params and hash params (since hash routing is used)
      let queryPrompt = "";
      
      // Method 1: Standard URL Search Params
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('prompt')) {
         queryPrompt = searchParams.get('prompt') || "";
      } 
      
      // Method 2: Hash based params (e.g. #chat?prompt=hello)
      if (!queryPrompt && window.location.hash.includes('?')) {
         const hashParts = window.location.hash.split('?');
         if (hashParts.length > 1) {
            const hashParams = new URLSearchParams(hashParts[1]);
            if (hashParams.has('prompt')) {
               queryPrompt = hashParams.get('prompt') || "";
            }
         }
      }

      if (queryPrompt) {
        setGlobalPrompt(decodeURIComponent(queryPrompt));
        setShouldAutoSubmit(true);
        // Clean URL without refresh
        const newUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, '', newUrl);
        
        // Ensure we end up in chat view if not already
        if (getInitialView() === 'chat' || getInitialView() === 'landing') {
           if (view !== 'chat') {
             navigate('chat');
             // Trigger auto-start logic for chat
             const newId = Date.now().toString();
             const newConv: Conversation = {
                id: newId,
                title: lang === 'si' ? "නව පිළිසඳර" : "New Chat",
                messages: [],
                timestamp: new Date(),
                mode: 'chat',
                modesUsed: ['chat']
             };
             setConversations(prev => [newConv, ...prev]);
             setActiveConversationId(newId);
           }
        }
      }
    };

    handleUrlParams();

    const handleHashChange = () => {
      const newView = getInitialView();
      setView(newView);
    };
    window.addEventListener('hashchange', handleHashChange);
    
    firebaseService.onForegroundMessage((payload) => {
      if (payload.notification) {
        setNotification({
          title: payload.notification.title,
          body: payload.notification.body
        });
        setTimeout(() => setNotification(null), 5000);
      }
    });

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (newView: AppView) => {
    window.location.hash = newView === 'landing' ? '' : newView;
    setView(newView); 
  };

  const [user, setUser] = useState(geminiService.getCurrentUser());
  const [showAbout, setShowAbout] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState(() => cacheService.get<string>(CacheKey.DRAFT_PROMPT, ''));
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [hasSyncedWithCloud, setHasSyncedWithCloud] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = cacheService.get<any[]>(CacheKey.HISTORY, []);
    try {
      return saved.map((c: any) => ({
        ...c,
        timestamp: new Date(c.timestamp),
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      }));
    } catch { return []; }
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    return cacheService.get<string | null>(CacheKey.ACTIVE_CONV, null);
  });

  // Effect to persist history on change
  useEffect(() => {
    const withMsgs = conversations.filter(c => c.messages.length > 0 || c.id === activeConversationId);
    cacheService.set(CacheKey.HISTORY, withMsgs);
  }, [conversations, activeConversationId]);

  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChanged((authUser) => {
      if (authUser) {
         const newUser: UserAccount = {
            id: authUser.uid,
            name: authUser.displayName || "User",
            email: authUser.email || "user@orin.ai",
            avatar: authUser.photoURL || undefined,
            tier: 'Verified Member',
            dailyUsage: { text: 0, images: 0, videos: 0 }
         };
         if (user?.id !== newUser.id) {
           geminiService.setSessionUser(newUser);
           setUser(newUser);
         }
      } else {
        if (user) {
           setUser(null);
           geminiService.logout();
        }
        setHasSyncedWithCloud(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      setSyncStatus('syncing');
      firebaseService.getHistory(user.id).then((cloudData) => {
        if (cloudData) {
          setConversations(prev => {
            const combined = new Map();
            prev.forEach(c => combined.set(c.id, c));
            cloudData.forEach((c: any) => {
                const local = combined.get(c.id);
                if (!local || c.timestamp > local.timestamp) combined.set(c.id, c);
            });
            return Array.from(combined.values()).sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());
          });
        }
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
        setHasSyncedWithCloud(true);
      }).catch(() => setSyncStatus('error'));
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && hasSyncedWithCloud) {
      const timeout = setTimeout(() => {
         const withMsgs = conversations.filter(c => c.messages.length > 0);
         if (withMsgs.length > 0) {
            setSyncStatus('syncing');
            firebaseService.saveHistory(user.id, withMsgs).then(() => {
               setSyncStatus('success');
               setTimeout(() => setSyncStatus('idle'), 3000);
            }).catch(() => setSyncStatus('error'));
         }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [conversations, user?.id, hasSyncedWithCloud]);


  useEffect(() => {
    if (activeConversationId) cacheService.set(CacheKey.ACTIVE_CONV, activeConversationId);
    else cacheService.remove(CacheKey.ACTIVE_CONV);
  }, [activeConversationId]);

  useEffect(() => {
    cacheService.set(CacheKey.DRAFT_PROMPT, globalPrompt);
  }, [globalPrompt]);

  useEffect(() => {
    cacheService.set(CacheKey.LANG, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Update theme and persist
  useEffect(() => {
    cacheService.set(CacheKey.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const refreshUser = useCallback(() => setUser(geminiService.getCurrentUser()), []);
  const handleLogin = async () => navigate('account');

  const handleStartWorkspace = (prompt: string, mode: WorkspaceMode = 'chat', autoSubmit: boolean = false) => {
    setGlobalPrompt(prompt);
    setShouldAutoSubmit(autoSubmit);
    
    const emptyConv = conversations.find(c => c.id === activeConversationId && c.messages.length === 0);
    
    if (view === 'landing' && !emptyConv) {
      const newId = Date.now().toString();
      const newConv: Conversation = {
        id: newId,
        title: lang === 'si' ? "නව පිළිසඳර" : "New Chat",
        messages: [],
        timestamp: new Date(),
        mode: mode,
        modesUsed: [mode]
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newId);
    } else if (emptyConv) {
        setConversations(prev => prev.map(c => c.id === emptyConv.id ? { ...c, mode, modesUsed: [mode] } : c));
    }

    if (!geminiService.getCurrentUser() && geminiService.hasReachedLimit()) { 
      navigate('account'); 
      return;
    } 

    let targetView: AppView = 'chat';
    if (mode === 'studio') targetView = 'art';
    else if (mode === 'vision') targetView = 'camera';
    else if (mode === 'voice') targetView = 'voice';
    else if (mode === 'maths') targetView = 'math';
    else if (mode === 'gethelp') targetView = 'help';
    
    navigate(targetView);
  };

  const handleUpdateActiveConversation = (title?: string, modesUsed?: WorkspaceMode[]) => {
    if (!activeConversationId) return;
    setConversations(prev => prev.map(c => 
      c.id === activeConversationId 
        ? { ...c, title: title || c.title, timestamp: new Date(), modesUsed: modesUsed || c.modesUsed } 
        : c
    ));
  };

  const handleSwitchConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversationId(id);
      setGlobalPrompt("");
      setShouldAutoSubmit(false);
      let targetView: AppView = 'chat';
      if (conv.mode === 'studio') targetView = 'art';
      else if (conv.mode === 'vision') targetView = 'camera';
      else if (conv.mode === 'maths') targetView = 'math';
      navigate(targetView);
    }
  };

  const handleNewConversation = () => {
    const newId = Date.now().toString();
    const newConv: Conversation = {
      id: newId,
      title: lang === 'si' ? "නව පිළිසඳර" : "New Chat",
      messages: [],
      timestamp: new Date(),
      mode: 'chat',
      modesUsed: ['chat']
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setGlobalPrompt("");
    setShouldAutoSubmit(false);
    navigate('chat');
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        if (filtered.length > 0) setActiveConversationId(filtered[0].id);
        else { setActiveConversationId(null); navigate('landing'); }
      }
      return filtered;
    });
  };

  const handleCloseWorkspace = useCallback(() => {
    if (activeConversationId) {
      const active = conversations.find(c => c.id === activeConversationId);
      if (active && active.messages.length === 0) handleDeleteConversation(activeConversationId);
    }
    navigate('landing');
    setShouldAutoSubmit(false);
  }, [activeConversationId, conversations, handleDeleteConversation]);

  const activeMessages = conversations.find(c => c.id === activeConversationId)?.messages || [];
  const toggleLang = () => setLang(prev => prev === 'en' ? 'si' : 'en');
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const renderContent = () => {
    switch (view) {
      case 'chat':
      case 'art':
      case 'camera':
        const workspaceMode: WorkspaceMode = view === 'art' ? 'studio' : view === 'camera' ? 'vision' : 'chat';
        return (
          <ChatWorkspace 
            onClose={handleCloseWorkspace} 
            hwStatus={{ mode: 'GPU', label: t.neuralCore }} 
            initialPrompt={globalPrompt}
            initialMode={workspaceMode}
            autoSubmit={shouldAutoSubmit}
            onInputChange={setGlobalPrompt}
            messages={activeMessages}
            setMessages={(updater) => {
              if (!activeConversationId) return;
              setConversations(prev => prev.map(c => {
                if (c.id === activeConversationId) {
                  const nextMessages = typeof updater === 'function' ? updater(c.messages) : updater;
                  return { ...c, messages: nextMessages, timestamp: new Date() };
                }
                return c;
              }));
            }}
            lang={lang}
            conversations={conversations}
            onSwitchConv={handleSwitchConversation}
            onNewConv={handleNewConversation}
            onDeleteConv={handleDeleteConversation}
            activeConvId={activeConversationId || ""}
            onUpdateTitle={handleUpdateActiveConversation}
            isSyncing={syncStatus === 'syncing'}
          />
        );
      case 'math': return <MathsMode onClose={() => navigate('landing')} lang={lang} />;
      case 'voice': return <VoiceAssistant onClose={() => navigate('landing')} lang={lang} inline={false} />;
      case 'help': return <GetHelpMode onClose={() => navigate('landing')} lang={lang} />;
      case 'account': return <AccountSettings onClose={() => navigate('landing')} lang={lang} onUserUpdate={refreshUser} />;
      case 'privacy': return <PrivacyPage onClose={() => navigate('landing')} />;
      case 'terms': return <TermsPage onClose={() => navigate('landing')} />;
      case 'releases': return <ReleasesPage onClose={() => navigate('landing')} lang={lang} />;
      case 'logic': return <LogicFlowPage onClose={() => navigate('landing')} lang={lang} />;
      case 'creator': return <CreatorPage onClose={() => navigate('landing')} lang={lang} />;
      case 'pricing': return <PricingPage onClose={() => navigate('landing')} lang={lang} />;
      case 'downloads': return <DownloadsPage onClose={() => navigate('landing')} lang={lang} />;
      case 'sitemap': return <SitemapPage onClose={() => navigate('landing')} lang={lang} />;
      default: 
        return (
          <LandingPage 
            prompt={globalPrompt}
            onPromptChange={setGlobalPrompt}
            onStartChat={(p, m) => handleStartWorkspace(p, m, !!p)} 
            onVoiceOpen={() => handleStartWorkspace('', 'voice', false)}
            lang={lang}
            user={user}
            onLogin={handleLogin}
          />
        );
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col transition-all duration-300 overflow-hidden ${lang === 'si' ? 'sinhala-text' : 'font-sans'} bg-slate-50 dark:bg-slate-950`}>
      <header className="h-16 glass-panel sticky top-0 z-[100] px-6 md:px-12 flex items-center justify-between border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('landing')}>
          <div className="w-8 h-8 rounded-lg bg-cyan-600 dark:bg-cyan-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <i className="fa-solid fa-bolt text-sm"></i>
          </div>
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{t.appName}</h1>
        </div>

        <div className="flex items-center gap-3">
          {syncStatus !== 'idle' && (
             <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${syncStatus === 'error' ? 'text-red-500' : syncStatus === 'success' ? 'text-emerald-500' : 'text-slate-500'}`}>
                  {syncStatus === 'syncing' ? t.syncing : syncStatus === 'success' ? t.synced : t.syncError}
                </span>
             </div>
          )}
          <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-cyan-600 dark:hover:cyan-400">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button onClick={toggleLang} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-600 dark:hover:cyan-400 px-2">
            {t.langToggle}
          </button>
          <button 
            onClick={() => navigate('account')}
            className="flex items-center gap-3 px-4 h-10 rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-black/5 dark:border-white/5"
          >
            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-black/5 dark:border-white/10">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="User" /> : <i className="fa-solid fa-user text-[9px]"></i>}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">
              {(user?.name || user?.email?.split('@')[0])?.split(' ')[0] || t.authenticate}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>
      
      {notification && (
        <div className="fixed top-20 right-6 z-[160] max-w-sm w-full animate-slide-in-right">
          <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 shadow-2xl flex items-start gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
             <div className="flex-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1">{notification.title}</h4>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-tight">{notification.body}</p>
             </div>
             <button onClick={() => setNotification(null)} className="text-slate-400">
               <i className="fa-solid fa-xmark"></i>
             </button>
          </div>
        </div>
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} lang={lang} />}
    </div>
  );
};

export default App;
