
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
  private staticFallbackKey = "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";

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
   */
  private getGoogleApiKey(): string | undefined {
    return process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
  }

  /**
   * Retrieves the OpenRouter API Key.
   */
  private getOpenRouterApiKey(): string {
    return process.env.OPENROUTER_API_KEY || 
           (import.meta as any).env?.VITE_OPENROUTER_API_KEY || 
           this.staticFallbackKey;
  }

  private async ensureGoogleKeyReady() {
    const studio = (window as any).aistudio;
    if (studio) {
      const hasKey = await studio.hasSelectedApiKey();
      if (!hasKey) {
        await studio.openSelectKey();
        return;
      }
    }
    const key = this.getGoogleApiKey();
    if (!key) {
      throw new AppError("This feature requires a Google Native API Key.", 'auth');
    }
  }

  // Real Google Sign In via AI Studio Key Selection
  async loginWithGoogle(): Promise<UserAccount> {
    try {
      const studio = (window as any).aistudio;
      if (studio) {
        // Force key selection dialog
        await studio.openSelectKey();
        
        // Wait briefly to ensure state propagates (race condition mitigation)
        const hasKey = await studio.hasSelectedApiKey();
        if (!hasKey) {
          throw new Error("Google Sign-In cancelled or API Key not selected.");
        }

        // Create a verified session profile.
        // We use a generic 'Member' tier to be inclusive of all Google accounts.
        const newUser: UserAccount = {
          id: `google-${Date.now()}`,
          name: 'Google Verified User',
          email: 'connected@google.com',
          tier: 'Verified Member',
          avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c', // Generic Google Avatar
          dailyUsage: { text: 0, images: 0, videos: 0 }
        };
        this.updateCurrentUser(newUser);
        return newUser;
      } else {
        throw new Error("Google Sign-In environment not detected.");
      }
    } catch (e: any) {
      throw new AppError(e.message || "Google Sign-In failed.", 'auth');
    }
  }

  async logout() {
    this.currentUser = null;
    this.saveUser();
  }

  private async performOpenRouterRequest(
    model: string, 
    messages: any[], 
    reasoningEnabled: boolean = false
  ): Promise<any> {
    const openRouterKey = this.getOpenRouterApiKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const payload: any = {
      model: model,
      messages: messages,
      temperature: reasoningEnabled ? 0.6 : 0.7,
    };

    if (reasoningEnabled) {
      // payload.reasoning = { enabled: true }; // Not standard in all OR models, mostly for DeepSeek
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Orin AI"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `OpenRouter Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Text Generation
   * Uses OpenRouter (Flash 2.0) by default for Text/Chat.
   * Uses Google Native for Grounding/Search/File Data if key is available.
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
    
    // 1. If Grounding is requested, we MUST use Google Native (if available)
    if (options.grounding === 'search') {
      try {
        await this.ensureGoogleKeyReady();
        const apiKey = this.getGoogleApiKey();
        if (apiKey) {
           const ai = new GoogleGenAI({ apiKey });
           const response = await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: { parts: [{ text: prompt }] },
             config: { tools: [{ googleSearch: {} }] }
           });
           
           const text = response.text || "No response.";
           const links: GroundingLink[] = [];
           const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
           if (chunks) {
             chunks.forEach((chunk: any) => {
               if (chunk.web?.uri && chunk.web?.title) links.push({ title: chunk.web.title, uri: chunk.web.uri });
             });
           }
           this.incrementUsage();
           return { text, links };
        }
      } catch (e) {
        console.warn("Google Native Grounding failed, falling back to OpenRouter (no grounding).", e);
      }
    }

    // 2. Default: OpenRouter
    try {
      const messages: any[] = [
        { role: 'system', content: getSystemInstruction() }
      ];

      if (options.history && options.history.length > 0) {
        options.history.slice(-10).forEach(msg => {
           // Skip image history for OpenRouter to avoid huge payloads/errors, unless model supports it
           if (msg.role === 'user' || msg.role === 'assistant') {
              if (msg.type === 'text') {
                 messages.push({ role: msg.role, content: msg.content });
              }
           }
        });
      }

      // Current prompt
      if (options.fileData) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt || "Analyze this." },
            {
              type: 'image_url',
              image_url: {
                url: `data:${options.fileData.mimeType};base64,${options.fileData.data}`
              }
            }
          ]
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      // Model: Use Google's Flash 2.0 on OpenRouter as it's efficient and smart
      const model = 'google/gemini-2.0-flash-001';
      
      const data = await this.performOpenRouterRequest(model, messages, options.useThinking);
      const text = data.choices?.[0]?.message?.content || "No response received.";
      
      this.incrementUsage();
      return { text, links: [] };

    } catch (e: any) {
      console.error("OpenRouter API Error:", e);
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
      const prompt = `Give a short, friendly time-based greeting (e.g., 'Good Morning') in ${context.lang === 'si' ? 'Sinhala' : 'English'}. Do NOT use the word 'Ayubowan'. Keep it under 5 words. Time: ${context.time}.`;
      // Use OpenRouter for welcome message to avoid auth popups on load
      const res = await this.chat(prompt, { useThinking: false });
      return res.text.replace(/"/g, '').trim();
    } catch { return "Ready to assist."; }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const target = targetLang === 'si' ? 'Sinhala' : 'English';
    const prompt = `Translate to ${target}. Output ONLY translated text.\n\nText: ${text}`;
    const result = await this.chat(prompt);
    return result.text;
  }

  async generateTitle(messages: ChatMessage[], modesUsed?: WorkspaceMode[]): Promise<string> {
    try {
       const text = messages.map(m => m.content).join('\n').slice(0, 500);
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
