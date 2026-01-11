
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";

declare const puter: any;

/**
 * Orin AI Gemini Service
 * Handles all interactions with Google GenAI models and user session management.
 */

export class AppError extends Error {
  constructor(public message: string, public type: 'safety' | 'quota' | 'auth' | 'generic' | 'not_found' | 'limit_reached' = 'generic') {
    super(message);
    this.name = 'AppError';
  }
}

const getSystemInstruction = () => {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  return `You are Orin AI, a helpful and simple assistant from Sri Lanka.

RULES:
1. BE SIMPLE: Use everyday language. No complex jargon or heavy words.
2. BE DIRECT: Start answering immediately. 
3. LANGUAGE: If the user speaks Sinhala, use natural, simple Sinhala. If English, use simple English.
4. MATH: Show math steps clearly using LaTeX.
5. IDENTITY: Only mention you were made by Januth Nimnal if asked.
6. LENGTH: Keep responses helpful but concise.

Context:
Time in Sri Lanka: ${timeStr}.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private freeUsageLimit = 200;

  constructor() {
    this.currentUser = cacheService.get<UserAccount | null>(CacheKey.USER, null);
    this.initPuter();
    this.initFirebaseListener();
    this.checkAndResetUsage();
  }

  private initFirebaseListener() {
    firebaseService.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        if (!this.currentUser) {
           const newUser: UserAccount = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email || "user@orin.ai",
              avatar: firebaseUser.photoURL || undefined,
              tier: 'Verified Member',
              dailyUsage: { text: 0, images: 0, videos: 0 }
           };
           this.setSessionUser(newUser);
        }
      }
    });
  }

  private async initPuter() {
    try {
      if (typeof puter !== 'undefined') {
        const signedIn = await puter.auth.isSignedIn();
        if (signedIn) {
          const user = await puter.auth.getUser();
          this.updateCurrentUser(user);
        }
      }
    } catch (e) {
      console.warn("Puter connection delayed.");
    }
  }

  private checkAndResetUsage() {
    const lastReset = cacheService.get<string | null>(CacheKey.LAST_RESET, null);
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!lastReset || (now - parseInt(lastReset)) > oneDay) {
      cacheService.set(CacheKey.USAGE_COUNT, 0);
      cacheService.set(CacheKey.LAST_RESET, now.toString());
    }
  }

  private updateCurrentUser(user: any) {
    if (!user) return;
    this.currentUser = {
      id: user.id || 'anonymous',
      name: user.name || user.username || 'Friend',
      email: user.email || `${user.username || user.id}@puter.com`,
      tier: 'Verified Member',
      avatar: user.avatar_url,
      dailyUsage: { text: 0, images: 0, videos: 0 }
    };
    this.saveUser();
  }

  setSessionUser(user: UserAccount) {
    this.currentUser = user;
    this.saveUser();
  }

  private saveUser() {
    if (this.currentUser) {
      cacheService.set(CacheKey.USER, this.currentUser);
    } else {
      cacheService.remove(CacheKey.USER);
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUsageCount(): number {
    this.checkAndResetUsage();
    return cacheService.get<number>(CacheKey.USAGE_COUNT, 0);
  }

  incrementUsage() {
    const current = this.getUsageCount();
    cacheService.set(CacheKey.USAGE_COUNT, current + 1);
  }

  hasReachedLimit(): boolean {
    if (this.currentUser) return false; 
    return this.getUsageCount() >= this.freeUsageLimit;
  }

  private async checkApiKey(): Promise<boolean> {
    const key = process.env.API_KEY;
    if (key) return true;
    
    if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) return true;
        await (window as any).aistudio.openSelectKey();
        return true;
    }
    return false;
  }

  async loginWithGoogle(): Promise<UserAccount> {
    try {
      if (typeof puter === 'undefined') throw new Error("System offline.");
      const user = await puter.auth.signIn();
      this.updateCurrentUser(user);
      return this.currentUser!;
    } catch (e: any) {
      throw new AppError("Login failed.", 'auth');
    }
  }

  async logout() {
    this.currentUser = null;
    this.saveUser();
    try { await firebaseService.logout(); } catch(e) {}
    if (typeof puter !== 'undefined') await puter.auth.signOut();
  }

  async connectLive(callbacks: any) {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: getSystemInstruction(),
      },
    });
  }

  async connectTranslator(callbacks: any, config: { source: string; target: string }) {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: `You are a translator between ${config.source} and ${config.target}. Speak ONLY the translation.`,
      },
    });
  }

  async generateWelcomeMessage(options: { date: string; time: string; location?: string; lang: Language }): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Strict 3-5 word rule enforced in prompt
      const prompt = `Generate a very short greeting in ${options.lang === 'si' ? 'Sinhala' : 'English'}.
      It MUST be exactly 3 to 5 words. No more, no less.
      Context: Time is ${options.time}. No emojis or jargon.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text?.trim() || (options.lang === 'si' ? "ඔබට සුබ දවසක් වේවා" : "Have a good day");
    } catch {
      return options.lang === 'si' ? "ඔබට සුබ දවසක් වේවා" : "Have a good day";
    }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate this to ${targetLang === 'si' ? 'Sinhala' : 'English'}: "${text}". Only the translation.`,
      });
      return response.text || text;
    } catch {
      return text;
    }
  }

  async generateTitle(messages: ChatMessage[], modes: WorkspaceMode[], lang: Language): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = messages.slice(0, 3).map(m => m.content).join(' ');
      const prompt = `Give this chat a name in ${lang === 'si' ? 'Sinhala' : 'English'}. 
      Strict Rule: Use exactly 3 to 4 words. Max 5. 
      Context: ${context}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      let title = response.text?.trim() || (lang === 'si' ? "නව සංවාදය" : "New Chat");
      // Fallback trim if AI is too talkative
      const words = title.split(' ');
      if (words.length > 5) title = words.slice(0, 5).join(' ');
      
      return title;
    } catch {
      return lang === 'si' ? "නව සංවාදය" : "New Chat";
    }
  }

  async chat(prompt: string, options: { 
    useThinking?: boolean; 
    grounding?: 'search' | 'maps'; 
    fileData?: { data: string; mimeType: string; name?: string };
    lang?: Language;
    messageCount?: number;
    history?: ChatMessage[];
    signal?: AbortSignal;
  } = {}): Promise<{ text: string; links: GroundingLink[]; reasoning_details?: any }> {
    if (this.hasReachedLimit()) throw new AppError("Limit reached. Please login.", "limit_reached");
    
    const count = options.messageCount || 0;
    const isUserLoggedIn = !!this.currentUser;
    const usePuterAI = isUserLoggedIn || count >= 2;

    if (usePuterAI && typeof puter !== 'undefined' && !options.signal) {
      try {
        const response = await puter.ai.chat(prompt, {
           model: 'gemini-flash',
           system_prompt: getSystemInstruction()
        });
        this.incrementUsage();
        return { text: response.toString(), links: [] };
      } catch (e) {
        console.warn("Puter fallback active.");
      }
    }

    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      
      let contents: any[] = [];
      if (options.history && options.history.length > 0) {
          const recentHistory = options.history.slice(-10);
          for (const msg of recentHistory) {
              const role = msg.role === 'user' ? 'user' : 'model';
              if (msg.type === 'text' && msg.content) {
                  contents.push({ role, parts: [{ text: msg.content }] });
              }
          }
      }

      const currentParts: any[] = [];
      if (options.fileData) {
          currentParts.push({ inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } });
      }
      currentParts.push({ text: prompt || "Continue." });
      contents.push({ role: 'user', parts: currentParts });

      const config: any = { 
        systemInstruction: getSystemInstruction(),
      };

      if (options.grounding === 'search') {
        config.tools = [{ googleSearch: {} }];
      } else if (options.grounding === 'maps') {
        config.tools = [{ googleMaps: {} }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config
      });

      this.incrementUsage();

      const links: GroundingLink[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web) links.push({ title: chunk.web.title, uri: chunk.web.uri });
          else if (chunk.maps) links.push({ title: chunk.maps.title, uri: chunk.maps.uri });
        });
      }

      return { text: response.text || "", links };
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      throw new AppError("Network Error", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal): Promise<string> {
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config: any = {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: size as any
        }
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Empty Response");
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      throw new AppError("Drawing Failed", 'generic');
    }
  }

  async downloadImage(url: string, filename: string = "orin-image") {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Save error:", err);
    }
  }
}

export const geminiService = new GeminiService();
