
export type Language = 'en' | 'si' | 'ta';
export type UserTier = 'Free' | 'Basic' | 'Pro (BYO-Google)' | 'Verified Member';
export type UserRole = 'visitor' | 'training' | 'devops' | 'owner';

// Site-wide visual theme (independent of dark/light toggle)
export type UserThemeId = 'classic' | 'midnight' | 'aurora' | 'terminal' | 'paper' | 'ocean' | 'sunset';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tier: UserTier;
  plan?: string; // Firestore plan: free, starter, basic, basic_yearly, pro, pro_yearly
  role?: UserRole;
  approved?: boolean;
  token?: string;
  theme?: UserThemeId;
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
  reasoning_details?: any;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
  mode: WorkspaceMode;
  modesUsed?: WorkspaceMode[];
  /** Embedding vector for semantic search (Gemini Embedding 2). */
  embedding?: number[];
}

/** True if the conversation has at least one user message (used for persist/sync; AI-only welcome does not count). */
export function conversationHasUserMessage(c: Conversation): boolean {
  return (c.messages || []).some(m => m.role === 'user');
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface HardwareStatus {
  mode: 'GPU' | 'CPU';
  label: string;
}

export type AppView = 'landing' | 'chat' | 'art' | 'camera' | 'voice' | 'math' | 'agent' | 'account' | 'privacy' | 'terms' | 'releases' | 'logic' | 'creator' | 'pricing' | 'downloads' | 'admin-portal' | 'telegram-bot';
export type WorkspaceMode = 'chat' | 'studio' | 'vision' | 'voice' | 'translator' | 'maths' | 'agent';

// Graphing types for Maths / Graphs workspace
export type GraphType = 'function' | 'parametric' | 'polar' | 'data';

export interface GraphDomain {
  min: number;
  max: number;
}

export interface GraphDataSeries {
  id: string;
  label: string;
  x: number[];
  y: number[];
}

export interface GraphDefinition {
  id: string;
  type: GraphType;
  expressionLatex?: string; // for function/parametric/polar
  xDomain?: GraphDomain;
  yDomain?: GraphDomain;
  dataSeries?: GraphDataSeries[]; // for data / statistics plots
}

// Maths-only history items (separate from chat history)
export type MathHistoryKind = 'expression' | 'graph';

export interface MathHistoryItem {
  id: string;
  kind: MathHistoryKind;
  inputLatex: string;
  result?: string;
  graph?: GraphDefinition | null;
  createdAt: string; // ISO string
}

export interface SiteMetrics {
  totalUsers: number;
  activeToday: number;
  aiRequests: number;
  serverStatus: 'online' | 'maintenance' | 'degraded';
  lastBackup: Date;
}

export interface SignupRequest {
  id: string;
  email: string;
  reason: string;
  codeDetected: boolean;
  requestedRole: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export interface ApiKeyDef {
  id: string;
  hash: string;
  note: string;
  createdAt: any;
  enabled: boolean;
}

export interface ExamPaper {
  id: string;
  title: string;
  year: number;
  subject: string;
  status: 'raw' | 'processed' | 'verified';
  uploadedBy: string;
}
