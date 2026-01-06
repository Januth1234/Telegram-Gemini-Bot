
import React, { useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
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
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize Google Sign-In Button
  useEffect(() => {
    if (!user && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: "989291286976-4fsle2vu6i7ik4273j6gfv8ii4futc7b.apps.googleusercontent.com",
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });
      (window as any).google.accounts.id.renderButton(
        document.getElementById("googleSignInDiv"),
        { theme: "outline", size: "large", width: "100%", shape: "pill", type: "standard" }
      );
    }
  }, [user]);

  const handleGoogleCredentialResponse = (response: any) => {
    try {
      const payload = decodeJwt(response.credential);
      const googleUser: UserAccount = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        avatar: payload.picture,
        tier: 'Verified Member',
        dailyUsage: { text: 0, images: 0, videos: 0 }
      };
      
      geminiService.setSessionUser(googleUser);
      setUser(googleUser);
      onUserUpdate();
    } catch (error) {
      console.error("Error parsing Google token", error);
      setAuthError("Failed to verify Google credentials.");
    }
  };

  function decodeJwt(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return {};
    }
  }

  const handleLogout = () => {
    if ((window as any).google) {
       (window as any).google.accounts.id.disableAutoSelect();
    }
    geminiService.logout();
    setUser(null);
    onUserUpdate();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal h-[100dvh]">
      {/* Immersive Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[60%] h-[60%] bg-cyan-500/10 blur-[140px] rounded-full animate-soft-pulse"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[60%] bg-indigo-500/10 blur-[140px] rounded-full animate-soft-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <header className="shrink-0 h-16 md:h-20 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 z-50">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg">
            <i className="fa-solid fa-user-shield text-sm md:text-base"></i>
          </div>
          <div>
            <h2 className="text-base md:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{t.profile}</h2>
            <p className="text-[7px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">Google Account</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 overscroll-contain px-6">
        <div className="w-full max-w-4xl mx-auto py-12 md:py-24 flex flex-col items-center">
          
          {!user ? (
            <div className="w-full max-w-md space-y-12 animate-scale-in">
              <div className="text-center space-y-8">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white dark:bg-white/10 rounded-full mx-auto flex items-center justify-center shadow-2xl animate-neural border border-black/5 dark:border-white/10">
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-10 h-10 md:w-12 md:h-12" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight">
                    Sign In
                  </h3>
                  <p className="text-sm md:text-lg font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Access your secure workspace using your Google Account.
                  </p>
                </div>
              </div>

              <div className="glass-panel p-8 md:p-14 rounded-[40px] md:rounded-[56px] border border-black/5 dark:border-white/5 shadow-2xl space-y-10 bg-white/50 dark:bg-slate-900/50">
                {/* Google Sign-In Button Container */}
                <div className="w-full flex justify-center min-h-[44px]">
                   <div id="googleSignInDiv" className="w-full flex justify-center"></div>
                </div>
                
                {authError && (
                   <p className="text-red-500 text-xs text-center font-bold animate-pulse">{authError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-10 animate-fade pb-20">
              {/* Profile Card */}
              <div className="glass-panel p-8 md:p-16 rounded-[48px] md:rounded-[64px] border border-black/5 dark:border-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-8 md:gap-12 bg-white/40 dark:bg-slate-900/40 relative overflow-hidden max-w-2xl mx-auto">
                <div className="relative">
                  <div className="absolute -inset-6 bg-cyan-500/20 rounded-full blur-3xl animate-soft-pulse"></div>
                  {user.avatar ? (
                    <img src={user.avatar} className="w-24 h-24 md:w-44 md:h-44 rounded-full border-4 border-white dark:border-slate-800 shadow-2xl relative z-10" alt="Avatar" />
                  ) : (
                    <div className="w-24 h-24 md:w-44 md:h-44 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-4xl md:text-6xl font-black shadow-2xl relative z-10">
                      {user.name[0]}
                    </div>
                  )}
                </div>
                <div className="text-center md:text-left space-y-5 flex-1 relative z-10">
                  <div className="space-y-2">
                    <h3 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                      {user.name}
                    </h3>
                    <p className="text-sm md:text-lg font-bold text-slate-500 dark:text-slate-400 break-all">
                      {user.email}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <i className="fa-solid fa-circle-check text-[10px]"></i>
                    <span className="text-[10px] font-black uppercase tracking-widest">Verified Account</span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-10 flex flex-col gap-6 items-center">
                <button onClick={handleLogout} className="px-16 py-5 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg">
                  {t.disconnect}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
