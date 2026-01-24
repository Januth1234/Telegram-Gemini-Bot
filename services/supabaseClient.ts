
import { createClient } from '@supabase/supabase-js';

// Hardcoded keys provided to ensure database features work
const SUPABASE_URL = "https://elcvjjldbjymourtjhrj.supabase.co";
// Using Service Role Key (Admin) to allow auto-seeding and user management
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsY3ZqamxkYmp5bW91cnRqaHJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA0NzEwNiwiZXhwIjoyMDg0NjIzMTA2fQ.vlB-83_4RkkrRH_Th4-h0gZXxDVwA1kiAY-Vs-2GJ4Q";

// Try to get env vars from Vite's import.meta.env first, then fall back to process.env, then hardcoded defaults
const getEnvVar = (key: string, viteKey: string, fallback: string) => {
  const meta = import.meta as any;
  if (meta.env && meta.env[viteKey]) {
    return meta.env[viteKey];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'VITE_SUPABASE_URL', SUPABASE_URL);
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', SUPABASE_KEY);

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "https://placeholder.supabase.co") {
  console.warn("Supabase keys are missing or placeholder. Database features will not work.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
