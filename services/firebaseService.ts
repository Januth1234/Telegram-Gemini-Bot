
import { getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/functions";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, runTransaction, Firestore, serverTimestamp, collection, query, orderBy, getDocs, where, limit } from "firebase/firestore";
import { Conversation, UserAccount, UserRole, SignupRequest, SiteMetrics, ApiKeyDef, conversationHasUserMessage, UserThemeId } from "../types";

interface UsagePlanLimits {
  textPerDay: number | null;
  imagesPer30Days: number | null;
  videosPer30Days: number | null;
}

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

        const recaptchaSiteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || (typeof process !== "undefined" && process.env?.VITE_RECAPTCHA_SITE_KEY) || "";
        if (recaptchaSiteKey) {
          try {
            initializeAppCheck(getApp(), {
              provider: new ReCaptchaV3Provider(recaptchaSiteKey),
              isTokenAutoRefreshEnabled: true,
            });
          } catch (_) {
            // App Check optional if key not configured
          }
        }

        if (this.auth) {
           this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch((error) => console.error("Auth Persistence Error:", error));
        }

        try {
          this.analytics = getAnalytics(this.app);
        } catch (_) {}
      }
    } catch (_) {}
  }

  async loginWithGoogle(): Promise<firebase.User | null> {
    if (!this.auth) throw new Error("Authentication module not initialized.");
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await this.auth.signInWithPopup(provider);
      return result.user ?? null;
    } catch (err: any) {
      const code = err?.code || '';
      const useRedirect = code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/web-storage-unsupported';
      if (useRedirect) {
        await this.auth.signInWithRedirect(provider);
        return null;
      }
      throw err;
    }
  }

  async getRedirectResult(): Promise<{ credential: firebase.auth.UserCredential | null; error: string | null }> {
    if (!this.auth) return { credential: null, error: null };
    try {
      const credential = await this.auth.getRedirectResult();
      return { credential, error: null };
    } catch (err: any) {
      const msg = err?.message || err?.code || "Unknown error";
      return { credential: null, error: msg };
    }
  }

  async logout(): Promise<void> {
    if (this.auth) await this.auth.signOut();
  }

  currentUser(): firebase.User | null {
    return this.auth?.currentUser ?? null;
  }

  onAuthStateChanged(callback: (user: firebase.User | null) => void) {
    if (this.auth) return this.auth.onAuthStateChanged(callback);
    callback(null);
    return () => {};
  }

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

  private static readonly DAY_MS = 24 * 60 * 60 * 1000;
  private static readonly THIRTY_DAYS_MS = 30 * FirebaseService.DAY_MS;

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
        plan: 'free',
        role: 'visitor', 
        approved: false,
        subscriptionStatus: 'active',
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        usage: { text: 0, images: 0, videos: 0, mediaWindowStart: Date.now() },
        memory: "User is new to Orin AI.",
        lastReset: Date.now(),
        theme: 'classic'
      };
      await setDoc(userRef, userData);
    } else {
      userData = snap.data();
      const updates: any = {};
      if (photoURL && userData.avatar !== photoURL) updates.avatar = photoURL;

      const now = Date.now();
      const usage = userData.usage ?? { text: 0, images: 0, videos: 0 };
      let lastReset: number = userData.lastReset || 0;
      let mediaWindowStart: number = usage.mediaWindowStart || lastReset || now;
      let changed = false;

      // Reset daily text usage if a full day has passed
      if (!lastReset || now - lastReset > FirebaseService.DAY_MS) {
        usage.text = 0;
        lastReset = now;
        changed = true;
      }

      // Reset 30-day window for images/videos if needed
      if (!mediaWindowStart || now - mediaWindowStart > FirebaseService.THIRTY_DAYS_MS) {
        usage.images = 0;
        usage.videos = 0;
        mediaWindowStart = now;
        changed = true;
      }

      if (changed) {
        usage.mediaWindowStart = mediaWindowStart;
        updates.usage = usage;
        updates.lastReset = lastReset;
        userData.usage = usage;
      }

      if (Object.keys(updates).length > 0) await updateDoc(userRef, updates);
    }

    const plan = (userData.plan || 'free').toLowerCase();
    const tier = (plan === 'pro' || plan === 'pro_yearly' || plan === 'elite')
      ? 'Pro (BYO-Google)'
      : (plan === 'basic' || plan === 'basic_yearly')
        ? 'Basic'
        : 'Free';
    return {
      id: uid,
      name: userData.name || email.split('@')[0],
      email: email,
      avatar: userData.avatar,
      tier,
      plan: userData.plan || 'free',
      role: userData.role || 'visitor',
      approved: userData.approved || false,
      dailyUsage: userData.usage || { text: 0, images: 0, videos: 0 },
      theme: (userData.theme as UserThemeId) || 'classic',
    };
  }

  private static readonly USAGE_LIMITS: Record<string, UsagePlanLimits> = {
    free:         { textPerDay: 200,  imagesPer30Days: 10,  videosPer30Days: 0 },
    starter:      { textPerDay: 200,  imagesPer30Days: 10,  videosPer30Days: 0 }, // legacy alias
    basic:        { textPerDay: 500,  imagesPer30Days: 30,  videosPer30Days: 2 },
    basic_yearly: { textPerDay: 500,  imagesPer30Days: 30,  videosPer30Days: 2 },
    pro:          { textPerDay: 2000, imagesPer30Days: null, videosPer30Days: null },
    pro_yearly:   { textPerDay: 2000, imagesPer30Days: null, videosPer30Days: null },
  };

  /**
   * Atomically check usage limit and increment if under limit.
   * @returns true if limit was already reached (caller should throw); false if increment was applied.
   */
  async checkAndIncrementUsage(uid: string, type: 'text' | 'images' | 'videos'): Promise<boolean> {
    const ref = this.userRef(uid);
    if (!ref || !this.db) return false;
    let limitReached = false;
    await runTransaction(this.db, async (transaction) => {
      const snap = await transaction.get(ref);
      const data = snap.exists() ? snap.data()! : {};
      const now = Date.now();
      const planKey: string = (data.plan || 'free') === 'elite' ? 'pro' : (data.plan || 'free');
      const limits = FirebaseService.USAGE_LIMITS[planKey] ?? FirebaseService.USAGE_LIMITS['free'];
      const usage: Record<string, number> = { ...(data.usage ?? { text: 0, images: 0, videos: 0 }) };
      let lastReset: number = data.lastReset || 0;
      let mediaWindowStart: number = (usage.mediaWindowStart ?? lastReset) || now;

      // Reset daily text if needed
      if (!lastReset || now - lastReset > FirebaseService.DAY_MS) {
        usage.text = 0;
        lastReset = now;
      }
      // Reset 30-day media window if needed
      if (!mediaWindowStart || now - mediaWindowStart > FirebaseService.THIRTY_DAYS_MS) {
        usage.images = 0;
        usage.videos = 0;
        mediaWindowStart = now;
      }
      usage.mediaWindowStart = mediaWindowStart;

      // Check limit
      if (type === 'text') {
        const limit = limits.textPerDay;
        if (limit != null) {
          const effectiveText = usage.text ?? 0;
          if (effectiveText >= limit) {
            limitReached = true;
            return;
          }
        }
      } else {
        const isImage = type === 'images';
        const limit = isImage ? limits.imagesPer30Days : limits.videosPer30Days;
        if (limit != null) {
          const windowFresh = !!mediaWindowStart && now - mediaWindowStart <= FirebaseService.THIRTY_DAYS_MS;
          const rawUsage = isImage ? (usage.images ?? 0) : (usage.videos ?? 0);
          const effectiveUsage = windowFresh ? rawUsage : 0;
          if (effectiveUsage >= limit) {
            limitReached = true;
            return;
          }
        }
      }

      // Atomically increment
      usage[type] = (usage[type] ?? 0) + 1;
      transaction.set(ref, { usage, lastReset, lastUpdated: serverTimestamp() }, { merge: true });
    });
    return limitReached;
  }

  async checkLimit(uid: string, type: 'text' | 'images' | 'videos'): Promise<boolean> {
    const ref = this.userRef(uid);
    if (!ref) return false;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return false;
      const data = snap.data();
      const now = Date.now();
      const planKey: string = (data.plan || 'free') === 'elite' ? 'pro' : (data.plan || 'free');
      const limits = FirebaseService.USAGE_LIMITS[planKey] || FirebaseService.USAGE_LIMITS['free'];
      const usage = data.usage ?? { text: 0, images: 0, videos: 0 };
      const lastReset: number = data.lastReset || 0;
      const mediaWindowStart: number = usage.mediaWindowStart || lastReset || now;

      if (type === 'text') {
        const limit = limits.textPerDay;
        if (limit == null) return false;
        const effectiveText = (!lastReset || now - lastReset > FirebaseService.DAY_MS) ? 0 : (usage.text ?? 0);
        return effectiveText >= limit;
      }

      const isImage = type === 'images';
      const limit = isImage ? limits.imagesPer30Days : limits.videosPer30Days;
      if (limit == null) return false;

      const windowFresh = !!mediaWindowStart && now - mediaWindowStart <= FirebaseService.THIRTY_DAYS_MS;
      const rawUsage = isImage ? (usage.images ?? 0) : (usage.videos ?? 0);
      const effectiveUsage = windowFresh ? rawUsage : 0;
      return effectiveUsage >= limit;
    } catch {
      return false; // permission/network; allow request
    }
  }

  async incrementUsage(uid: string, type: 'text' | 'images' | 'videos') {
    const ref = this.userRef(uid);
    if (!ref) return;
    try {
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const now = Date.now();

      const usage = (data.usage ?? { text: 0, images: 0, videos: 0 }) as any;
      let lastReset: number = data.lastReset || 0;
      let mediaWindowStart: number = usage.mediaWindowStart || lastReset || now;

      // Reset daily text if needed
      if (!lastReset || now - lastReset > FirebaseService.DAY_MS) {
        usage.text = 0;
        lastReset = now;
      }

      // Reset 30-day window for media if needed
      if (!mediaWindowStart || now - mediaWindowStart > FirebaseService.THIRTY_DAYS_MS) {
        usage.images = 0;
        usage.videos = 0;
        mediaWindowStart = now;
      }

      if (type === 'text') {
        usage.text = (usage.text ?? 0) + 1;
      } else if (type === 'images') {
        usage.images = (usage.images ?? 0) + 1;
      } else {
        usage.videos = (usage.videos ?? 0) + 1;
      }

      usage.mediaWindowStart = mediaWindowStart;

      await setDoc(ref, { usage, lastReset, lastUpdated: serverTimestamp() }, { merge: true });
    } catch {
      // Permission or network; don't block chat
    }
  }

  async saveFCMToken(uid: string, token: string): Promise<void> {
    const ref = this.userRef(uid);
    if (!ref) return;
    try {
      await updateDoc(ref, {
        fcmToken: token,
        fcmTokenUpdatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });
    } catch (_) {}
  }

  async updatePlan(uid: string, plan: string) {
    const ref = this.userRef(uid);
    if (!ref) return;
    await updateDoc(ref, { plan: plan.toLowerCase(), lastUpdated: serverTimestamp() });
  }

  async updateUserTheme(uid: string, theme: UserThemeId) {
    const ref = this.userRef(uid);
    if (!ref) return;
    try {
      await updateDoc(ref, { theme, lastUpdated: serverTimestamp() });
    } catch {
      // Do not block UI if theme update fails
    }
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
    try {
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data().memory ?? "") : "";
    } catch {
      return ""; // permission/network; continue without memory
    }
  }

  /** Max memory length to avoid bloating chat() system instructions. Enforced server-side even if UI is bypassed. */
  static readonly MEMORY_MAX_LENGTH = 2000;

  async updateUserMemory(uid: string, memory: string) {
    const ref = this.userRef(uid);
    if (!ref) return;
    const trimmed = memory.slice(0, FirebaseService.MEMORY_MAX_LENGTH);
    await updateDoc(ref, { memory: trimmed });
  }

  private static readonly CONVERSATIONS_LIMIT = 30;
  private static readonly MESSAGES_PER_CONVERSATION = 50;
  private static readonly BATCH_SIZE = 500;

  private conversationRef(uid: string, convId: string) {
    return this.db ? doc(this.db, `users/${uid}/conversations/${convId}`) : null;
  }

  private conversationsCollection(uid: string) {
    return this.db ? collection(this.db, `users/${uid}/conversations`) : null;
  }

  /** Save history to subcollection users/{uid}/conversations/{convId}. Optional embeddingsByConvId for semantic search. */
  async saveHistory(uid: string, history: Conversation[], deletedIds: string[] = [], recentCloud: Conversation[] | null = null, embeddingsByConvId?: Record<string, number[]>) {
    if (!this.db) return;
    try {
      let cloud: Conversation[] | null = recentCloud;
      if (cloud === undefined || cloud === null) {
        try {
          cloud = await this.getHistory(uid);
        } catch {
          // Use empty cloud so we still persist local history (e.g. offline or permission)
        }
      }
      const cloudList = (cloud || []).filter(c => conversationHasUserMessage(c));
      const localList = history.filter(c => conversationHasUserMessage(c));
      const localById = new Map(localList.map(c => [c.id, c]));
      for (const c of cloudList) {
        const existing = localById.get(c.id);
        if (!existing) {
          localById.set(c.id, c);
          continue;
        }
        const cMsg = (c.messages || []).length;
        const eMsg = (existing.messages || []).length;
        const cTime = new Date(c.timestamp).getTime();
        const eTime = new Date(existing.timestamp).getTime();
        if (cMsg > eMsg || (cMsg === eMsg && cTime > eTime)) localById.set(c.id, c);
      }
      const deletedSet = new Set(deletedIds);
      const merged = [...localById.values()]
        .filter(c => !deletedSet.has(c.id))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const col = this.conversationsCollection(uid);
      if (!col) return;
      type Op = { type: 'set'; ref: ReturnType<typeof this.conversationRef>; payload: object } | { type: 'delete'; ref: ReturnType<typeof this.conversationRef> };
      const ops: Op[] = [];
      for (const conv of merged) {
        const convRef = this.conversationRef(uid, conv.id);
        if (!convRef) continue;
        const payload: Record<string, unknown> = {
          id: conv.id,
          title: conv.title ?? 'Chat',
          mode: conv.mode ?? 'chat',
          modesUsed: conv.modesUsed ?? [],
          timestamp: conv.timestamp,
          messages: (conv.messages || []).slice(-FirebaseService.MESSAGES_PER_CONVERSATION),
          lastUpdated: serverTimestamp(),
        };
        const embedding = embeddingsByConvId?.[conv.id];
        if (embedding && Array.isArray(embedding)) payload.embedding = embedding;
        ops.push({ type: 'set', ref: convRef, payload });
      }
      for (const id of deletedIds) {
        const convRef = this.conversationRef(uid, id);
        if (convRef) ops.push({ type: 'delete', ref: convRef });
      }
      for (let i = 0; i < ops.length; i += FirebaseService.BATCH_SIZE) {
        const chunk = ops.slice(i, i + FirebaseService.BATCH_SIZE);
        if (chunk.length === 0) continue;
        const batch = writeBatch(this.db);
        for (const op of chunk) {
          if (op.ref) {
            if (op.type === 'set') batch.set(op.ref, op.payload);
            else batch.delete(op.ref);
          }
        }
        await batch.commit();
      }
    } catch {
      // Network or permission; sync will retry on next change
    }
  }

  async getHistory(uid: string): Promise<Conversation[] | null> {
    const col = this.conversationsCollection(uid);
    if (!col) return null;
    try {
      const q = query(
        col,
        orderBy('timestamp', 'desc'),
        limit(FirebaseService.CONVERSATIONS_LIMIT)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        const ts = data.timestamp;
        const timestamp = ts?.toDate?.() ?? (ts ? new Date(ts) : new Date());
        return {
          id: data.id ?? d.id,
          title: data.title ?? 'Chat',
          mode: data.mode ?? 'chat',
          modesUsed: data.modesUsed ?? [],
          timestamp,
          messages: (data.messages || []).map((m: any) => ({
            ...m,
            timestamp: m.timestamp?.toDate?.() ?? (m.timestamp ? new Date(m.timestamp) : new Date()),
          })),
          embedding: Array.isArray(data.embedding) ? data.embedding : undefined,
        } as Conversation;
      });
      if (list.length > 0) return list;
      const userSnap = await getDoc(this.userRef(uid)!);
      const blob = userSnap.data()?.historyBlob;
      if (blob === undefined || blob === null || typeof blob !== 'string') return [];
      const parsed = JSON.parse(blob) as any[];
      if (!Array.isArray(parsed)) return [];
      const migrated = parsed.map((c: any) => ({
        id: c.id ?? String(Date.now()),
        title: c.title ?? 'Chat',
        mode: c.mode ?? 'chat',
        modesUsed: c.modesUsed ?? [],
        timestamp: c.timestamp ? new Date(c.timestamp) : new Date(),
        messages: (c.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        })),
      }));
      const batch = writeBatch(this.db!);
      for (const conv of migrated.slice(0, FirebaseService.CONVERSATIONS_LIMIT)) {
        const convRef = this.conversationRef(uid, conv.id)!;
        batch.set(convRef, {
          ...conv,
          messages: (conv.messages || []).slice(-FirebaseService.MESSAGES_PER_CONVERSATION),
          lastUpdated: serverTimestamp(),
        });
      }
      await batch.commit();
      return migrated;
    } catch {
      return null;
    }
  }
}

export const firebaseService = new FirebaseService();
