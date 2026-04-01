
import { getAnalytics } from "firebase/analytics";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/functions";
import { getFirestore, doc, setDoc, getDoc, updateDoc, Firestore, serverTimestamp, collection, query, orderBy, getDocs, where, addDoc, deleteDoc, limit, startAfter, DocumentSnapshot, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { Conversation, UserAccount, UserRole, SignupRequest, SiteMetrics, ApiKeyDef, conversationHasUserMessage } from "../types";

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
    // Log this login to Firestore immediately — before any chat starts
    if (this.db) {
      try {
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(this.db, 'login_events', `${uid}_${today}`), {
          uid, email, loginAt: serverTimestamp(), date: today
        }, { merge: true });
      } catch { /* non-blocking */ }
    }
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
        lastReset: Date.now()
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
    };
  }

  private static readonly USAGE_LIMITS: Record<string, UsagePlanLimits> = {
    free:         { textPerDay: 200,  imagesPer30Days: 10,  videosPer30Days: 0 },
    starter:      { textPerDay: 200,  imagesPer30Days: 10,  videosPer30Days: 0 },
    basic:        { textPerDay: 500,  imagesPer30Days: 30,  videosPer30Days: 2 },
    basic_yearly: { textPerDay: 500,  imagesPer30Days: 30,  videosPer30Days: 2 },
    pro:          { textPerDay: 2000, imagesPer30Days: null, videosPer30Days: null },
    pro_yearly:   { textPerDay: 2000, imagesPer30Days: null, videosPer30Days: null },
  };

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

  async updateUserMemory(uid: string, memory: string) {
    const ref = this.userRef(uid);
    if (!ref) return;
    await updateDoc(ref, { memory });
  }

  async saveHistory(uid: string, history: Conversation[], deletedIds: string[] = []) {
    const ref = this.userRef(uid);
    if (!ref) return;
    try {
      let cloud: Conversation[] | null = null;
      try {
        cloud = await this.getHistory(uid);
      } catch {
        // Use empty cloud so we still persist local history (e.g. offline or permission)
      }
      const cloudList = (cloud || []).filter(c => conversationHasUserMessage(c));
      const localList = history.filter(c => conversationHasUserMessage(c));
      const localById = new Map(localList.map(c => [c.id, c]));
      // Merge: for each cloud conv, keep cloud unless local has more messages or newer timestamp
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
      if (blob === undefined || blob === null) return null;
      if (typeof blob !== 'string') return null;
      const parsed = JSON.parse(blob) as any[];
      if (!Array.isArray(parsed)) return null;
      return parsed.map((c: any) => ({
        ...c,
        id: c.id ?? String(Date.now()),
        title: c.title ?? 'Chat',
        mode: c.mode ?? 'chat',
        timestamp: c.timestamp ? new Date(c.timestamp) : new Date(),
        messages: (c.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        })),
      }));
    } catch {
      return null;
    }
  }

  // ─── Creations ─────────────────────────────────────────────────────────────

  async createCreation(data: {
    title: string; caption: string; originalPrompt: string;
    output?: string; mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'music' | 'text';
    tags?: string[]; userId: string; userName: string; userAvatar?: string;
  }): Promise<string> {
    if (!this.db) throw new Error('DB not initialized');
    if (!data.originalPrompt && !data.caption) throw new Error('prompt or caption required');
    const ref = await addDoc(collection(this.db, 'creations'), {
      ...data, likes: [], likeCount: 0, commentCount: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async getCreations(pageSize = 12, lastVisible?: DocumentSnapshot): Promise<{ posts: any[]; lastDoc: DocumentSnapshot | null }> {
    if (!this.db) return { posts: [], lastDoc: null };
    const constraints: any[] = [orderBy('createdAt', 'desc'), limit(pageSize)];
    if (lastVisible) constraints.push(startAfter(lastVisible));
    const snap = await getDocs(query(collection(this.db, 'creations'), ...constraints));
    return {
      posts: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  }

  async getCreation(id: string): Promise<any | null> {
    if (!this.db) return null;
    const snap = await getDoc(doc(this.db, 'creations', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async updateCreation(id: string, data: Partial<{ title: string; caption: string; originalPrompt: string; tags: string[] }>): Promise<void> {
    if (!this.db) return;
    await updateDoc(doc(this.db, 'creations', id), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteCreation(id: string): Promise<void> {
    if (!this.db) return;
    await deleteDoc(doc(this.db, 'creations', id));
  }

  async toggleCreationLike(creationId: string, userId: string): Promise<boolean> {
    if (!this.db) return false;
    const ref = doc(this.db, 'creations', creationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const liked = (snap.data().likes as string[]).includes(userId);
    await updateDoc(ref, {
      likes: liked ? arrayRemove(userId) : arrayUnion(userId),
      likeCount: increment(liked ? -1 : 1),
    });
    return !liked;
  }

  async addCreationComment(creationId: string, comment: { userId: string; userName: string; userAvatar?: string; text: string }): Promise<any> {
    if (!this.db) throw new Error('DB not initialized');
    if (!comment.text.trim()) throw new Error('Comment cannot be empty');
    const cRef = await addDoc(collection(this.db, 'creations', creationId, 'comments'), {
      ...comment, likes: [], createdAt: serverTimestamp(),
    });
    await updateDoc(doc(this.db, 'creations', creationId), { commentCount: increment(1) });
    return { id: cRef.id, ...comment, likes: [], createdAt: new Date() };
  }

  async getCreationComments(creationId: string): Promise<any[]> {
    if (!this.db) return [];
    const snap = await getDocs(query(collection(this.db, 'creations', creationId, 'comments'), orderBy('createdAt', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async toggleCommentLike(creationId: string, commentId: string, userId: string): Promise<void> {
    if (!this.db) return;
    const ref = doc(this.db, 'creations', creationId, 'comments', commentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const liked = (snap.data().likes as string[]).includes(userId);
    await updateDoc(ref, { likes: liked ? arrayRemove(userId) : arrayUnion(userId) });
  }


}

export const firebaseService = new FirebaseService();
