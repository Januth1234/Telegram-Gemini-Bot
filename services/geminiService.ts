
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";

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
    this.initUser();
    this.checkAndResetUsage();
  }

  private initUser() {
    try {
      const saved = localStorage.getItem('orin_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("User init failed.");
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

  private updateCurrentUser(user: UserAccount) {
    this.currentUser = user;
    this.saveUser();
  }

  public setSessionUser(user: UserAccount) {
    this.updateCurrentUser(user);
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

  private getGoogleApiKey(): string | undefined {
    const local = localStorage.getItem('orin_google_key');
    if (local && local.trim().length > 0) return local;
    
    // Safely check for process.env.API_KEY
    try {
      return (window as any).process?.env?.API_KEY || (import.meta as any).env?.VITE_API_KEY;
    } catch {
      return undefined;
    }
  }

  private async ensureGoogleKeyReady() {
    const key = this.getGoogleApiKey();
    if (key) return;

    const studio = (window as any).aistudio;
    if (studio) {
      const hasKey = await studio.hasSelectedApiKey();
      if (!hasKey) {
        await studio.openSelectKey();
        return;
      }
    }
  }

  async loginWithGoogle(): Promise<UserAccount> {
    try {
      const studio = (window as any).aistudio;
      if (studio) {
        await studio.openSelectKey();
        const hasKey = await studio.hasSelectedApiKey();
        if (!hasKey) {
          throw new Error("Key selection cancelled.");
        }
      }

      const newUser: UserAccount = {
        id: `user-${Date.now()}`,
        name: 'Orin Member',
        email: 'member@orin.ai',
        tier: 'Verified Member',
        avatar: '',
        dailyUsage: { text: 0, images: 0, videos: 0 }
      };
      
      this.updateCurrentUser(newUser);
      return newUser;

    } catch (e: any) {
      if (e.message && e.message.includes("cancelled")) {
          throw new AppError("Sign-In Cancelled.", 'auth');
      }
      const fallbackUser: UserAccount = {
        id: `local-${Date.now()}`,
        name: 'Guest User',
        email: 'guest@local',
        tier: 'Basic',
        dailyUsage: { text: 0, images: 0, videos: 0 }
      };
      this.updateCurrentUser(fallbackUser);
      return fallbackUser;
    }
  }

  async logout() {
    this.currentUser = null;
    this.saveUser();
  }

  async chat(prompt: string, options: { 
    useThinking?: boolean; 
    grounding?: 'search' | 'maps'; 
    fileData?: { data: string; mimeType: string; name?: string };
    lang?: Language;
    messageCount?: number;
    history?: ChatMessage[];
  } = {}): Promise<{ text: string; links: GroundingLink[]; reasoning_details?: any }> {
    if (this.hasReachedLimit()) throw new AppError("Limit reached. Please sign in for more.", "limit_reached");
    await this.ensureGoogleKeyReady();
    const apiKey = this.getGoogleApiKey();
    if (!apiKey) throw new AppError("API Key missing.", 'auth');
    
    const ai = new GoogleGenAI({ apiKey });

    // Use Gemini 3 Flash for basic tasks, Pro for thinking
    const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const config: any = { 
      systemInstruction: getSystemInstruction(),
      temperature: 0.7,
    };
    
    if (options.useThinking) {
      config.thinkingConfig = { thinkingBudget: 2048 }; 
    }
    
    if (options.grounding === 'search') {
      config.tools = [{ googleSearch: {} }];
    } else if (options.grounding === 'maps') {
      config.tools = [{ googleMaps: {} }];
    }

    const contents: any[] = [];
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
      currentParts.push({ inlineData: { mimeType: options.fileData.mimeType, data: options.fileData.data } });
    }
    currentParts.push({ text: prompt });
    contents.push({ role: 'user', parts: currentParts });

    try {
        const response = await ai.models.generateContent({ model: modelName, contents: contents, config: config });
        const text = response.text || "No response.";
        const links: GroundingLink[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri && chunk.web?.title) {
                  links.push({ title: chunk.web.title, uri: chunk.web.uri });
                }
            });
        }
        this.incrementUsage();
        return { text, links };
    } catch (e: any) {
        if (e.message?.includes("API key") || e.message?.includes("403")) throw new AppError("Invalid API Key. Please sign in again.", 'auth');
        throw new AppError(e.message || "Connection failed.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize): Promise<string> {
    try {
      await this.ensureGoogleKeyReady();
      const apiKey = this.getGoogleApiKey();
      if (!apiKey) throw new AppError("API Key missing.", 'auth');
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Empty image returned.");
    } catch (e: any) {
      if (e.message?.includes("entity was not found") && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
      throw new AppError(e.message || "Image creation failed.", 'generic');
    }
  }

  async generateWelcomeMessage(context: { lang: Language; date?: string; time?: string; location?: string }): Promise<string> {
    try {
      const key = this.getGoogleApiKey();
      if (!key) return "Ayubowan! Ready to assist.";
      const prompt = `Give a short, friendly time-based greeting (e.g., 'Good Morning') in ${context.lang === 'si' ? 'Sinhala' : 'English'}. Do NOT use the word 'Ayubowan'. Keep it under 5 words. Time: ${context.time}.`;
      const res = await this.chat(prompt, { useThinking: false });
      return res.text.replace(/"/g, '').trim();
    } catch { return "Ayubowan! Ready to assist."; }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const target = targetLang === 'si' ? 'Sinhala' : 'English';
    const prompt = `Translate to ${target}. Output ONLY translated text.\n\nText: ${text}`;
    const result = await this.chat(prompt);
    return result.text;
  }

  async generateTitle(messages: ChatMessage[], modesUsed?: WorkspaceMode[], preferredLang: Language = 'en'): Promise<string> {
    try {
       const textMessages = messages.filter(m => m.type === 'text');
       if (textMessages.length === 0 && modesUsed?.includes('studio')) return preferredLang === 'si' ? "නිර්මාණාත්මක සැසිය" : "Creative Session";
       if (textMessages.length === 0 && modesUsed?.includes('translator')) return preferredLang === 'si' ? "භාෂා පරිවර්තනය" : "Live Translation";
       if (textMessages.length === 0) return preferredLang === 'si' ? "නව පිළිසඳර" : "New Chat";
       
       const filteredContent = textMessages
          .map(m => m.content)
          .join(' ')
          .replace(/Ayubowan/gi, '')
          .replace(/ආයුබෝවන්/g, '')
          .replace(/Hello/gi, '')
          .replace(/Hi/gi, '')
          .trim()
          .slice(0, 500);

       if (!filteredContent || filteredContent.length < 5) return preferredLang === 'si' ? "නව පිළිසඳර" : "New Chat";

       const hasSinhala = /[\u0D80-\u0DFF]/.test(filteredContent);
       const targetLang = hasSinhala ? 'Sinhala' : (preferredLang === 'si' ? 'Sinhala' : 'English');
       const prompt = `Generate a very short (2-4 words) descriptive title for this conversation based on the user's intent. IGNORE all greetings like "Ayubowan". Output ONLY the title in ${targetLang}. Do NOT use quotation marks.\n\nContext: ${filteredContent}`;
       const res = await this.chat(prompt, { useThinking: false });
       let title = res.text.replace(/"/g, '').replace(/\*\*/g, '').trim();
       
       title = title.replace(/Ayubowan/gi, '').replace(/ආයුබෝවන්/g, '').trim();
       if (!title) return preferredLang === 'si' ? "නව පිළිසඳර" : "New Chat";
       
       return title;
    } catch { return preferredLang === 'si' ? "නව පිළිසඳර" : "New Chat"; }
  }

  async connectLive(callbacks: any) {
    await this.ensureGoogleKeyReady();
    const apiKey = this.getGoogleApiKey();
    if (!apiKey) throw new AppError("API Key missing.", 'auth');
    
    const ai = new GoogleGenAI({ apiKey });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: getSystemInstruction(),
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    });
  }

  async connectTranslator(callbacks: any, languages: { source: string, target: string }) {
    await this.ensureGoogleKeyReady();
    const apiKey = this.getGoogleApiKey();
    if (!apiKey) throw new AppError("API Key missing.", 'auth');
    
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are a professional simultaneous interpreter mediating between ${languages.source} and ${languages.target} speakers.
    
    PROTOCOL:
    1. Listen to input audio.
    2. Auto-detect if it is ${languages.source} or ${languages.target}.
    3. If input is ${languages.source}, translate to ${languages.target} and speak it out.
    4. If input is ${languages.target}, translate to ${languages.source} and speak it out.
    5. NEVER engage in conversation. ONLY translate.
    6. Response must be immediate. Maintain the speaker's tone.`;

    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
        systemInstruction: systemInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    });
  }
}

export const geminiService = new GeminiService();
