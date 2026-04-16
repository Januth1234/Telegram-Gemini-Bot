/**
 * AIProviderSettings — tab inside AccountSettings.
 * Add/remove API keys for multiple providers.
 * Integrations toggles (Spotify, Calendar, Gmail, Drive).
 */
import React, { useState, useEffect } from 'react';
import {
  AIProviderKey, IntegrationToken,
  getProviderKeys, saveProviderKey, removeProviderKey,
  getIntegrations, saveIntegration, removeIntegration,
} from '../services/aiProviderService';
import {
  GOOGLE_MODULES, GoogleModuleId,
  isModuleEnabled, getGrantedModules,
  requestModuleConsent, disableModule, enableModule,
} from '../services/googleIntegrationService';

const PROVIDERS = [
  { id: 'gemini',      name: 'Gemini',          icon: 'fa-google',           color: 'text-blue-500' },
  { id: 'openai',      name: 'OpenAI',           icon: 'fa-robot',            color: 'text-emerald-500' },
  { id: 'claude',      name: 'Claude',           icon: 'fa-c',                color: 'text-orange-500' },
  { id: 'perplexity',  name: 'Perplexity',       icon: 'fa-magnifying-glass', color: 'text-cyan-500' },
  { id: 'openrouter',  name: 'OpenRouter',       icon: 'fa-route',            color: 'text-purple-500' },
  { id: 'groq',        name: 'Groq',             icon: 'fa-bolt',             color: 'text-yellow-500' },
  { id: 'xai',         name: 'xAI (Grok)',       icon: 'fa-x',               color: 'text-slate-500' },
  { id: 'vercel',      name: 'Vercel AI Gateway', icon: 'fa-triangle',        color: 'text-slate-600' },
] as const;

const INTEGRATIONS = [
  { id: 'spotify',  name: 'Spotify', icon: 'fa-spotify', color: 'text-green-500', isGoogle: false },
] as const;

// Google modules from spec
const GOOGLE_MODULE_IDS: GoogleModuleId[] = ['gmail','drive','calendar','docs','slides','sheets','youtube','fitness'];

const SPOTIFY_CLIENT_ID = (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/auth/spotify/callback` : '';

const AIProviderSettings: React.FC = () => {
  const [keys, setKeys]           = useState<AIProviderKey[]>([]);
  const [integs, setIntegs]       = useState<IntegrationToken[]>([]);
  const [adding, setAdding]       = useState<string | null>(null); // provider id being added
  const [newKey, setNewKey]       = useState('');
  const [newLabel, setNewLabel]   = useState('');
  const [showKeys, setShowKeys]   = useState<Set<string>>(new Set());
  const [section, setSection]     = useState<'providers' | 'integrations'>('providers');

  useEffect(() => {
    setKeys(getProviderKeys());
    setIntegs(getIntegrations());
    if (window.location.search.includes('spotify_callback')) handleSpotifyCallback();
  }, []);

  const [grantedModules, setGrantedModules] = React.useState<GoogleModuleId[]>(() => getGrantedModules());
  const refreshGoogleState = () => setGrantedModules(getGrantedModules());

  const refresh = () => { setKeys(getProviderKeys()); setIntegs(getIntegrations()); };

  const addKey = () => {
    if (!adding || !newKey.trim()) return;
    saveProviderKey({ provider: adding, label: newLabel || adding, key: newKey.trim(), enabled: true, addedAt: Date.now() });
    setAdding(null); setNewKey(''); setNewLabel('');
    refresh();
  };

  const toggleKey = (k: AIProviderKey) => {
    saveProviderKey({ ...k, enabled: !k.enabled });
    refresh();
  };

  const deleteKey = (k: AIProviderKey) => {
    removeProviderKey(k.provider, k.label);
    refresh();
  };

  const toggleVisibility = (id: string) => {
    setShowKeys(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // Spotify PKCE OAuth
  const connectSpotify = async () => {
    if (!SPOTIFY_CLIENT_ID) { alert('Set VITE_SPOTIFY_CLIENT_ID in Vercel env vars.'); return; }
    const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('');
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    localStorage.setItem('spotify_verifier', verifier);
    const scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing streaming';
    const url = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&code_challenge_method=S256&code_challenge=${challenge}`;
    window.location.href = url;
  };

  const handleSpotifyCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const verifier = localStorage.getItem('spotify_verifier');
    if (!code || !verifier || !SPOTIFY_CLIENT_ID) return;
    try {
      const r = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri: REDIRECT_URI,
          client_id: SPOTIFY_CLIENT_ID, code_verifier: verifier }),
      });
      const data = await r.json();
      if (data.access_token) {
        saveIntegration({ service:'spotify', enabled:true, accessToken: data.access_token,
          refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000,
          scope: data.scope, connectedAt: Date.now() });
        refresh();
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {}
  };

  const disconnectInteg = (service: string) => { removeIntegration(service); refresh(); };

  const toggleInteg = (service: string, current: IntegrationToken | undefined) => {
    if (!current?.accessToken) return;
    saveIntegration({ ...current, enabled: !current.enabled });
    refresh();
  };

  const keysByProvider = (pid: string) => keys.filter(k => k.provider === pid);
  const getInteg = (sid: string) => integs.find(i => i.service === sid);

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5">
        {(['providers','integrations'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              section===s ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
            {s === 'providers' ? '🔑 AI Keys' : '🔗 Integrations'}
          </button>
        ))}
      </div>

      {/* ── AI PROVIDER KEYS ─────────────────────────────────────────────── */}
      {section === 'providers' && (
        <div className="space-y-2">
          <p className="text-[9px] text-slate-400 px-1">Keys saved locally + synced to your profile. Use multiple per provider.</p>
          {PROVIDERS.map(p => {
            const pKeys = keysByProvider(p.id);
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-white/3">
                  <div className="flex items-center gap-2">
                    <i className={`fa-brands ${p.icon} ${p.color} text-sm`} />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{p.name}</span>
                    {pKeys.length > 0 && <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">{pKeys.filter(k=>k.enabled).length} active</span>}
                  </div>
                  <button onClick={() => { setAdding(p.id); setNewLabel(''); setNewKey(''); }}
                    className="text-[9px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest">
                    + Add
                  </button>
                </div>
                {/* Keys list */}
                {pKeys.map((k, i) => {
                  const vid = `${k.provider}_${i}`;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 dark:border-white/5">
                      <button onClick={() => toggleKey(k)} className={`w-3 h-3 rounded-full border-2 shrink-0 ${k.enabled ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`} />
                      <span className="text-[10px] text-slate-500 flex-1 min-w-0 truncate">{k.label}</span>
                      <code className="text-[9px] text-slate-400 font-mono">
                        {showKeys.has(vid) ? atob(k.key).slice(0,20)+'…' : '••••••••••••'}
                      </code>
                      <button onClick={() => toggleVisibility(vid)} className="text-slate-400 hover:text-slate-600">
                        <i className={`fa-solid ${showKeys.has(vid)?'fa-eye-slash':'fa-eye'} text-[10px]`} />
                      </button>
                      <button onClick={() => deleteKey(k)} className="text-slate-300 hover:text-red-500">
                        <i className="fa-solid fa-trash text-[10px]" />
                      </button>
                    </div>
                  );
                })}
                {/* Add form */}
                {adding === p.id && (
                  <div className="px-3 py-2.5 border-t border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 space-y-2">
                    <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="Label (optional)"
                      className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    <input value={newKey} onChange={e=>setNewKey(e.target.value)} placeholder={`${p.name} API key`} type="password"
                      className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    <div className="flex gap-2">
                      <button onClick={addKey} className="flex-1 py-1.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500">Save</button>
                      <button onClick={()=>setAdding(null)} className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-500 text-[10px] font-black">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── INTEGRATIONS ─────────────────────────────────────────────────── */}
      {section === 'integrations' && (
        <div className="space-y-4">
          <p className="text-[9px] text-slate-400 px-1">One Google identity — grant per-service permissions. Uses system browser OAuth, no re-login.</p>

          {/* Google Services */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-1 flex items-center gap-1.5">
              <i className="fa-brands fa-google text-blue-500" /> Google Services
            </p>
            <div className="grid grid-cols-2 gap-2">
              {GOOGLE_MODULE_IDS.map(mid => {
                const mod = GOOGLE_MODULES[mid];
                const active = grantedModules.includes(mid);
                return (
                  <div key={mid} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                    active ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-white/10'}`}>
                    <i className={`fa-solid ${mod.icon} text-sm ${active ? mod.color : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-800 dark:text-white truncate">{mod.label}</p>
                      <p className={`text-[8px] ${active ? 'text-emerald-500' : 'text-slate-400'}`}>{active ? 'Connected' : 'Not connected'}</p>
                    </div>
                    {active
                      ? <button onClick={() => { disableModule(mid); refreshGoogleState(); }}
                          className="text-[8px] font-black text-red-400 hover:text-red-500 uppercase shrink-0">Off</button>
                      : <button onClick={() => requestModuleConsent(mid)}
                          className="text-[8px] font-black text-indigo-500 hover:text-indigo-600 uppercase shrink-0">Allow</button>
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spotify */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-1">Other Services</p>
            {INTEGRATIONS.map(integ => {
              const tok = getInteg(integ.id);
              const connected = !!(tok?.accessToken);
              return (
                <div key={integ.id} className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  connected ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-white/10'}`}>
                  <div className="flex items-center gap-3">
                    <i className={`fa-brands ${integ.icon} text-lg ${connected ? integ.color : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100">{integ.name}</p>
                      <p className="text-[9px] text-slate-400">{connected ? 'Connected' : 'Not connected'}</p>
                    </div>
                  </div>
                  {connected
                    ? <button onClick={() => disconnectInteg(integ.id)} className="text-[9px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest">Disconnect</button>
                    : <button onClick={connectSpotify} className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-green-500">Connect</button>
                  }
                </div>
              );
            })}
          </div>
          {!SPOTIFY_CLIENT_ID && (
            <p className="text-[9px] text-amber-500 px-1">⚠️ Add <code>VITE_SPOTIFY_CLIENT_ID</code> + <code>VITE_GOOGLE_CLIENT_ID</code> to Vercel env vars.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AIProviderSettings;
