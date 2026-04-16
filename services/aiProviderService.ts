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
const INTEGRATIONS_KEY = 'orin_integrations';

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

// ── Integration tokens ────────────────────────────────────────────────────────

export function getIntegrations(): IntegrationToken[] {
  try { return JSON.parse(localStorage.getItem(INTEGRATIONS_KEY) || '[]'); }
  catch { return []; }
}

export function getIntegration(service: string): IntegrationToken | null {
  return getIntegrations().find(i => i.service === service) || null;
}

export function saveIntegration(token: IntegrationToken): void {
  const list = getIntegrations().filter(i => i.service !== token.service);
  list.push({ ...token, accessToken: token.accessToken ? enc(token.accessToken) : undefined,
    refreshToken: token.refreshToken ? enc(token.refreshToken) : undefined });
  localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(list));
  _syncToFirestore();
}

export function removeIntegration(service: string): void {
  const list = getIntegrations().filter(i => i.service !== service);
  localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(list));
  _syncToFirestore();
}

export function getDecryptedToken(service: string): { access: string; refresh: string } | null {
  const t = getIntegration(service);
  if (!t || !t.accessToken) return null;
  return { access: dec(t.accessToken), refresh: t.refreshToken ? dec(t.refreshToken) : '' };
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
