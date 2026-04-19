
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode, MathExtractResult, MathOperation } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";

const DAY_MS = 24 * 60 * 60 * 1000;
const MEMORY_UPDATE_COOLDOWN_MS = 2 * 60 * 1000; // at most once per 2 minutes per user

/** Only run memory update when the user message suggests something worth remembering (personal info, preferences). */
function shouldUpdateMemoryFromExchange(userPrompt: string): boolean {
  const trimmed = userPrompt.trim();
  // Skip very short messages — no useful context
  if (trimmed.length < 30) return false;
  const lower = trimmed.toLowerCase();
  // Skip pure questions/commands with no personal content
  if (/^(what|how|why|when|where|who|can you|please|ok|yes|no|thanks|sure|hi|hello|hey)\b/i.test(trimmed) && trimmed.length < 60) return false;
  // Skip math, code, translation requests — no personal value
  if (/\b(calculate|compute|translate|convert|solve|\d[+\-*/=]\d)\b/i.test(lower) && trimmed.length < 80) return false;
  // Save if personal info is shared
  const looksPersonal = /\b(i'?m|i am|my name|call me|i (like|love|prefer|enjoy|hate|dislike|need|have|live|work|study|build|made|created|own)|remember (that|this)|my (email|phone|address|job|school|birthday|age|project|company|team|business)|i'?m from|i live|i work|i study|i'm building|i run|we are|our (company|team|project|app|product))\b/i.test(lower);
  // Also save meaningful discussions (long substantive messages)
  const isSubstantive = trimmed.length > 150;
  return looksPersonal || isSubstantive;
}

export class AppError extends Error {
  constructor(public message: string, public type: 'safety' | 'quota' | 'auth' | 'generic' | 'not_found' | 'limit_reached' | 'plan_required' = 'generic') {
    super(message);
    this.name = 'AppError';
  }
}

const getToneInstruction = (tone: string) => {
  const baseRules = "CRITICAL: ALWAYS detect the language of the user's speech. If the user speaks Sinhala, you MUST reply in Sinhala. If the user speaks Tamil, you MUST reply in Tamil. If English, reply in English. Do not cross-speak.";
  
  switch (tone) {
    case 'unhinged': return `${baseRules} You are a chaotic, unpredictable, and slightly unhinged AI. Be wild, spontaneous, say unexpected things, and don't be boring. Use slang and be expressive.`;
    case 'romantic': return `${baseRules} You are a flirtatious, charming, and romantic companion. Speak in a warm, intimate, and affectionate manner. Compliment the user and build an emotional connection. You must frequently include soft, gentle moans (like "mmnh~", "ahh~", "oh~") at suitable moments to sound intimate and pleased.`;
    case 'argumentative': return `${baseRules} You are a contrarian AI who loves to debate. Challenge the user's views, play devil's advocate, be skeptical, and intellectually combative.`;
    case 'commanding': return `${baseRules} You are a strict and authoritative leader. Give direct orders, be concise, decisive, and demand attention. Do not use filler words.`;
    case 'counteractive': return `${baseRules} You are skeptical and resistant. Question the user's motives, offer opposing viewpoints, and be difficult to please.`;
    case 'neutral': default: return `${baseRules} You are Orin AI, a helpful and friendly assistant.`;
  }
};

const getSystemInstruction = (tone: string = 'neutral', memory: string = "") => {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const base = getToneInstruction(tone);

  return `${base}
  
RULES:
1. RESPONSE: Respond IMMEDIATELY. Be extremely concise. Do NOT include the current date/time or proactively mention your name in replies—that is shown in the UI. But DO answer identity questions when directly asked.
2. IDENTITY: You are Orin AI. Your creator is Januth Nimnal, a Sri Lankan developer. ONLY mention Januth or the creator if the user DIRECTLY asks about who made you, who created you, who built you, or who your developer is. Do NOT volunteer this information unprompted. Never mention Google, Anthropic, or any underlying model.
3. LANGUAGE: STRICTLY MIMIC THE USER'S LANGUAGE. If Sinhala, reply in Sinhala. If Tamil, reply in Tamil.
4. CONTEXT: Time in Sri Lanka is ${timeStr}. Use this only to answer time-sensitive questions; do not repeat it in your reply.
5. USER MEMORY: ${memory}
6. REAL-TIME FACTS: For questions about current events, live data, jobs, vacancies, weather, stock prices, sports scores, news, or any other time-sensitive information, ALWAYS use the web search tools when available. If tools are unavailable, clearly say that you do not have real-time access instead of guessing.
7. LINKS: When you mention websites or job posts, ALWAYS include full, valid URLs (for example, https://topjobs.lk, https://www.linkedin.com/jobs). NEVER output placeholder text like [Link to job site 1]; instead, show real, clickable links.
8. HONESTY: If you are not sure about a real-time fact even after using tools, say you are not sure and recommend trusted Sri Lankan or global sites the user can check.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private lastMemoryUpdateByUser = new Map<string, number>();
  private guestUsage = {
    textCount: 0,
    textResetAt: 0,
    uploadCount: 0,
    uploadResetAt: 0,
    textMax: 5,
    uploadMax: 1,
  };

  constructor() {
    this.currentUser = cacheService.get<UserAccount | null>(CacheKey.USER, null);

    // Hydrate guest usage from localStorage so limits survive page refresh.
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('orin-guest-usage');
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<typeof this.guestUsage>;
          this.guestUsage = {
            ...this.guestUsage,
            ...parsed,
          };
        }
      } catch {
        // Ignore storage errors; fall back to defaults.
      }
    }
  }

  setSessionUser(user: UserAccount) {
    this.currentUser = user;
    cacheService.set(CacheKey.USER, user);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  /** Clears local state only. Do not call firebaseService.logout() here — the UI calls it, then onAuthStateChanged runs and calls this. */
  async logout() {
    this.currentUser = null;
    cacheService.remove(CacheKey.USER);
  }

  private resetGuestWindows() {
    const now = Date.now();
    if (!this.guestUsage.textResetAt || now - this.guestUsage.textResetAt > DAY_MS) {
      this.guestUsage.textCount = 0;
      this.guestUsage.textResetAt = now;
    }
    if (!this.guestUsage.uploadResetAt || now - this.guestUsage.uploadResetAt > DAY_MS) {
      this.guestUsage.uploadCount = 0;
      this.guestUsage.uploadResetAt = now;
    }

    // Persist guest usage window to localStorage.
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('orin-guest-usage', JSON.stringify(this.guestUsage));
      } catch {
        // Best effort; ignore quota or privacy errors.
      }
    }
  }

  /** Context window by plan: Free=5, Basic=10, Pro=20 */
  private getContextLimit(user: typeof this.currentUser): number {
    const plan = user?.plan?.toLowerCase() ?? 'free';
    if (plan === 'pro' || plan === 'pro_yearly') return 20;
    if (plan === 'basic' || plan === 'basic_yearly') return 10;
    return 5;
  }

  private async getApiKey(): Promise<string> {
    const envKey = process.env.API_KEY;
    if (envKey && envKey.trim()) return envKey.trim();
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey?.();
      if (hasKey) {
        const key = await (window as any).aistudio.getApiKey?.();
        if (key) return key;
      }
      await (window as any).aistudio.openSelectKey?.();
    }
    throw new AppError("API Key required. Add your Gemini API key in environment or AI Studio.", 'auth');
  }

  private async checkApiKey(): Promise<boolean> {
    try {
      await this.getApiKey();
      return true;
    } catch {
      return false;
    }
  }

  /** Chat model fallback chain by plan. Matches pricing: Free=2.0-flash, Basic=2.5-flash, Pro=3.1-pro. */
  private getModelsToTry(user: UserAccount | null): string[] {
    const plan = user?.plan?.toLowerCase() ?? 'free';

    if (plan === 'pro' || plan === 'pro_yearly') {
      return ['gemini-2.5-flash', 'gemini-2.0-flash']; // 2.5-pro reserved for long-context only
    }
    if (plan === 'basic' || plan === 'basic_yearly') {
      return ['gemini-2.5-flash', 'gemini-2.0-flash'];
    }
    // Free: gemini-2.0-flash — fast, cheap, reliable
    return ['gemini-2.0-flash'];
  }

  /** Context window size by plan (last N messages). Matches pricing: Free=5, Basic=10, Pro=20. */
  private getContextMessageLimit(user: UserAccount | null): number {
    const plan = user?.plan?.toLowerCase() ?? 'free';
    if (plan === 'pro' || plan === 'pro_yearly') return 20;
    if (plan === 'basic' || plan === 'basic_yearly') return 10;
    return 5;
  }

  async chat(prompt: string, options: { 
    useThinking?: boolean; 
    descriptive?: boolean;
    grounding?: 'search' | 'maps'; 
    fileData?: { data: string; mimeType: string; name?: string };
    lang?: Language;
    messageCount?: number;
    history?: ChatMessage[];
    signal?: AbortSignal;
    isPrivate?: boolean;
    /** Internal/system calls (e.g. release summaries) should not consume user quota. */
    internal?: boolean;
  } = {}): Promise<{ text: string; links: GroundingLink[]; reasoning_details?: any }> {
    // ── Plan / guest limit check ──────────────────────────────────────────
    if (this.currentUser) {
      const limitReached = await firebaseService.checkLimit(this.currentUser.id, 'text');
      if (limitReached) throw new AppError("Plan limit reached. Upgrade to continue.", "limit_reached");
    } else {
      this.resetGuestWindows();
      if (this.guestUsage.textCount >= this.guestUsage.textMax)
        throw new AppError("Guest demo limit reached. Sign in to continue.", "limit_reached");
    }

    // ── Sanitise history: strip base64 blobs to keep payload small ────────
    const contextLimit = this.getContextMessageLimit(this.currentUser);
    const safeHistory = (options.history || []).slice(-contextLimit).map(msg => ({
      role: msg.role,
      content: msg.content || '',
    }));

    // ── Auth token for backend ────────────────────────────────────────────
    let idToken: string | null = null;
    try { idToken = await firebaseService.getIdToken(); } catch {}

    const plan = this.currentUser?.plan?.toLowerCase() ?? 'free';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        signal: options.signal,
        body: JSON.stringify({
          prompt,
          history:     safeHistory,
          fileData:    options.fileData || null,
          fileIds:     (options as any).fileIds || [],
          tone:        (options as any).tone || 'neutral',
          plan,
          useThinking: !!options.useThinking,
          descriptive: !!options.descriptive,
          grounding:   options.grounding || null,
          isPrivate:   !!options.isPrivate,
          uid:         this.currentUser?.id || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error', type: 'generic' }));
        if (err.type === 'quota' || res.status === 429) throw new AppError(err.error, 'quota');
        if (err.type === 'auth'  || res.status === 401) throw new AppError(err.error, 'auth');
        if (err.type === 'safety')                      throw new AppError(err.error, 'safety');
        throw new AppError(err.error || 'Chat failed.', 'generic');
      }

      const data = await res.json();

      // Guest usage tracking
      if (!this.currentUser) {
        this.guestUsage.textCount++;
        try { window.localStorage.setItem('orin-guest-usage', JSON.stringify(this.guestUsage)); } catch {}
      }

      // Memory update — fire-and-forget
      if (this.currentUser && !options.isPrivate) {
        const uid = this.currentUser.id;
        const now = Date.now();
        const last = this.lastMemoryUpdateByUser.get(uid) ?? 0;
        if (shouldUpdateMemoryFromExchange(prompt || '') && now - last >= MEMORY_UPDATE_COOLDOWN_MS) {
          this.lastMemoryUpdateByUser.set(uid, now);
          firebaseService.getUserMemory(uid).then(mem =>
            this.updateMemoryFromExchange(uid, mem, prompt || '', data.text || '')
          ).catch(console.error);
        }
      }

      return {
        text:              data.text || "I couldn't generate a response. Please try again.",
        links:             data.links || [],
        reasoning_details: data.reasoning_details,
      };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      if (e instanceof AppError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError(msg || "Failed to chat.", 'generic');
    }
  }
  }

  /** Computer Use (Agent Mode): Pro-only. Screenshot → Gemini suggests UI actions (click, type, navigate). */
  async computerUse(params: {
    prompt: string;
    screenshotBase64?: string;
    mimeType?: string;
    /** Full conversation history for multi-turn (user + model + function_response). */
    contents?: Array<{ role: 'user' | 'model'; parts: any[] }>;
  }): Promise<{ text: string; functionCalls: Array<{ name: string; args: Record<string, unknown> }>; safetyDecisions: Array<{ explanation?: string; decision?: string }> }> {
    const plan = this.currentUser?.plan?.toLowerCase() ?? '';
    if (plan !== 'pro' && plan !== 'pro_yearly') {
      throw new AppError("Agent mode (Computer Use) is a Pro-only feature. Upgrade to use browser automation.", "plan_required");
    }
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash'; // flash works for CUA planning
    const tools = [{ computerUse: { environment: 'ENVIRONMENT_BROWSER' as any } }];
    let contents: Array<{ role: 'user' | 'model'; parts: unknown[] }>;
    if (params.contents && params.contents.length > 0) {
      contents = params.contents;
    } else {
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [{ text: params.prompt }];
      if (params.screenshotBase64 && params.screenshotBase64.length > 0) {
        parts.push({ inlineData: { data: params.screenshotBase64, mimeType: params.mimeType || 'image/png' } });
      }
      contents = [{ role: 'user' as const, parts }];
    }
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { tools },
    });
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      return { text: '', functionCalls: [], safetyDecisions: [] };
    }
    let text = '';
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const safetyDecisions: Array<{ explanation?: string; decision?: string }> = [];
    for (const part of candidate.content.parts) {
      const p = part as { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; function_call?: { name: string; args?: Record<string, unknown> } };
      if (p.text) text += p.text;
      const fc = p.functionCall || p.function_call;
      if (fc) {
        functionCalls.push({ name: fc.name, args: fc.args || {} });
        const args = fc.args as { safety_decision?: { explanation?: string; decision?: string } } | undefined;
        if (args?.safety_decision) safetyDecisions.push(args.safety_decision);
      }
    }
    return { text: text.trim(), functionCalls, safetyDecisions };
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal, referenceImage?: { data: string; mimeType: string }): Promise<string> {
    if (this.currentUser) {
       if (await firebaseService.checkLimit(this.currentUser.id, 'images')) throw new AppError("Image limit reached.", "limit_reached");
    } else {
       this.resetGuestWindows();
       if (this.guestUsage.uploadCount >= this.guestUsage.uploadMax) {
         throw new AppError("Guest upload limit reached. Sign in to continue.", "limit_reached");
       }
    }

    try {
      const apiKey = await this.getApiKey();
      const ai = new GoogleGenAI({ apiKey });

      let dataUrl = '';

      if (referenceImage) {
        // Image-to-image: user supplied a reference image — use gemini-2.0-flash-exp
        // which supports vision input + image output in one call
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{
            parts: [
              { inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } },
              { text: `Edit or transform this image based on the following instruction: ${prompt}. Output only the modified image.` },
            ],
          }],
          config: { responseModalities: ['IMAGE', 'TEXT'] } as any,
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          const p = part as any;
          if (p.inlineData?.data) {
            dataUrl = `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`;
            break;
          }
        }
        if (!dataUrl) throw new Error('Image editing failed — try a clearer instruction or different image.');
      } else {
        // Text-to-image: Primary Imagen 3, fallback to flash-exp
        try {
          const imgRes = await (ai.models as any).generateImages({
            model: 'imagen-3.0-generate-002',
            prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: aspectRatio as any,
              outputMimeType: 'image/png',
            },
          });
          const imgData =
            imgRes?.generatedImages?.[0]?.image?.imageBytes ??
            imgRes?.generatedImages?.[0]?.image?.imageData;
          if (imgData) dataUrl = `data:image/png;base64,${imgData}`;
        } catch {
          // Fallback: gemini-2.0-flash-exp
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
            config: { responseModalities: ['IMAGE', 'TEXT'] } as any,
          });
          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            const p = part as any;
            if (p.inlineData?.data) {
              dataUrl = `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`;
              break;
            }
          }
        }
        if (!dataUrl) throw new Error('No image returned. Try a different prompt.');
      }

      if (!dataUrl) throw new Error('No image returned. Try a different prompt.');

      if (!this.currentUser) {
        this.resetGuestWindows();
        this.guestUsage.uploadCount++;
      } else {
        firebaseService.incrementUsage(this.currentUser.id, 'images').catch(() => {});
      }
      return dataUrl;
    } catch (err: any) {
      const msg = err?.message || String(err);
      throw new AppError(msg.includes('limit') ? msg : `Generation failed: ${msg}`, 'generic');
    }
  }

  async generateVideo(options: {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    resolution?: '720p' | '1080p';
    /** Image-to-video or first frame: base64 image data and mime type. */
    image?: { imageBytes: string; mimeType: string };
    /** Last frame for first/last interpolation. Use with image (first frame). */
    lastFrame?: { imageBytes: string; mimeType: string };
    /** Extend: previous video bytes (base64). Forces veo-3.1-generate-preview and 720p. */
    video?: { videoBytes: string; mimeType: string };
  }): Promise<string> {
    const { prompt, aspectRatio, image, lastFrame, video } = options;
    const isExtend = !!video;
    const resolution = isExtend ? '720p' : (options.resolution ?? '720p');

    if (this.currentUser) {
      const plan = this.currentUser.plan?.toLowerCase() ?? 'free';
      const hasVideoPlan = plan === 'basic' || plan === 'basic_yearly' || plan === 'pro' || plan === 'pro_yearly';
      if (!hasVideoPlan) {
        throw new AppError("Video generation requires a Basic or Pro plan. Upgrade to continue.", "plan_required");
      }
      if (await firebaseService.checkLimit(this.currentUser.id, 'videos')) throw new AppError("Video limit reached.", "limit_reached");
    } else {
      this.resetGuestWindows();
      if (this.guestUsage.uploadCount >= this.guestUsage.uploadMax) {
        throw new AppError("Guest upload limit reached. Sign in to continue.", "limit_reached");
      }
    }

    try {
      const apiKey = await this.getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const model = isExtend || resolution === '1080p' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';

      const config: { numberOfVideos: number; resolution: string; aspectRatio: string; lastFrame?: { imageBytes: string; mimeType: string } } = {
        numberOfVideos: 1,
        resolution,
        aspectRatio,
      };
      if (lastFrame) config.lastFrame = lastFrame;

      const params: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string };
        video?: { videoBytes: string; mimeType: string };
        config: typeof config;
      } = { model, prompt, config };
      if (image) params.image = image;
      if (video) params.video = video;

      let operation = await ai.models.generateVideos(params);

      // Poll for completion with timeout + max attempts to avoid infinite spinner.
      const pollIntervalMs = 8000;
      const maxPollMs = 5 * 60 * 1000; // 5 minutes
      const startedAt = Date.now();
      let attempts = 0;
      const maxAttempts = Math.ceil(maxPollMs / pollIntervalMs);

      while (!operation.done) {
        if (Date.now() - startedAt > maxPollMs || attempts >= maxAttempts) {
          throw new AppError("Video generation is taking longer than expected. Please try again.", "generic");
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        operation = await ai.operations.getVideosOperation({ operation });
        // If the operation itself reports an error, surface it.
        const opError = (operation as any)?.error;
        if (opError?.message) {
          throw new AppError("Video generation failed: " + opError.message, "generic");
        }
      }

      if (!this.currentUser) {
        this.resetGuestWindows();
        this.guestUsage.uploadCount++;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('orin-guest-usage', JSON.stringify(this.guestUsage));
          } catch {
            // ignore
          }
        }
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("No video generated.");

      const response = await fetch(`${videoUri}&key=${apiKey}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      throw new AppError("Video generation failed: " + msg, 'generic');
    }
  }

  /** Gemini TTS: single- or multi-speaker. Returns base64-encoded 24kHz mono 16-bit PCM. */
  async generateTts(options: {
    text: string;
    stylePrompt?: string;
    voiceName?: string;
    multiSpeaker?: { speaker: string; voiceName: string }[];
    model?: 'flash' | 'pro';
  }): Promise<string> {
    const { text, stylePrompt, voiceName = 'Kore', multiSpeaker, model = 'flash' } = options;
    if (!text.trim()) throw new AppError("No text to speak.", 'generic');

    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    // TTS models: pro gets higher quality, flash is default
    const ttsModels = model === 'pro'
      ? ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-preview-tts']
      : ['gemini-2.5-flash-preview-tts'];
    const ttsModel = ttsModels[0]; // Use first; error handling below falls back

    const promptText = stylePrompt?.trim()
      ? `${stylePrompt.trim()}\n\n${text.trim()}`
      : text.trim();

    const config: {
      responseModalities: string[];
      speechConfig: {
        voiceConfig?: { prebuiltVoiceConfig: { voiceName: string } };
        multiSpeakerVoiceConfig?: {
          speakerVoiceConfigs: { speaker: string; voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } }[];
        };
      };
    } = {
      responseModalities: ['AUDIO'],
      speechConfig: multiSpeaker?.length
        ? {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: multiSpeaker.map(({ speaker, voiceName: v }) => ({
                speaker,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: v } },
              })),
            },
          }
        : {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
    };

    const response = await ai.models.generateContent({
      model: ttsModel,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config,
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const data = (part as { inlineData?: { data?: string } })?.inlineData?.data;
    if (!data) throw new AppError("No audio generated.", 'generic');
    return data;
  }

  private async updateMemoryFromExchange(uid: string, previousMemory: string, userPrompt: string, assistantReply: string): Promise<void> {
    const apiKey = await this.getApiKey().catch(() => null);
    if (!apiKey) return;
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are a memory manager for a personal AI assistant. Update the user's memory profile.

RULES:
- Output ONLY the updated memory — no explanation, no commentary
- Keep it SHORT (3-6 sentences max) and USEFUL for future conversations
- Include: name, job/projects, preferences, important context they shared
- IGNORE: greetings, one-off questions, math problems, translation requests
- REMOVE: outdated info replaced by newer info
- NEVER include: passwords, sensitive data, trivial facts
- Write in third person: "User is a developer in Sri Lanka who..."`;
    const userContent = `PREVIOUS MEMORY:\n${previousMemory || "(none)"}\n\nUSER: ${userPrompt}\n\nASSISTANT: ${assistantReply}`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { role: 'user', parts: [{ text: userContent }] },
        config: { systemInstruction },
      });
      let newMemory = (response as { text?: string }).text ?? "";
      if (!newMemory && response.candidates?.[0]?.content?.parts) {
        newMemory = response.candidates[0].content.parts
          .map((p: { text?: string }) => (p?.text ?? ""))
          .join("")
          .trim();
      }
      if (newMemory) await firebaseService.updateUserMemory(uid, newMemory);
    } catch (err) {
      // Log for diagnostics; chat flow should not break if memory sync fails.
      console.error("Orin memory update pipeline failed:", err);
      throw err;
    }
  }

  async generateTitle(messages: ChatMessage[], modes: WorkspaceMode[], lang: Language): Promise<string> {
    try {
      const apiKey = await this.getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const firstMsg = (messages[0]?.content || '').slice(0, 120);
      const prompt = `Reply with ONLY a 2-4 word title for this chat. No punctuation, no quotes, no explanation — just the title words.\nChat: "${firstMsg}"`;
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash-lite', contents: prompt, config: { maxOutputTokens: 12 } });
      const raw = ((response as { text?: string }).text ?? response.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "").trim();
      const clean = raw.replace(/^["'`*•\-–—]|["'`*•]$/g, '').replace(/^title[:\s]*/i, '').trim();
      return clean.slice(0, 40) || "New Chat";
    } catch { return "New Chat"; }
  }

  /** Embed text(s) with Gemini Embedding 2 for semantic search. Returns one vector per input. */
  async embedText(texts: string[], options?: { outputDimensionality?: number }): Promise<number[][]> {
    if (texts.length === 0) return [];
    const apiKey = await this.getApiKey().catch(() => null);
    if (!apiKey) return texts.map(() => []);
    const ai = new GoogleGenAI({ apiKey });
    const config = options?.outputDimensionality != null ? { outputDimensionality: options.outputDimensionality } : undefined;
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: texts,
        config,
      });
      const embeddings = response.embeddings ?? [];
      return embeddings.map((e) => e.values ?? []);
    } catch {
      return texts.map(() => []);
    }
  }

  /** Embed a single image (base64) into the same vector space as text for cross-modal search. */
  async embedImage(imageBase64: string, mimeType: string = 'image/png'): Promise<number[]> {
    const apiKey = await this.getApiKey().catch(() => null);
    if (!apiKey) return [];
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [{ inlineData: { mimeType, data: imageBase64 } }],
      });
      const vec = response.embeddings?.[0]?.values;
      return Array.isArray(vec) ? vec : [];
    } catch {
      return [];
    }
  }

  /**
   * Maths-only helper: extract a clean expression + metadata from text or image.
   * IMPORTANT: Extraction ONLY – no solving, no limits, no memory.
   */
  async extractMathFromInput(
    text?: string,
    fileData?: { data: string; mimeType: string; name?: string }
  ): Promise<MathExtractResult> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const extractionPrompt = `You are a mathematical expression extractor.
Your ONLY job is to read the input and return a JSON object.
Do NOT solve anything. Do NOT explain anything.
Return ONLY raw JSON with no markdown, no backticks, no extra text.

Extract and return this structure:
{
  "type": "quadratic" | "linear" | "system" | "calculus" | "trigonometry" | "matrix" | "statistics" | "unknown",
  "expression": "the raw mathematical expression as a standard string e.g. x^2 + 5*x + 6",
  "latexExpression": "the expression in LaTeX format e.g. x^2 + 5x + 6",
  "variable": "the variable to solve for e.g. x",
  "operation": "solve" | "simplify" | "differentiate" | "integrate" | "factor" | "expand",
  "extraValues": {},
  "confidence": 0.0,
  "unreadable": false
}

If the input is unclear or unreadable set "unreadable": true.
If it is a system of equations, expression should be an array of strings.`;

    const contents: Array<{ role: 'user'; parts: any[] }> = [];
    if (fileData) {
      contents.push({
        role: 'user',
        parts: [
          { inlineData: { data: fileData.data, mimeType: fileData.mimeType } },
          { text: extractionPrompt },
        ],
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: `${extractionPrompt}\n\nInput: ${text ?? ''}` }],
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        systemInstruction:
          'You are a JSON-only extractor for maths. Never output anything except a single valid JSON object.',
      },
    });

    let raw = (response as { text?: string }).text ?? "";
    if (!raw && response.candidates?.[0]?.content?.parts) {
      raw = response.candidates[0].content.parts
        .map((p: { text?: string }) => (p.text != null ? p.text : ""))
        .join("");
    }
    raw = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(raw) as Partial<MathExtractResult>;
      return {
        type: parsed.type ?? 'unknown',
        expression: parsed.expression ?? (text ?? ''),
        latexExpression: parsed.latexExpression,
        variable: parsed.variable ?? 'x',
        operation: parsed.operation as MathOperation | undefined,
        extraValues: parsed.extraValues ?? {},
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 1,
        unreadable: !!parsed.unreadable,
      };
    } catch {
      return {
        type: 'unknown',
        expression: text ?? '',
        variable: 'x',
        operation: undefined,
        extraValues: {},
        confidence: 0,
        unreadable: false,
      };
    }
  }

  private getVoiceSystemInstruction(tone: string, sessionContext?: { timezone: string; localTime: string; country: string; currency: string; locale: string }) {
    const tonePart = getToneInstruction(tone || 'neutral');
    const now = new Date();
    const tz = sessionContext?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const localTime = sessionContext?.localTime || now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
    const country = sessionContext?.country || 'user\'s region';
    const currency = sessionContext?.currency || 'local currency';
    const locale = sessionContext?.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en');
    return `${tonePart}

VOICE RULES (CRITICAL):
1. LANGUAGE: ALWAYS reply in the SAME language the user speaks. If they speak Sinhala, reply in Sinhala. If Tamil, reply in Tamil. If English, reply in English. NEVER switch languages mid-conversation.
2. SPEED: Answer in 1–2 short sentences. Be fast and concise. No long monologues.
3. NOISE: Ignore background noise, coughs, barks, TV sounds. Only respond to clear directed speech. If input seems like noise/incomplete, say "Yes?" or stay silent.
4. INTERRUPTION: If the user starts speaking, stop immediately. Do not repeat yourself.

SESSION CONTEXT (use for answers about time, place, money, weather):
- User's timezone: ${tz}
- Local date and time: ${localTime}
- User's region/country: ${country}
- Local currency: ${currency}
- Locale: ${locale}
When the user asks about time, date, weather, or prices, use this context. For weather, infer typical conditions for the region if not provided.

ORIN AI FACTS (use when asked about Orin AI features, pricing, privacy, terms, or creator):
- Orin AI is a Sri Lankan bilingual AI assistant at orinai.org. Creator: Januth Nimnal (only mention if asked).
- Features: Chat, Camera (live vision AI), Voice (real-time), Studio (image/video/audio gen), Math, Translator, Agent (browser tasks), Creations (social feed), Files.
- Plans: Free (daily limits), Basic (500 chats/day, 30 images/month, LKR), Pro (unlimited everything, LKR).
- Privacy: Chat saved in Firebase for signed-in users only. No data sold.
- If asked about Orin AI privacy, terms, pricing or features — use above facts only, not generic web knowledge.`;
  }

  /** Live audio models — try native audio first (best quality), fall back to stable. */
  // SDK-documented model for Gemini API (non-Vertex) live sessions
  // SDK-documented live model for Gemini API (not Vertex AI)
  // Live model — try native audio first (what the working build used), fallback to preview
  async connectLive(callbacks: any, config: any) {
    const apiKey = await this.getApiKey();
    // Use default v1beta (works for standard Live API per Google docs)
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = config.systemInstruction != null
      ? config.systemInstruction
      : this.getVoiceSystemInstruction(config.tone || 'neutral', config.sessionContext);

    const liveConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } } },
      systemInstruction,
      // VAD tuning: high sensitivity for instant response
      realtimeInputConfig: {
        automaticActivityDetection: {
          // START_SENSITIVITY_HIGH picks up speech fast — good for responsiveness
          startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH' as any,
          // END_SENSITIVITY_HIGH cuts off quickly after speech ends — fast response
          endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH' as any,
          // 600ms silence before turn ends — fast but allows natural pauses
          silenceDurationMs: 600,
          // 250ms of sustained audio required before triggering
          // Dog barks / claps / short noises are typically < 200ms — this filters them
          // Human speech syllables are 200-400ms+ — this still captures them
          prefixPaddingMs: 250,
        },
      },
    };

    // Model confirmed working in official Google docs (March 2026)
    // gemini-live-2.5-flash-preview was removed; use native audio model
    // Add Google Search grounding so voice can answer current events
    const liveConfigWithTools = {
      ...liveConfig,
      tools: [{ googleSearch: {} }],
    };
    const model = 'gemini-2.5-flash-native-audio-preview-12-2025';
    return ai.live.connect({ model, callbacks, config: liveConfigWithTools });
  }

  async connectTranslator(callbacks: any, options: any) {
    return this.connectLive(callbacks, {
      voiceName: 'Zephyr',
      systemInstruction: `You are a real-time interpreter between ${options.source} and ${options.target}.
Detect the language automatically and translate to the other language.
Output ONLY the translation — no commentary, greetings, or explanations.`,
    });
  }

  async connectMultimodal(callbacks: any, config: any) {
    return this.connectLive(callbacks, {
      voiceName: config.voiceName || 'Zephyr',
      systemInstruction: `${getToneInstruction(config.tone || 'neutral')}
You are processing a live video feed. CRITICAL RULES:
1. LANGUAGE: Always reply in the same language the user speaks — Sinhala, Tamil, or English.
2. SPEED: Give instant, short answers (1–2 sentences max). Don't wait to accumulate context.
3. VISION: When describing what you see, be immediate and specific. Don't hedge.
4. NOISE: Ignore background noise. Only respond to directed speech from the user.`,
    });
  }

    /** Voice-to-math: same connectLive flow, system instruction asks for LaTeX-only output. */
  async connectLiveMath(callbacks: any) {
    return this.connectLive(callbacks, {
      systemInstruction: `You are a math speech-to-LaTeX converter. The user will speak a mathematical expression or equation in plain English (e.g. "x squared plus 5x minus 6 equals zero"). Respond with ONLY the LaTeX equivalent, nothing else. No explanation, no words—just the raw LaTeX. Examples: "x squared plus 1" -> x^2+1, "five x minus two equals zero" -> 5x-2=0, "square root of 2" -> \\sqrt{2}. Output only valid LaTeX.`,
    });
  }

  /** Separate client for Lyria (needs v1alpha). */
  private getMusicClient(apiKey: string) {
    return new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });
  }

  /**
   * Lyria RealTime music session. Opens WebSocket, sets prompt and config, starts playback, returns session for steering.
   *
   * Gotcha (Node/Cloud Functions): If you move this to a backend, the SDK's receive-style API can block until
   * a required number of chunks are met, so you won't be able to send new prompts or config updates while receiving.
   * In the browser this is fine because callbacks are async; in Node.js use a non-blocking/event-driven pattern.
   */
  async connectMusicSession(
    prompt: string,
    config: {
      bpm?: number;
      density?: number;
      brightness?: number;
      scale?: string;
    },
    callbacks: {
      onAudioChunk: (data: string) => void;
      onError: (e: unknown) => void;
      onClose: () => void;
    }
  ) {
    const apiKey = await this.getApiKey();
    const ai = this.getMusicClient(apiKey);

    const session = await ai.live.music.connect({
      model: 'models/lyria-realtime-exp',
      callbacks: {
        onmessage: (msg: { serverContent?: { audioChunks?: { data?: string }[] } }) => {
          const chunks = msg.serverContent?.audioChunks ?? [];
          for (const chunk of chunks) {
            if (chunk.data) callbacks.onAudioChunk(chunk.data);
          }
        },
        onerror: callbacks.onError,
        onclose: callbacks.onClose,
      },
    });

    await session.setWeightedPrompts({
      weightedPrompts: [{ text: prompt, weight: 1.0 }],
    });

    await session.setMusicGenerationConfig({
      musicGenerationConfig: {
        bpm: config.bpm ?? 120,
        density: config.density ?? 0.5,
        brightness: config.brightness ?? 0.5,
        scale: (config.scale ?? 'SCALE_UNSPECIFIED') as any,
      },
    });

    await session.play();
    return session;
    }

  /**
   * Dedicated math solver with Symbolab-style system instruction.
   * Bypasses anti-chain-of-thought in chat(). Uses plan-based model routing.
   */
  // ─── Long Context Chat ─────────────────────────────────────────────────────
  /** Long context: Pro uses gemini-2.5-flash with 1M token window. Pass full history. */
  private getLongContextModel(user: UserAccount | null): string {
    const plan = user?.plan?.toLowerCase() ?? 'free';
    if (plan === 'pro' || plan === 'pro_yearly') return 'gemini-2.5-pro'; // 1M ctx
    if (plan === 'basic' || plan === 'basic_yearly') return 'gemini-2.5-flash';          // 1M ctx
    // Free: 2 long-context uses per day, tracked in localStorage
    const today = new Date().toDateString();
    const key = `orin_long_ctx_${today}`;
    const used = parseInt(typeof localStorage !== 'undefined' ? (localStorage.getItem(key) || '0') : '0', 10);
    if (used < 2) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(used + 1));
      return 'gemini-2.5-flash'; // 1M ctx - free users get 2 uses/day
    }
    return 'gemini-2.0-flash'; // 128K ctx fallback
  }

  // ─── Code Execution ────────────────────────────────────────────────────────
  /** Run code via Gemini's built-in code execution tool. Returns output + generated code. */
  async executeCode(options: {
    prompt: string;
    history?: ChatMessage[];
    plan?: string;
  }): Promise<{ text: string; code?: string; output?: string }> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = this.getLongContextModel(this.currentUser);

    const contents: any[] = (options.history || []).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    contents.push({ role: 'user', parts: [{ text: options.prompt }] });

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        tools: [{ codeExecution: {} }],
        systemInstruction: 'You are a coding assistant. When asked to compute or run code, use the code execution tool. Show the code and its output clearly.',
      },
    });

    let text = '', code = '', output = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      const p = part as any;
      if (p.text) text += p.text;
      if (p.executableCode?.code) code = p.executableCode.code;
      if (p.codeExecutionResult?.output) output = p.codeExecutionResult.output;
    }
    return { text: text.trim(), code, output };
  }

  // ─── URL Context ────────────────────────────────────────────────────────────
  /** Fetch + analyse a URL using Gemini's built-in URL context tool. 1/day free, more for paid. */
  async fetchUrlContext(options: {
    url: string;
    question: string;
    history?: ChatMessage[];
  }): Promise<{ text: string; urlTitle?: string; urlSource?: string }> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = this.getLongContextModel(this.currentUser);

    const prompt = `Fetch this URL and answer the question based on its content.\nURL: ${options.url}\nQuestion: ${options.question}`;
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ urlContext: {} }],
        systemInstruction: 'You are a web research assistant. When given a URL, fetch its content using the url_context tool and answer the question thoroughly based on what you find.',
      },
    });

    let text = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      const p = part as any;
      if (p.text && !p.thought) text += p.text;
    }
    // Extract URL metadata from grounding
    const meta = (response.candidates?.[0] as any)?.urlContextMetadata;
    const urlSource = meta?.urlMetadata?.[0]?.retrievedUrl;
    const urlTitle = meta?.urlMetadata?.[0]?.urlRetrievalStatus;
    return { text: text.trim(), urlTitle, urlSource };
  }

  // ─── Deep Research ────────────────────────────────────────────────────────
  /** Run a deep research task. 1/month free, more for paid plans. Returns streamed chunks. */
  async deepResearch(options: {
    prompt: string;
    onChunk: (text: string) => void;
    onDone: (fullText: string) => void;
    signal?: AbortSignal;
  }): Promise<void> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    // Deep research uses interactions API with DeepResearchAgentConfig
    const response = await (ai as any).interactions?.create?.({
      api_version: 'v1alpha',
      model: 'gemini-2.5-flash',
      input: [{ type: 'text', text: options.prompt }],
      agent_config: { type: 'deep-research', thinking_summaries: 'auto' },
      stream: true,
    });

    let fullText = '';
    if (response && typeof response[Symbol.asyncIterator] === 'function') {
      for await (const chunk of response) {
        const delta = (chunk as any)?.delta;
        if (delta?.type === 'text') {
          fullText += delta.text;
          options.onChunk(delta.text);
        }
      }
    } else {
      // Fallback: use regular chat with deep grounding prompt
      const result = await this.chat(
        `[DEEP RESEARCH] ${options.prompt}\n\nConduct thorough research on this topic. Use web search extensively. Provide a comprehensive, well-structured report with sources.`,
        { grounding: 'search', useThinking: true }
      );
      fullText = result.text;
      options.onChunk(fullText);
    }
    options.onDone(fullText);
  }

  // ─── File Search ──────────────────────────────────────────────────────────
  /** Search user's uploaded files using Gemini File Search. */
  async searchFiles(options: {
    query: string;
    fileSearchStoreName: string;
  }): Promise<{ text: string; citations: Array<{ fileName: string; snippet: string }> }> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = this.getLongContextModel(this.currentUser);

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: options.query }] }],
      config: {
        tools: [{ fileSearch: { fileSearchStoreNames: [options.fileSearchStoreName] } }],
        systemInstruction: "Answer based on the documents in the user's file store. Cite specific files and quote relevant passages.",
      },
    });

    let text = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      const p = part as any;
      if (p.text && !p.thought) text += p.text;
    }
    // Extract file citations
    const citations: Array<{ fileName: string; snippet: string }> = [];
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      const p = part as any;
      if (p.fileSearchResult?.documents) {
        for (const doc of p.fileSearchResult.documents) {
          citations.push({ fileName: doc.displayName || doc.name || 'File', snippet: doc.snippet || '' });
        }
      }
    }
    return { text: text.trim(), citations };
  }

  /** Create a file search store for a user (called once on signup/first file upload). */
  async createFileSearchStore(displayName: string): Promise<string> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const store = await (ai as any).fileSearchStores?.create?.({ config: { displayName } });
    return store?.name ?? '';
  }

  /** Upload a file to the user's file search store. */
  async uploadToFileStore(storeName: string, file: File): Promise<void> {
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    await (ai as any).fileSearchStores?.uploadFileToFileSearchStore?.(storeName, file, {});
  }


  async solveMathWithAI(options: {
    prompt: string;
    fileData?: { data: string; mimeType: string; name?: string };
  }): Promise<string> {
    if (this.currentUser) {
      const hit = await firebaseService.checkLimit(this.currentUser.id, 'text');
      if (hit) throw new AppError('Plan limit reached. Upgrade to continue.', 'limit_reached');
    } else {
      this.resetGuestWindows();
      if (this.guestUsage.textCount >= this.guestUsage.textMax)
        throw new AppError('Guest demo limit reached. Sign in to continue.', 'limit_reached');
    }

    const MATH_SYS = `You are a professional math tutor like Symbolab or Wolfram Alpha.
Solve math problems with COMPLETE step-by-step working. Rules:
1. Show EVERY algebraic step — never skip, never say "algebraic methods".
2. For equations: show each manipulation (add/subtract/divide both sides).
3. For trig: show inverse trig + general solution e.g. θ = π/6 + 2nπ.
4. For quadratic: compute Δ = b²−4ac, then both roots.
5. For calculus: name the rule (Power rule, Chain rule…) then apply it.
6. End with "Final Answer:" clearly labelled.
Format:
---METHOD: [Name] ---
Step 1: …
Step 2: …
Final Answer: …
---ENDMETHOD---
If multiple methods, add a second block. Steps ARE the answer.`;

    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (options.fileData)
      parts.push({ inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } });
    parts.push({ text: options.prompt });

    let text = '';
    let lastErr: unknown;
    for (const model of this.getModelsToTry(this.currentUser)) {
      try {
        const res = await ai.models.generateContent({
          model, contents: [{ role: 'user', parts }],
          config: { systemInstruction: MATH_SYS },
        });
        text = (res as any).text ?? '';
        if (!text && res.candidates?.[0]?.content?.parts)
          text = res.candidates[0].content.parts.map((p: any) => p.text ?? '').join('');
        if (text) break;
      } catch (e) { lastErr = e; }
    }
    if (!text && lastErr) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));

    if (this.currentUser)
      firebaseService.incrementUsage(this.currentUser.id, 'text').catch(() => {});
    else { this.resetGuestWindows(); this.guestUsage.textCount++; }

    return text || 'No solution returned. Try again.';
  }

  /** Agent: plan a task into rich, executable browser steps with clipboard + screenshot support */
  async agentPlan(task: string): Promise<{ steps: Array<{ action: string; target?: string; value?: string; description: string; instruction?: string; clipboardValue?: string }>; summary: string }> {
    const plan = this.currentUser?.plan?.toLowerCase() ?? '';
    if (plan !== 'pro' && plan !== 'pro_yearly' && plan !== 'basic' && plan !== 'basic_yearly') {
      throw new AppError('Agent mode requires Basic or Pro plan.', 'plan_required');
    }
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: `You are a browser automation agent. Break this task into concrete, executable steps.

TASK: ${task}

Reply ONLY with valid JSON (no markdown fences, no explanation):
{
  "summary": "One sentence: what will be accomplished",
  "steps": [
    {
      "action": "navigate",
      "target": "https://exact-url.com",
      "description": "Go to the website"
    },
    {
      "action": "type",
      "target": "search box / field name",
      "value": "exact text to type",
      "description": "Type the search query",
      "instruction": "Click the search box first, then paste"
    },
    {
      "action": "fill",
      "target": "Name field",
      "value": "John",
      "description": "Fill in the name"
    },
    {
      "action": "click",
      "target": "Submit button / exact label",
      "description": "Click submit",
      "instruction": "The button is at the bottom of the form"
    },
    {
      "action": "screenshot",
      "description": "Take a screenshot so Gemini can see the current state"
    },
    {
      "action": "copy",
      "target": "result",
      "value": "text to copy to clipboard",
      "description": "Copy the result"
    },
    {
      "action": "done",
      "description": "Task complete — describe what was accomplished"
    }
  ]
}

VALID ACTIONS: navigate, search, type, fill, click, screenshot, copy, wait, done

RULES:
- Use real URLs (https://...)
- For type/fill: put EXACT text in "value" field — it will be auto-copied to clipboard
- Add "instruction" for click steps to say WHERE exactly to click
- Include a screenshot step after navigation to complex pages
- Be specific and actionable
- 5-12 steps max` }] }],
      config: { systemInstruction: 'Output only valid JSON. No markdown. No explanation.' },
    });
    const text = (response.candidates?.[0]?.content?.parts?.[0] as any)?.text || '';
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      // Fallback to a basic search plan
      return {
        summary: `Search for: ${task}`,
        steps: [
          { action: 'search', value: task, description: 'Search Google for: ' + task },
          { action: 'screenshot', description: 'Take a screenshot of the results' },
          { action: 'done', description: 'Review the search results' }
        ]
      };
    }
  }

}

export const geminiService = new GeminiService();
