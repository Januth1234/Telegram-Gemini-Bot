
import React, { useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { firebaseService } from '../services/firebaseService';
import { UserAccount, Language } from '../types';
import { translations } from '../translations';

interface AccountSettingsProps {
  onClose: () => void;
  lang: Language;
  user: UserAccount | null;
  onClearHistory: () => void;
  conversationsCount?: number;
  authError?: string | null;
  onDismissAuthError?: () => void;
  onSignInWithUser?: (authUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => Promise<void>;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ onClose, lang, user, onClearHistory, conversationsCount = 0, authError, onDismissAuthError, onSignInWithUser }) => {
  const t = translations[lang];
  const [memory, setMemory] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ text: number; images: number; videos: number } | null>(null);

  useEffect(() => {
     if (user) {
        firebaseService.getUserMemory(user.id).then(setMemory);
        firebaseService.getUsage(user.id).then(setUsage);
     } else {
        setUsage(null);
     }
  }, [user]);

  const handleSaveMemory = async () => {
     if (user) {
        setLoading(true);
        await firebaseService.updateUserMemory(user.id, memory);
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
      await geminiService.logout();
      // Auth listener will reset state
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal h-[100dvh] overflow-hidden">
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
                  <div className="absolute inset-0 bg-cyan-500 blur-[60px] opacity-20 rounded-full"></div>
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
                     <i className="fa-solid fa-cloud-arrow-up text-cyan-500 text-xl"></i>
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
            <div className="w-full space-y-8 animate-reveal">
              <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 flex flex-col items-center gap-4 text-center">
                 <div className="relative">
                    <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-xl" alt="Avatar" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-slate-800 rounded-full"></div>
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">{user.name}</h3>
                    <p className="text-sm font-mono text-slate-500">{user.email}</p>
                 </div>
                 <div className="px-4 py-1 bg-cyan-500/10 text-cyan-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-cyan-500/20">{user.tier}</div>
              </div>

              {/* Memory Editor */}
              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <i className="fa-solid fa-memory"></i>
                       Neural Memory
                    </label>
                    <button onClick={handleSaveMemory} disabled={loading} className="text-[10px] font-bold text-cyan-600 hover:underline">{loading ? "Saving..." : "Save Changes"}</button>
                 </div>
                 <textarea 
                    value={memory} 
                    onChange={e => setMemory(e.target.value)} 
                    className="w-full h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-5 text-sm font-medium resize-none focus:ring-2 focus:ring-cyan-500 outline-none shadow-inner"
                    placeholder="Tell Orin what to remember about you (e.g. 'I am a software engineer', 'I prefer concise answers')..."
                 />
              </div>

              {/* Stats: real counts from Firestore + conversation list */}
              <div className="w-full space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Activity (Today)</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center gap-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{conversationsCount}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Chats</span>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center gap-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{usage ? usage.text : user.dailyUsage.text}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Messages</span>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center gap-2 col-span-2 md:col-span-1">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{usage ? usage.images + usage.videos : user.dailyUsage.images + user.dailyUsage.videos}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Creations</span>
                    </div>
                 </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-black/5 dark:border-white/5 w-full space-y-4">
                 <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">Danger Zone</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <button onClick={onClearHistory} className="py-4 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Delete History
                    </button>
                    <button onClick={handleLogout} className="py-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
                        Sign Out
                    </button>
                 </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
