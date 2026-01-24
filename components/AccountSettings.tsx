
import React, { useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { firebaseService } from '../services/firebaseService';
import { subscriptionService } from '../services/subscriptionService';
import { UserAccount, Language, UserTier } from '../types';
import { translations } from '../translations';

interface AccountSettingsProps {
  onClose: () => void;
  lang: Language;
  onUserUpdate: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ onClose, lang, onUserUpdate }) => {
  const t = translations[lang];
  const [user, setUser] = useState<UserAccount | null>(geminiService.getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Memory Override States
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState(user?.neuralBio || "");

  useEffect(() => {
    if (user) setTempBio(user.neuralBio || "");
  }, [user]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const googleUser = await firebaseService.loginWithGoogle();
      const { history: cloudHistory, bio: cloudBio } = await firebaseService.getUserData(googleUser.uid);
      
      const newUser: UserAccount = {
        id: googleUser.uid,
        name: googleUser.displayName || "Orin User",
        email: googleUser.email || "user@orin.ai",
        avatar: googleUser.photoURL || undefined,
        tier: 'Verified Member',
        plan: 'free',
        neuralBio: cloudBio || "",
        usage: { prompts: 0, images: 0, videos: 0, lastReset: new Date() }
      };

      await subscriptionService.syncUser(newUser);

      try {
        const sub = await subscriptionService.getUserSubscription(newUser.id);
        if (sub) {
            newUser.subscription = sub;
            if (sub.plan?.name) newUser.tier = sub.plan.name as UserTier;
        }
      } catch (e) {}

      geminiService.setSessionUser(newUser);
      setUser(newUser);
      onUserUpdate();
    } catch (err: any) {
      setError(err.message || "Connection to Google failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    setLoading(true);
    try {
        const updatedUser = { ...user, neuralBio: tempBio };
        // Save to Cloud immediately
        // History is empty here because we just want to update the bio doc
        const { history } = await firebaseService.getUserData(user.id);
        await firebaseService.saveUserData(user.id, history, tempBio);
        
        // Update Local State
        geminiService.setSessionUser(updatedUser);
        setUser(updatedUser);
        setIsEditingBio(false);
        onUserUpdate();
        alert(lang === 'si' ? "මතකය සාර්ථකව සුරැකිණි!" : "Memory Core updated successfully!");
    } catch (e) {
        setError("Failed to sync memory.");
    } finally {
        setLoading(false);
    }
  };

  const confirmSignOut = async () => {
    await geminiService.logout();
    setUser(null);
    onUserUpdate();
    setShowSignOutConfirm(false);
  };

  const enableNotifications = async () => {
    setError(null);
    try {
      const token = await firebaseService.requestPermission();
      if (token) {
        setFcmToken(token);
        firebaseService.simulateLocalNotification(
          lang === 'si' ? "දැනුම්දීම් සක්‍රීයයි!" : "Notifications Active!",
          "Orin AI is now connected to your device."
        );
      }
    } catch (e: any) {
      setError(e.message || "Failed to enable notifications.");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal h-[100dvh] overflow-hidden">
      
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade">
          <div className="max-w-sm w-full glass-panel p-8 md:p-10 rounded-[40px] border border-white/10 shadow-2xl space-y-8 animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl mx-auto flex items-center justify-center text-red-500"><i className="fa-solid fa-triangle-exclamation text-2xl"></i></div>
            <div className="text-center space-y-2">
               <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirm Sign Out?</h3>
               <p className="text-xs font-bold text-slate-500 dark:text-slate-400">All local cache will be cleared.</p>
            </div>
            <div className="flex flex-col gap-3">
               <button onClick={confirmSignOut} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Sign Out Now</button>
               <button onClick={() => setShowSignOutConfirm(false)} className="w-full py-4 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <header className="shrink-0 h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl"><i className="fa-solid fa-id-card text-xl"></i></div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.profile}</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Identity Hub</p>
          </div>
        </div>
        <button onClick={onClose} className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all duration-300"><i className="fa-solid fa-xmark text-xl"></i></button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 px-6 py-12">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-10">
          
          {loading && (
             <div className="fixed inset-0 z-[130] bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}

          {!user ? (
            <div className="w-full space-y-12 animate-scale-in">
               <div className="text-center space-y-6">
                 <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[32px] mx-auto flex items-center justify-center shadow-2xl border border-black/5 dark:border-white/10"><img src="https://www.google.com/favicon.ico" alt="G" className="w-10 h-10" /></div>
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Authentication</h3>
               </div>
               <div className="glass-panel p-10 md:p-14 rounded-[48px] border border-black/5 dark:border-white/5 shadow-2xl flex flex-col items-center gap-8">
                  <button onClick={handleGoogleLogin} className="w-full max-w-sm py-5 rounded-[24px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4"><i className="fa-brands fa-google text-lg"></i><span>Sign in with Google</span></button>
                  {error && <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-500 text-center animate-bounce-subtle">{error}</div>}
               </div>
            </div>
          ) : (
            <div className="w-full space-y-10 animate-reveal pb-20">
              {/* Profile Card */}
              <div className="glass-panel p-8 md:p-12 rounded-[48px] border border-black/5 dark:border-white/5 flex flex-col items-center gap-6 shadow-xl relative overflow-hidden bg-white/40 dark:bg-slate-900/40">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-500/5 to-transparent"></div>
                <div className="relative">
                  <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-cyan-500 to-indigo-500">
                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff`} className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-900" />
                  </div>
                  <div className="absolute bottom-1 right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center text-white"><i className="fa-solid fa-check text-[10px]"></i></div>
                </div>
                <div className="text-center space-y-2 relative z-10">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.name}</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">{user.email}</p>
                  <div className="inline-block mt-2 px-4 py-1.5 bg-cyan-500/10 rounded-lg"><span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.2em]">{user.tier}</span></div>
                </div>
              </div>

              {/* MEMORY CORE - NEW SECTION */}
              <div className="glass-panel p-8 rounded-[40px] border border-black/5 dark:border-white/5 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-600"><i className="fa-solid fa-brain"></i></div>
                      <div>
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Neural Memory Core</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase">What Orin remembers about you</p>
                      </div>
                   </div>
                   {!isEditingBio && (
                      <button onClick={() => setIsEditingBio(true)} className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 transition-all border border-transparent hover:border-black/5 dark:hover:border-white/10">Manual Override</button>
                   )}
                </div>

                {isEditingBio ? (
                  <div className="space-y-4 animate-reveal">
                     <textarea 
                       value={tempBio}
                       onChange={(e) => setTempBio(e.target.value)}
                       placeholder="Enter facts for Orin to remember (Name, work, hobbies, preferences)..."
                       className="w-full h-44 p-6 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-3xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none sinhala-text"
                     />
                     <div className="flex gap-2">
                        <button onClick={handleSaveBio} className="flex-1 py-4 bg-violet-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg shadow-violet-500/20 active:scale-95 transition-all">Update Memory</button>
                        <button onClick={() => { setIsEditingBio(false); setTempBio(user.neuralBio || ""); }} className="px-6 py-4 bg-slate-200 dark:bg-white/5 text-slate-500 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] active:scale-95 transition-all">Cancel</button>
                     </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50/50 dark:bg-black/20 rounded-3xl border border-black/5 dark:border-white/5">
                     <p className={`text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium italic ${/[^\u0000-\u007F]/.test(user.neuralBio || "") ? 'sinhala-text' : ''}`}>
                        {user.neuralBio || "Memory is currently empty. Start chatting to build your persona or click 'Manual Override' to add facts."}
                     </p>
                  </div>
                )}
              </div>

              {/* Usage Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-6 rounded-[32px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{user.usage?.prompts || 0}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sessions</span>
                </div>
                <div className="glass-panel p-6 rounded-[32px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{user.usage?.images || 0}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Assets</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <button onClick={enableNotifications} className="w-full py-5 rounded-[24px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"><i className="fa-solid fa-bell"></i>{fcmToken ? "Active" : "Enable Alerts"}</button>
                <button onClick={() => setShowSignOutConfirm(true)} className="w-full py-5 rounded-[24px] bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/10 transition-all duration-300 flex items-center justify-center gap-3"><i className="fa-solid fa-power-off text-sm"></i><span className="text-[10px] font-black uppercase tracking-[0.2em]">Disconnect Session</span></button>
              </div>
              
              {error && <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-500 text-center">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
