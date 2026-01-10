
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import { firebaseService } from '../services/firebaseService';
import { UserAccount, Language } from '../types';
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const googleUser = await firebaseService.loginWithGoogle();
      
      const newUser: UserAccount = {
        id: googleUser.uid,
        name: googleUser.displayName || "Orin User",
        email: googleUser.email || "user@orin.ai",
        avatar: googleUser.photoURL || undefined,
        tier: 'Verified Member',
        dailyUsage: { text: 0, images: 0, videos: 0 }
      };

      geminiService.setSessionUser(newUser);
      setUser(newUser);
      onUserUpdate();
    } catch (err: any) {
      console.error("Login failed", err);
      // Friendly error mapping
      let msg = "Connection to Google failed. Please try again.";
      if (err.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
      if (err.code === 'auth/popup-blocked') msg = "Popup blocked. Please allow popups for this site.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmSignOut = async () => {
    await geminiService.logout(); // This also calls firebaseService.logout() via update
    setUser(null);
    onUserUpdate();
    setShowSignOutConfirm(false);
  };

  const enableNotifications = async () => {
    const token = await firebaseService.requestPermission();
    if (token) {
      setFcmToken(token);
      alert(lang === 'si' ? "දැනුම්දීම් සක්‍රීයයි!" : "Notifications Enabled! Token generated.");
    } else {
      alert("Permission denied or failed to generate token.");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal h-[100dvh] overflow-hidden">
      
      {/* Sign Out Confirmation Modal Overlay */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade">
          <div className="max-w-sm w-full glass-panel p-8 md:p-10 rounded-[40px] border border-white/10 shadow-2xl space-y-8 animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl mx-auto flex items-center justify-center text-red-500">
               <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <div className="text-center space-y-2">
               <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirm Sign Out?</h3>
               <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Your session tokens will be purged. You will need to sign in again to access pro features.</p>
            </div>
            <div className="flex flex-col gap-3">
               <button 
                 onClick={confirmSignOut}
                 className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
               >
                 Sign Out Now
               </button>
               <button 
                 onClick={() => setShowSignOutConfirm(false)}
                 className="w-full py-4 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-white/20 active:scale-95 transition-all"
               >
                 Stay Logged In
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[100px] animate-soft-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] animate-soft-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Header */}
      <header className="shrink-0 h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl">
            <i className="fa-solid fa-id-card text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.profile}</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Identity Management</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all duration-300"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 px-6 py-12">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-10">
          
          {loading && (
             <div className="fixed inset-0 z-[130] bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}

          {!user ? (
            /* LOGIN STATE */
            <div className="w-full space-y-12 animate-scale-in">
               <div className="text-center space-y-6">
                 <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[32px] mx-auto flex items-center justify-center shadow-2xl border border-black/5 dark:border-white/10 relative group">
                    <div className="absolute inset-0 bg-cyan-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-10 h-10 relative z-10" />
                 </div>
                 <div className="space-y-3">
                   <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Authentication</h3>
                   <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Secure your neural workspace session</p>
                 </div>
               </div>

               <div className="glass-panel p-10 md:p-14 rounded-[48px] border border-black/5 dark:border-white/5 shadow-2xl flex flex-col items-center gap-8 bg-white/40 dark:bg-slate-900/40">
                  <div className="flex items-center gap-3 px-5 py-2 bg-emerald-500/5 rounded-full border border-emerald-500/10">
                    <i className="fa-solid fa-lock text-emerald-500 text-xs"></i>
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">End-to-End Encrypted</span>
                  </div>

                  {/* FIREBASE AUTH BUTTON */}
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full max-w-sm py-5 rounded-[24px] bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-sm uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                  >
                     <i className="fa-brands fa-google text-lg"></i>
                     <span>Sign in with Google</span>
                  </button>

                  {error && (
                    <div className="text-center animate-bounce-subtle">
                       <p className="text-xs font-bold text-red-500">{error}</p>
                    </div>
                  )}

                  <p className="text-[9px] text-center font-bold text-slate-400 max-w-xs leading-relaxed">
                    By continuing, you grant Orin access to your public profile and email for account identification purposes only via Firebase Authentication.
                  </p>
               </div>
            </div>
          ) : (
            /* LOGGED IN STATE */
            <div className="w-full space-y-8 animate-reveal">
              <div className="glass-panel p-8 md:p-12 rounded-[48px] border border-black/5 dark:border-white/5 flex flex-col items-center gap-6 shadow-xl relative overflow-hidden">
                {/* Decorative background blur inside card */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-500/5 to-transparent"></div>

                <div className="relative">
                  <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-cyan-500 to-indigo-500">
                    <img 
                      src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff`} 
                      alt="Profile" 
                      className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-900"
                    />
                  </div>
                  <div className="absolute bottom-1 right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-lg" title="Verified">
                    <i className="fa-solid fa-check text-[10px]"></i>
                  </div>
                </div>

                <div className="text-center space-y-2 relative z-10">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.name}</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">{user.email}</p>
                  <div className="inline-block mt-2 px-4 py-1.5 bg-cyan-500/10 rounded-lg">
                    <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.2em]">{user.tier}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-6 rounded-[32px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{user.dailyUsage.text}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Chats</span>
                </div>
                <div className="glass-panel p-6 rounded-[32px] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{user.dailyUsage.images}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Creations</span>
                </div>
              </div>
              
              <button
                onClick={enableNotifications}
                className="w-full py-5 rounded-[24px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <i className="fa-solid fa-bell"></i>
                Enable Notifications
              </button>
              
              {fcmToken && (
                  <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-2xl break-all">
                      <p className="text-[9px] font-mono text-slate-500">{fcmToken}</p>
                  </div>
              )}

              <button 
                onClick={() => setShowSignOutConfirm(true)}
                className="w-full py-5 rounded-[24px] bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/10 transition-all duration-300 flex items-center justify-center gap-3 group"
              >
                <i className="fa-solid fa-power-off text-sm transition-transform group-hover:scale-110"></i>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Disconnect Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
