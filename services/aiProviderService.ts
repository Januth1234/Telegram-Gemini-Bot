/**
 * aiProviderService — stores AI provider keys & integration tokens
 * per user in Firestore users/{uid}/settings/providers
 * Providers: gemini, openai, claude, perplexity, openrouter, groq, xai
 * Integrations: spotify, calendar, gmail, drive
 */
import { firebaseService } from './firebaseService';

export interface AIProviderKey {
  provider: string;
  label: string;
  key: string;       // stored obfuscated
  enabled: boolean;
  addedAt: number;
}

export interface IntegrationToken {
  service: string;   // spotify | calendar | gmail | drive
  enabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  connectedAt?: number;
}

const PROVIDERS_KEY = 'orin_ai_providers';
// Integration tokens moved to Firestore backend via /api/auth/*

// Simple obfuscation for localStorage/Firestore (not cryptographic)
const enc = (s: string) => btoa(unescape(encodeURIComponent(s)));
const dec = (s: string) => { try { return decodeURIComponent(escape(atob(s))); } catch { return s; } };

// ── Provider keys ─────────────────────────────────────────────────────────────

export function getProviderKeys(): AIProviderKey[] {
  try { return JSON.parse(localStorage.getItem(PROVIDERS_KEY) || '[]'); }
  catch { return []; }
}

export function saveProviderKey(p: AIProviderKey): void {
  const keys = getProviderKeys().filter(k => !(k.provider === p.provider && k.label === p.label));
  keys.push({ ...p, key: enc(p.key) });
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(keys));
  _syncToFirestore();
}

export function removeProviderKey(provider: string, label: string): void {
  const keys = getProviderKeys().filter(k => !(k.provider === provider && k.label === label));
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(keys));
  _syncToFirestore();
}

export function getDecryptedKey(provider: string, label?: string): string | null {
  const keys = getProviderKeys();
  const match = label ? keys.find(k => k.provider === provider && k.label === label && k.enabled)
                      : keys.find(k => k.provider === provider && k.enabled);
  return match ? dec(match.key) : null;
}

// ── Integration tokens — now handled server-side ─────────────────────────────
// Spotify tokens are stored encrypted in Firestore via /api/auth/spotify.
// These stubs remain for backward compat with any callers.

export function getIntegrations(): IntegrationToken[] { return []; }
export function getIntegration(service: string): IntegrationToken | null { return null; }
export function saveIntegration(_token: IntegrationToken): void { /* no-op: use /api/auth/spotify */ }
export function removeIntegration(_service: string): void { /* no-op */ }
export function getDecryptedToken(_service: string): { access: string; refresh: string } | null {
  // Tokens now live server-side. Use /api/auth/spotify?action=getToken instead.
  return null;
}

// ── Sync to Firestore (background) ───────────────────────────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
function _syncToFirestore() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    try {
      const uid = (window as any).__orinUser?.id;
      if (!uid) return;
      await (firebaseService as any).saveUserSettings?.(uid, {
        aiProviders: getProviderKeys().map(k => ({ ...k, key: '[redacted]' })), // don't store keys in cloud
        integrations: getIntegrations().map(i => ({ service: i.service, enabled: i.enabled, connectedAt: i.connectedAt })),
      });
    } catch {}
  }, 2000);
}
