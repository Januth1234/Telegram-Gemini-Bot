/**
 * googleIntegrationService — single Google identity with scoped permissions.
 * Extends existing Firebase Google auth with incremental consent.
 * Never creates new auth sessions — reuses the user's signed-in Google account.
 *
 * Spec: google_integration_layer (docs/spec.json)
 *   - One identity, multiple scoped permissions
 *   - Incremental consent per feature module
 *   - Auto-refresh on expiry
 *   - Encrypted token vault in Firestore users/{uid}/google_tokens
 */
import { firebaseService } from './firebaseService';

// ── Scope definitions per feature module ────────────────────────────────────
export const GOOGLE_MODULES = {
  gmail:    { scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],        label: 'Gmail',          icon: 'fa-envelope',   color: 'text-red-500' },
  drive:    { scopes: ['https://www.googleapis.com/auth/drive.file'],                                                          label: 'Google Drive',   icon: 'fa-hard-drive', color: 'text-yellow-500' },
  calendar: { scopes: ['https://www.googleapis.com/auth/calendar'],                                                            label: 'Calendar',       icon: 'fa-calendar',   color: 'text-blue-500' },
  people:   { scopes: ['openid', 'email', 'profile'],                                                                          label: 'Contacts',       icon: 'fa-address-book', color: 'text-indigo-500' },
  docs:     { scopes: ['https://www.googleapis.com/auth/documents'],                                                           label: 'Google Docs',    icon: 'fa-file-lines', color: 'text-blue-400' },
  slides:   { scopes: ['https://www.googleapis.com/auth/presentations'],                                                       label: 'Google Slides',  icon: 'fa-display',    color: 'text-orange-400' },
  sheets:   { scopes: ['https://www.googleapis.com/auth/spreadsheets'],                                                        label: 'Google Sheets',  icon: 'fa-table',      color: 'text-green-500' },
  youtube:  { scopes: ['https://www.googleapis.com/auth/youtube.readonly'],                                                    label: 'YouTube',        icon: 'fa-youtube',    color: 'text-red-600' },
  fitness:  { scopes: ['https://www.googleapis.com/auth/fitness.activity.read', 'https://www.googleapis.com/auth/fitness.body.read'], label: 'Google Fit', icon: 'fa-heart-pulse', color: 'text-pink-500' },
} as const;

export type GoogleModuleId = keyof typeof GOOGLE_MODULES;

interface TokenVault {
  [module: string]: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    grantedScopes: string[];
    connectedAt: number;
    enabled: boolean;
  };
}

const VAULT_KEY = 'orin_google_vault';
const enc = (s: string) => btoa(unescape(encodeURIComponent(s)));
const dec = (s: string) => { try { return decodeURIComponent(escape(atob(s))); } catch { return s; } };

// ── Vault helpers ────────────────────────────────────────────────────────────
function loadVault(): TokenVault {
  try { return JSON.parse(localStorage.getItem(VAULT_KEY) || '{}'); } catch { return {}; }
}
function saveVault(v: TokenVault): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(v));
  _syncVaultMeta(); // sync metadata (no tokens) to Firestore
}

export function getModuleToken(module: GoogleModuleId): string | null {
  const v = loadVault()[module];
  if (!v || !v.enabled) return null;
  if (v.expiresAt > Date.now() + 60000) return dec(v.accessToken); // still valid
  return null; // expired — caller should call refreshModule()
}

export function isModuleEnabled(module: GoogleModuleId): boolean {
  const v = loadVault()[module];
  return !!(v?.enabled && v?.accessToken);
}

export function getGrantedModules(): GoogleModuleId[] {
  const v = loadVault();
  return Object.entries(v).filter(([, t]) => t.enabled && t.accessToken).map(([k]) => k as GoogleModuleId);
}

export function disableModule(module: GoogleModuleId): void {
  const v = loadVault();
  if (v[module]) { v[module].enabled = false; saveVault(v); }
}

export function enableModule(module: GoogleModuleId): void {
  const v = loadVault();
  if (v[module]) { v[module].enabled = true; saveVault(v); }
}

// ── Incremental consent OAuth ────────────────────────────────────────────────
// Uses system browser (new tab) — no embedded popup, per spec security rules.
const CLIENT_ID = (typeof window !== 'undefined') ? (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '' : '';
const REDIRECT = (typeof window !== 'undefined') ? `${window.location.origin}/auth/google/callback` : '';

export async function requestModuleConsent(module: GoogleModuleId): Promise<boolean> {
  if (!CLIENT_ID) {
    console.warn('[google] Set VITE_GOOGLE_CLIENT_ID env var');
    return false;
  }
  const scopes = GOOGLE_MODULES[module].scopes.join(' ');
  // PKCE
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  sessionStorage.setItem('g_pkce_verifier', verifier);
  sessionStorage.setItem('g_pkce_module', module);

  // Open system browser — per spec: must_not use_embedded_google_login_popup
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent'); // incremental — only ask for new scopes
  url.searchParams.set('include_granted_scopes', 'true'); // additive, not replacement
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  window.location.href = url.toString(); // full redirect — system browser
  return true;
}

// Called on redirect back from Google OAuth
export async function handleOAuthCallback(): Promise<{ module: GoogleModuleId } | null> {
  if (!window.location.pathname.includes('/auth/google/callback')) return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const verifier = sessionStorage.getItem('g_pkce_verifier');
  const module = sessionStorage.getItem('g_pkce_module') as GoogleModuleId | null;
  if (!code || !verifier || !module) return null;

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, redirect_uri: REDIRECT,
        grant_type: 'authorization_code', code_verifier: verifier,
      }),
    });
    const data = await r.json();
    if (data.access_token) {
      const v = loadVault();
      v[module] = {
        accessToken: enc(data.access_token),
        refreshToken: enc(data.refresh_token || ''),
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        grantedScopes: (data.scope || '').split(' '),
        connectedAt: Date.now(),
        enabled: true,
      };
      saveVault(v);
      sessionStorage.removeItem('g_pkce_verifier');
      sessionStorage.removeItem('g_pkce_module');
      window.history.replaceState({}, '', '/');
      return { module };
    }
  } catch {}
  return null;
}

// Auto-refresh access token using stored refresh token
export async function refreshModule(module: GoogleModuleId): Promise<string | null> {
  const v = loadVault();
  const entry = v[module];
  if (!entry?.refreshToken) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID, refresh_token: dec(entry.refreshToken),
        grant_type: 'refresh_token',
      }),
    });
    const data = await r.json();
    if (data.access_token) {
      v[module].accessToken = enc(data.access_token);
      v[module].expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      saveVault(v);
      return data.access_token;
    }
  } catch {}
  return null;
}

// Get valid access token — auto-refreshes if expired
export async function getValidToken(module: GoogleModuleId): Promise<string | null> {
  const cached = getModuleToken(module);
  if (cached) return cached;
  return refreshModule(module); // retry with backoff fallback
}

// ── Google API helpers ────────────────────────────────────────────────────────

async function gFetch(module: GoogleModuleId, url: string, opts?: RequestInit): Promise<any> {
  let token = await getValidToken(module);
  if (!token) throw new Error(`No token for ${module}. Grant access first.`);
  const res = await fetch(url, { ...opts, headers: { ...(opts?.headers || {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    // Token invalid — try refresh once
    token = await refreshModule(module);
    if (!token) throw new Error('Token refresh failed');
    const retry = await fetch(url, { ...opts, headers: { ...(opts?.headers || {}), Authorization: `Bearer ${token}` } });
    if (!retry.ok) throw new Error(`API error ${retry.status}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Gmail
export async function gmailListThreads(maxResults = 10) {
  return gFetch('gmail', `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&labelIds=INBOX`);
}
export async function gmailGetThread(id: string) {
  return gFetch('gmail', `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`);
}
export async function gmailSend(to: string, subject: string, body: string) {
  const raw = btoa(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain\r\n\r\n${body}`).replace(/\+/g,'-').replace(/\//g,'_');
  return gFetch('gmail', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ raw }) });
}

// Calendar
export async function calendarListEvents(maxResults = 10) {
  const now = new Date().toISOString();
  return gFetch('calendar', `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=${maxResults}&timeMin=${now}&singleEvents=true&orderBy=startTime`);
}
export async function calendarCreateEvent(summary: string, start: string, end: string, description?: string) {
  return gFetch('calendar', 'https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ summary, description, start:{ dateTime:start, timeZone:'Asia/Colombo' }, end:{ dateTime:end, timeZone:'Asia/Colombo' } }),
  });
}

// Drive
export async function driveListFiles(q = '') {
  return gFetch('drive', `https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,modifiedTime)${q?`&q=${encodeURIComponent(q)}`:''}`);
}

// Docs
export async function docsCreate(title: string) {
  return gFetch('docs', 'https://docs.googleapis.com/v1/documents', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title }) });
}

// Slides
export async function slidesCreate(title: string) {
  return gFetch('slides', 'https://slides.googleapis.com/v1/presentations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title }) });
}

// Sheets
export async function sheetsCreate(title: string) {
  return gFetch('sheets', 'https://sheets.googleapis.com/v4/spreadsheets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ properties:{ title } }) });
}

// YouTube
export async function youtubeSearch(q: string, maxResults = 5) {
  return gFetch('youtube', `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(q)}&type=video`);
}

// Fitness
export async function fitnessGetActivity() {
  const now = Date.now();
  const week = now - 7 * 24 * 3600 * 1000;
  return gFetch('fitness', 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ aggregateBy:[{dataTypeName:'com.google.step_count.delta'}], bucketByTime:{durationMillis:86400000}, startTimeMillis:week, endTimeMillis:now }),
  });
}

// Sync vault metadata (no tokens) to Firestore
let _syncT: ReturnType<typeof setTimeout> | null = null;
function _syncVaultMeta() {
  if (_syncT) clearTimeout(_syncT);
  _syncT = setTimeout(async () => {
    try {
      const uid = (window as any).__orinUser?.id; if (!uid) return;
      const v = loadVault();
      const meta = Object.fromEntries(Object.entries(v).map(([k, t]) => [k, { enabled: t.enabled, connectedAt: t.connectedAt, grantedScopes: t.grantedScopes }]));
      await (firebaseService as any).saveUserSettings?.(uid, { googleModules: meta });
    } catch {}
  }, 2000);
}
