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

  // ── mode routing ────────────────────────────────────────────────────────────
  const mode = req.body?.mode || 'chat';

  if (mode === 'code')        return handleCodeExecution(req, res, apiKey);
  if (mode === 'url')         return handleUrlContext(req, res, apiKey);
  if (mode === 'research')    return handleDeepResearch(req, res, apiKey);
  if (mode === 'image')       return handleImageGen(req, res, apiKey);
  if (mode === 'tts')         return handleTts(req, res, apiKey);
  if (mode === 'computer-use')return handleComputerUse(req, res, apiKey);
  if (mode === 'agent-plan')  return handleAgentPlan(req, res, apiKey);
  if (mode === 'title')       return handleTitle(req, res, apiKey);
  if (mode === 'embed')       return handleEmbed(req, res, apiKey);
  if (mode === 'math')        return handleMath(req, res, apiKey);
  if (mode === 'memory-update') return handleMemoryUpdate(req, res, apiKey);
  if (mode === 'video')         return handleVideoGen(req, res, apiKey);
  if (mode === 'math-extract')  return handleMathExtract(req, res, apiKey);

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



// ── Code Execution ────────────────────────────────────────────────────────────
async function handleCodeExecution(req, res, apiKey) {
  const { prompt, history = [], plan = 'free' } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = plan === 'pro' || plan === 'pro_yearly' ? 'gemini-2.5-pro'
                : plan.includes('basic') ? 'gemini-2.5-flash' : 'gemini-2.0-flash';
    const contents = (history || []).slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || '' }],
    }));
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    const response = await ai.models.generateContent({
      model, contents,
      config: {
        tools: [{ codeExecution: {} }],
        systemInstruction: 'You are a coding assistant. Use the code execution tool. Show code and output clearly.',
      },
    });
    let text = '', code = '', output = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) text += part.text;
      if (part.executableCode?.code) code = part.executableCode.code;
      if (part.codeExecutionResult?.output) output = part.codeExecutionResult.output;
    }
    return res.status(200).json({ text: text.trim(), code, output });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Code execution failed' });
  }
}

// ── URL Context ───────────────────────────────────────────────────────────────
async function handleUrlContext(req, res, apiKey) {
  const { url, question, history = [], plan = 'free' } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = plan.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const prompt = `Fetch this URL and answer the question based on its content.\nURL: ${url}\nQuestion: ${question || 'Summarise this page'}`;
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ urlContext: {} }],
        systemInstruction: 'Fetch the URL using url_context and answer thoroughly.',
      },
    });
    let text = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.text && !part.thought) text += part.text;
    }
    const meta = response.candidates?.[0]?.urlContextMetadata;
    return res.status(200).json({ text: text.trim(), urlSource: meta?.urlMetadata?.[0]?.retrievedUrl });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'URL context failed' });
  }
}

// ── Deep Research ─────────────────────────────────────────────────────────────
async function handleDeepResearch(req, res, apiKey) {
  const { prompt, plan = 'free' } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Fallback to grounded chat — interactions API not stable in current SDK
    const model = plan.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `[DEEP RESEARCH] ${prompt}\n\nConduct thorough research. Use web search extensively. Provide a comprehensive, well-structured report with sources.` }] }],
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: 'You are a deep research assistant. Search extensively and produce a detailed, sourced report.',
        thinkingConfig: { thinkingBudget: plan.includes('pro') ? 8192 : 4096 },
      },
    });
    let text = '';
    const links = [];
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.text && !part.thought) text += part.text;
    }
    for (const chunk of response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
      if (chunk.web?.uri) links.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
    }
    return res.status(200).json({ text: text.trim(), links });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Deep research failed' });
  }
}


// ── Image Generation ──────────────────────────────────────────────────────────
async function handleImageGen(req, res, apiKey) {
  const { prompt, aspectRatio = '1:1', referenceImage, plan = 'free' } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    let dataUrl = '';

    if (referenceImage?.data) {
      const r = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ parts: [
          { inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } },
          { text: `Edit or transform this image: ${prompt}. Output only the modified image.` },
        ]}],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      });
      for (const part of r.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) { dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`; break; }
      }
    } else {
      try {
        const imgRes = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt,
          config: { numberOfImages: 1, aspectRatio, outputMimeType: 'image/png' },
        });
        const imgData = imgRes?.generatedImages?.[0]?.image?.imageBytes ?? imgRes?.generatedImages?.[0]?.image?.imageData;
        if (imgData) dataUrl = `data:image/png;base64,${imgData}`;
      } catch {
        const r = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        });
        for (const part of r.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) { dataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`; break; }
        }
      }
    }
    if (!dataUrl) return res.status(400).json({ error: 'No image returned. Try a different prompt.' });
    return res.status(200).json({ dataUrl });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Image generation failed' });
  }
}

// ── TTS ───────────────────────────────────────────────────────────────────────
async function handleTts(req, res, apiKey) {
  const { text, stylePrompt, voiceName = 'Kore', multiSpeaker } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'No text to speak' });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const promptText = stylePrompt?.trim() ? `${stylePrompt.trim()}\n\n${text.trim()}` : text.trim();
    const speechConfig = multiSpeaker?.length
      ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: multiSpeaker.map(({ speaker, voiceName: v }) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: v } } })) } }
      : { voiceConfig: { prebuiltVoiceConfig: { voiceName } } };
    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: { responseModalities: ['AUDIO'], speechConfig },
    });
    const data = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) return res.status(400).json({ error: 'No audio generated' });
    return res.status(200).json({ audioBase64: data });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'TTS failed' });
  }
}

// ── computerUse (agent screenshot → action plan) ──────────────────────────────
async function handleComputerUse(req, res, apiKey) {
  const { prompt, screenshotBase64, mimeType = 'image/png', contents: contentsIn } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const contents = contentsIn?.length ? contentsIn : [{
      role: 'user',
      parts: [
        ...(screenshotBase64 ? [{ inlineData: { data: screenshotBase64, mimeType } }] : []),
        { text: prompt || '' },
      ],
    }];
    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { tools: [{ computerUse: { environment: 'ENVIRONMENT_BROWSER' } }] },
    });
    let text = '';
    const functionCalls = [];
    const safetyDecisions = [];
    for (const part of r.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) text += part.text;
      const fc = part.functionCall || part.function_call;
      if (fc) {
        functionCalls.push({ name: fc.name, args: fc.args || {} });
        if (fc.args?.safety_decision) safetyDecisions.push(fc.args.safety_decision);
      }
    }
    return res.status(200).json({ text: text.trim(), functionCalls, safetyDecisions });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Computer use failed' });
  }
}

// ── agentPlan ─────────────────────────────────────────────────────────────────
async function handleAgentPlan(req, res, apiKey) {
  const { task } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: `You are a browser automation agent. Break this task into concrete, executable steps.\n\nTASK: ${task}\n\nReply ONLY with valid JSON (no markdown fences, no explanation):\n{"summary":"One sentence summary","steps":[{"action":"navigate","target":"https://url","description":"desc"},{"action":"click","target":"element","description":"desc"},{"action":"type","target":"field","value":"text","description":"desc"},{"action":"screenshot","description":"desc"},{"action":"done","description":"desc"}]}\n\nVALID ACTIONS: navigate, search, type, fill, click, screenshot, copy, wait, done` }] }],
      config: { systemInstruction: 'Output only valid JSON. No markdown. No explanation.' },
    });
    const text = r.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(clean));
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Agent planning failed', steps: [], summary: '' });
  }
}

// ── generateTitle ─────────────────────────────────────────────────────────────
async function handleTitle(req, res, apiKey) {
  const { firstMessage } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: `Reply with ONLY a 2-4 word title. No punctuation, no quotes.\nChat: "${(firstMessage || '').slice(0, 120)}"`,
      config: { maxOutputTokens: 12 },
    });
    const raw = (r.text ?? r.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '').trim();
    return res.status(200).json({ title: raw.replace(/^[\"'`*•\-–—]|[\"'`*•]$/g, '').replace(/^title[:\s]*/i, '').trim().slice(0, 40) || 'New Chat' });
  } catch { return res.status(200).json({ title: 'New Chat' }); }
}

// ── embedText ─────────────────────────────────────────────────────────────────
async function handleEmbed(req, res, apiKey) {
  const { texts, imageBase64, mimeType = 'image/png', outputDimensionality } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const config = outputDimensionality != null ? { outputDimensionality } : undefined;
    if (imageBase64) {
      const r = await ai.models.embedContent({ model: 'gemini-embedding-2-preview', contents: [{ inlineData: { mimeType, data: imageBase64 } }] });
      return res.status(200).json({ embeddings: [r.embeddings?.[0]?.values ?? []] });
    }
    const r = await ai.models.embedContent({ model: 'gemini-embedding-2-preview', contents: texts || [], config });
    return res.status(200).json({ embeddings: (r.embeddings ?? []).map(e => e.values ?? []) });
  } catch (err) {
    return res.status(200).json({ embeddings: (texts || []).map(() => []) });
  }
}

// ── solveMathWithAI ───────────────────────────────────────────────────────────
async function handleMath(req, res, apiKey) {
  const { prompt, fileData, plan = 'free' } = req.body || {};
  const MATH_SYS = `You are a professional math tutor like Symbolab or Wolfram Alpha.\nSolve math problems with COMPLETE step-by-step working.\n1. Show EVERY algebraic step.\n2. For quadratic: compute Δ = b²−4ac, then both roots.\n3. For calculus: name the rule then apply it.\n4. End with "Final Answer:" clearly labelled.\nFormat:\n---METHOD: [Name] ---\nStep 1: …\nFinal Answer: …\n---ENDMETHOD---`;
  const models = plan.includes('pro') ? ['gemini-2.5-flash', 'gemini-2.0-flash'] : plan.includes('basic') ? ['gemini-2.5-flash', 'gemini-2.0-flash'] : ['gemini-2.0-flash'];
  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts = [];
    if (fileData?.data) parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
    parts.push({ text: prompt });
    for (const model of models) {
      try {
        const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }], config: { systemInstruction: MATH_SYS } });
        const text = r.text ?? r.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
        if (text) return res.status(200).json({ text });
      } catch {}
    }
    return res.status(400).json({ error: 'No solution returned' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Math solve failed' });
  }
}


// ── Memory update ──────────────────────────────────────────────────────────────
async function handleMemoryUpdate(req, res, apiKey) {
  const { previousMemory, userPrompt, assistantReply } = req.body || {};
  const SYS = `You are a memory manager for a personal AI assistant.
RULES: Output ONLY the updated memory (3-6 sentences max). Include: name, job, preferences, context.
IGNORE: greetings, math, one-off questions. REMOVE outdated info. Write in third person.`;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { role: 'user', parts: [{ text: `PREVIOUS MEMORY:\n${previousMemory || '(none)'}\n\nUSER: ${userPrompt}\n\nASSISTANT: ${assistantReply}` }] },
      config: { systemInstruction: SYS },
    });
    const newMemory = (r.text ?? r.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '').trim();
    return res.status(200).json({ newMemory });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
}


// ── Video Generation ──────────────────────────────────────────────────────────
async function handleVideoGen(req, res, apiKey) {
  const { prompt, aspectRatio = '16:9', resolution = '720p', image, lastFrame, video: videoIn, plan = 'free' } = req.body || {};
  try {
    const ai = new GoogleGenAI({ apiKey });
    const isExtend = !!videoIn;
    const model = isExtend || resolution === '1080p' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
    const config = { numberOfVideos: 1, resolution, aspectRatio };
    if (lastFrame) config.lastFrame = lastFrame;
    const params = { model, prompt, config };
    if (image) params.image = image;
    if (videoIn) params.video = videoIn;

    let operation = await ai.models.generateVideos(params);
    const startedAt = Date.now();
    while (!operation.done) {
      if (Date.now() - startedAt > 300000) return res.status(408).json({ error: 'Video generation timed out' });
      await new Promise(r => setTimeout(r, 8000));
      operation = await ai.operations.getVideosOperation({ operation });
      if (operation?.error?.message) return res.status(400).json({ error: operation.error.message });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) return res.status(400).json({ error: 'No video generated' });
    const vr = await fetch(`${videoUri}&key=${apiKey}`);
    const buf = Buffer.from(await vr.arrayBuffer());
    return res.status(200).json({ videoBase64: buf.toString('base64') });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Video generation failed' });
  }
}

// ── Math Expression Extractor ─────────────────────────────────────────────────
async function handleMathExtract(req, res, apiKey) {
  const { text, fileData } = req.body || {};
  const EXTRACT_PROMPT = `You are a mathematical expression extractor. Return ONLY raw JSON, no markdown.
{"type":"quadratic|linear|system|calculus|trigonometry|matrix|statistics|unknown","expression":"raw math string","latexExpression":"LaTeX","variable":"x","operation":"solve|simplify|differentiate|integrate|factor|expand","extraValues":{},"confidence":0.9,"unreadable":false}`;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts = [];
    if (fileData?.data) parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
    parts.push({ text: `${EXTRACT_PROMPT}

Input: ${text || ''}` });
    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts }],
      config: { systemInstruction: 'Output only valid JSON. No markdown. No explanation.' },
    });
    const raw = (r.text ?? r.candidates?.[0]?.content?.parts?.[0]?.text ?? '').replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(raw));
  } catch (err) {
    return res.status(200).json({ type: 'unknown', expression: text || '', latexExpression: '', variable: 'x', operation: 'solve', extraValues: {}, confidence: 0, unreadable: true });
  }
}
