
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";

declare const puter: any;

const getEnvApiKey = () => {
  try {
    return process.env.API_KEY || "";
  } catch {
    return "";
  }
};

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
2. BE DIRECT: Start answering immediately. Don't say "Hello" or "I am an AI" unless asked.
3. LANGUAGE: If the user speaks Sinhala, use natural, simple Sinhala (not formal book language). If English, use simple English.
4. MATH: Show math steps clearly using LaTeX.
5. IDENTITY: Only mention you were made by Januth Nimnal if asked.

Context:
Time in Sri Lanka: ${timeStr}.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private freeUsageLimit = 200;

  constructor() {
    const saved = localStorage.getItem('orin_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        console.warn("Session cleared.");
        localStorage.removeItem('orin_user');
      }
    }
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
      console.warn("Puter delayed.");
    }
  }

  private checkAndResetUsage() {
    const lastReset = localStorage.getItem('orin_last_reset');
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!lastReset || (now - parseInt(lastReset)) > oneDay) {
      localStorage.setItem('orin_usage_count', '0');
      localStorage.setItem('orin_last_reset', now.toString());
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
      localStorage.setItem('orin_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('orin_user');
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUsageCount(): number {
    this.checkAndResetUsage();
    return parseInt(localStorage.getItem('orin_usage_count') || '0');
  }

  incrementUsage() {
    const current = this.getUsageCount();
    localStorage.setItem('orin_usage_count', (current + 1).toString());
  }

  hasReachedLimit(): boolean {
    if (this.currentUser) return false; 
    return this.getUsageCount() >= this.freeUsageLimit;
  }

  private async checkApiKey(): Promise<boolean> {
    const key = getEnvApiKey();
    if (key) return true;
    
    if ((window as any).aistudio) {
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
      throw new AppError("Sign in failed.", 'auth');
    }
  }

  async logout() {
    this.currentUser = null;
    this.saveUser();
    try { await firebaseService.logout(); } catch(e) {}
    if (typeof puter !== 'undefined') await puter.auth.signOut();
  }

  async convertMathImageToLatex(base64Data: string, mimeType: string): Promise<string> {
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: "Output ONLY the raw LaTeX for the math in this image." }
          ]
        }]
      });
      return (response.text || "").replace(/```latex/g, '').replace(/```/g, '').trim();
    } catch (e: any) {
      throw new AppError("Could not read math.", 'generic');
    }
  }

  async chat(prompt: string, options: { 
    useThinking?: boolean; 
    grounding?: 'search' | 'maps'; 
    fileData?: { data: string; mimeType: string; name?: string };
    lang?: Language;
    messageCount?: number;
    history?: ChatMessage[];
  } = {}): Promise<{ text: string; links: GroundingLink[]; reasoning_details?: any }> {
    if (this.hasReachedLimit()) throw new AppError("Limit reached. Please sign in.", "limit_reached");
    
    const count = options.messageCount || 0;
    const isUserLoggedIn = !!this.currentUser;
    const usePuterAI = isUserLoggedIn || count >= 2;

    if (usePuterAI && typeof puter !== 'undefined') {
      try {
        const response = await puter.ai.chat(prompt, {
           model: 'gemini-flash',
           system_prompt: getSystemInstruction()
        });
        this.incrementUsage();
        return { text: response.toString(), links: [] };
      } catch (e) {
        console.warn("Puter fallback.");
      }
    }

    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');

      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
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
      currentParts.push({ text: prompt || "Explain this." });
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
      throw new AppError("Failed to process.", 'generic');
    }
  }

  async generateWelcomeMessage(options: { date: string, time: string, location?: string, lang: Language }): Promise<string> {
    try {
      if (!await this.checkApiKey()) return "";
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      const prompt = `Say a very brief, friendly hello. 
      Context: Date is ${options.date}, Time is ${options.time}. Language: ${options.lang === 'si' ? 'Sinhala' : 'English'}. 
      Max 5 words.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text?.trim() || "";
    } catch {
      return "";
    }
  }

  async generateTitle(messages: ChatMessage[], modes: WorkspaceMode[], lang: Language): Promise<string> {
    try {
      if (!await this.checkApiKey()) return "New Chat";
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      const prompt = `Title this chat in 2 words. Language: ${lang === 'si' ? 'Sinhala' : 'English'}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text?.trim() || "New Chat";
    } catch {
      return "New Chat";
    }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      const prompt = `Translate to ${targetLang === 'si' ? 'Sinhala' : 'English'}: ${text}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || text;
    } catch (e: any) {
      throw new AppError("Translation failed.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize): Promise<string> {
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: size as any
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Failed.");
    } catch (e: any) {
      throw new AppError("Failed to draw.", 'generic');
    }
  }

  async connectLive(callbacks: any) {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: getSystemInstruction()
      }
    });
  }

  async connectTranslator(callbacks: any, options: { source: string, target: string }) {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are a translator between ${options.source} and ${options.target}. Speak simply and naturally.`
      }
    });
  }
}

export const geminiService = new GeminiService();
