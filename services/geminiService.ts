
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

  // Public setter for external auth providers
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

  /**
   * Retrieves the Google Native API key.
   * Priority: Local Storage (User Input) -> Env Vars
   */
  private getGoogleApiKey(): string | undefined {
    // Check local storage for manually set key (legacy support or dev overrides)
    const local = localStorage.getItem('orin_google_key');
    if (local && local.trim().length > 0) return local;
    
    // Check environment variable
    return process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
  }

  private async ensureGoogleKeyReady() {
    // If we have a key in local storage or env, we are good
    if (this.getGoogleApiKey()) return;

    // Otherwise check AI Studio (Veo/High-End Model Requirement)
    const studio = (window as any).aistudio;
    if (studio) {
      const hasKey = await studio.hasSelectedApiKey();
      if (!hasKey) {
        await studio.openSelectKey();
        return;
      }
    }
    
    // Final check
    const key = this.getGoogleApiKey();
    if (!key) {
      // If we still don't have a key, we throw an auth error which can be caught to show the Google Sign-In prompt
      throw new AppError("Access Denied. Please Sign In with Google.", 'auth');
    }
  }

  // Improved Login Handler - Falls back to Local Session if Google Auth is unavailable
  async loginWithGoogle(): Promise<UserAccount> {
    try {
      const studio = (window as any).aistudio;
      if (studio) {
        // Attempt Native Google Auth Flow via AI Studio wrapper if available
        await studio.openSelectKey();
        const hasKey = await studio.hasSelectedApiKey();
        if (!hasKey) {
          throw new Error("Key selection cancelled.");
        }
      } else {
         // Fallback: Create a local verified session without cloud auth
         console.log("Standard Google Auth not detected. Creating local session.");
      }

      // Create/Update Session
      const newUser: UserAccount = {
        id: `user-${Date.now()}`,
        name: 'Orin Member',
        email: 'member@orin.ai',
        tier: 'Verified Member',
        avatar: '', // Empty avatar will show initials
        dailyUsage: { text: 0, images: 0, videos: 0 }
      };
      
      this.updateCurrentUser(newUser);
      return newUser;

    } catch (e: any) {
      // If user explicitly cancelled key selection, rethrow
      if (e.message && e.message.includes("cancelled")) {
          throw new AppError("Sign-In Cancelled.", 'auth');
      }
      
      // Fallback for any other error to ensure user can still access the app
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

  /**
   * Text Generation & General Chat
   * Switched entirely to Google GenAI.
   */
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

    // Select Model based on complexity
    // Basic interaction -> Flash
    // Reasoning/Thinking -> Pro
    let modelName = 'gemini-3-flash-preview';
    if (options.useThinking) {
        modelName = 'gemini-3-pro-preview';
    }

    // Configure Tools (Grounding)
    const tools: any[] = [];
    if (options.grounding === 'search') {
        tools.push({ googleSearch: {} });
    }

    // Configure Config
    const config: any = {
        systemInstruction: getSystemInstruction(),
    };
    
    if (options.useThinking) {
        config.thinkingConfig = { thinkingBudget: 2048 }; 
    }

    if (tools.length > 0) {
        config.tools = tools;
    }

    // Construct Content Payload
    const contents: any[] = [];

    // 1. History (Last 10 messages for context)
    if (options.history && options.history.length > 0) {
        const recentHistory = options.history.slice(-10);
        for (const msg of recentHistory) {
            const role = msg.role === 'user' ? 'user' : 'model';
            // Only add text parts to history to maintain clean context
            if (msg.type === 'text' && msg.content) {
                contents.push({ role, parts: [{ text: msg.content }] });
            }
        }
    }

    // 2. Current Turn
    const currentParts: any[] = [];
    if (options.fileData) {
        currentParts.push({
            inlineData: {
                mimeType: options.fileData.mimeType,
                data: options.fileData.data
            }
        });
        // If handling image, upgrade model if default is too weak (though flash handles images well)
        // gemini-3-flash-preview handles images fine.
    }
    currentParts.push({ text: prompt });
    contents.push({ role: 'user', parts: currentParts });

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: config
        });

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
        console.error("Gemini Chat Error:", e);
        if (e.message?.includes("API key") || e.message?.includes("403")) {
             throw new AppError("Invalid API Key. Please sign in again.", 'auth');
        }
        throw new AppError(e.message || "Connection failed.", 'generic');
    }
  }

  /**
   * Image Generation (Google Native)
   */
  async generateImagePro(prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize): Promise<string> {
    try {
      await this.ensureGoogleKeyReady();
      const apiKey = this.getGoogleApiKey();
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
      
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
      const errorMsg = e.message || "";
      if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("API key not valid")) {
        if ((window as any).aistudio) await (window as any).aistudio.openSelectKey();
      }
      throw new AppError(e.message || "Image creation failed.", 'generic');
    }
  }

  async generateWelcomeMessage(context: { lang: Language; date?: string; time?: string; location?: string }): Promise<string> {
    try {
      // Check for key silently to avoid popup on load
      const key = this.getGoogleApiKey();
      const hasStudioKey = (window as any).aistudio ? await (window as any).aistudio.hasSelectedApiKey() : false;
      
      if (!key && !hasStudioKey) return "Ayubowan! Ready to assist.";

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

  async generateTitle(messages: ChatMessage[], modesUsed?: WorkspaceMode[]): Promise<string> {
    try {
       // Filter for text content only to generate title
       const text = messages.filter(m => m.type === 'text').map(m => m.content).join('\n').slice(0, 500);
       if (!text) return "New Conversation";

       const prompt = `Generate a 4-word title for this chat content: ${text}`;
       const res = await this.chat(prompt, { useThinking: false });
       return res.text.replace(/"/g, '').trim();
    } catch { return "New Chat"; }
  }

  /**
   * Live Voice (Native WebSocket)
   */
  async connectLive(callbacks: any) {
    await this.ensureGoogleKeyReady();
    const apiKey = this.getGoogleApiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
    
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
