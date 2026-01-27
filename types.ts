
export type Language = 'en' | 'si' | 'ta';
export type UserTier = 'Basic' | 'Pro (BYO-Google)' | 'Verified Member';

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
  reasoning_details?: any; // To support OpenRouter reasoning models
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
  mode: WorkspaceMode;
  modesUsed?: WorkspaceMode[];
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface HardwareStatus {
  mode: 'GPU' | 'CPU';
  label: string;
}

export type AppView = 'landing' | 'chat' | 'art' | 'camera' | 'voice' | 'math' | 'account' | 'privacy' | 'terms' | 'releases' | 'logic' | 'creator' | 'pricing' | 'downloads';
export type WorkspaceMode = 'chat' | 'studio' | 'vision' | 'voice' | 'translator' | 'maths';
