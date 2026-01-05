
import React, { useState } from 'react';
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

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const newUser = await geminiService.loginWithGoogle();
      setUser(newUser);
      onUserUpdate();
    } catch (err: any) {
      alert("Sign-in failed. Please ensure you are logged into Puter.com");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    geminiService.logout();
    setUser(null);
    onUserUpdate();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-white dark:bg-slate-950 flex flex-col h-[100dvh] overflow-hidden animate-reveal">
      <header className="h-16 md:h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <h2 className="text-lg font-black uppercase tracking-tighter dark:text-white">{t.profile}</h2>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-10 overscroll-contain">
        <div className="max-w-2xl mx-auto space-y-12">
          {!user ? (
            <div className="text-center space-y-8 py-10">
              <div className="w-20 h-20 bg-cyan-600 rounded-[30px] mx-auto flex items-center justify-center text-white text-3xl shadow-2xl">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black uppercase tracking-tighter dark:text-white">{t.authenticate}</h3>
                <p className="text-sm font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">{t.loginDesc}</p>
              </div>
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoggingIn ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-brands fa-google"></i>}
                Connect with Puter
              </button>
            </div>
          ) : (
            <div className="space-y-10 animate-fade">
              <div className="p-8 rounded-[40px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center gap-8">
                {user.avatar ? (
                  <img src={user.avatar} className="w-24 h-24 rounded-[30px] shadow-xl" alt="P" />
                ) : (
                  <div className="w-24 h-24 rounded-[30px] bg-cyan-600 flex items-center justify-center text-white text-4xl font-black">{user.name[0]}</div>
                )}
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black uppercase tracking-tighter dark:text-white">{user.name}</h3>
                  <p className="text-sm font-bold text-slate-500">{user.email}</p>
                  <div className="mt-4 inline-block px-4 py-1.5 bg-cyan-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                    {user.tier}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-[32px] border border-slate-200 dark:border-white/5 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600"><i className="fa-solid fa-brain"></i></div>
                  <h4 className="text-sm font-black uppercase dark:text-white">Neural Core</h4>
                  <p className="text-[10px] font-bold text-slate-500">Standard chats use Puter's high-speed core. No personal key required.</p>
                </div>
                <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-[32px] border border-slate-200 dark:border-white/5 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600"><i className="fa-solid fa-shield-check"></i></div>
                  <h4 className="text-sm font-black uppercase dark:text-white">Privacy</h4>
                  <p className="text-[10px] font-bold text-slate-500">Your conversations are synced with your Puter account safely.</p>
                </div>
              </div>

              <button onClick={handleLogout} className="w-full py-4 border border-red-500/30 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                {t.disconnect}
              </button>
            </div>
          )}
          <p className="text-center text-[8px] font-black text-slate-400 uppercase tracking-[0.5em] pb-10">© 2026 ORIN NEURAL SYSTEM</p>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
