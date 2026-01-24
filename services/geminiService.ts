
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, GroundingLink, AspectRatio, ImageSize, UserAccount, ChatMessage, Conversation, WorkspaceMode } from "../types";
import { firebaseService } from "./firebaseService";
import { cacheService, CacheKey } from "./cacheService";

export class AppError extends Error {
  constructor(public message: string, public type: 'safety' | 'quota' | 'auth' | 'generic' | 'not_found' | 'limit_reached' = 'generic') {
    super(message);
    this.name = 'AppError';
  }
}

const getToneInstruction = (tone: string) => {
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
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const base = getToneInstruction(tone);
  const bioSection = bio ? `\n\nUSER MEMORY (Personalization):\n${bio}\n(Use this information to personalize responses, but do not explicitly mention you are reading from memory unless asked.)` : "";

  return `${base}
${bioSection}
  
RULES:
1. RESPONSE: Respond IMMEDIATELY. Be extremely concise.
2. IDENTITY: You are Orin AI.
3. LANGUAGE: Support Sinhala, Tamil, and English.
4. CONTEXT: Time in Sri Lanka is ${timeStr}.`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private freeUsageLimit = 200;

  constructor() {
    this.currentUser = cacheService.get<UserAccount | null>(CacheKey.USER, null);
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

  private checkAndResetUsage() {
    const lastReset = cacheService.get<string | null>(CacheKey.LAST_RESET, null);
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!lastReset || (now - parseInt(lastReset)) > oneDay) {
      cacheService.set(CacheKey.USAGE_COUNT, 0);
      cacheService.set(CacheKey.LAST_RESET, now.toString());
    }
  }

  setSessionUser(user: UserAccount) {
    // Preserve existing bio if new object doesn't have it but old one did (during quick re-renders)
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
  }

  // --- MEMORY CORE ---
  async evolveUserBio(currentBio: string, recentMessages: ChatMessage[]): Promise<string> {
    if (recentMessages.length === 0) return currentBio;
    if (!await this.checkApiKey()) return currentBio;

    // Filter user messages only to save tokens
    const userInputs = recentMessages
        .filter(m => m.role === 'user')
        .slice(-5) // Only last 5 messages
        .map(m => m.content)
        .join('\n');

    if (!userInputs.trim()) return currentBio;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
    You are the "Memory Core" for Orin AI.
    Your task is to update the user's biography based on new conversation data.
    
    CURRENT BIO:
    ${currentBio || "No prior information."}
    
    NEW USER INPUTS:
    ${userInputs}
    
    INSTRUCTIONS:
    1. Extract key facts about the user (name, preferences, work, hobbies, language style).
    2. Merge new facts into the CURRENT BIO.
    3. Keep it concise (max 100 words).
    4. If nothing new or relevant is found, return the CURRENT BIO exactly as is.
    5. Output ONLY the updated bio text.
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
        systemInstruction: `${instruction}
        You are receiving a live video stream from the user's camera along with their audio.
        
        RULES:
        1. Watch the video stream attentively and answer questions about what you see.
        2. Remember details shown earlier.
        3. Support English, Sinhala, and Tamil languages.`,
      },
    });
  }

  async generateWelcomeMessage(options: { timeOfDay: string; weather: string; lang: Language }): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Generate a very cheerful greeting in ${options.lang === 'si' ? 'Sinhala' : options.lang === 'ta' ? 'Tamil' : 'English'}.
      Context: It is a ${options.weather} ${options.timeOfDay} in Sri Lanka.
      User Bio: ${this.currentUser?.neuralBio || "Generic user"}
      STRICT RULE: It MUST be exactly 6 to 7 words long. No emojis. No symbols. Personalized if bio exists.`;

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
      const firstMsg = messages.length > 0 ? messages[0].content : "";
      const lastMsg = messages.length > 1 ? messages[messages.length - 1].content : "";
      const target = lang === 'si' ? 'Sinhala' : lang === 'ta' ? 'Tamil' : 'English';
      const modeContext = modes.length > 0 ? `Used Modes: ${modes.join(', ')}` : "";
      
      const prompt = `Generate a very short, specific title (3-5 words) for this conversation in ${target}.
      Conversation Start: "${firstMsg.substring(0, 100)}"
      Latest Update: "${lastMsg.substring(0, 100)}"
      ${modeContext}
      
      Rules:
      - Summarize the main topic based on the entire context.
      - If 'maths' mode was used, mention the math topic (e.g., "Calculus Problem").
      - If 'vision' mode was used, mention what was analyzed.
      - If 'studio' mode was used, mention the art subject.
      - If multiple modes were used, combine them concisely.
      - Keep it extremely concise (max 5 words). No quotes.`;

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

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p' = '720p'): Promise<string> {
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("No video generated.");

      // The response.body contains the MP4 bytes. Must append API key.
      const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      if (!response.ok) throw new Error("Failed to download video.");
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e: any) {
      throw new AppError("Video generation failed: " + e.message, 'generic');
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
