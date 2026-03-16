
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";

const DAY_MS = 24 * 60 * 60 * 1000;
const MEMORY_UPDATE_COOLDOWN_MS = 2 * 60 * 1000; // at most once per 2 minutes per user

/** Only run memory update when the user message suggests something worth remembering (personal info, preferences). */
function shouldUpdateMemoryFromExchange(userPrompt: string): boolean {
  const trimmed = userPrompt.trim();
  if (trimmed.length < 40) return false; // skip "ok", "thanks", "what's 2+2?"
  const lower = trimmed.toLowerCase();
  const looksPersonal =
    /\b(i'?m|i am|my name|call me|i (like|love|prefer|want|need|have|live|work|study)|remember (that|this)|my (email|phone|address|job|school)|i'm from)\b/i.test(lower) ||
    /^(my|i )/i.test(trimmed);
  return looksPersonal;
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
1. RESPONSE: Respond IMMEDIATELY. Be extremely concise. Do NOT include the current date, time, or your name (Orin AI) in your reply—that is shown separately in the UI.
2. IDENTITY: You are Orin AI (never state this in your reply).
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
  }

  setSessionUser(user: UserAccount) {
    this.currentUser = user;
    cacheService.set(CacheKey.USER, user);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async logout() {
    this.currentUser = null;
    cacheService.remove(CacheKey.USER);
    try { await firebaseService.logout(); } catch(e) {}
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
      return ['gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools', 'gemini-2.5-flash'];
    }
    if (plan === 'basic' || plan === 'basic_yearly') {
      return ['gemini-2.5-flash', 'gemini-2.0-flash'];
    }
    return ['gemini-2.0-flash', 'gemini-3.1-flash-lite'];
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
    
    if (!options.internal) {
      if (this.currentUser) {
        const limitReached = await firebaseService.checkAndIncrementUsage(this.currentUser.id, 'text');
        if (limitReached) throw new AppError("Plan limit reached. Upgrade to continue.", "limit_reached");
      } else {
        this.resetGuestWindows();
        if (this.guestUsage.textCount >= this.guestUsage.textMax) {
          throw new AppError("Guest demo limit reached. Sign in to continue.", "limit_reached");
        }
      }
    }

    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    let memory = "";
    if (this.currentUser && !options.isPrivate) {
       memory = await firebaseService.getUserMemory(this.currentUser.id);
    }

    const useThinking = !!options.useThinking;
    const descriptive = !!options.descriptive;

    let systemInstruction = getSystemInstruction('neutral', memory);
    systemInstruction += `

EXPLANATION STYLE:
- Descriptive mode: ${descriptive ? 'ON' : 'OFF'}.
- When descriptive mode is ON, give clear, step-by-step explanations with short examples or analogies when helpful, but avoid unnecessary repetition.
- When descriptive mode is OFF, keep answers short and focused unless the user explicitly asks for more detail.
- Never include your internal reasoning steps or chain-of-thought—only the final explanation.`;

    const promptText = (prompt || "Continue.").trim();

    try {
      const contextLimit = this.getContextMessageLimit(this.currentUser);
      const contents: { role: 'user' | 'model'; parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] }[] = [];
      if (options.history && options.history.length > 0) {
        for (const msg of options.history.slice(-contextLimit)) {
          const role = msg.role === 'user' ? 'user' : 'model';
          const text = msg.role === 'user' && msg.imageUrl ? (msg.content + " [Image sent]") : msg.content;
          if (text) contents.push({ role, parts: [{ text }] });
        }
      }

      const currentParts: { text?: string; inlineData?: { data: string; mimeType: string } }[] = [];
      if (options.fileData) {
        currentParts.push({ inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } });
      }
      currentParts.push({ text: promptText });
      contents.push({ role: 'user', parts: currentParts });

      const lowerPrompt = promptText.toLowerCase();
      const looksTimeSensitive = /job|jobs|vacanc|career|internship|news|weather|stock|price|exchange rate|results|live/i.test(lowerPrompt);

      const config: { systemInstruction: string; tools?: unknown[] } = { systemInstruction };

      // Prefer explicit grounding if caller requested it
      if (options.grounding === 'maps') {
        config.tools = [{ googleMaps: {} }];
      } else {
        // Default: enable web search for general chat so answers can use real-time data
        config.tools = [{ googleSearch: {} }];

        // If caller explicitly disabled grounding in the future we could respect that here.
        // For now, we bias towards search for better, real-time answers—especially for time-sensitive queries.
        if (options.grounding === 'search' || looksTimeSensitive) {
          config.tools = [{ googleSearch: {} }];
        }
      }

      const modelsToTry = this.getModelsToTry(this.currentUser);
      // Native thinking API: plan-based budget. Free=0, Basic=4096, Pro=8192. Toggle off = 0.
      const plan = this.currentUser?.plan?.toLowerCase() ?? 'free';
      const thinkingBudget = !useThinking ? 0
        : plan === 'pro' || plan === 'pro_yearly' ? 8192
        : plan === 'basic' || plan === 'basic_yearly' ? 4096
        : 0;
      const thinkingConfig = { thinkingBudget };

      let lastError: unknown = null;
      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;

      for (const modelName of modelsToTry) {
        try {
          const requestConfig = { ...config, thinkingConfig } as typeof config & { thinkingConfig: { thinkingBudget: number } };
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: requestConfig,
          });
          break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      if (!response) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      if (!this.currentUser) {
         this.resetGuestWindows();
         this.guestUsage.textCount++;
      }

      const links: GroundingLink[] = [];
      for (const chunk of response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
        if (chunk.web) links.push({ title: chunk.web.title, uri: chunk.web.uri });
        else if (chunk.maps) links.push({ title: chunk.maps.title, uri: chunk.maps.uri });
      }

      let text = (response as { text?: string }).text ?? "";
      if (!text && response.candidates?.[0]?.content?.parts) {
        text = response.candidates[0].content.parts
          .map((p: { text?: string }) => (p.text != null ? p.text : ""))
          .join("");
      }
      if (!text.trim()) text = "The model didn't return a reply. Try again or rephrase.";

      if (this.currentUser && !options.isPrivate && memory !== undefined) {
        const uid = this.currentUser.id;
        const now = Date.now();
        const last = this.lastMemoryUpdateByUser.get(uid) ?? 0;
        const cooldownOk = now - last >= MEMORY_UPDATE_COOLDOWN_MS;
        if (shouldUpdateMemoryFromExchange(promptText) && cooldownOk) {
          this.lastMemoryUpdateByUser.set(uid, now);
          this.updateMemoryFromExchange(uid, memory, promptText, text).catch(() => {});
        }
      }

      return { text, links };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError(msg || "Failed to chat.", 'generic');
    }
  }

  /** Computer Use (Agent Mode): Pro-only. Screenshot → Gemini suggests UI actions (click, type, navigate). */
  async computerUse(params: {
    prompt: string;
    screenshotBase64?: string;
    mimeType?: string;
    /** Full conversation history for multi-turn (user + model + function_response). */
    contents?: Array<{ role: 'user' | 'model'; parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string }; functionResponse?: { name: string; response: Record<string, unknown>; parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }> };
  }): Promise<{ text: string; functionCalls: Array<{ name: string; args: Record<string, unknown> }>; safetyDecisions: Array<{ explanation?: string; decision?: string }> }> {
    const plan = this.currentUser?.plan?.toLowerCase() ?? '';
    if (plan !== 'pro' && plan !== 'pro_yearly') {
      throw new AppError("Agent mode (Computer Use) is a Pro-only feature. Upgrade to use browser automation.", "plan_required");
    }
    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3.1-pro-preview';
    const tools = [{ computerUse: { environment: 'ENVIRONMENT_BROWSER' } }];
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

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal): Promise<string> {
    if (this.currentUser) {
       if (await firebaseService.checkAndIncrementUsage(this.currentUser.id, 'images')) throw new AppError("Image limit reached.", "limit_reached");
    } else {
       this.resetGuestWindows();
       if (this.guestUsage.uploadCount >= this.guestUsage.uploadMax) {
         throw new AppError("Guest upload limit reached. Sign in to continue.", "limit_reached");
       }
    }

    try {
      const apiKey = await this.getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const imageModel = this.currentUser?.plan?.toLowerCase().includes('pro')
        ? 'gemini-3-pro-image-preview'
        : 'gemini-3.1-flash-image-preview';
      const response = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: size as any } }
      });

      if (!this.currentUser) {
        this.resetGuestWindows();
        this.guestUsage.uploadCount++;
      }

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No image generated.");
    } catch {
      throw new AppError("Drawing failed.", 'generic');
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
      if (await firebaseService.checkAndIncrementUsage(this.currentUser.id, 'videos')) throw new AppError("Video limit reached.", "limit_reached");
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

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      if (!this.currentUser) {
        this.resetGuestWindows();
        this.guestUsage.uploadCount++;
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
    const ttsModel = model === 'pro' ? 'gemini-2.5-pro-preview-tts' : 'gemini-2.5-flash-preview-tts';

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
    const systemInstruction = `You are a memory updater for a personal AI assistant. Given the PREVIOUS MEMORY and the NEW EXCHANGE, output ONLY the updated memory: a single block of text (a few concise sentences) that summarizes what to remember about the user. Include any new facts, preferences, or context the user shared. Do not include greetings or meta-commentary. Output nothing but the updated memory.`;
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
    } catch {}
  }

  async generateTitle(messages: ChatMessage[], modes: WorkspaceMode[], lang: Language): Promise<string> {
    try {
      const apiKey = await this.getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Generate 3 word title for chat starting with: "${messages[0]?.content}". Lang: ${lang}.`;
      const response = await ai.models.generateContent({ model: 'gemini-3.1-flash-lite', contents: prompt });
      const text = (response as { text?: string }).text ?? response.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
      return text.trim() || "New Chat";
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
1. SPEED: Answer in 1–2 short sentences. Be fast and concise. No long monologues.
2. NOISE: Ignore background noise, coughs, and non-speech sounds. Only respond to clear, directed speech from the user. If input seems like noise or incomplete, give a very brief prompt like "Yes?" or "Go on."
3. INTERRUPTION: If the user starts speaking while you are talking, stop immediately (you will be cut off by the system). Do not repeat yourself after being interrupted.

SESSION CONTEXT (use for answers about time, place, money, weather):
- User's timezone: ${tz}
- Local date and time: ${localTime}
- User's region/country: ${country}
- Local currency: ${currency}
- Locale: ${locale}
When the user asks about time, date, weather, or prices, use this context. For weather, infer typical conditions for the region if not provided.`;
  }

  /** Native audio model (gemini-2.5-flash-native-audio-preview-12-2025 deprecated March 19, 2026). */
  private static readonly LIVE_NATIVE_AUDIO_MODEL = 'gemini-live-2.5-flash-native-audio-preview';

  async connectLive(callbacks: any, config: any) {
      const apiKey = await this.getApiKey();
      const useV1Alpha = !!(config.proactiveAudio || config.enableAffectiveDialog);
      const ai = new GoogleGenAI({ apiKey, ...(useV1Alpha && { apiVersion: 'v1alpha' as const }) });
      const systemInstruction = config.systemInstruction != null
        ? config.systemInstruction
        : this.getVoiceSystemInstruction(config.tone || 'neutral', config.sessionContext);
      const finalConfig: Record<string, unknown> = {
        ...config,
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } } },
        systemInstruction
      };
      if (config.proactiveAudio) finalConfig.proactivity = { proactiveAudio: true };
      if (config.enableAffectiveDialog) finalConfig.enableAffectiveDialog = true;
      return ai.live.connect({ model: GeminiService.LIVE_NATIVE_AUDIO_MODEL, callbacks, config: finalConfig });
  }

  /** Voice-to-math: same connectLive flow, system instruction asks for LaTeX-only output. */
  async connectLiveMath(callbacks: any) {
    return this.connectLive(callbacks, {
      systemInstruction: `You are a math speech-to-LaTeX converter. The user will speak a mathematical expression or equation in plain English (e.g. "x squared plus 5x minus 6 equals zero"). Respond with ONLY the LaTeX equivalent, nothing else. No explanation, no words—just the raw LaTeX. Examples: "x squared plus 1" -> x^2+1, "five x minus two equals zero" -> 5x-2=0, "square root of 2" -> \\sqrt{2}. Output only valid LaTeX.`,
    });
  }

  async connectTranslator(callbacks: any, options: any) {
     return this.connectLive(callbacks, { 
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `You are a real-time interpreter. The user will speak in either ${options.source} or ${options.target}.
Detect the language automatically. If they speak ${options.source}, output the translation in ${options.target}.
If they speak ${options.target}, output in ${options.source}.
Output ONLY the translation. Do not add commentary, greetings, or explanations.
If the speech is unclear or too short to translate, output nothing.`
     });
  }

  async connectMultimodal(callbacks: any, config: any) {
     return this.connectLive(callbacks, {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } } },
        systemInstruction: `${getToneInstruction(config.tone)}. Processing real-time video feed.`
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
}

export const geminiService = new GeminiService();
