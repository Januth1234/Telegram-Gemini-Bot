
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
3. LANGUAGE: Detect the user's language (Sinhala, Tamil, or English) and reply in the EXACT SAME language.
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
        systemInstruction: getSystemInstruction(),
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
        systemInstruction: `You are a professional bi-directional translator.
        Objective: Translate speech between ${options.source} and ${options.target}.
        Rules:
        1. If input is ${options.source}, translate to ${options.target}.
        2. If input is ${options.target}, translate to ${options.source}.
        3. Give ONLY the spoken translation. No introductions or explanations.`,
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
      const targetName = targetLang === 'si' ? 'Sinhala' : targetLang === 'ta' ? 'Tamil' : 'English';
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate to ${targetName}: "${text}". Only output the translation.`,
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
      const langName = lang === 'si' ? 'Sinhala' : lang === 'ta' ? 'Tamil' : 'English';
      const prompt = `Short title (3-5 words) for this chat in ${langName}: ${context}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      let title = response.text?.trim() || (lang === 'si' ? "නව පිළිසඳර" : lang === 'ta' ? "புதிய அரட்டை" : "New Chat");
      const words = title.split(' ');
      if (words.length > 5) title = words.slice(0, 5).join(' ');
      return title;
    } catch {
      return lang === 'si' ? "නව පිළිසඳර" : lang === 'ta' ? "புதிய அரட்டை" : "New Chat";
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
              contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
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

  async generateVideo(prompt: string): Promise<string> {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using Veo fast generate preview
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed.");
    
    // Must append API key to download
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async animateImage(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt, // Prompt is optional but helpful
      image: {
        imageBytes: imageBase64,
        mimeType: mimeType
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Animation failed.");

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async generateSpeech(text: string): Promise<string> {
     if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore, Puck, Charon, Fenrir
              },
          },
        },
     });

     const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
     if (!base64Audio) throw new Error("Audio generation failed.");
     return this.pcmToWav(base64Audio);
  }

  private pcmToWav(base64: string): string {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, 24000, true); // Sample Rate
    view.setUint32(28, 24000 * 2, true); // Byte Rate
    view.setUint16(32, 2, true); // Block Align
    view.setUint16(34, 16, true); // Bits per sample
    
    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, len, true);
    
    const blob = new Blob([view, bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
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
