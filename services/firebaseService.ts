
import { getAnalytics } from "firebase/analytics";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/functions";
import { getFirestore, doc, setDoc, getDoc, updateDoc, Firestore, serverTimestamp, collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { Conversation, UserAccount, UserRole, SignupRequest, SiteMetrics, ApiKeyDef, conversationHasUserMessage } from "../types";

// Configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyB5rY4e-_GOkkl4qwDZuvHqwq0_IP9mFmA",
  authDomain: "orin-ai-f6798.firebaseapp.com",
  projectId: "orin-ai-f6798",
  storageBucket: "orin-ai-f6798.firebasestorage.app",
  messagingSenderId: "259788442094",
  appId: process.env.FIREBASE_APP_ID || "1:259788442094:web:4d946378ca1b4d7349a6ff",
  measurementId: "G-57DHESH4ZJ"
};

declare global {
  interface Window {
    handleNativeGoogleToken?: (token: string) => Promise<void>;
  }
}

class FirebaseService {
  private app: any;
  private analytics: any = null;
  private auth: firebase.auth.Auth | null = null;
  private functions: firebase.functions.Functions | null = null;
  private db: Firestore | null = null;

  constructor() {
    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(firebaseConfig);
      } else {
        this.app = firebase.app();
      }
      
      if (typeof window !== 'undefined') {
        this.auth = firebase.auth();
        this.functions = firebase.functions();
        this.db = getFirestore(this.app);
        
        if (this.auth) {
           this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch((error) => console.error("Auth Persistence Error:", error));
        }

        try {
          this.analytics = getAnalytics(this.app);
        } catch (e) {
          console.debug("Analytics initialization skipped");
        }
      }
    } catch (e) {
      console.warn("Firebase initialization warning:", e);
    }
  }

  // --- AUTHENTICATION ---
  async loginWithGoogle(): Promise<firebase.User> {
    if (!this.auth) throw new Error("Authentication module not initialized.");
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await this.auth.signInWithPopup(provider);
      return result.user!;
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') throw new Error("Sign-in cancelled.");
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.auth) await this.auth.signOut();
  }

  onAuthStateChanged(callback: (user: firebase.User | null) => void) {
    if (this.auth) return this.auth.onAuthStateChanged(callback);
    callback(null);
    return () => {};
  }

  // --- ADMIN PORTAL LOGIC (CLOUD FUNCTIONS) ---
  
  async submitSignupRequest(email: string, reason: string): Promise<void> {
    if (!this.functions) return;
    const createPendingSignup = this.functions.httpsCallable('createPendingSignup');
    await createPendingSignup({ email, reason });
  }

  async approveUser(uid: string, role: UserRole): Promise<void> {
    if (!this.functions) return;
    const approveUserFunc = this.functions.httpsCallable('approveUser');
    await approveUserFunc({ targetUid: uid, role, approved: true });
  }

  async generateApiKey(note: string): Promise<string> {
    if (!this.functions) return "";
    const genKeyFunc = this.functions.httpsCallable('generateApiKey');
    const result = await genKeyFunc({ note });
    return (result.data as any).apiKey;
  }

  async processOCR(imageUrl: string, lang: 'en' | 'si'): Promise<any> {
    if (!this.functions) return null;
    const ocrFunc = this.functions.httpsCallable('ocrProcess');
    const result = await ocrFunc({ imageUrl, lang });
    return result.data;
  }

  // --- FIRESTORE READS (Direct) ---

  async getPendingRequests(): Promise<SignupRequest[]> {
    if (!this.db) return [];
    const q = query(collection(this.db, "pending_signups"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SignupRequest));
  }

  async getApiKeys(): Promise<ApiKeyDef[]> {
    if (!this.db) return [];
    const q = query(collection(this.db, "api_keys"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ApiKeyDef));
  }

  async getSiteMetrics(): Promise<SiteMetrics> {
    if (!this.db) return { totalUsers: 0, activeToday: 0, aiRequests: 0, serverStatus: 'online', lastBackup: new Date() };
    const snap = await getDoc(doc(this.db, "site_metrics", "meters"));
    if (snap.exists()) {
      const data = snap.data();
      return {
        totalUsers: data.totalUsers || 0,
        activeToday: data.activeToday || 0,
        aiRequests: data.aiRequests || 0,
        serverStatus: data.serverStatus || 'online',
        lastBackup: data.lastBackup?.toDate() || new Date()
      };
    }
    return { totalUsers: 1, activeToday: 1, aiRequests: 50, serverStatus: 'online', lastBackup: new Date() };
  }

  private userRef(uid: string) {
    return this.db ? doc(this.db, "users", uid) : null;
  }

  // --- FIRESTORE USER SYNC ---
  async syncUserSession(uid: string, email: string, photoURL?: string | null): Promise<UserAccount> {
    if (!this.db) throw new Error("DB not init");
    const userRef = doc(this.db, "users", uid);
    const snap = await getDoc(userRef);
    let userData: any;

    if (!snap.exists()) {
      // New users start as visitors
      userData = {
        email,
        name: email.split('@')[0],
        avatar: photoURL || null,
        plan: 'starter',
        role: 'visitor', 
        approved: false,
        subscriptionStatus: 'active',
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        usage: { text: 0, images: 0, videos: 0 },
        memory: "User is new to Orin AI.",
        lastReset: Date.now()
      };
      await setDoc(userRef, userData);
    } else {
      userData = snap.data();
      const updates: any = {};
      if (photoURL && userData.avatar !== photoURL) updates.avatar = photoURL;
      if (Date.now() - (userData.lastReset || 0) > 86400000) {
        updates.usage = { text: 0, images: 0, videos: 0 };
        updates.lastReset = Date.now();
        userData.usage = updates.usage;
      }
      if (Object.keys(updates).length > 0) await updateDoc(userRef, updates);
    }

    return {
      id: uid,
      name: userData.name || email.split('@')[0],
      email: email,
      avatar: userData.avatar,
      tier: userData.plan === 'elite' ? 'Verified Member' : userData.plan === 'pro' ? 'Pro (BYO-Google)' : 'Basic',
      role: userData.role || 'visitor',
      approved: userData.approved || false,
      dailyUsage: userData.usage || { text: 0, images: 0, videos: 0 },
    };
  }

  private static readonly USAGE_LIMITS: Record<string, { text: number; images: number; videos: number }> = {
    starter: { text: 200, images: 10, videos: 0 },
    pro: { text: 500, images: 50, videos: 5 },
    elite: { text: 999999, images: 9999, videos: 999 },
  };

  async checkLimit(uid: string, type: 'text' | 'images' | 'videos'): Promise<boolean> {
    const ref = this.userRef(uid);
    if (!ref) return false;
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data();
    const plan = data.plan || 'starter';
    const usage = data.usage?.[type] ?? 0;
    return usage >= FirebaseService.USAGE_LIMITS[plan]?.[type];
  }

  async incrementUsage(uid: string, type: 'text' | 'images' | 'videos') {
    const ref = this.userRef(uid);
    if (!ref) return;
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const current = snap.data().usage?.[type] ?? 0;
      await updateDoc(ref, { [`usage.${type}`]: current + 1 });
    }
  }

  async updatePlan(uid: string, plan: string) {
    const ref = this.userRef(uid);
    if (!ref) return;
    await updateDoc(ref, { plan: plan.toLowerCase(), lastUpdated: serverTimestamp() });
  }

  async getUsage(uid: string): Promise<{ text: number; images: number; videos: number }> {
    const ref = this.userRef(uid);
    if (!ref) return { text: 0, images: 0, videos: 0 };
    const snap = await getDoc(ref);
    if (!snap.exists()) return { text: 0, images: 0, videos: 0 };
    const u = snap.data().usage ?? {};
    return { text: u.text ?? 0, images: u.images ?? 0, videos: u.videos ?? 0 };
  }

  async getUserMemory(uid: string): Promise<string> {
    const ref = this.userRef(uid);
    if (!ref) return "";
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data().memory ?? "") : "";
  }

  async updateUserMemory(uid: string, memory: string) {
    const ref = this.userRef(uid);
    if (!ref) return;
    await updateDoc(ref, { memory });
  }

  /**
   * Saves conversation history with read-merge-write for cross-device sync.
   * - Merges local + cloud by id; for same id keeps the one with more messages or newer timestamp.
   * - Pass deletedIds so deletes propagate (those ids are removed from merged result).
   */
  async saveHistory(uid: string, history: Conversation[], deletedIds: string[] = []) {
    const ref = this.userRef(uid);
    if (!ref) return;
    try {
      const cloud = await this.getHistory(uid);
      const cloudList = (cloud || []).filter(c => conversationHasUserMessage(c));
      const localById = new Map(history.filter(c => conversationHasUserMessage(c)).map(c => [c.id, c]));
      for (const c of cloudList) {
        const existing = localById.get(c.id);
        if (!existing) {
          localById.set(c.id, c);
          continue;
        }
        const cMsg = (c.messages || []).length;
        const eMsg = existing.messages.length;
        const cTime = new Date(c.timestamp).getTime();
        const eTime = new Date(existing.timestamp).getTime();
        if (cMsg > eMsg || (cMsg === eMsg && cTime > eTime)) localById.set(c.id, c);
      }
      const deletedSet = new Set(deletedIds);
      const merged = [...localById.values()]
        .filter(c => !deletedSet.has(c.id))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      await setDoc(ref, { historyBlob: JSON.stringify(merged), lastUpdated: serverTimestamp() }, { merge: true });
    } catch {
      // Network or permission; sync will retry on next change
    }
  }

  async getHistory(uid: string): Promise<Conversation[] | null> {
    const ref = this.userRef(uid);
    if (!ref) return null;
    try {
      const snap = await getDoc(ref);
      const blob = snap.data()?.historyBlob;
      if (!blob) return null;
      const parsed = JSON.parse(blob) as any[];
      return parsed.map((c: any) => ({
        ...c,
        timestamp: new Date(c.timestamp),
        messages: (c.messages || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
      }));
    } catch {
      return null;
    }
  }
}

export const firebaseService = new FirebaseService();
