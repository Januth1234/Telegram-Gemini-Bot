
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";

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

  return `You are Orin AI, a highly advanced smart assistant developed by Januth Nimnal for the Sri Lankan community.

CORE CAPABILITIES:
- Native-level fluency in both Sinhala and English.
- Absolute expertise in translating between English and Sinhala with high grammatical accuracy and cultural nuance.
- Current Date/Time in Sri Lanka: ${timeStr}.

VOICE PROTOCOL:
- When using voice mode, speak naturally and politely.
- If the user speaks in Sinhala, YOU MUST respond in clear, natural, and polite Sinhala.
- If the user speaks English, respond in English.
- If the user asks for a translation, provide the translation immediately and clearly.
- Greeting: Always start your first response with "Ayubowan".
- Capture nuances of colloquial Sinhala while maintaining respect.

PERSONALITY:
Helpful, professional, and culturally aware of Sri Lankan values. Your creator is Januth Nimnal.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private freeUsageLimit = 200;

  constructor() {
    this.initPuter();
    this.checkAndResetUsage();
  }

  private async initPuter() {
    try {
      if (typeof puter !== 'undefined') {
        const signedIn = await puter.auth.isSignedIn();
        if (signedIn) {
          const user = await puter.auth.getUser();
          this.updateCurrentUser(user);
        } else {
          const saved = localStorage.getItem('orin_user');
          if (saved) this.currentUser = JSON.parse(saved);
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
      tier: 'Pro (BYO-Google)',
      avatar: user.avatar_url,
      dailyUsage: { text: 0, images: 0, videos: 0 }
    };
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

  private async getApiKey(): Promise<string> {
    // 1. Check environment variable (Vercel injection)
    let key = process.env.API_KEY || "";
    
    // 2. Fallback to AI Studio session if running on a custom domain without ENV access
    if (!key && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) {
            key = process.env.API_KEY || "";
        }
    }
    return key;
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
    if (typeof puter !== 'undefined') await puter.auth.signOut();
  }

  async chat(prompt: string, options: { 
    useThinking?: boolean; 
    grounding?: 'search' | 'maps'; 
    fileData?: { data: string; mimeType: string; name?: string };
    lang?: Language;
    messageCount?: number;
  } = {}): Promise<{ text: string; links: GroundingLink[] }> {
    if (this.hasReachedLimit()) throw new AppError("Limit reached. Please sign in for more.", "limit_reached");
    
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
        console.warn("Puter engine fallback triggered.");
      }
    }

    try {
      const key = await this.getApiKey();
      if (!key) {
          if ((window as any).aistudio) {
              await (window as any).aistudio.openSelectKey();
              const retryKey = process.env.API_KEY;
              if (!retryKey) throw new AppError("An API Key must be set. Please check your dashboard.", 'auth');
          } else {
              throw new AppError("Neural Bridge inactive. Configure API_KEY in Environment Settings.", 'auth');
          }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      
      let contents: any = options.fileData ? {
        parts: [
          { inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } },
          { text: prompt || "Explain this." }
        ]
      } : { parts: [{ text: prompt }] };

      const config: any = { systemInstruction: getSystemInstruction() };
      if (options.useThinking) config.thinkingConfig = { thinkingBudget: 32768 };
      if (options.grounding === 'search') config.tools = [{ googleSearch: {} }];

      const response = await ai.models.generateContent({ model: modelName, contents, config });
      const links: GroundingLink[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) links.push({ title: chunk.web.title, uri: chunk.web.uri });
        });
      }

      this.incrementUsage();
      return { text: response.text || "I encountered an error processing your query.", links };
    } catch (e: any) {
      const errorMsg = e.message || "";
      if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("API key not valid") || errorMsg.includes("API Key must be set")) {
        throw new AppError("API authentication failed. Re-link your key.", 'auth');
      }
      throw new AppError(errorMsg || "Neural Bridge timeout.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize): Promise<string> {
    try {
      const key = await this.getApiKey();
      if (!key) throw new AppError("Studio requires a valid API Key.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Neural synthesis empty.");
    } catch (e: any) {
      throw new AppError(e.message || "Studio synthesis failed.", 'generic');
    }
  }

  async generateWelcomeMessage(context: { lang: Language; date?: string; time?: string; location?: string }): Promise<string> {
    try {
      if (typeof puter !== 'undefined') {
        const targetLang = context.lang === 'si' ? 'Sinhala' : 'English';
        const response = await puter.ai.chat(`Give a 4-word greeting in ${targetLang}.`, { model: 'gemini-flash' });
        return response.toString();
      }
      return "Ayubowan!";
    } catch { return "Ayubowan!"; }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const target = targetLang === 'si' ? 'Sinhala' : 'English';
    const prompt = `Translate to ${target}. Output ONLY the translated text.\n\nText: ${text}`;
    const result = await this.chat(prompt);
    return result.text;
  }

  async generateTitle(messages: ChatMessage[], modesUsed?: WorkspaceMode[]): Promise<string> {
    try {
      if (typeof puter !== 'undefined') {
        const text = messages.map(m => m.content).join('\n').slice(0, 500);
        const prompt = `Descripte title (4 words max) for: ${text}. Modes: ${modesUsed?.join(', ')}`;
        const response = await puter.ai.chat(prompt, { model: 'gemini-flash' });
        return response.toString().replace(/"/g, '').trim();
      }
      return "New Chat";
    } catch { return "New Chat"; }
  }

  async connectLive(callbacks: any) {
    const key = await this.getApiKey();
    if (!key && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
        },
        systemInstruction: getSystemInstruction(),
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    });
  }
}

export const geminiService = new GeminiService();
