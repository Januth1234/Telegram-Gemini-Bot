// Shared Firebase config for both app and service workers.
// Values are injected at build time via Vite env defines.
self.FIREBASE_CONFIG = {
  apiKey: (typeof process !== 'undefined' && process.env && process.env.FIREBASE_API_KEY) || "AIzaSyB5rY4e-_GOkkl4qwDZuvHqwq0_IP9mFmA",
  authDomain: "orin-ai-f6798.firebaseapp.com",
  projectId: "orin-ai-f6798",
  storageBucket: "orin-ai-f6798.firebasestorage.app",
  messagingSenderId: "259788442094",
  appId: (typeof process !== 'undefined' && process.env && process.env.FIREBASE_APP_ID) || "1:259788442094:web:4d946378ca1b4d7349a6ff",
  measurementId: "G-57DHESH4ZJ",
};

