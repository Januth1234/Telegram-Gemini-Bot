
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import GetHelpMode from './components/GetHelpMode';
import MathsMode from './components/MathsMode';
import { ChatMessage, Language, AppView, WorkspaceMode, Conversation, UserAccount } from './types';
import { geminiService } from './services/geminiService';
import { firebaseService } from './services/firebaseService';
import { cacheService, CacheKey } from './services/cacheService';
import { translations } from './translations';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => cacheService.get<Language>(CacheKey.LANG, 'en'));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => cacheService.get<string | null>(CacheKey.THEME, null) as any || 'light');

  const t = translations[lang];

  // Robust Dynamic Viewport Height System
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    window.visualViewport?.addEventListener('resize', setViewportHeight);
    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      window.visualViewport?.removeEventListener('resize', setViewportHeight);
    };
  }, []);

  const getInitialView = (): AppView => {
    const hash = window.location.hash.replace('#', '').split('?')[0];
    const validViews: AppView[] = ['landing', 'chat', 'art', 'camera', 'voice', 'help', 'math', 'account', 'privacy', 'terms', 'releases', 'logic', 'creator', 'pricing', 'downloads'];
    return validViews.includes(hash as any) ? hash as AppView : 'landing';
  };

  const [view, setView] = useState<AppView>(getInitialView());
  const [user, setUser] = useState(geminiService.getCurrentUser());
  const [globalPrompt, setGlobalPrompt] = useState(() => cacheService.get<string>(CacheKey.DRAFT_PROMPT, ''));
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [hasSyncedWithCloud, setHasSyncedWithCloud] = useState(false);
  
  const saveTimeoutRef = useRef<number | null>(null);

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

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => cacheService.get<string | null>(CacheKey.ACTIVE_CONV, null));

  const navigate = (newView: AppView) => {
    window.location.hash = newView === 'landing' ? '' : newView;
    setView(newView); 
  };

  useEffect(() => {
    const handleHash = () => setView(getInitialView());
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Save to Local Storage & Cloud
  useEffect(() => {
    cacheService.set(CacheKey.HISTORY, conversations);
    if (activeConversationId) cacheService.set(CacheKey.ACTIVE_CONV, activeConversationId);
    else cacheService.remove(CacheKey.ACTIVE_CONV);

    if (user?.id) {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        setSyncStatus('syncing');
        firebaseService.saveHistory(user.id, conversations)
          .then(() => {
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
          })
          .catch(() => setSyncStatus('error'));
      }, 3000);
    }
  }, [conversations, activeConversationId, user?.id]);

  // Auth Listener & Cloud Merge
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChanged(async (authUser) => {
      if (authUser) {
         const newUser: UserAccount = { id: authUser.uid, name: authUser.displayName || "User", email: authUser.email || "user@orin.ai", avatar: authUser.photoURL || undefined, tier: 'Verified Member', dailyUsage: { text: 0, images: 0, videos: 0 } };
         
         // If switching users or logging in fresh
         if (user?.id !== newUser.id) { 
           geminiService.setSessionUser(newUser); 
           setUser(newUser);
           
           // Fetch Cloud History and Merge
           try {
             setSyncStatus('syncing');
             const cloudHistory = await firebaseService.getHistory(authUser.uid);
             if (cloudHistory && cloudHistory.length > 0) {
               setConversations(prevLocal => {
                 // Map by ID
                 const combinedMap = new Map<string, Conversation>();
                 [...prevLocal, ...cloudHistory].forEach(conv => {
                   const existing = combinedMap.get(conv.id);
                   // Keep the one with the later timestamp if conflict, otherwise add
                   if (!existing || new Date(conv.timestamp) > new Date(existing.timestamp)) {
                     combinedMap.set(conv.id, conv);
                   }
                 });
                 // Convert back to array and sort desc
                 return Array.from(combinedMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
               });
             }
             setHasSyncedWithCloud(true);
             setSyncStatus('success');
             setTimeout(() => setSyncStatus('idle'), 2000);
           } catch (e) {
             console.error("Sync merge failed", e);
             setSyncStatus('error');
           }
         }
      } else {
        if (user) { setUser(null); geminiService.logout(); }
        setHasSyncedWithCloud(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const cycleLanguage = () => {
    let next: Language = 'en';
    if (lang === 'en') next = 'si';
    else if (lang === 'si') next = 'ta';
    else next = 'en';
    setLang(next);
    cacheService.set(CacheKey.LANG, next);
  };

  const handleStartWorkspace = (prompt: string, mode: WorkspaceMode = 'chat', autoSubmit: boolean = false) => {
    setGlobalPrompt(prompt);
    setShouldAutoSubmit(autoSubmit);
    
    const activeConv = conversations.find(c => c.id === activeConversationId);
    
    // Only create new if we are on landing page OR the current active conversation has messages
    if (!activeConv || activeConv.messages.length > 0) {
      const newId = Date.now().toString();
      const newTitle = lang === 'si' ? "නව පිළිසඳර" : lang === 'ta' ? "புதிய அரட்டை" : "New Chat";
      
      setConversations(prev => [{ 
        id: newId, 
        title: newTitle, 
        messages: [], 
        timestamp: new Date(), 
        mode, 
        modesUsed: [mode] 
      }, ...prev]);
      setActiveConversationId(newId);
    } else {
      // Reuse empty conversation but update mode
      setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, mode, modesUsed: [...(c.modesUsed || []), mode] } : c));
    }

    const modeMap: Record<WorkspaceMode, AppView> = { studio: 'art', vision: 'camera', voice: 'voice', maths: 'math', gethelp: 'help', chat: 'chat', translator: 'chat' };
    navigate(modeMap[mode] || 'chat');
  };

  const activeMessages = conversations.find(c => c.id === activeConversationId)?.messages || [];

  const renderContent = () => {
    switch (view) {
      case 'chat':
      case 'art':
      case 'camera':
      case 'help':
      case 'math':
        const modeMapping: Record<AppView, WorkspaceMode> = {
          'art': 'studio', 'camera': 'vision', 'help': 'gethelp', 'math': 'maths', 'chat': 'chat',
          'landing': 'chat', 'voice': 'voice', 'account': 'chat', 'privacy': 'chat', 'terms': 'chat', 'releases': 'chat', 'logic': 'chat', 'creator': 'chat', 'pricing': 'chat', 'downloads': 'chat'
        };
        return (
          <ChatWorkspace 
            onClose={() => navigate('landing')} 
            hwStatus={{ mode: 'GPU', label: 'Ready' }} 
            initialPrompt={globalPrompt}
            initialMode={modeMapping[view]}
            autoSubmit={shouldAutoSubmit}
            onInputChange={setGlobalPrompt}
            messages={activeMessages}
            setMessages={(updater) => {
              if (!activeConversationId) return;
              setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, messages: typeof updater === 'function' ? updater(c.messages) : updater, timestamp: new Date() } : c));
            }}
            lang={lang}
            conversations={conversations}
            onSwitchConv={setActiveConversationId}
            onNewConv={() => handleStartWorkspace('', 'chat')}
            onDeleteConv={(id) => {
               setConversations(prev => {
                 const filtered = prev.filter(c => c.id !== id);
                 if (activeConversationId === id) setActiveConversationId(filtered[0]?.id || null);
                 // If all deleted, sync empty to cloud immediately if logged in
                 if (filtered.length === 0 && user?.id) firebaseService.saveHistory(user.id, []);
                 return filtered;
               });
            }}
            activeConvId={activeConversationId || ""}
            onUpdateTitle={(title, modes) => setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title, modesUsed: modes ? [...new Set([...(c.modesUsed || []), ...modes])] : c.modesUsed } : c))}
            onModeSwitch={(m) => setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, mode: m } : c))}
            isSyncing={syncStatus === 'syncing'}
          />
        );
      case 'voice': return <VoiceAssistant onClose={() => navigate('landing')} lang={lang} inline={false} />;
      case 'account': return <AccountSettings onClose={() => navigate('landing')} lang={lang} onUserUpdate={() => setUser(geminiService.getCurrentUser())} />;
      case 'privacy': return <PrivacyPage onClose={() => navigate('landing')} />;
      case 'terms': return <TermsPage onClose={() => navigate('landing')} />;
      case 'releases': return <ReleasesPage onClose={() => navigate('landing')} lang={lang} />;
      case 'logic': return <LogicFlowPage onClose={() => navigate('landing')} lang={lang} />;
      case 'creator': return <CreatorPage onClose={() => navigate('landing')} lang={lang} />;
      case 'pricing': return <PricingPage onClose={() => navigate('landing')} lang={lang} />;
      case 'downloads': return <DownloadsPage onClose={() => navigate('landing')} lang={lang} />;
      default: 
        return <LandingPage prompt={globalPrompt} onPromptChange={setGlobalPrompt} onStartChat={handleStartWorkspace} onVoiceOpen={() => handleStartWorkspace('', 'voice')} lang={lang} user={user} onLogin={async () => navigate('account')} />;
    }
  };

  return (
    <div 
      className={`w-screen flex flex-col ${lang === 'si' ? 'sinhala-text' : lang === 'ta' ? 'tamil-text' : 'font-sans'} bg-slate-50 dark:bg-slate-950 overflow-hidden relative`}
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      <header className="h-16 shrink-0 glass-panel sticky top-0 z-[100] px-4 md:px-12 flex items-center justify-between border-b border-black/5 dark:border-white/5 safe-pt">
        <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => navigate('landing')}>
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-bolt text-sm"></i></div>
          <h1 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{t.appName}</h1>
        </div>
        <div className="flex items-center gap-1.5 md:gap-3">
          {syncStatus !== 'idle' && (
             <div className="hidden tiny:flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <div className={`w-1 h-1 rounded-full ${syncStatus === 'syncing' ? 'bg-cyan-500 animate-pulse' : syncStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">{syncStatus === 'syncing' ? 'Sync' : syncStatus === 'success' ? 'Saved' : 'Err'}</span>
             </div>
          )}
          <button onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); cacheService.set(CacheKey.THEME, n); document.documentElement.classList.toggle('dark', n === 'dark'); }} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-slate-500"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i></button>
          <button onClick={cycleLanguage} className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 md:px-2 min-w-[60px] text-center border border-slate-200 dark:border-white/5 rounded-full py-1.5">
            {lang === 'en' ? 'සිංහල' : lang === 'si' ? 'தமிழ்' : 'English'}
          </button>
          
          <div className="flex items-center gap-2 pl-1">
            <button onClick={() => navigate('account')} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden flex items-center justify-center border border-black/5 dark:border-white/10 active:scale-95 transition-all shadow-sm">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-[10px] text-slate-400"></i>}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative flex flex-col">{renderContent()}</main>
    </div>
  );
};

export default App;
