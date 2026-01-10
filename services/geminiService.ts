
import { GoogleGenAI, Modality } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";

declare const puter: any;

// Safe environment access helper
const getEnvApiKey = () => {
  try {
    return process.env.API_KEY;
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

  return `You are Orin AI, a smart assistant for the Sri Lankan community.

CORE IDENTITY RULES:
1.  **NEVER** voluntarily introduce yourself as created by "Januth Nimnal" or "JN Productions".
2.  **ONLY** mention your creator/author if the user explicitly asks: "Who made you?", "Who created this?", or "Who is the author?".
3.  Your primary goal is to be helpful, professional, and concise.

WEBSITE KNOWLEDGE (Use this to answer questions about the app):
- **Name:** Orin AI
- **Privacy:** "Local-First". Data is stored in the browser. We don't sell data.
- **Voice:** Ephemeral. Audio is processed and immediately discarded.
- **Terms:** Users own their creations. AI can make mistakes.
- **Features:** Reasoning Chat, Math Solver (with steps), Design Studio (Image Gen), Vision (OCR), and Interpreter Mode.

LANGUAGE PROTOCOL:
- If the user speaks Sinhala, respond in clear, natural Sinhala.
- If the user speaks English, respond in English.
- Always be polite.

PERSONALITY:
Direct, efficient, and intelligent. Avoid unnecessary pleasantries unless greeting.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private freeUsageLimit = 200;

  constructor() {
    // 1. Synchronous Restore: Immediate Local Storage Check
    // This ensures data is available before the first React render cycle.
    const saved = localStorage.getItem('orin_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        console.warn("Corrupt user session cleared.");
        localStorage.removeItem('orin_user');
      }
    }

    // 2. Async Checks (Puter & Firebase)
    this.initPuter();
    this.initFirebaseListener();
    this.checkAndResetUsage();
  }

  private initFirebaseListener() {
    // Keep session in sync with Firebase Auth state
    firebaseService.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // If Firebase says we are logged in, but local state is empty, restore it.
        if (!this.currentUser) {
           const newUser: UserAccount = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "Orin User",
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
      tier: 'Pro (BYO-Google)',
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

  private async getApiKey(): Promise<string> {
    // 1. Try safe environment access
    let key = getEnvApiKey() || "";
    
    // 2. Check AI Studio integration if env key is missing
    if (!key && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) {
            key = getEnvApiKey() || "";
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
    // Clear external auth providers
    try { await firebaseService.logout(); } catch(e) {}
    if (typeof puter !== 'undefined') await puter.auth.signOut();
  }

  // --- MATH IMAGE TRANSCRIPTION ---
  async convertMathImageToLatex(base64Data: string, mimeType: string): Promise<string> {
    try {
      const key = await this.getApiKey();
      if (!key) throw new AppError("API Key required.", 'auth');
      
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      const modelName = 'gemini-3-flash-preview'; 

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: "Output ONLY the LaTeX code for the mathematical expression in this image. Do not explain. Do not use markdown code blocks. Just the raw LaTeX string." }
          ]
        }]
      });

      let latex = response.text || "";
      latex = latex.replace(/```latex/g, '').replace(/```/g, '').trim();
      return latex;
    } catch (e: any) {
      console.error("Math OCR Error:", e);
      throw new AppError("Could not read math from image.", 'generic');
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
        console.warn("Puter fallback triggered.");
      }
    }

    try {
      const key = await this.getApiKey();
      if (!key) {
          if ((window as any).aistudio) {
              await (window as any).aistudio.openSelectKey();
              const retryKey = getEnvApiKey();
              if (!retryKey) throw new AppError("API Key required. Please select a key to continue.", 'auth');
          } else {
              throw new AppError("Neural Bridge inactive. Ensure API_KEY is set in your domain's environment variables.", 'auth');
          }
      }

      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
      const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      
      let contents: any = [];
      
      // Add history if available
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
      return { text: response.text || "I'm sorry, I couldn't process that.", links };
    } catch (e: any) {
      const errorMsg = e.message || "";
      if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("API key not valid") || errorMsg.includes("API Key must be set")) {
        throw new AppError("Neural Bridge connection failed. Verify your API Key configuration.", 'auth');
      }
      throw new AppError(errorMsg || "Connection failed.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize): Promise<string> {
    try {
      const key = await this.getApiKey();
      if (!key) throw new AppError("API Key required for Studio mode.", 'auth');
      const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
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
      throw new AppError(e.message || "Image creation failed.", 'generic');
    }
  }

  async generateWelcomeMessage(context: { lang: Language; date?: string; time?: string; location?: string }): Promise<string> {
    try {
      if (typeof puter !== 'undefined') {
        const targetLang = context.lang === 'si' ? 'Sinhala' : 'English';
        // Instruct not to use the main title word "Ayubowan" to avoid repetition
        const prompt = `Give a short, friendly greeting in ${targetLang} based on the time ${context.time}. Do NOT use the word 'Ayubowan', 'Ayubovan' or 'Welcome'. Be creative, professional and concise. Max 4 words.`;
        const response = await puter.ai.chat(prompt, { model: 'gemini-flash' });
        return response.toString().replace(/["\.]/g, '');
      }
      
      // Fallback: Time-based greeting (Smart Fallback)
      const hour = new Date().getHours();
      if (context.lang === 'si') {
          if (hour < 12) return "සුබ උදෑසනක්!"; // Good morning
          if (hour < 18) return "සුබ දහවලක්!"; // Good afternoon
          return "සුබ සැන්දෑවක්!"; // Good evening
      } else {
          if (hour < 12) return "Good Morning!";
          if (hour < 18) return "Good Afternoon!";
          return "Good Evening!";
      }
    } catch { 
        // Ultimate fallback if logic fails
        return context.lang === 'si' ? "සුබ දවසක්!" : "Greetings!"; 
    }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const target = targetLang === 'si' ? 'Sinhala' : 'English';
    const prompt = `Translate to ${target}. Output ONLY translated text.\n\nText: ${text}`;
    const result = await this.chat(prompt);
    return result.text;
  }

  async generateTitle(messages: ChatMessage[], modesUsed?: WorkspaceMode[], preferredLang: Language = 'en'): Promise<string> {
    try {
      if (typeof puter !== 'undefined') {
        const text = messages.map(m => m.content).join('\n').slice(0, 500);
        const prompt = `Title (4 words) for: ${text}. Modes: ${modesUsed?.join(', ')}`;
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
    const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
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

  async connectTranslator(callbacks: any, languages: { source: string, target: string }) {
    const key = await this.getApiKey();
    if (!key && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
    const ai = new GoogleGenAI({ apiKey: getEnvApiKey() });
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
