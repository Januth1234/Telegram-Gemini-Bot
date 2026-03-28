// Shared Firebase config for both app and service workers.
// Values are injected at build time via Vite env defines.
self.FIREBASE_CONFIG = {
  apiKey: (typeof process !== 'undefined' && process.env && process.env.FIREBASE_API_KEY) || "YOUR_FIREBASE_API_KEY",
  authDomain: "orin-ai-f6798.firebaseapp.com",
  projectId: "orin-ai-f6798",
  storageBucket: "orin-ai-f6798.firebasestorage.app",
  messagingSenderId: "259788442094",
  appId: (typeof process !== 'undefined' && process.env && process.env.FIREBASE_APP_ID) || "YOUR_FIREBASE_APP_ID",
  measurementId: "G-57DHESH4ZJ",
};

