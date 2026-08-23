/**
 * OrinAuthPanel — the ONLY sign-in method for Orin AI (no Google).
 * Tabs: Sign In (email-or-phone + password) · Create Account (name, email, phone,
 * password ×2) · Forgot Password (name + email + phone → new password ×2).
 * The desktop app opens this panel in the user's browser via the device flow;
 * approval there signs the app in automatically.
 */
import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService';

type Mode = 'login' | 'signup' | 'forgot' | 'forgot-set';

interface OrinAuthPanelProps {
  onSignedIn?: (authUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{9,15}$/;

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (!EMAIL_RE.test(v)) return 'That email address looks incomplete.';
  return null;
}

function validatePhone(value: string): string | null {
  const digits = value.trim().replace(/[\s()\-.]/g, '');
  if (!digits) return 'Enter your phone number.';
  if (!PHONE_RE.test(digits)) return 'Enter a valid phone number (e.g. 0771234567 or +94771234567).';
  return null;
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) {
    return 'Password needs at least 8 characters with letters and numbers.';
  }
  return null;
}

const inputCls = "w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow";

const OrinAuthPanel: React.FC<OrinAuthPanelProps> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  const finalize = async () => {
    // onAuthStateChanged also fires; the explicit callback guarantees the full
    // sync path runs even if the listener event races the custom-token exchange.
    const fbUser = firebaseService.currentUser();
    if (fbUser && onSignedIn) await onSignedIn(fbUser);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    // ── SIGN IN ─────────────────────────────────────────────────────────────
    if (mode === 'login') {
      const v = identifier.trim();
      if (!v) { setError('Enter your email or phone number.'); return; }
      if (!v.includes('@') && validatePhone(v)) { setError(validatePhone(v)!); return; }
      if (v.includes('@') && validateEmail(v)) { setError(validateEmail(v)!); return; }
      if (!password) { setError('Enter your password.'); return; }
      setBusy(true);
      try {
        await firebaseService.loginWithPassword(v, password);
        await finalize();
      } catch (err: any) {
        setError(err?.message || 'Sign-in failed. Please try again.');
      } finally { setBusy(false); }
      return;
    }

    // ── CREATE ACCOUNT ──────────────────────────────────────────────────────
    if (mode === 'signup') {
      if (name.trim().length < 2) { setError('Enter your name.'); return; }
      const emailErr = validateEmail(email);
      if (emailErr) { setError(emailErr); return; }
      const phoneErr = validatePhone(phone);
      if (phoneErr) { setError(phoneErr); return; }
      const pwErr = validatePassword(password);
      if (pwErr) { setError(pwErr); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setBusy(true);
      try {
        await firebaseService.registerWithPassword(name.trim(), email.trim(), phone.trim(), password);
        await finalize();
      } catch (err: any) {
        setError(err?.message || 'Could not create your account. Please try again.');
      } finally { setBusy(false); }
      return;
    }

    // ── FORGOT STEP 1: identity check ───────────────────────────────────────
    if (mode === 'forgot') {
      if (name.trim().length < 2) { setError('Enter your name.'); return; }
      const emailErr = validateEmail(email);
      if (emailErr) { setError(emailErr); return; }
      const phoneErr = validatePhone(phone);
      if (phoneErr) { setError(phoneErr); return; }
      setBusy(true);
      try {
        const token = await firebaseService.requestPasswordReset(name.trim(), email.trim(), phone.trim());
        setResetToken(token);
        setPassword(''); setConfirm('');
        setMode('forgot-set');
      } catch (err: any) {
        setError(err?.message || 'Verification failed.');
      } finally { setBusy(false); }
      return;
    }

    // ── FORGOT STEP 2: new password ─────────────────────────────────────────
    if (mode === 'forgot-set') {
      const pwErr = validatePassword(password);
      if (pwErr) { setError(pwErr); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setBusy(true);
      try {
        await firebaseService.confirmPasswordReset(resetToken!, password);
        setNotice('Password updated. Sign in with your new password.');
        setResetToken(null);
        setIdentifier(email);
        setPassword(''); setConfirm('');
        setMode('login');
      } catch (err: any) {
        setError(err?.message || 'Could not update your password. Start again.');
        setMode('forgot');
      } finally { setBusy(false); }
      return;
    }
  };

  const tabs: Array<{ id: Mode; label: string }> = [
    { id: 'login', label: 'Sign In' },
    { id: 'signup', label: 'Create Account' },
  ];
  const showTabs = mode === 'login' || mode === 'signup';

  return (
    <div className="w-full space-y-4">
      {showTabs && (
        <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5" role="tablist">
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={mode === t.id}
              onClick={() => switchMode(t.id)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === t.id ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'forgot' && (
        <button type="button" onClick={() => switchMode('login')}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500">
          <i className="fa-solid fa-arrow-left" /> Back to sign in
        </button>
      )}

      <form onSubmit={submit} className="space-y-3" noValidate>
        {mode === 'forgot' && (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="font-black text-indigo-500">Step 1 of 2 —</span> verify your identity
            with the exact name, email, and phone number on your account.
          </p>
        )}
        {mode === 'forgot-set' && (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="font-black text-emerald-500">✓ Verified.</span>{' '}
            <span className="font-black text-indigo-500">Step 2 of 2 —</span> choose a new password.
          </p>
        )}

        {(mode === 'signup' || mode === 'forgot') && (
          <div>
            <label htmlFor="orin-name" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Full Name</label>
            <input id="orin-name" type="text" autoComplete="name" value={name} maxLength={60}
              onChange={e => setName(e.target.value)} className={inputCls}
              placeholder="Your name" disabled={busy} />
          </div>
        )}

        {mode === 'login' && (
          <div>
            <label htmlFor="orin-id" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Email or Phone</label>
            <input id="orin-id" type="text" autoComplete="username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)} className={inputCls}
              placeholder="you@example.com or 0771234567"
              disabled={busy} />
          </div>
        )}

        {(mode === 'signup' || mode === 'forgot') && (
          <div>
            <label htmlFor="orin-email" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Email</label>
            <input id="orin-email" type="email" autoComplete="email" value={email}
              onChange={e => setEmail(e.target.value)} className={inputCls}
              placeholder="you@example.com" disabled={busy} />
          </div>
        )}

        {(mode === 'signup' || mode === 'forgot') && (
          <div>
            <label htmlFor="orin-phone" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">Phone Number</label>
            <input id="orin-phone" type="tel" autoComplete="tel" value={phone}
              onChange={e => setPhone(e.target.value)} className={inputCls}
              placeholder="0771234567 or +94771234567" disabled={busy} />
          </div>
        )}

        {mode !== 'forgot' && (
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
        )}

        {(mode === 'signup' || mode === 'forgot-set') && (
          <div>
            <label htmlFor="orin-pw2" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">
              {mode === 'forgot-set' ? 'New Password' : 'Re-enter Password'}
            </label>
            <input id="orin-pw2" type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls}
              placeholder={mode === 'forgot-set' ? 'Min 8 chars, letters + numbers' : 'Repeat password'} disabled={busy} />
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-bold">
            <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <i className="fa-solid fa-circle-check mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <button type="submit" disabled={busy}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
          {busy && <i className="fa-solid fa-circle-notch animate-spin" />}
          {busy
            ? (mode === 'login' ? 'Signing in…'
              : mode === 'signup' ? 'Creating account…'
              : mode === 'forgot' ? 'Verifying…'
              : 'Updating password…')
            : (mode === 'login' ? 'Sign in to Orin'
              : mode === 'signup' ? 'Create my Orin account'
              : mode === 'forgot' ? 'Verify my identity'
              : 'Set new password')}
        </button>
      </form>

      {mode === 'login' && (
        <div className="flex flex-col items-center gap-1.5">
          <button type="button" onClick={() => switchMode('forgot')}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500">
            Forgot password?
          </button>
          <p className="text-[10px] font-bold text-slate-400">
            New to Orin?{' '}
            <button type="button" onClick={() => switchMode('signup')} className="text-indigo-500 hover:underline">Create an account</button>
          </p>
        </div>
      )}
      {mode === 'signup' && (
        <p className="text-center text-[10px] font-bold text-slate-400">
          Already have an account?{' '}
          <button type="button" onClick={() => switchMode('login')} className="text-indigo-500 hover:underline">Sign in</button>
        </p>
      )}
    </div>
  );
};

export default OrinAuthPanel;
