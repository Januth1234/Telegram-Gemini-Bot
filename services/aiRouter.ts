/**
 * aiRouter — Item 8: fallback routing across providers.
 * Tries providers in priority order. On failure, tries next.
 * Uses user's stored API keys from aiProviderService.
 */
import { getDecryptedKey } from './aiProviderService';

export type AiProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'perplexity' | 'openrouter' | 'xai';

export interface RouteOptions {
  task: 'chat' | 'code' | 'research' | 'vision' | 'fast';
  preferProvider?: AiProvider;
  maxRetries?: number;
  systemPrompt?: string;
}

interface ProviderConfig {
  url: string;
  makeBody: (prompt: string, system?: string) => object;
  extractText: (res: any) => string;
  headers: (key: string) => Record<string, string>;
}

const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: k => ({ 'Content-Type':'application/json', Authorization:`Bearer ${k}` }),
    makeBody: (p, s) => ({ model:'gpt-4o-mini', messages:[...(s?[{role:'system',content:s}]:[]),{role:'user',content:p}], max_tokens:2000 }),
    extractText: r => r.choices?.[0]?.message?.content || '',
  },
  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: k => ({ 'Content-Type':'application/json', 'x-api-key':k, 'anthropic-version':'2023-06-01' }),
    makeBody: (p, s) => ({ model:'claude-3-haiku-20240307', max_tokens:2000, ...(s?{system:s}:{}), messages:[{role:'user',content:p}] }),
    extractText: r => r.content?.[0]?.text || '',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: k => ({ 'Content-Type':'application/json', Authorization:`Bearer ${k}` }),
    makeBody: (p, s) => ({ model:'llama-3.1-8b-instant', messages:[...(s?[{role:'system',content:s}]:[]),{role:'user',content:p}], max_tokens:2000 }),
    extractText: r => r.choices?.[0]?.message?.content || '',
  },
  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
    headers: k => ({ 'Content-Type':'application/json', Authorization:`Bearer ${k}` }),
    makeBody: (p, s) => ({ model:'llama-3.1-sonar-small-128k-online', messages:[...(s?[{role:'system',content:s}]:[]),{role:'user',content:p}] }),
    extractText: r => r.choices?.[0]?.message?.content || '',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: k => ({ 'Content-Type':'application/json', Authorization:`Bearer ${k}`, 'HTTP-Referer':'https://orinai.org' }),
    makeBody: (p, s) => ({ model:'auto', messages:[...(s?[{role:'system',content:s}]:[]),{role:'user',content:p}] }),
    extractText: r => r.choices?.[0]?.message?.content || '',
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    headers: k => ({ 'Content-Type':'application/json', Authorization:`Bearer ${k}` }),
    makeBody: (p, s) => ({ model:'grok-beta', messages:[...(s?[{role:'system',content:s}]:[]),{role:'user',content:p}], max_tokens:2000 }),
    extractText: r => r.choices?.[0]?.message?.content || '',
  },
  // Gemini handled by existing geminiService — only fallback to others if Gemini fails
  gemini: {
    url: '',
    headers: () => ({}),
    makeBody: () => ({}),
    extractText: () => '',
  },
};

// Task → provider priority order
const PRIORITY: Record<RouteOptions['task'], AiProvider[]> = {
  chat:     ['gemini','openai','claude','groq','openrouter'],
  code:     ['openai','claude','gemini','groq'],
  research: ['perplexity','openai','gemini','claude'],
  vision:   ['gemini','openai','claude'],
  fast:     ['groq','gemini','openai'],
};

export async function routeToAI(prompt: string, opts: RouteOptions = { task: 'chat' }): Promise<{ text: string; provider: string }> {
  const order = opts.preferProvider
    ? [opts.preferProvider, ...PRIORITY[opts.task].filter(p => p !== opts.preferProvider)]
    : PRIORITY[opts.task];

  const maxRetries = opts.maxRetries ?? 3;
  let lastErr = '';

  for (const provider of order.slice(0, maxRetries)) {
    // Gemini — use existing service
    if (provider === 'gemini') {
      try {
        const { geminiService } = await import('./geminiService');
        const result = await geminiService.chat(prompt, { isPrivate: true });
        const text = typeof result === 'string' ? result : (result as any)?.text || '';
        if (text) return { text, provider: 'gemini' };
      } catch (e: any) { lastErr = e.message; continue; }
    }

    const key = getDecryptedKey(provider);
    if (!key) continue; // no key for this provider, skip

    const cfg = PROVIDERS[provider];
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: cfg.headers(key),
        body: JSON.stringify(cfg.makeBody(prompt, opts.systemPrompt)),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`${provider} HTTP ${res.status}`);
      const data = await res.json();
      const text = cfg.extractText(data);
      if (text) return { text, provider };
      throw new Error(`${provider} returned empty response`);
    } catch (e: any) {
      lastErr = e.message;
      console.warn(`[aiRouter] ${provider} failed:`, e.message);
      // continue to next
    }
  }
  throw new Error(`All providers failed. Last error: ${lastErr}`);
}
