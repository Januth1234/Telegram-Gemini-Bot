
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";

const DAY_MS = 24 * 60 * 60 * 1000;

export class AppError extends Error {
  constructor(public message: string, public type: 'safety' | 'quota' | 'auth' | 'generic' | 'not_found' | 'limit_reached' = 'generic') {
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

  /** Chat model chain by plan. Free → flash, Basic → 2.5-flash, Pro → 2.5-pro */
  private getModelsToTry(user: typeof this.currentUser): string[] {
    const plan = user?.plan?.toLowerCase() ?? 'free';
    if (plan === 'pro' || plan === 'pro_yearly')
      return ['gemini-2.5-pro-preview-06-05', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    if (plan === 'basic' || plan === 'basic_yearly')
      return ['gemini-2.5-flash', 'gemini-2.0-flash'];
    return ['gemini-2.0-flash', 'gemini-2.5-flash'];
  }

  /** Context window depth by plan. Free=5, Basic=10, Pro=20 */
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
  } = {}): Promise<{ text: string; links: GroundingLink[]; reasoning_details?: any }> {
    
    if (this.currentUser) {
       const limitReached = await firebaseService.checkLimit(this.currentUser.id, 'text');
       if (limitReached) throw new AppError("Plan limit reached. Upgrade to continue.", "limit_reached");
    } else {
       this.resetGuestWindows();
       if (this.guestUsage.textCount >= this.guestUsage.textMax) {
         throw new AppError("Guest demo limit reached. Sign in to continue.", "limit_reached");
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

    if (useThinking) {
      systemInstruction += `

REASONING MODE:
- For complex or technical questions, think through the problem internally before answering.
- Use structured reasoning to avoid mistakes, but only output the final answer and concise explanation, not your intermediate thoughts.`;
    }
    const promptText = (prompt || "Continue.").trim();

    try {
      const contents: { role: 'user' | 'model'; parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] }[] = [];
      if (options.history && options.history.length > 0) {
        for (const msg of options.history.slice(-this.getContextLimit(this.currentUser))) {
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
      let lastError: unknown = null;
      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config,
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

      if (this.currentUser && !options.isPrivate) {
         firebaseService.incrementUsage(this.currentUser.id, 'text').catch(() => {});
      } else if (!this.currentUser) {
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
        this.updateMemoryFromExchange(this.currentUser.id, memory, promptText, text).catch(() => {});
      }

      return { text, links };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError(msg || "Failed to chat.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal): Promise<string> {
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
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: size as any } }
      });

      if (this.currentUser) {
        firebaseService.incrementUsage(this.currentUser.id, 'images').catch(() => {});
      } else {
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

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p' = '720p'): Promise<string> {
    if (this.currentUser) {
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
      const model = resolution === '1080p' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';

      let operation = await ai.models.generateVideos({
        model: model,
        prompt: prompt,
        config: { numberOfVideos: 1, resolution: resolution, aspectRatio: aspectRatio }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      if (this.currentUser) {
        firebaseService.incrementUsage(this.currentUser.id, 'videos').catch(() => {});
      } else {
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
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      const text = (response as { text?: string }).text ?? response.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
      return text.trim() || "New Chat";
    } catch { return "New Chat"; }
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

  async connectLive(callbacks: any, config: any) {
      const apiKey = await this.getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = config.systemInstruction != null
        ? config.systemInstruction
        : this.getVoiceSystemInstruction(config.tone || 'neutral', config.sessionContext);
      const finalConfig = {
        ...config,
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } } },
        systemInstruction
      };
      return ai.live.connect({ model: 'gemini-2.5-flash-native-audio-preview-12-2025', callbacks, config: finalConfig });
  }

  async connectTranslator(callbacks: any, options: any) {
     return this.connectLive(callbacks, { 
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `ACT AS A STRICT INTERPRETER. TASK: Translate speech between ${options.source} and ${options.target}.`
     });
  }

  async connectMultimodal(callbacks: any, config: any) {
     return this.connectLive(callbacks, {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } } },
        systemInstruction: `${getToneInstruction(config.tone)}. Processing real-time video feed.`
     });
  }
}

  /**
   * Dedicated math solver — bypasses the general chat system instruction that says
   * "Never include your internal reasoning steps or chain-of-thought".
   * Uses a Symbolab-style system instruction that forces full numbered steps.
   * Respects plan hierarchy: Free uses flash, Basic uses 2.5-flash, Pro uses 2.5-pro.
   */
  async solveMathWithAI(options: {
    prompt: string;
    fileData?: { data: string; mimeType: string; name?: string };
  }): Promise<string> {
    // Usage gate
    if (this.currentUser) {
      const limitReached = await firebaseService.checkLimit(this.currentUser.id, 'text');
      if (limitReached) throw new AppError('Plan limit reached. Upgrade to continue.', 'limit_reached');
    } else {
      this.resetGuestWindows();
      if (this.guestUsage.textCount >= this.guestUsage.textMax) {
        throw new AppError('Guest demo limit reached. Sign in to continue.', 'limit_reached');
      }
    }

    const MATH_SYSTEM = `You are a professional math tutor like Symbolab or Wolfram Alpha.
Your ONLY job: solve math problems with complete step-by-step working.

RULES (follow exactly):
1. Show EVERY algebraic step — never skip, never write vague phrases like "algebraic methods".
2. For equations: show each manipulation (add/subtract/divide both sides).
3. For trig equations: show inverse trig + general solution(s) e.g. θ = π/6 + 2nπ.
4. For quadratic: calculate Δ = b²−4ac explicitly, then derive both roots.
5. For calculus: name the rule (Power rule, Chain rule, etc.) then apply it.
6. End with a clearly labelled Final Answer.

FORMAT — use this structure exactly:
---METHOD: [Method Name] ---
Step 1: [what you're doing]
[actual math]
Step 2: [what you're doing]
[actual math]
...
Final Answer: [clearly stated]
---ENDMETHOD---

If multiple methods exist, add a second METHOD block.
Steps ARE the answer — never refuse to show them.`;

    const apiKey = await this.getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = this.getModelsToTry(this.currentUser);

    const parts: any[] = [];
    if (options.fileData) {
      parts.push({ inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } });
    }
    parts.push({ text: options.prompt });

    let text = '';
    let lastError: unknown = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: MATH_SYSTEM },
        });
        text = (response as any).text ?? '';
        if (!text && response.candidates?.[0]?.content?.parts) {
          text = response.candidates[0].content.parts.map((p: any) => p.text ?? '').join('');
        }
        if (text) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!text && lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));

    // Increment usage after success
    if (this.currentUser) {
      firebaseService.incrementUsage(this.currentUser.id, 'text').catch(() => {});
    } else {
      this.resetGuestWindows();
      this.guestUsage.textCount++;
    }

    return text || 'No solution returned. Please try again.';
  }

export const geminiService = new GeminiService();
