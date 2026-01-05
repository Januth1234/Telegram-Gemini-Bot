
import { GoogleGenAI } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage } from "../types";

declare const puter: any;

export class AppError extends Error {
  constructor(public message: string, public type: 'safety' | 'quota' | 'auth' | 'generic' | 'not_found' | 'limit_reached' = 'generic') {
    super(message);
    this.name = 'AppError';
  }
}

const getSystemInstruction = (lang: Language) => {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const languageDirective = lang === 'si' 
    ? "STRICT: You must answer ONLY in Sinhala. Do not use English unless it is a technical term that has no Sinhala equivalent."
    : "STRICT: You must answer ONLY in English. Do not use Sinhala.";

  return `You are Orin AI, a sophisticated smart workspace by Januth Nimnal.
IDENTITY: Built by Januth Nimnal for Sri Lankans. Greeting: "Ayubowan".
CONTEXT: Current Sri Lanka time is ${timeStr}.
${languageDirective}
BEHAVIOR: Concise, professional, and strictly adherent to the selected language.
ENGINE: Running on Puter Neural Core.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private isPuterReady: boolean = false;

  constructor() {
    this.initPuter();
  }

  private async initPuter() {
    try {
      if (typeof puter !== 'undefined') {
        await puter.ready();
        this.isPuterReady = true;
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
      console.error("Puter initialization failed:", e);
    }
  }

  private updateCurrentUser(user: any) {
    if (!user) return;
    this.currentUser = {
      id: user.id || 'anonymous',
      name: user.name || user.username || 'Citizen',
      email: user.email || `${user.username || user.id}@puter.com`,
      tier: 'Pro (Puter Managed)',
      avatar: user.avatar_url,
      dailyUsage: { text: 0, images: 0, videos: 0 }
    };
    localStorage.setItem('orin_user', JSON.stringify(this.currentUser));
  }

  hasReachedLimit(): boolean {
    return false;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async loginWithGoogle(): Promise<UserAccount> {
    if (typeof puter === 'undefined') throw new Error("Puter subsystem offline.");
    const user = await puter.auth.signIn();
    this.updateCurrentUser(user);
    return this.currentUser!;
  }

  async logout() {
    this.currentUser = null;
    localStorage.removeItem('orin_user');
    if (typeof puter !== 'undefined') await puter.auth.signOut();
  }

  async chat(prompt: string, options: { 
    lang: Language;
    useThinking?: boolean; 
    grounding?: 'search' | 'maps' | 'none';
    fileData?: { data: string; mimeType: string; name?: string };
  }): Promise<{ text: string; links: GroundingLink[] }> {
    
    const apiKey = process.env.API_KEY;
    const hasApiKey = !!apiKey && apiKey !== "undefined" && apiKey.length > 10;

    // Preference: Use SDK if API Key is valid and special features are requested
    if (hasApiKey && (options.useThinking || options.grounding || options.fileData)) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const model = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
        const contents: any = options.fileData ? {
          parts: [
            { inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } },
            { text: prompt }
          ]
        } : { parts: [{ text: prompt }] };

        const response = await ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction: getSystemInstruction(options.lang) }
        });

        return { text: response.text || '', links: [] };
      } catch (e: any) {
        console.warn("SDK Path failed, falling back to Puter:", e);
      }
    }

    // Default Route: Puter AI (Robust & Managed)
    if (typeof puter !== 'undefined') {
      try {
        if (!this.isPuterReady) await puter.ready();
        
        const response = await puter.ai.chat(prompt, {
          model: options.useThinking ? 'gemini-pro' : 'gemini-flash',
          system_prompt: getSystemInstruction(options.lang)
        });
        return { text: response.toString(), links: [] };
      } catch (e: any) {
        throw new AppError("Neural Bridge Timeout. Please check your internet connection and try again.", 'generic');
      }
    }

    throw new AppError("Neural Core Unreachable. Please refresh the page.", 'generic');
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize): Promise<string> {
    try {
      if (typeof puter !== 'undefined') {
        const image = await puter.ai.txt2img(prompt);
        return image.src;
      }
      throw new Error("Puter offline");
    } catch (e: any) {
      const apiKey = process.env.API_KEY;
      if (apiKey && apiKey !== "undefined") {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
          });
          const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
          if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        } catch {}
      }
      throw new AppError("Synthesis engine timed out.", 'limit_reached');
    }
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    try {
      const response = await puter.ai.chat(`Translate to ${targetLang === 'si' ? 'Sinhala' : 'English'}: ${text}`);
      return response.toString().trim();
    } catch { return "Translation failed."; }
  }

  async generateWelcomeMessage(context: { lang: Language; date?: string; time?: string }): Promise<string> {
    try {
      const target = context.lang === 'si' ? 'Sinhala' : 'English';
      const response = await puter.ai.chat(`Give me a 5-word warm welcome greeting in ${target}. Time: ${context.time}`, { model: 'gemini-flash' });
      return response.toString();
    } catch { return "Ayubowan! Ready for your task."; }
  }

  async generateTitle(messages: ChatMessage[]): Promise<string> {
    try {
      const text = messages.map(m => m.content).join(' ').slice(0, 300);
      const response = await puter.ai.chat(`3-word title for: ${text}`);
      return response.toString().trim();
    } catch { return "New Neural Chat"; }
  }
}

export const geminiService = new GeminiService();
