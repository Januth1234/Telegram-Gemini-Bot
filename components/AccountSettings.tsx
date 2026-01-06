
import React, { useState, useEffect, useRef } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const GOOGLE_CLIENT_ID = "989291286976-4fsle2vu6i7ik4273j6gfv8ii4futc7b.apps.googleusercontent.com";

  const handleCredentialResponse = (response: any) => {
    try {
      const payload = decodeJwt(response.credential);
      if (!payload || !payload.sub) {
        throw new Error("Identity handshake failed: Invalid payload.");
      }

      const googleUser: UserAccount = {
        id: payload.sub,
        name: payload.name || "Aura User",
        email: payload.email || "",
        avatar: payload.picture || "",
        tier: 'Verified Member',
        dailyUsage: { text: 0, images: 0, videos: 0 }
      };
      
      geminiService.setSessionUser(googleUser);
      setUser(googleUser);
      onUserUpdate();
      setError(null);
    } catch (err: any) {
      console.error("Auth Exception:", err);
      setError("Handshake failure. Please ensure your browser supports the Google Identity Protocol.");
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
      console.error("JWT Decode Error:", e);
      return null;
    }
  }

  useEffect(() => {
    let checkInterval: any;
    
    const initializeGSI = () => {
      const google = (window as any).google;
      if (google && google.accounts && google.accounts.id) {
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            context: 'signin'
          });

          if (googleBtnRef.current) {
            // Clear previous content to avoid duplicate buttons on re-renders
            googleBtnRef.current.innerHTML = "";
            google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "filled_blue",
              size: "large",
              width: 320,
              shape: "pill",
              logo_alignment: "left"
            });
            // Show One Tap prompt
            google.accounts.id.prompt();
          }
          setIsInitializing(false);
          if (checkInterval) clearInterval(checkInterval);
        } catch (e) {
          console.error("GSI Initialization Error:", e);
          setError("Identity services temporarily unreachable.");
          setIsInitializing(false);
        }
      }
    };

    if (user) {
      setIsInitializing(false);
    } else {
      // Periodically check for Google GSI script readiness if not already active
      checkInterval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          initializeGSI();
        }
      }, 500);

      // Immediate attempt in case it's already loaded
      initializeGSI();
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [user]);

  const handleLogout = () => {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
    geminiService.logout();
    setUser(null);
    onUserUpdate();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col animate-reveal h-[100dvh]">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-cyan-500/10 blur-[120px] rounded-full animate-soft-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full animate-soft-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <header className="shrink-0 h-16 md:h-24 glass-panel flex items-center justify-between px-6 md:px-12 border-b border-black/5 dark:border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-2xl">
            <i className="fa-solid fa-user-lock text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{t.profile}</h2>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Sign In to Neural Workspace</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-10 h-10 md:w-14 md:h-14 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-red-500 transition-all active:scale-95"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 px-6 overscroll-contain">
        <div className="w-full max-w-xl mx-auto py-12 md:py-24 flex flex-col items-center">
          
          {!user ? (
            <div className="w-full space-y-12 animate-scale-in">
              <div className="text-center space-y-8">
                <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[40px] mx-auto flex items-center justify-center shadow-2xl animate-neural border border-black/5 dark:border-white/10 relative">
                  <div className="absolute inset-0 bg-cyan-500/5 rounded-[40px] blur-2xl"></div>
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-12 h-12 relative z-10" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
                    Sign In
                  </h3>
                  <p className="text-sm md:text-xl font-bold text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Connect your Google Identity to access persistent neural memory and higher workspace limits.
                  </p>
                </div>
              </div>

              <div className="glass-panel p-10 md:p-14 rounded-[56px] border border-black/5 dark:border-white/5 shadow-2xl space-y-10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl min-h-[280px] flex flex-col items-center justify-center">
                {isInitializing ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Establishing Identity Tunnel...</span>
                  </div>
                ) : (
                  <div className="space-y-8 animate-reveal w-full flex flex-col items-center">
                    <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl w-full justify-center">
                      <i className="fa-solid fa-shield-check text-emerald-500"></i>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">End-to-End Encrypted Auth</span>
                    </div>

                    <div className="w-full flex justify-center py-4 min-h-[50px]">
                      {/* GSI Button Injection Target */}
                      <div ref={googleBtnRef} className="flex justify-center w-full"></div>
                    </div>
                    
                    <p className="text-[10px] text-center font-bold text-slate-400 leading-relaxed max-w-[280px] mx-auto">
                      Privacy Note: We only access your basic public profile to personalize your experience.
                    </p>
                  </div>
                )}
                
                {error && (
                  <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl animate-reveal mt-4">
                    <p className="text-[10px] font-black text-red-500 text-center uppercase tracking-[0.2em] leading-relaxed">
                      <i className="fa-solid fa-circle-exclamation mr-2"></i>
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-10 animate-reveal">
              <div className="flex flex-col items-center gap-8">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-[48px] md:rounded-[56px] bg-slate-200 dark:bg-white/10 overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl relative group">
                  {user.avatar ? (
                    <img src={user.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={user.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-5xl font-black">
                      {user.name.charAt(0)}
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-3">
                  <h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{user.name}</h3>
                  <p className="text-sm md:text-base font-bold text-slate-500 dark:text-slate-400">{user.email}</p>
                  <div className="inline-flex items-center gap-2 px-6 py-2 bg-cyan-600/10 border border-cyan-600/20 rounded-full text-[10px] font-black text-cyan-600 uppercase tracking-widest mt-4">
                    <i className="fa-solid fa-crown text-[8px]"></i> {user.tier}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Neural Queries" value={user.dailyUsage.text} icon="fa-message" />
                <StatCard label="Creative Syntheses" value={user.dailyUsage.images} icon="fa-wand-magic-sparkles" />
                <StatCard label="Cloud Archiving" value="Active" icon="fa-cloud-arrow-up" isText />
              </div>

              <div className="pt-12 space-y-4">
                <button 
                  onClick={handleLogout}
                  className="w-full py-6 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-4"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                  {t.disconnect}
                </button>
                <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest">Digital ID Node: {user.id}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; icon: string; isText?: boolean }> = ({ label, value, icon, isText }) => (
  <div className="glass-panel p-8 rounded-[36px] border border-black/5 dark:border-white/5 flex flex-col gap-4 hover:translate-y-[-2px] transition-all">
    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500">
      <i className={`fa-solid ${icon} text-lg`}></i>
    </div>
    <div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

export default AccountSettings;
