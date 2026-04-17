
import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { UserAccount, Language, UserThemeId } from '../types';
import FilesWorkspace from './FilesWorkspace';
import AIProviderSettings from './AIProviderSettings';
import TaskScheduler from './TaskScheduler';
import { translations } from '../translations';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface AccountSettingsProps {
  onClose: () => void;
  lang: Language;
  user: UserAccount | null;
  onClearHistory: () => void;
  conversationsCount?: number;
  authError?: string | null;
  onDismissAuthError?: () => void;
  onSignInWithUser?: (authUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => Promise<void>;
  userTheme?: UserThemeId;
  onThemeChange?: (theme: UserThemeId) => void;
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
}

const MEMORY_MAX_LENGTH = 2000; // Keeps system instructions in chat() from bloating

const AccountSettings: React.FC<AccountSettingsProps> = ({ onClose, lang, user, onClearHistory, conversationsCount = 0, authError, onDismissAuthError, onSignInWithUser, userTheme = 'classic', onThemeChange, themeMode, onThemeModeChange }) => {
  const t = translations[lang];
  const [memory, setMemory] = useState("");
  const [settingsTab, setSettingsTab] = useState<'profile'|'ai'|'schedule'>('profile');
  const pairId = typeof window !== 'undefined' ? localStorage.getItem('orin_exec_pair_id') : null;
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ text: number; images: number; videos: number } | null>(null);

  useEffect(() => {
     if (user) {
        firebaseService.getUserMemory(user.id).then(m => setMemory(m.slice(0, MEMORY_MAX_LENGTH)));
        firebaseService.getUsage(user.id).then(setUsage);
     } else {
        setUsage(null);
     }
  }, [user]);

  const handleSaveMemory = async () => {
     if (user) {
        setLoading(true);
        const toSave = memory.slice(0, MEMORY_MAX_LENGTH);
        await firebaseService.updateUserMemory(user.id, toSave);
        if (memory.length > MEMORY_MAX_LENGTH) setMemory(toSave);
        setLoading(false);
     }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const fbUser = await firebaseService.loginWithGoogle();
      if (fbUser && onSignInWithUser) {
        await onSignInWithUser(fbUser);
      }
    } catch (err: any) {
      alert(err?.message || "Sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await firebaseService.logout();
    // onAuthStateChanged fires with null and clears geminiService / app state
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/5 dark:bg-black/60 flex flex-col animate-reveal h-[100dvh] overflow-hidden">
      <header className="shrink-0 h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 z-50">
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.profile}</h2>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 py-12">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-10">
          {authError && (
            <div className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-sm">
              <span className="flex-1">{authError}</span>
              {onDismissAuthError && <button type="button" onClick={onDismissAuthError} className="shrink-0 p-1 rounded-lg hover:bg-red-500/20" aria-label="Dismiss"><i className="fa-solid fa-xmark" /></button>}
            </div>
          )}
          {!user ? (
            <div className="w-full flex flex-col items-center text-center space-y-10 animate-scale-in">
               
               {/* Hero Icon */}
               <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500 blur-[60px] opacity-20 rounded-full"></div>
                  <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[32px] flex items-center justify-center shadow-2xl relative border border-slate-100 dark:border-white/10">
                     <i className="fa-solid fa-fingerprint text-5xl text-slate-800 dark:text-white"></i>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Sign In to Orin</h3>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Sync your neural workspace across devices and unlock professional reasoning tools.</p>
               </div>

               {/* Features Grid ("Ions and Stuff") */}
               <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-3 shadow-sm">
                     <i className="fa-solid fa-cloud-arrow-up text-indigo-500 text-xl"></i>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Cloud Sync</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-3 shadow-sm">
                     <i className="fa-solid fa-brain text-purple-500 text-xl"></i>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Long Term Memory</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-3 shadow-sm">
                     <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-xl"></i>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Studio Access</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-3 shadow-sm">
                     <i className="fa-solid fa-shield-halved text-emerald-500 text-xl"></i>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Private Mode</span>
                  </div>
               </div>

               <button onClick={handleGoogleLogin} disabled={loading} className="w-full py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
                  {loading ? (
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                  ) : (
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />
                  )}
                  <span>{loading ? "Connecting..." : "Continue with Google"}</span>
               </button>
               
               <p className="text-[10px] font-bold text-slate-400">By continuing, you agree to our Terms & Privacy Protocol.</p>
            </div>
          ) : (
            <div className="w-full">
            {/* Settings Tabs */}
            <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 mb-6">
              {([['profile','👤 Profile'],['ai','🔑 AI & Services'],['schedule','🕐 Scheduler']] as const).map(([id,label]) => (
                <button key={id} onClick={() => setSettingsTab(id)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    settingsTab===id ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                  {label}
                </button>
              ))}
            </div>

            {settingsTab === 'ai' && <div className="w-full text-slate-900 dark:text-slate-100"><AIProviderSettings /></div>}

            {settingsTab === 'schedule' && <div className="w-full text-slate-900 dark:text-slate-100"><TaskScheduler pairId={pairId} /></div>}

            {/* === Profile Tab === */}
            {settingsTab === 'profile' && <div className="w-full space-y-8">
              <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 flex flex-col items-center gap-4 text-center animate-reveal">
                 <div className="relative">
                    <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-xl object-cover" alt="Avatar" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-slate-800 rounded-full ring-2 ring-emerald-400/50" title="Signed in" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">{user.name}</h3>
                    <p className="text-sm font-mono text-slate-500">{user.email}</p>
                 </div>
                 <div className="px-4 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">{user.tier}</div>
              </div>

              {/* Memory Editor */}
              <div className="space-y-4 animate-reveal" style={{ animationDelay: '0.02s' }}>
                 <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <i className="fa-solid fa-memory text-indigo-500/80" />
                       Neural Memory
                    </label>
                    <div className="flex items-center gap-3">
                       <span className={`text-[10px] font-mono ${memory.length > MEMORY_MAX_LENGTH ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} aria-live="polite">
                          {memory.length} / {MEMORY_MAX_LENGTH}
                       </span>
                       <button onClick={handleSaveMemory} disabled={loading} className="text-[10px] font-bold text-indigo-600 hover:underline tap-target">{loading ? "Saving..." : "Save Changes"}</button>
                    </div>
                 </div>
                 <textarea 
                    value={memory} 
                    onChange={e => setMemory(e.target.value)} 
                    maxLength={MEMORY_MAX_LENGTH}
                    className="w-full h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-5 text-sm font-medium resize-none focus:ring-2 focus:ring-indigo-500 outline-none focus:outline-none shadow-inner transition-shadow duration-200 focus:shadow-md"
                    placeholder="Tell Orin what to remember about you (e.g. 'I am a software engineer', 'I prefer concise answers')..."
                    aria-describedby="memory-count"
                 />
                 <p id="memory-count" className="sr-only">Neural memory is limited to {MEMORY_MAX_LENGTH} characters so it can be used in every chat.</p>
              </div>

              {/* Light / dark mode — separate from visual theme */}
              {onThemeModeChange && (
                <div className="space-y-4 animate-reveal" style={{ animationDelay: '0.04s' }}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                    <i className="fa-solid fa-circle-half-stroke text-indigo-500/80" />
                    Light / dark
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: 'light' as ThemeMode, label: 'Light', desc: 'Always light.' },
                      { id: 'dark' as ThemeMode, label: 'Dark', desc: 'Always dark.' },
                      { id: 'auto' as ThemeMode, label: 'Auto', desc: 'Follow system or time of day.' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onThemeModeChange(m.id)}
                        className={`text-left p-4 rounded-2xl border text-xs space-y-1 transition-all duration-200 flex-1 min-w-[100px] ${
                          themeMode === m.id
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-md'
                            : 'border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:border-indigo-500/60 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                            {m.label}
                          </span>
                          {themeMode === m.id && <i className="fa-solid fa-check text-indigo-500 text-xs" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Workspace theme — visual skin (Classic, Midnight, etc.) */}
              <div className="space-y-4 animate-reveal" style={{ animationDelay: '0.05s' }}>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                  <i className="fa-solid fa-palette text-indigo-500/80" />
                  Workspace theme
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'classic', label: 'Classic', desc: 'Light + dark, balanced UI.' },
                    { id: 'midnight', label: 'Midnight', desc: 'Pure dark studio look.' },
                    { id: 'aurora', label: 'Aurora', desc: 'Gradient, glowing backdrop.' },
                    { id: 'terminal', label: 'Terminal', desc: 'Matrix rain hacker terminal.' },
                    { id: 'paper', label: 'Paper', desc: 'Soft, warm document feel.' },
                    { id: 'neon', label: 'Neon', desc: 'Cyberpunk glow. Neon lights, grid floor.' },
                    { id: 'ocean', label: 'Ocean', desc: 'Deep blue, calm focus.' },
                    { id: 'sunset', label: 'Sunset', desc: 'Warm amber and rose glow.' },
                  ].map((tDef) => {
                    const active = userTheme === (tDef.id as UserThemeId);
                    return (
                      <button
                        key={tDef.id}
                        type="button"
                        onClick={() => onThemeChange && onThemeChange(tDef.id as UserThemeId)}
                        className={`text-left p-4 rounded-2xl border text-xs space-y-1 transition-all duration-200 ${
                          active
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-md'
                            : 'border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:border-indigo-500/60 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                            {tDef.label}
                          </span>
                          {active && <i className="fa-solid fa-check text-indigo-500 text-xs" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{tDef.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Activity: total counts with light animations */}
              <div className="w-full space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Activity</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center gap-2 animate-reveal hover:border-indigo-500/20 hover:shadow-md transition-all duration-200" style={{ animationDelay: '0.05s' }}>
                        <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{conversationsCount}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Chats</span>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center gap-2 animate-reveal hover:border-indigo-500/20 hover:shadow-md transition-all duration-200" style={{ animationDelay: '0.1s' }}>
                        <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{usage ? usage.images + usage.videos : user.dailyUsage.images + user.dailyUsage.videos}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Creations (30 days)</span>
                    </div>
                 </div>
              </div>

              {/* File Library */}
              <div className="pt-4 border-t border-black/5 dark:border-white/5 w-full animate-reveal" style={{ animationDelay: '0.09s' }}>
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1 mb-3">File Library</h4>
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10" style={{ minHeight: 420 }}>
                  <FilesWorkspace onClose={() => {}} lang={lang} user={user} />
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-black/5 dark:border-white/5 w-full space-y-4 animate-reveal" style={{ animationDelay: '0.08s' }}>
                 <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">Danger Zone</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <button onClick={onClearHistory} className="py-4 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-red-500 hover:text-white transition-all duration-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 tap-target">
                        Delete History
                    </button>
                    <button onClick={handleLogout} className="py-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 text-[10px] font-black uppercase tracking-widest tap-target">
                        Sign Out
                    </button>
                 </div>
              </div>

            </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
