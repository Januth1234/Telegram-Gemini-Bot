import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth, User, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, Firestore } from "firebase/firestore";
import { Conversation } from "../types";

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

class FirebaseService {
  private app: any;
  private messaging: Messaging | null = null;
  private token: string | null = null;
  private analytics: any = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;

  constructor() {
    try {
      this.app = initializeApp(firebaseConfig);
      
      // Initialize Analytics & Auth if in browser
      if (typeof window !== 'undefined') {
        this.analytics = getAnalytics(this.app);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        
        // Ensure persistence is set to LOCAL to survive refreshes
        setPersistence(this.auth, browserLocalPersistence)
          .catch((error) => console.error("Auth Persistence Error:", error));
      }

      // Initialize Messaging
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        this.messaging = getMessaging(this.app);
      }
    } catch (e) {
      console.warn("Firebase initialization warning:", e);
    }
  }

  // --- AUTHENTICATION ---
  async loginWithGoogle(): Promise<User> {
    if (!this.auth) throw new Error("Authentication module not initialized.");
    
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    try {
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error: any) {
      console.error("Firebase Auth Error Full:", error);
      
      if (error.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        const host = window.location.host;
        // Fallback to host if hostname is empty (can happen in some preview environments)
        const currentDomain = hostname || host || window.location.href;
        throw new Error(`Domain not authorized (${currentDomain}). Please add "${currentDomain}" to the Firebase Console.`);
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error("Sign-in cancelled by user.");
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }
      
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.auth) {
      await signOut(this.auth);
    }
  }

  // Add listener for auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    if (this.auth) {
      return onAuthStateChanged(this.auth, callback);
    }
  }

  // --- FIRESTORE HISTORY SYNC ---
  async saveHistory(uid: string, history: Conversation[]) {
    if (!this.db) return;
    try {
      // We store history as a JSON string blob to preserve structure and avoid
      // Firestore recursion limits or field mapping issues with complex nested objects.
      const historyBlob = JSON.stringify(history);
      const userRef = doc(this.db, "users", uid);
      await setDoc(userRef, { historyBlob, lastUpdated: new Date() }, { merge: true });
      console.log("Cloud Sync: History saved successfully.");
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
        return parsed;
      }
    } catch (e) {
      console.error("Cloud Fetch Error:", e);
    }
    return null;
  }

  // --- MESSAGING ---
  async requestPermission(): Promise<string | null> {
    if (!this.messaging) {
      console.warn("Messaging not initialized (Service Workers not supported or blocked).");
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // VAPID Key provided by user
        const vapidKey = "BMz4Zssv3qb7H5GI-hEdYBGQ32QQ65Qj6gHwT1dTJy5NnPd38UrnRunrIWeFxDNsUJyard-mhXkur13D2fVlf48"; 

        try {
          const currentToken = await getToken(this.messaging, {
            vapidKey: vapidKey
          });
          
          if (currentToken) {
            this.token = currentToken;
            console.log("FCM Token Generated:", currentToken);
            return currentToken;
          } else {
            console.warn("No registration token available. Request permission to generate one.");
          }
        } catch (tokenError) {
          console.error("Error fetching FCM token:", tokenError);
          throw new Error("Failed to generate token. Ensure Service Worker is registered.");
        }
      } else {
        console.warn("Notification permission denied.");
        throw new Error("Permission denied. Please enable notifications in browser settings.");
      }
    } catch (err) {
      console.error("An error occurred while retrieving token. ", err);
      throw err;
    }
    return null;
  }

  async simulateLocalNotification(title: string, body: string) {
    if (Notification.permission === 'granted') {
       new Notification(title, { body, icon: '/favicon.svg' });
    }
  }

  onForegroundMessage(callback: (payload: any) => void) {
    if (!this.messaging) return;
    return onMessage(this.messaging, (payload) => {
      console.log("Foreground Message received: ", payload);
      callback(payload);
    });
  }

  getCurrentToken() {
    return this.token;
  }
}

export const firebaseService = new FirebaseService();