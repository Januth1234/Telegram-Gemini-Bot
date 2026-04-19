/**
 * POST /api/chat
 * Backend Gemini proxy. Keeps API key server-side.
 * Injects parsed file content from Firestore into context.
 * Handles: standard chat, file context, grounding, thinking budget.
 */
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
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
  if (p === 'pro' || p === 'pro_yearly')      return ['gemini-2.5-flash', 'gemini-2.0-flash'];
  if (p === 'basic' || p === 'basic_yearly')  return ['gemini-2.5-flash', 'gemini-2.0-flash'];
  return ['gemini-2.0-flash'];
}

function getThinkingBudget(plan, useThinking) {
  if (!useThinking) return 0;
  const p = (plan || 'free').toLowerCase();
  if (p === 'pro' || p === 'pro_yearly')     return 8192;
  if (p === 'basic' || p === 'basic_yearly') return 4096;
  return 0;
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

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

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build memory + file context
    const memory = (!isPrivate && safeUid) ? await getUserMemory(safeUid) : '';
    const filesText = (fileIds.length > 0 && safeUid) ? await getFilesText(safeUid, fileIds) : '';

    let systemInstruction = getSystemInstruction(tone, memory);
    systemInstruction += `\n\nEXPLANATION STYLE:\n- Descriptive mode: ${descriptive ? 'ON' : 'OFF'}.`;
    if (filesText) {
      systemInstruction += `\n\nUSER FILES CONTEXT (answer questions using this content):\n${filesText}`;
    }

    const contextLimit = getContextLimit(plan);
    const contents = [];

    // Build history
    for (const msg of (history || []).slice(-contextLimit)) {
      const role = msg.role === 'user' ? 'user' : 'model';
      // Strip base64 blobs from history — reference by text only to avoid huge payloads
      const text = msg.content || '';
      if (text) contents.push({ role, parts: [{ text }] });
    }

    // Current message parts
    const currentParts = [];
    if (fileData?.data && fileData?.mimeType) {
      currentParts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
    }
    currentParts.push({ text: (prompt || 'Continue.').trim() });
    contents.push({ role: 'user', parts: currentParts });

    // Tool selection — search only when appropriate
    const lowerPrompt = (prompt || '').toLowerCase();
    const looksTimeSensitive = /job|jobs|vacanc|news|weather|stock|price|exchange|results|live|current|latest|today|now|election|conflict|war|crisis/i.test(lowerPrompt);
    const allowSearch = !isPrivate && !fileData && !filesText && (grounding === 'search' || looksTimeSensitive);

    const cfg = { systemInstruction };
    if (grounding === 'maps') cfg.tools = [{ googleMaps: {} }];
    else if (allowSearch)     cfg.tools = [{ googleSearch: {} }];

    const thinkingBudget = getThinkingBudget(plan, useThinking);
    const requestCfg = { ...cfg, thinkingConfig: { thinkingBudget } };

    // Model fallback chain
    const models = getModels(plan);
    let response = null;
    let lastErr = null;
    for (const model of models) {
      try {
        response = await ai.models.generateContent({ model, contents, config: requestCfg });
        break;
      } catch (e) { lastErr = e; }
    }
    if (!response) throw lastErr;

    // Extract text + grounding links
    let text = '';
    const links = [];
    const reasoning_details = [];

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) text += part.text;
      if (part.thought) reasoning_details.push({ thought: part.thought });
    }

    const meta = response.candidates?.[0]?.groundingMetadata;
    if (meta?.groundingChunks) {
      for (const chunk of meta.groundingChunks) {
        if (chunk.web?.uri) links.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
      }
    }

    return res.status(200).json({ text: text.trim(), links, reasoning_details });
  } catch (err) {
    console.error('[api/chat] error:', err);
    const msg = err?.message || String(err);
    if (msg.includes('quota') || msg.includes('429')) return res.status(429).json({ error: 'Quota exceeded', type: 'quota' });
    if (msg.includes('API_KEY') || msg.includes('401')) return res.status(401).json({ error: 'API key invalid', type: 'auth' });
    if (msg.includes('SAFETY')) return res.status(400).json({ error: 'Safety filter triggered', type: 'safety' });
    return res.status(500).json({ error: msg, type: 'generic' });
  }
}
