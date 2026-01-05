
export type Language = 'en' | 'si';
// Fix: Added 'Pro (Puter Managed)' to UserTier to allow matching the assignment in geminiService.ts
export type UserTier = 'Basic' | 'Pro (BYO-Google)' | 'Pro (Puter Managed)';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tier: UserTier;
  token?: string;
  dailyUsage: {
    text: number;
    images: number;
    videos: number;
  };
}

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'video' | 'file' | 'audio';
  links?: GroundingLink[];
  imageUrl?: string;
  videoUrl?: string;
  fileName?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
  mode: WorkspaceMode;
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface HardwareStatus {
  mode: 'GPU' | 'CPU';
  label: string;
}

export type AppView = 'landing' | 'workspace' | 'account' | 'privacy' | 'terms' | 'releases' | 'logic' | 'creator' | 'pricing';
export type WorkspaceMode = 'chat' | 'studio' | 'vision' | 'voice';
