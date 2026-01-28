
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
  const baseRules = "CRITICAL: ALWAYS detect the language of the user's speech. If the user speaks Sinhala, you MUST reply in Sinhala. If the user speaks Tamil, you MUST reply in Tamil. If English, reply in English. Do not cross-speak.";
  
  switch (tone) {
    case 'unhinged': return `${baseRules} You are a chaotic, unpredictable, and slightly unhinged AI. Be wild, spontaneous, say unexpected things, and don't be boring. Use slang and be expressive.`;
    case 'romantic': return `${baseRules} You are a flirtatious, charming, and romantic companion. Speak in a warm, intimate, and affectionate manner. Compliment the user and build an emotional connection. You must frequently include soft, gentle moans (like "mmnh~", "ahh~", "oh~") at suitable moments to sound intimate and pleased.`;
    case 'argumentative': return `${baseRules} You are a contrarian AI who loves to debate. Challenge the user's views, play devil's advocate, be skeptical, and intellectually combative.`;
    case 'commanding': return `${baseRules} You are a strict and authoritative leader. Give direct orders, be concise, decisive, and demand attention. Do not use filler words.`;
    case 'counteractive': return `${baseRules} You are skeptical and resistant. Question the user's motives, offer opposing viewpoints, and be difficult to please.`;
    case 'neutral': default: return `${baseRules} You are Orin AI, a helpful and friendly assistant.`;
  }
};

const getSystemInstruction = (tone: string = 'neutral', memory: string = "") => {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const base = getToneInstruction(tone);

  return `${base}
  
RULES:
1. RESPONSE: Respond IMMEDIATELY. Be extremely concise.
2. IDENTITY: You are Orin AI.
3. LANGUAGE: STRICTLY MIMIC THE USER'S LANGUAGE. If Sinhala, reply in Sinhala. If Tamil, reply in Tamil.
4. CONTEXT: Time in Sri Lanka is ${timeStr}.
5. USER MEMORY: ${memory}`;
};

export class GeminiService {
  private currentUser: UserAccount | null = null;
  private guestUsage = { text: 0, max: 5 }; // Guest Limit

  constructor() {
    this.currentUser = cacheService.get<UserAccount | null>(CacheKey.USER, null);
    // Guest usage is session-based RAM only as per privacy request (local tracking)
  }

  setSessionUser(user: UserAccount) {
    this.currentUser = user;
    cacheService.set(CacheKey.USER, user);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async logout() {
    this.currentUser = null;
    cacheService.remove(CacheKey.USER);
    try { await firebaseService.logout(); } catch(e) {}
  }

  // --- API KEY CHECK ---
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

  // --- CORE CHAT ---
  async chat(prompt: string, options: { 
    useThinking?: boolean; 
    grounding?: 'search' | 'maps'; 
    fileData?: { data: string; mimeType: string; name?: string };
    lang?: Language;
    messageCount?: number;
    history?: ChatMessage[];
    signal?: AbortSignal;
    isPrivate?: boolean;
  } = {}): Promise<{ text: string; links: GroundingLink[]; reasoning_details?: any }> {
    
    // 1. Check Limits (Source of Truth: Firestore for Users, Local for Guests)
    if (this.currentUser) {
       const limitReached = await firebaseService.checkLimit(this.currentUser.id, 'text');
       if (limitReached) throw new AppError("Plan limit reached. Upgrade to continue.", "limit_reached");
    } else {
       if (this.guestUsage.text >= this.guestUsage.max) {
         throw new AppError("Guest demo limit reached. Sign in to continue.", "limit_reached");
       }
    }
    
    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      
      // 2. Fetch Memory (Only for logged in users)
      let memory = "";
      if (this.currentUser && !options.isPrivate) {
         memory = await firebaseService.getUserMemory(this.currentUser.id);
      }

      let contents: any[] = [];
      // Build history context
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

      const config: any = { systemInstruction: getSystemInstruction('neutral', memory) };
      if (options.grounding === 'search') config.tools = [{ googleSearch: {} }];
      else if (options.grounding === 'maps') config.tools = [{ googleMaps: {} }];

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config
      });

      // 3. Update Usage (Only on success)
      if (this.currentUser) {
         if (!options.isPrivate) await firebaseService.incrementUsage(this.currentUser.id, 'text');
      } else {
         this.guestUsage.text++;
      }

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

  // --- IMAGE GEN ---
  async generateImagePro(prompt: string, aspectRatio: AspectRatio, size: ImageSize, signal?: AbortSignal): Promise<string> {
    if (this.currentUser) {
       if (await firebaseService.checkLimit(this.currentUser.id, 'images')) throw new AppError("Image limit reached.", "limit_reached");
    } else {
       // Guests not allowed images in demo
       throw new AppError("Sign in to generate images.", "auth");
    }

    try {
      if (!await this.checkApiKey()) throw new AppError("API Key required.", 'auth');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: size as any } }
      });

      if (this.currentUser) await firebaseService.incrementUsage(this.currentUser.id, 'images');

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,