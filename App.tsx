
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
import AboutModal from './components/AboutModal';
import VoiceAssistant from './components/VoiceAssistant';
import GetHelpMode from './components/GetHelpMode';
import MathsMode from './components/MathsMode';
import { ChatMessage, Language, AppView, WorkspaceMode, Conversation, UserAccount } from './types';
import { geminiService } from './services/geminiService';
import { firebaseService } from './services/firebaseService'; // Import Firebase Service
import { translations } from './translations';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('orin_lang') as Language) || 'en');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('orin_theme') as 'dark' | 'light') || 'dark');
  const t = translations[lang];

  const getInitialView = (): AppView => {
    const hash = window.location.hash.replace('#', '');
    const validViews: AppView[] = ['landing', 'chat', 'art', 'camera', 'voice', 'help', 'math', 'account', 'privacy', 'terms', 'releases', 'logic', 'creator', 'pricing'];
    
    if (validViews.includes(hash as AppView)) {
      return hash as AppView;
    }
    // Backward compatibility
    if (hash === 'workspace') return 'chat';
    return 'landing';
  };

  const [view, setView] = useState<AppView>(getInitialView());
  
  // Notification State
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const newView = getInitialView();
      setView(newView);
    };
    window.addEventListener('hashchange', handleHashChange);
    
    // Initialize Firebase Messaging Listener
    firebaseService.onForegroundMessage((payload) => {
      if (payload.notification) {
        setNotification({
          title: payload.notification.title,
          body: payload.notification.body
        });
        // Auto dismiss
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
  const [globalPrompt, setGlobalPrompt] = useState(() => localStorage.getItem('orin_draft_prompt') || '');
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSyncedWithCloud, setHasSyncedWithCloud] = useState(false);

  // Persistence: Conversations list
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('orin_history_v2');
    if (!saved) return [];
    try {
      return JSON.parse(saved).map((c: any) => ({
        ...c,
        timestamp: new Date(c.timestamp),
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      }));
    } catch { return []; }
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    return localStorage.getItem('orin_active_conv_id');
  });

  // Local Storage Sync
  useEffect(() => {
    try {
      localStorage.setItem('orin_history_v2', JSON.stringify(conversations));
    } catch (e) {
      console.warn("Local storage limit reached or failed:", e);
    }
  }, [conversations]);

  // Auth State Listener to keep UI in sync with Firebase
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChanged((authUser) => {
      if (authUser) {
         // Create a UserAccount object from the Firebase User
         const newUser: UserAccount = {
            id: authUser.uid,
            name: authUser.displayName || "User",
            email: authUser.email || "user@orin.ai",
            avatar: authUser.photoURL || undefined,
            tier: 'Verified Member',
            dailyUsage: { text: 0, images: 0, videos: 0 }
         };
         // Only update if ID changed to prevent loops
         if (user?.id !== newUser.id) {
           geminiService.setSessionUser(newUser);
           setUser(newUser);
         }
      } else {
        if (user) {
           setUser(null);
           geminiService.logout();
        }
        setHasSyncedWithCloud(false); // Reset sync status on logout
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Cloud Sync Logic
  // 1. Pull on login
  useEffect(() => {
    if (user?.id) {
      setIsSyncing(true);
      firebaseService.getHistory(user.id).then((cloudData) => {
        if (cloudData) {
          setConversations(prev => {
            // Revive dates just in case, though firebaseService.getHistory handles it now too.
            // Double robustness.
            const revivedCloud = cloudData.map((c: any) => ({
                ...c,
                timestamp: new Date(c.timestamp),
                messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
            }));

            // Merge Strategy: Combine Map by ID
            const combined = new Map();
            
            // Add existing local conversations
            prev.forEach(c => combined.set(c.id, c));
            
            // Merge/Overwrite with Cloud conversations
            revivedCloud.forEach((c: Conversation) => {
                const local = combined.get(c.id);
                // If cloud is newer (timestamp check), overwrite. 
                // If it doesn't exist locally, add it.
                if (!local || c.timestamp > local.timestamp) {
                    combined.set(c.id, c);
                }
            });
            
            // Return sorted list
            return Array.from(combined.values()).sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());
          });
        }
        setIsSyncing(false);
        setHasSyncedWithCloud(true); // Enable push sync only after successful pull
      });
    }
  }, [user?.id]);

  // 2. Push on change (Debounced)
  useEffect(() => {
    if (user?.id && hasSyncedWithCloud) {
      const timeout = setTimeout(() => {
         setIsSyncing(true);
         firebaseService.saveHistory(user.id, conversations).then(() => {
            setIsSyncing(false);
         });
      }, 2000); // Save after 2 seconds of inactivity (Faster for automatic feeling)
      return () => clearTimeout(timeout);
    }
  }, [conversations, user?.id, hasSyncedWithCloud]);


  useEffect(() => {
    if (activeConversationId) localStorage.setItem('orin_active_conv_id', activeConversationId);
    else localStorage.removeItem('orin_active_conv_id');
  }, [activeConversationId]);

  useEffect(() => {
    localStorage.setItem('orin_draft_prompt', globalPrompt);
  }, [globalPrompt]);

  useEffect(() => {
    localStorage.setItem('orin_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('orin_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const refreshUser = useCallback(() => {
    setUser(geminiService.getCurrentUser());
  }, []);

  const handleLogin = async () => {
    navigate('account');
  };

  const handleStartWorkspace = (prompt: string, mode: WorkspaceMode = 'chat', autoSubmit: boolean = false) => {
    setGlobalPrompt(prompt);
    setShouldAutoSubmit(autoSubmit);
    
    // Create new conversation on start if we are in landing
    if (view === 'landing') {
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
    }

    if (!geminiService.getCurrentUser() && geminiService.hasReachedLimit()) { 
      navigate('account'); 
      return;
    } 

    // Route to appropriate page based on mode
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
        ? { 
            ...c, 
            title: title || c.title, 
            timestamp: new Date(),
            modesUsed: modesUsed || c.modesUsed 
          } 
        : c
    ));
  };

  const handleSwitchConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversationId(id);
      setGlobalPrompt("");
      setShouldAutoSubmit(false);
      
      // Navigate to the mode saved in the conversation
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

  const activeMessages = conversations.find(c => c.id === activeConversationId)?.messages || [];

  const toggleLang = () => setLang(prev => prev === 'en' ? 'si' : 'en');
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const renderContent = () => {
    switch (view) {
      case 'chat':
      case 'art':
      case 'camera':
        // Determine initial mode for ChatWorkspace
        const workspaceMode: WorkspaceMode = view === 'art' ? 'studio' : view === 'camera' ? 'vision' : 'chat';
        return (
          <ChatWorkspace 
            onClose={() => { navigate('landing'); setShouldAutoSubmit(false); }} 
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
            isSyncing={isSyncing}
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
            <i className="fa-solid fa-bolt orin-icon text-sm"></i>
          </div>
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{t.appName}</h1>
        </div>

        <div className="flex items-center gap-3">
          {isSyncing && (
             <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <i className="fa-solid fa-cloud-arrow-up animate-pulse text-cyan-500 text-[10px]"></i>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{t.syncing}</span>
             </div>
          )}
          <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} orin-icon`}></i>
          </button>
          <button onClick={toggleLang} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 px-2">
            {t.langToggle}
          </button>
          <button 
            onClick={() => navigate('account')}
            className="flex items-center gap-3 px-4 h-10 rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-black/5 dark:border-white/5"
          >
            <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-800 overflow-hidden flex items-center justify-center border border border-black/5 dark:border-white/10">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="User avatar" /> : <i className="fa-solid fa-user orin-icon text-[9px]"></i>}
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
      
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-[160] max-w-sm w-full animate-slide-in-right">
          <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 shadow-2xl flex items-start gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
             <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
               <i className="fa-solid fa-bell"></i>
             </div>
             <div className="flex-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1">{notification.title}</h4>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-tight">{notification.body}</p>
             </div>
             <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
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
