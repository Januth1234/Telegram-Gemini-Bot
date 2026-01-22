
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose API Keys with explicit fallbacks to provided keys
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || ""),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || ""),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || ""),
      'process.env.VAPID_KEY': JSON.stringify(env.VAPID_KEY || env.VITE_VAPID_KEY || ""),
      
      // Hardcoded fallbacks for Supabase to ensure database features work immediately
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || "https://elcvjjldbjymourtjhrj.supabase.co"),
      // Using Service Role Key as requested for admin access
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsY3ZqamxkYmp5bW91cnRqaHJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA0NzEwNiwiZXhwIjoyMDg0NjIzMTA2fQ.vlB-83_4RkkrRH_Th4-h0gZXxDVwA1kiAY-Vs-2GJ4Q"),
    },
  };
});
