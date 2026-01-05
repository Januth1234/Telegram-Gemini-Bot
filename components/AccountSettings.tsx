
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const newUser = await geminiService.loginWithGoogle();
      setUser(newUser);
      onUserUpdate();
    } catch (err: any) {
      setAuthError(err.message || "Connection protocol failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    geminiService.logout();
    setUser(null);
    onUserUpdate();
  };

  const isSi = lang === 'si';

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
            <i className="fa-solid fa-id-card-clip text-sm md:text-base"></i>
          </div>
          <div>
            <h2 className="text-base md:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{t.profile}</h2>
            <p className="text-[7px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">Identity Hub</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      {/* Main Content Area - Optimized for Mobile Scrolling */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 overscroll-contain px-6">
        <div className="w-full max-w-4xl mx-auto py-12 md:py-24 flex flex-col items-center">
          
          {!user ? (
            <div className="w-full max-w-md space-y-12 animate-scale-in">
              <div className="text-center space-y-8">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-cyan-600 to-indigo-600 rounded-[32px] mx-auto flex items-center justify-center text-white text-3xl md:text-4xl shadow-2xl animate-neural border border-white/10">
                  <i className="fa-brands fa-google"></i>
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight">
                    {t.authenticate}
                  </h3>
                  <p className="text-sm md:text-lg font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    {t.loginDesc}
                  </p>
                </div>
              </div>

              <div className="glass-panel p-8 md:p-14 rounded-[40px] md:rounded-[56px] border border-black/5 dark:border-white/5 shadow-2xl space-y-10 bg-white/50 dark:bg-slate-900/50">
                <button 
                  onClick={handleLogin} 
                  disabled={isLoggingIn} 
                  className="group relative w-full py-6 md:py-7 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-[28px] font-black text-xs md:text-sm uppercase tracking-[0.25em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50 overflow-hidden"
                >
                  {isLoggingIn ? (
                    <i className="fa-solid fa-circle-notch animate-spin text-xl"></i>
                  ) : (
                    <>
                      <i className="fa-brands fa-google text-xl"></i>
                      <span>{isSi ? 'Google සමඟ සම්බන්ධ වන්න' : 'Secure Google Login'}</span>
                    </>
                  )}
                </button>

                <div className="text-center space-y-6">
                  <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
                    {isSi ? 'ඔබේ දත්ත ඔබ සතුව පමණි' : 'Privacy secured. Local-only.'}
                  </p>
                  <div className="flex justify-center gap-6 opacity-20">
                    <i className="fa-solid fa-shield-halved text-2xl"></i>
                    <i className="fa-solid fa-lock text-2xl"></i>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-10 animate-fade pb-20">
              {/* Profile Card */}
              <div className="glass-panel p-8 md:p-16 rounded-[48px] md:rounded-[64px] border border-black/5 dark:border-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-8 md:gap-12 bg-white/40 dark:bg-slate-900/40 relative overflow-hidden">
                <div className="relative">
                  <div className="absolute -inset-6 bg-cyan-500/20 rounded-full blur-3xl animate-soft-pulse"></div>
                  {user.avatar ? (
                    <img src={user.avatar} className="w-24 h-24 md:w-44 md:h-44 rounded-[32px] md:rounded-[48px] border-4 border-white dark:border-slate-800 shadow-2xl relative z-10" alt="Avatar" />
                  ) : (
                    <div className="w-24 h-24 md:w-44 md:h-44 rounded-[32px] md:rounded-[48px] bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-4xl md:text-6xl font-black shadow-2xl relative z-10">
                      {user.name[0]}
                    </div>
                  )}
                </div>
                <div className="text-center md:text-left space-y-5 flex-1 relative z-10">
                  <div className="space-y-2">
                    <h3 className="text-3xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-none uppercase">
                      {user.name}
                    </h3>
                    <p className="text-xs md:text-xl font-bold text-slate-500 dark:text-slate-400 truncate max-w-xs md:max-w-none">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                    <span className="px-4 py-1.5 bg-cyan-500 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-cyan-500/20">
                      <i className="fa-solid fa-circle-check mr-2"></i> Verified
                    </span>
                    <span className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-full">
                      {user.tier}
                    </span>
                  </div>
                </div>
              </div>

              {/* Setting Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal Bridge */}
                <div className="glass-panel p-8 md:p-10 rounded-[40px] md:rounded-[56px] border border-black/5 dark:border-white/5 space-y-8 flex flex-col justify-between hover-lift transition-all">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                        <i className="fa-solid fa-key text-xl"></i>
                      </div>
                      <div className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${hasApiKey ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
                        {hasApiKey ? 'Neural Bridge Active' : 'Bridge Inactive'}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Neural Bridge</h4>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        {isSi 
                          ? 'පුද්ගලික Gemini API යතුර මෙතැනින් සම්බන්ධ කරන්න. මෙය විශේෂිත 4K නිර්මාණ සඳහා පමණි.' 
                          : 'Connect personal key to unlock 4K production assets and high-intensity reasoning.'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <button onClick={handleSelectKey} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all">
                      {hasApiKey ? (isSi ? 'යතුර වෙනස් කරන්න' : 'Update Connection') : (isSi ? 'යතුර සම්බන්ධ කරන්න' : 'Connect Personal Key')}
                    </button>
                    <p className="text-center">
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[8px] font-black text-slate-400 uppercase tracking-widest hover:underline">Billing Documentation</a>
                    </p>
                  </div>
                </div>

                {/* Puter Core */}
                <div className="glass-panel p-8 md:p-10 rounded-[40px] md:rounded-[56px] border border-black/5 dark:border-white/5 space-y-8 flex flex-col justify-between hover-lift transition-all">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 animate-soft-pulse">
                        <i className="fa-solid fa-bolt text-xl"></i>
                      </div>
                      <div className="px-4 py-1 bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 rounded-full text-[8px] font-black uppercase tracking-widest">Puter Core Active</div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Puter Core (Free)</h4>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        {isSi 
                          ? 'සාමාන්‍ය පණිවිඩ සඳහා Puter Core ස්වයංක්‍රීයව භාවිතා වේ. මේ සඳහා ඔබට මුදලක් වැය නොවේ.' 
                          : 'Standard chat reasoning uses Puter’s managed AI core by default, preserving your personal quota.'}
                      </p>
                    </div>
                  </div>
                  <div className="p-5 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-between border border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></div>
                      <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Secure Sync Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-16 border-t border-black/5 dark:border-white/5 flex flex-col gap-6 items-center">
                <button onClick={handleLogout} className="px-16 py-5 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg">
                  {t.disconnect}
                </button>
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">© 2026 JN PRODUCTIONS GLOBAL • IDENTITY PROTOCOL</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
