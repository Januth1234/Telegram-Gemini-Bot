
export type Language = 'en' | 'si' | 'ta';
export type UserTier = 'Basic' | 'Pro' | 'Elite' | 'Verified Member';

// Database Interfaces
export interface DbPlan {
  id: string;
  name: string;
  price_lkr: number;
  daily_limit_text: number;
  daily_limit_images: number;
  features: string[];
}

export interface DbSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired';
  start_date: string;
  end_date: string | null;
  plan?: DbPlan; // Joined data
}

export interface UserUsage {
  prompts: number;
  images: number;
  videos: number;
  lastReset: any; // Firestore Timestamp or Date
  lastImageGenerated?: any;
  lastVideoGenerated?: any;
  lastImageReset?: any; // Specific for Free tier 3-day window
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tier: UserTier; // Display label
  plan: string; // Internal plan ID: 'free', 'basic', 'pro', 'elite'
  token?: string;
  neuralBio?: string;
  usage?: UserUsage;
  subscriptionStatus?: string;
  planStartedAt?: any;
  subscription?: DbSubscription; // Legacy support if needed
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
  reasoning_details?: any;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
  mode: WorkspaceMode;
  modesUsed?: WorkspaceMode[];
  isPrivate?: boolean;
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface HardwareStatus {
  mode: 'GPU' | 'CPU';
  label: string;
}

export type AppView = 'landing' | 'chat' | 'art' | 'camera' | 'voice' | 'help' | 'math' | 'account' | 'privacy' | 'terms' | 'releases' | 'logic' | 'creator' | 'pricing' | 'downloads';
export type WorkspaceMode = 'chat' | 'studio' | 'vision' | 'voice' | 'translator' | 'gethelp' | 'maths';
