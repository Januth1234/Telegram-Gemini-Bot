import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth, User } from "firebase/auth";

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

  constructor() {
    try {
      this.app = initializeApp(firebaseConfig);
      
      // Initialize Analytics if in browser
      if (typeof window !== 'undefined') {
        this.analytics = getAnalytics(this.app);
        this.auth = getAuth(this.app);
      }

      // Messaging is only supported in browser environments with Service Workers
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        this.messaging = getMessaging(this.app);
      }
    } catch (e) {
      console.warn("Firebase initialization failed:", e);
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
    } catch (error) {
      console.error("Firebase Auth Error:", error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.auth) {
      await signOut(this.auth);
    }
  }

  // --- MESSAGING ---
  async requestPermission(): Promise<string | null> {
    if (!this.messaging) {
      console.warn("Messaging not initialized (service workers not supported?).");
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        
        // VAPID Key provided by user
        const vapidKey = "BMz4Zssv3qb7H5GI-hEdYBGQ32QQ65Qj6gHwT1dTJy5NnPd38UrnRunrIWeFxDNsUJyard-mhXkur13D2fVlf48"; 

        const currentToken = await getToken(this.messaging, {
          vapidKey: vapidKey
        });
        
        if (currentToken) {
          this.token = currentToken;
          console.log("FCM Token (Use this to send test messages):", currentToken);
          return currentToken;
        } else {
          console.warn("No registration token available. Request permission to generate one.");
        }
      } else {
        console.warn("Notification permission denied.");
      }
    } catch (err) {
      console.error("An error occurred while retrieving token. ", err);
    }
    return null;
  }

  onForegroundMessage(callback: (payload: any) => void) {
    if (!this.messaging) return;
    return onMessage(this.messaging, (payload) => {
      console.log("Message received. ", payload);
      callback(payload);
    });
  }

  getCurrentToken() {
    return this.token;
  }
}

export const firebaseService = new FirebaseService();