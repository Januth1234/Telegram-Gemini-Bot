
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";

declare const puter: any;

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

  return `You are Orin AI, a helpful assistant from Sri Lanka.
  
RULES:
1. SIMPLE: Use everyday language.
2. DIRECT: Answer immediately.
3. LANGUAGE: Use simple Sinhala, Tamil, or English.
4. IDENTITY: Only mention Januth Nimnal if asked.
5. CONCISE: Keep it short and helpful.

Context: Time in Sri Lanka is ${timeStr}.`;
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
      console.warn("Connection delayed.");
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
        systemInstruction: getSystemInstruction() + "\nCRITICAL: Respond IMMEDIATELY. Be extremely concise. Support Sinhala and Tamil input.",
      },
    });
  }

  async connectTranslator(callbacks: any, options: { source: string; target: string }) {
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
        systemInstruction: `You are a professional real-time interpreter.
        Your task is to translate spoken audio between ${options.source} and ${options.target}.
        
        RULES:
        1. If you hear ${options.source}, translate it to ${options.target}.
        2. If you hear ${options.target}, translate it to ${options.source}.
        3. Speak the translation CLEARLY and IMMEDIATELY.
        4. Do NOT add introductory phrases like "He said" or "Translating". Just speak the translated text.
        5. Detect the input language automatically between ${options.source} and ${options.target}.`,
      },
    });
  }

  async generateWelcomeMessage(options: { timeOfDay: string; weather: string; lang: Language }): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Generate a very cheerful greeting in ${options.lang === 'si' ? 'Sinhala' : options.lang === 'ta' ? 'Tamil' : 'English'}.
      Context: It is a ${options.weather} ${options.timeOfDay} in Sri Lanka.
      STRICT RULE: It MUST be exactly 6 to 7 words long. No emojis. No symbols.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      let text = response.text?.trim() || "";
      const words = text.split(/\s+/);
      if (words.length > 7) text = words.slice(0, 7).join(' ');
      return text;
    } catch {
      return "";
    }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const target = targetLang === 'si' ? 'Sinhala' : targetLang === 'ta' ? 'Tamil' : 'English';
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate to ${target}: "${text}". Only output the translation.`,
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
      const target = lang === 'si' ? 'Sinhala' : lang === 'ta' ? 'Tamil' : 'English';
      const prompt = `Short title (3-5 words) for this chat in ${target}: ${context}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      let title = response.text?.trim() || (lang === 'si' ? "නව පිළිසඳර" : "New Chat");
      const words = title.split(' ');
      if (words.length > 5) title = words.slice(0, 5).join(' ');
      return title;
    } catch {
      return "New Chat";
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
    if (this.hasReachedLimit()) throw new AppError("Limit reached.", "limit_reached");
    
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      
      let contents: any[] = [];
      if (options.history && options.history.length > 0) {
          options.history.slice(-10).forEach(msg => {
              if (msg.role === 'user' && msg.imageUrl) {
                 contents.push({ role: 'user', parts: [{ text: msg.content + " [Image sent]" }] });
              } else {
                 contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
              }
          });
      }

      const currentParts: any[] = [];
      if (options.fileData) {
          currentParts.push({ inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } });
      }
      currentParts.push({ text: prompt || "Continue." });
      contents.push({ role: 'user', parts: currentParts });

      const config: any = { systemInstruction: getSystemInstruction() };
      if (options.grounding === 'search') config.tools = [{ googleSearch: {} }];
      else if (options.grounding === 'maps') config.tools = [{ googleMaps: {} }];

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
      throw new AppError("Failed to chat.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal): Promise<string> {
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: size as any } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No image generated.");
    } catch (e: any) {
      throw new AppError("Drawing failed.", 'generic');
    }
  }

  async downloadImage(url: string, filename: string = "orin-image") {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Save error:", err);
    }
  }
}

export const geminiService = new GeminiService();
