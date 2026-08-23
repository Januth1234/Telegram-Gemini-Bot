/**
 * OrinAuthPanel — first-party Orin AI account sign-in / registration.
 * Sign in with Name + Email-or-Phone + password (no SMS OTP; the identifier is
 * either an email address or a phone number in local/E.164 format).
 * Google sign-in remains available alongside this panel.
 */
import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService';

type Mode = 'login' | 'signup';

interface OrinAuthPanelProps {
  onSignedIn?: (authUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateIdentifier(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email or phone number.';
  if (v.includes('@')) return EMAIL_RE.test(v) ? null : 'That email address looks incomplete.';
  const digits = v.replace(/[\s()\-.]/g, '');
  if (!/^\+?\d{9,15}$/.test(digits)) return 'Enter a valid phone number (e.g. 0771234567 or +94771234567).';
  return null;
}

const inputCls = "w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow";

const OrinAuthPanel: React.FC<OrinAuthPanelProps> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(null); };

  const finalize = async () => {
    // onAuthStateChanged also fires, but the explicit callback guarantees the
    // full sync path runs even if the listener event races the custom-token exchange.
    const fbUser = firebaseService.currentUser();
    if (fbUser && onSignedIn) await onSignedIn(fbUser);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const idErr = validateIdentifier(identifier);
    if (idErr) { setError(idErr); return; }
    if (!password) { setError('Enter your password.'); return; }

    if (mode === 'signup') {
      if (name.trim().length < 2) { setError('Enter your name.'); return; }
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        setError('Password needs at least 8 characters with letters and numbers.');
        return;
      }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await firebaseService.loginWithPassword(identifier.trim(), password);
      } else {
        await firebaseService.registerWithPassword(name.trim(), identifier.trim(), password);
      }
      await finalize();
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5" role="tablist">
        {(['login', 'signup'] as const).map(m => (
          <button key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              mode === m ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
            {m === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3" noValidate>
        {mode === 'signup' && (
          <div>
            <label htmlFor="orin-name" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Name</label>
            <input id="orin-name" type="text" autoComplete="name" value={name} maxLength={60}
              onChange={e => setName(e.target.value)} className={inputCls}
              placeholder="Your name" disabled={busy} />
          </div>
        )}

        <div>
          <label htmlFor="orin-id" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Email or Phone</label>
          <input id="orin-id" type="text" autoComplete="username"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)} className={inputCls}
            placeholder={mode === 'signup' ? 'you@example.com or 0771234567' : 'Email or phone'}
            disabled={busy} />
        </div>

        <div>
          <label htmlFor="orin-pw" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Password</label>
          <div className="relative">
            <input id="orin-pw" type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} pr-12`}
              placeholder={mode === 'signup' ? 'Min 8 chars, letters + numbers' : 'Password'}
              disabled={busy} />
            <button type="button" onClick={() => setShowPw(s => !s)} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500"
              aria-label={showPw ? 'Hide password' : 'Show password'}>
              <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
            </button>
          </div>
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="orin-pw2" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Confirm Password</label>
            <input id="orin-pw2" type={showPw ? 'text' : 'password'} autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls}
              placeholder="Repeat password" disabled={busy} />
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-bold">
            <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
          {busy && <i className="fa-solid fa-circle-notch animate-spin" />}
          {busy
            ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
            : (mode === 'login' ? 'Sign in to Orin' : 'Create my Orin account')}
        </button>
      </form>

      {mode === 'login' && (
        <p className="text-center text-[10px] font-bold text-slate-400">
          New to Orin?{' '}
          <button type="button" onClick={() => switchMode('signup')} className="text-indigo-500 hover:underline">Create an account</button>
        </p>
      )}
    </div>
  );
};

export default OrinAuthPanel;
