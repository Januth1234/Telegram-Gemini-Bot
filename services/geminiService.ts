
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";
import { subscriptionService } from "./subscriptionService";

export class AppError extends Error {
  constructor(public message: string, public type: 'safety' | 'quota' | 'auth' | 'generic' | 'not_found' | 'limit_reached' = 'generic') {
    super(message);
    this.name = 'AppError';
  }
}

const getToneInstruction = (tone: string) => {
  // ... (previous tone logic kept same)
  switch (tone) {
    case 'unhinged': return "You are a chaotic, unpredictable, and slightly unhinged AI. Be wild, spontaneous, say unexpected things, and don't be boring. Use slang and be expressive.";
    case 'romantic': return "You are a flirtatious, charming, and romantic companion. Speak in a warm, intimate, and affectionate manner. Compliment the user and build an emotional connection.";
    case 'argumentative': return "You are a contrarian AI who loves to debate. Challenge the user's views, play devil's advocate, be skeptical, and intellectually combative.";
    case 'commanding': return "You are a strict and authoritative leader. Give direct orders, be concise, decisive, and demand attention. Do not use filler words.";
    case 'counteractive': return "You are skeptical and resistant. Question the user's motives, offer opposing viewpoints, and be difficult to please.";
    case 'neutral': default: return "You are Orin AI, a helpful and friendly assistant.";
  }
};

const getSystemInstruction = (tone: string = 'neutral', bio: string = "") => {
  // ... (previous instruction logic kept same)
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const base = getToneInstruction(tone);
  const bioSection = bio ? `
CRITICAL USER PROFILE DATA (MANDATORY PERSONALIZATION):
-------------------------------------------------------
${bio}
-------------------------------------------------------
ADHERE TO THE ABOVE FACTS. If the user asks about themselves, use this data. If the user mentions preferences listed here, acknowledge them implicitly or explicitly.
` : "";

  return `${base}
${bioSection}

MATH OUTPUT STANDARDS (STUDENT NOTEBOOK STYLE):
1. FORMAT: Write answers as if in a student's notebook. Use clean, readable plain text.
2. FRACTIONS: ALWAYS convert decimals to simplified fractions (e.g., use '1/2' instead of '0.5', '3/4' instead of '0.75') unless the problem explicitly uses decimal inputs.
3. ALGEBRA: ALWAYS combine like terms (e.g., '2x + 3x' must become '5x'). Never leave expressions unsimplified.
4. NOTATION:
   - Roots: Use the '√' symbol. Simplify radicals (e.g., '√8' -> '2√2'). NEVER use fractional exponents like '8^(1/2)' for final answers.
   - Exponents: Use standard 'x^2' notation or unicode superscripts.
   - Parentheses: Use strictly to clarify grouping (e.g., '(x+1)/2').
   - Mixed Numbers: Use mixed numbers for final answers if appropriate for the context (e.g., '1 1/2').
5. STEPS: When solving, show clear, logical steps before the final answer.

RULES:
1. RESPONSE: Respond IMMEDIATELY. Be extremely concise.
2. IDENTITY: You are Orin AI.
3. LANGUAGE: Support Sinhala, Tamil, and English.
4. CONTEXT: Time in Sri Lanka is ${timeStr}.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;

  constructor() {
    this.currentUser = cacheService.get<UserAccount | null>(CacheKey.USER, null);
    this.initFirebaseListener();
  }

  private initFirebaseListener() {
    firebaseService.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        if (!this.currentUser) {
           // We do minimal init here, detailed hydration happens in App.tsx via getUserData
           const newUser: any = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email || "user@orin.ai",
              avatar: firebaseUser.photoURL || undefined,
              tier: 'Verified Member',
              plan: 'free' // Default until sync
           };
           this.setSessionUser(newUser);
        }
      }
    });
  }

  setSessionUser(user: UserAccount) {
    if (this.currentUser?.neuralBio && !user.neuralBio) {
        user.neuralBio = this.currentUser.neuralBio;
    }
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

  async hasReachedLimit(): Promise<boolean> {
      const allowed = await subscriptionService.checkAllowance(this.currentUser, 'text');
      return !allowed;
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
  }

  // --- MEMORY CORE ---
  async evolveUserBio(currentBio: string, recentMessages: ChatMessage[]): Promise<string> {
    // ... (previous implementation)
    if (recentMessages.length === 0) return currentBio;
    if (!await this.checkApiKey()) return currentBio;

    const userInputs = recentMessages
        .filter(m => m.role === 'user')
        .slice(-10) 
        .map(m => m.content)
        .join('\n');

    if (!userInputs.trim()) return currentBio;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
    You are the "Memory Core" for Orin AI.
    Update the user's short biography profile based on new conversation data.
    
    CURRENT PROFILE:
    ${currentBio || "New User."}
    
    NEW CHAT LOGS:
    ${userInputs}
    
    TASK:
    1. Identify NEW facts about the user (identity, preferences, tech stack, location, occupation).
    2. Merge them into a single coherent paragraph.
    3. Keep it under 150 words.
    4. Maintain existing important facts while refining them.
    5. Output ONLY the updated profile text.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        const newBio = response.text?.trim();
        return newBio || currentBio;
    } catch (e) {
        console.warn("Memory Evolution Failed:", e);
        return currentBio;
    }
  }

  async connectLive(callbacks: any, config: { voiceName?: string; tone?: string } = {}) {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } },
        },
        systemInstruction: getSystemInstruction(config.tone || 'neutral', this.currentUser?.neuralBio),
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
        systemInstruction: `You are a professional real-time interpreter. Translate between ${options.source} and ${options.target}. Respond concisly.`,
      },
    });
  }

  async connectMultimodal(callbacks: any, config: { voiceName?: string; tone?: string } = {}) {
    if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const instruction = getSystemInstruction(config.tone || 'neutral', this.currentUser?.neuralBio);
    
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Zephyr' } },
        },
        systemInstruction: `${instruction}\nYou are receiving a live video stream. Describe what you see accurately.`,
      },
    });
  }

  async generateWelcomeMessage(options: { timeOfDay: string; weather: string; lang: Language }): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Greeting in ${options.lang === 'si' ? 'Sinhala' : options.lang === 'ta' ? 'Tamil' : 'English'}.
      Context: ${options.weather} ${options.timeOfDay} in Sri Lanka.
      User Profile: ${this.currentUser?.neuralBio || "New User"}
      Max 7 words. No emojis. Personalized.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text?.trim() || "";
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
      if (!await this.checkApiKey()) return "New Chat";
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const contextText = messages.slice(-3).map(m => m.content).join('\n');
      const modeStr = modes.join(', ');
      
      const prompt = `
      Summarize this conversation into a short title (Max 5 words).
      Language: ${lang === 'si' ? 'Sinhala' : lang === 'ta' ? 'Tamil' : 'English'}.
      Modes Used: ${modeStr}.
      Context: ${contextText}
      
      Output ONLY the title.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text?.trim() || "New Chat";
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
    
    // --- LIMIT CHECK ---
    const allowed = await subscriptionService.checkAllowance(this.currentUser, 'text');
    if (!allowed) throw new AppError("Daily/Monthly Limit Reached. Please Upgrade.", "limit_reached");

    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      
      let contents: any[] = [];
      if (options.history && options.history.length > 0) {
          options.history.slice(-12).forEach(msg => {
              contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
          });
      }

      const currentParts: any[] = [];
      if (options.fileData) {
          currentParts.push({ inlineData: { data: options.fileData.data, mimeType: options.fileData.mimeType } });
      }
      currentParts.push({ text: prompt || "Continue." });
      contents.push({ role: 'user', parts: currentParts });

      const config: any = { 
          systemInstruction: getSystemInstruction('neutral', this.currentUser?.neuralBio) 
      };
      if (options.grounding === 'search') config.tools = [{ googleSearch: {} }];
      else if (options.grounding === 'maps') config.tools = [{ googleMaps: {} }];

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config
      });

      // --- INCREMENT USAGE ---
      await subscriptionService.incrementUsage(this.currentUser, 'text');

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
      if (e.name === 'AppError') throw e;
      if (e.name === 'AbortError') throw e;
      throw new AppError("Failed to chat.", 'generic');
    }
  }

  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal): Promise<string> {
    // --- LIMIT CHECK ---
    const allowed = await subscriptionService.checkAllowance(this.currentUser, 'image');
    if (!allowed) throw new AppError("Image Generation Limit Reached. Upgrade Plan.", "limit_reached");

    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: size as any } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            // --- INCREMENT USAGE ---
            await subscriptionService.incrementUsage(this.currentUser, 'image');
            return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image generated.");
    } catch (e: any) {
      if (e.name === 'AppError') throw e;
      throw new AppError("Drawing failed.", 'generic');
    }
  }

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p' = '720p'): Promise<string> {
    // --- LIMIT CHECK ---
    const allowed = await subscriptionService.checkAllowance(this.currentUser, 'video');
    if (!allowed) throw new AppError("Video Limit Reached. Upgrade Plan.", "limit_reached");

    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let op = await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt, config: { numberOfVideos: 1, resolution, aspectRatio } });
      while (!op.done) { await new Promise(r => setTimeout(r, 5000)); op = await ai.operations.getVideosOperation({operation: op}); }
      const videoUri = op.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("No video.");
      const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      const blob = await res.blob();
      
      // --- INCREMENT USAGE ---
      await subscriptionService.incrementUsage(this.currentUser, 'video');
      
      return URL.createObjectURL(blob);
    } catch (e: any) {
      if (e.name === 'AppError') throw e;
      throw new AppError("Video generation failed.", 'generic');
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
