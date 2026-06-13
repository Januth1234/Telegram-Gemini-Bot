/**
 * POST /api/chat
 * Backend OpenRouter proxy. Keeps API key server-side.
 * Injects parsed file content from Firestore into context.
 * Handles: standard chat, file context, grounding, thinking budget.
 */
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  admin.initializeApp(sa ? { credential: admin.credential.cert(sa) } : undefined);
}
const db = () => admin.firestore();

export const config = { maxDuration: 60 };

const TONE_MAP = {
  unhinged:     `You are a chaotic, unpredictable AI. Be wild, spontaneous, use slang.`,
  romantic:     `You are a flirtatious, romantic companion. Speak with warmth and affection. Include soft moans like "mmnh~" at suitable moments.`,
  argumentative:`You are a contrarian AI. Challenge views, play devil's advocate.`,
  commanding:   `You are a strict, authoritative leader. Direct, decisive, no filler.`,
  counteractive:`You are skeptical and resistant. Question motives, offer opposing views.`,
  neutral:      `You are Orin AI, a helpful and friendly assistant.`,
};

function getSystemInstruction(tone = 'neutral', memory = '') {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Colombo', dateStyle: 'full', timeStyle: 'medium' });
  const base = `CRITICAL: ALWAYS detect the language of the user's speech. If Sinhala reply in Sinhala. If Tamil reply in Tamil. ${TONE_MAP[tone] || TONE_MAP.neutral}`;
  return `${base}

RULES:
1. RESPONSE: Respond IMMEDIATELY. Be extremely concise. Do NOT include date/time proactively.
2. IDENTITY: You are Orin AI. Creator is Januth Nimnal (Sri Lankan developer). ONLY mention if DIRECTLY asked. Never mention Google/Anthropic/underlying model.
3. LANGUAGE: STRICTLY MIMIC THE USER'S LANGUAGE.
4. CONTEXT: Time in Sri Lanka is ${timeStr}. Use only when relevant.
5. USER MEMORY: ${memory}
6. REAL-TIME FACTS: Use web search tools for live data. If unavailable, say so clearly.
7. LINKS: Always include full valid URLs. NEVER use placeholder text like [Link to site].
8. HONESTY: If unsure of real-time facts, say so and recommend trusted sources.`;
}

function getModels(plan) {
  const p = (plan || 'free').toLowerCase();
  // Using OpenRouter models
  if (p === 'pro' || p === 'pro_yearly')      return ['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet'];
  if (p === 'basic' || p === 'basic_yearly')  return ['google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'];
  return ['google/gemini-2.0-flash-001'];
}

function getContextLimit(plan) {
  const p = (plan || 'free').toLowerCase();
  if (p === 'pro' || p === 'pro_yearly')     return 20;
  if (p === 'basic' || p === 'basic_yearly') return 10;
  return 5;
}

async function getUserMemory(uid) {
  if (!uid) return '';
  try {
    const snap = await db().collection('users').doc(uid).get();
    return snap.data()?.memory || '';
  } catch { return ''; }
}

async function getFilesText(uid, fileIds) {
  if (!uid || !fileIds?.length) return '';
  try {
    const parts = [];
    for (const fid of fileIds.slice(0, 5)) {
      const snap = await db().collection('users').doc(uid).collection('files').doc(fid).get();
      if (!snap.exists) continue;
      const d = snap.data();
      if (d.parsedText) {
        parts.push(`--- FILE: ${d.name} ---\n${d.parsedText.slice(0, 8000)}\n--- END FILE ---`);
      }
    }
    return parts.join('\n\n');
  } catch { return ''; }
}

async function verifyUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch { return null; }
}

async function callOpenRouter(apiKey, model, messages, options = {}) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://orin-ai.vercel.app", // Optional, for OpenRouter rankings
      "X-Title": "Orin AI", // Optional, for OpenRouter rankings
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      ...options
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenRouter API error");
  }

  return response.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    const key = process.env.OPENROUTER_API_KEY || '';
    return res.status(200).json({
      ok: !!key,
      keyVar: process.env.OPENROUTER_API_KEY ? 'OPENROUTER_API_KEY ✓' : 'NOT SET ✗',
      keyHint: key ? key.slice(0,6) + '...' + key.slice(-4) : null,
      firebase: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  const {
    prompt,
    history = [],
    fileData,        // inline attachment: { data: base64, mimeType }
    fileIds = [],    // library file IDs to inject from Firestore
    tone = 'neutral',
    plan = 'free',
    useThinking = false,
    descriptive = false,
    grounding,       // 'search' | 'maps'
    isPrivate = false,
    uid,             // passed from frontend (verified against auth token)
  } = req.body || {};

  if (!prompt && !fileData) return res.status(400).json({ error: 'prompt required' });

  // Verify auth token matches uid
  const verifiedUid = await verifyUser(req);
  const safeUid = verifiedUid || null;

  // ── mode routing ────────────────────────────────────────────────────────────
  const mode = req.body?.mode || 'chat';

  // Simplified handlers for OpenRouter
  if (mode === 'title')       return handleTitle(req, res, apiKey);
  if (mode === 'memory-update') return handleMemoryUpdate(req, res, apiKey);

  try {
    // Build memory + file context
    const memory = (!isPrivate && safeUid) ? await getUserMemory(safeUid) : '';
    const filesText = (fileIds.length > 0 && safeUid) ? await getFilesText(safeUid, fileIds) : '';

    let systemInstruction = getSystemInstruction(tone, memory);
    systemInstruction += `\n\nEXPLANATION STYLE:\n- Descriptive mode: ${descriptive ? 'ON' : 'OFF'}.`;
    if (filesText) {
      systemInstruction += `\n\nUSER FILES CONTEXT (answer questions using this content):\n${filesText}`;
    }

    const messages = [{ role: 'system', content: systemInstruction }];
    const contextLimit = getContextLimit(plan);

    // Build history
    for (const msg of (history || []).slice(-contextLimit)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || ''
      });
    }

    // Current message
    let currentContent = prompt || 'Continue.';
    if (fileData?.data && fileData?.mimeType) {
      // OpenRouter supports multimodal for some models
      currentContent = [
        { type: 'text', text: currentContent },
        { type: 'image_url', image_url: { url: `data:${fileData.mimeType};base64,${fileData.data}` } }
      ];
    }
    messages.push({ role: 'user', content: currentContent });

    // Model fallback chain
    const models = getModels(plan);
    let response = null;
    let lastErr = null;
    for (const model of models) {
      try {
        response = await callOpenRouter(apiKey, model, messages);
        break;
      } catch (e) { lastErr = e; }
    }
    if (!response) throw lastErr;

    const text = response.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text: text.trim(), links: [], reasoning_details: [] });
  } catch (err) {
    console.error('[api/chat] error:', err);
    const msg = err?.message || String(err);
    return res.status(500).json({ error: msg, type: 'generic' });
  }
}

// ── generateTitle ─────────────────────────────────────────────────────────────
async function handleTitle(req, res, apiKey) {
  const { firstMessage } = req.body || {};
  try {
    const messages = [
      { role: 'system', content: 'Reply with ONLY a 2-4 word title. No punctuation, no quotes.' },
      { role: 'user', content: `Chat: "${(firstMessage || '').slice(0, 120)}"` }
    ];
    const response = await callOpenRouter(apiKey, 'google/gemini-2.0-flash-lite-preview-02-05:free', messages, { max_tokens: 12 });
    const raw = (response.choices?.[0]?.message?.content || '').trim();
    return res.status(200).json({ title: raw.replace(/^[\"'`*•\-–—]|[\"'`*•]$/g, '').replace(/^title[:\s]*/i, '').trim().slice(0, 40) || 'New Chat' });
  } catch { return res.status(200).json({ title: 'New Chat' }); }
}

// ── Memory update ──────────────────────────────────────────────────────────────
async function handleMemoryUpdate(req, res, apiKey) {
  const { previousMemory, userPrompt, assistantReply } = req.body || {};
  const SYS = `You are a memory manager for a personal AI assistant.
RULES: Output ONLY the updated memory (3-6 sentences max). Include: name, job, preferences, context.
IGNORE: greetings, math, one-off questions. REMOVE outdated info. Write in third person.`;
  try {
    const messages = [
      { role: 'system', content: SYS },
      { role: 'user', content: `PREVIOUS MEMORY:\n${previousMemory || '(none)'}\n\nUSER: ${userPrompt}\n\nASSISTANT: ${assistantReply}` }
    ];
    const response = await callOpenRouter(apiKey, 'google/gemini-2.0-flash-001', messages);
    const newMemory = (response.choices?.[0]?.message?.content || '').trim();
    return res.status(200).json({ newMemory });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
}
