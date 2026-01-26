
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, Firestore, serverTimestamp } from "firebase/firestore";
import { Conversation, UserAccount } from "../types";

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
  private messaging: Messaging | null = null;
  private token: string | null = null;
  private analytics: any = null;
  private auth: firebase.auth.Auth | null = null;
  private db: Firestore | null = null;

  constructor() {
    try {
      this.app = initializeApp(firebaseConfig);
      
      if (typeof window !== 'undefined') {
        this.analytics = getAnalytics(this.app);
        this.auth = firebase.auth(this.app);
        this.db = getFirestore(this.app);
        
        this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
          .catch((error) => console.error("Auth Persistence Error:", error));

        window.handleNativeGoogleToken = async (token: string) => {
          if (!this.auth) return;
          try {
            const credential = firebase.auth.GoogleAuthProvider.credential(token);
            await this.auth.signInWithCredential(credential);
            window.location.reload();
          } catch (err) {
            console.error('Firebase sign-in error:', err);
          }
        };
      }

      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        this.messaging = getMessaging(this.app);
      }
    } catch (e) {
      console.warn("Firebase initialization warning:", e);
    }
  }

  // --- AUTHENTICATION ---
  async loginWithGoogle(): Promise<firebase.User> {
    if (!this.auth) throw new Error("Authentication module not initialized.");
    
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
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
    return () => {};
  }

  // --- FIRESTORE USER SYNC ---
  async syncUserSession(uid: string, email: string): Promise<UserAccount> {
    if (!this.db) throw new Error("DB not init");
    
    const userRef = doc(this.db, "users", uid);
    const snap = await getDoc(userRef);
    
    let userData: any;

    if (!snap.exists()) {
      // Create new user profile
      userData = {
        email,
        plan: 'starter',
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
      // Check for daily reset logic (client-side calculation for now, robust solution would be cloud function)
      const lastReset = userData.lastReset || 0;
      if (Date.now() - lastReset > 86400000) {
        userData.usage = { text: 0, images: 0, videos: 0 };
        userData.lastReset = Date.now();
        await updateDoc(userRef, { usage: userData.usage, lastReset: userData.lastReset });
      }
    }

    // Convert to App Type
    return {
      id: uid,
      name: userData.name || email.split('@')[0],
      email: email,
      tier: userData.plan === 'elite' ? 'Verified Member' : userData.plan === 'pro' ? 'Pro (BYO-Google)' : 'Basic',
      dailyUsage: userData.usage || { text: 0, images: 0, videos: 0 },
      // Memory is handled separately or can be added to UserAccount type if needed globally
    };
  }

  async checkLimit(uid: string, type: 'text' | 'images' | 'videos'): Promise<boolean> {
    if (!this.db) return false;
    const userRef = doc(this.db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return false;
    
    const data = snap.data();
    const plan = data.plan || 'starter';
    const usage = data.usage?.[type] || 0;

    // Limits
    const limits: any = {
       starter: { text: 200, images: 10, videos: 0 },
       pro: { text: 500, images: 50, videos: 5 },
       elite: { text: 999999, images: 9999, videos: 999 }
    };

    return usage >= limits[plan][type];
  }

  async incrementUsage(uid: string, type: 'text' | 'images' | 'videos') {
    if (!this.db) return;
    const userRef = doc(this.db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
       const current = snap.data().usage?.[type] || 0;
       await updateDoc(userRef, { [`usage.${type}`]: current + 1 });
    }
  }

  async updatePlan(uid: string, plan: string) {
    if (!this.db) return;
    await updateDoc(doc(this.db, "users", uid), {
      plan: plan.toLowerCase(),
      lastUpdated: serverTimestamp()
    });
  }

  async getUserMemory(uid: string): Promise<string> {
    if (!this.db) return "";
    const snap = await getDoc(doc(this.db, "users", uid));
    return snap.exists() ? (snap.data().memory || "") : "";
  }

  async updateUserMemory(uid: string, memory: string) {
    if (!this.db) return;
    await updateDoc(doc(this.db, "users", uid), { memory });
  }

  // --- HISTORY SYNC ---
  async saveHistory(uid: string, history: Conversation[]) {
    if (!this.db) return;
    try {
      const historyBlob = JSON.stringify(history);
      const userRef = doc(this.db, "users", uid);
      await setDoc(userRef, { historyBlob, lastUpdated: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error("Cloud Sync Error:", e);
    }
  }

  async getHistory(uid: string): Promise<Conversation[] | null> {
    if (!this.db) return null;
    try {
      const userRef = doc(this.db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data().historyBlob) {
        const parsed = JSON.parse(snap.data().historyBlob);
        return parsed.map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp),
            messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
      }
    } catch (e) {
      console.error("Cloud Fetch Error:", e);
    }
    return null;
  }

  // --- MESSAGING ---
  async requestPermission(): Promise<string | null> {
    if (!this.messaging) return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const vapidKey = process.env.VAPID_KEY || "BMz4Zssv3qb7H5GI-hEdYBGQ32QQ65Qj6gHwT1dTJy5NnPd38UrnRunrIWeFxDNsUJyard-mhXkur13D2fVlf48"; 
        
        let serviceWorkerRegistration = undefined;
        if ('serviceWorker' in navigator) {
             serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
        }

        const currentToken = await getToken(this.messaging, { vapidKey, serviceWorkerRegistration });
        if (currentToken) {
          this.token = currentToken;
          return currentToken;
        }
      }
    } catch (err) {
      console.error("Token Error", err);
    }
    return null;
  }

  async simulateLocalNotification(title: string, body: string) {
    if (Notification.permission === 'granted') {
       new Notification(title, { body, icon: '/favicon.svg' });
    }
  }
}

export const firebaseService = new FirebaseService();
