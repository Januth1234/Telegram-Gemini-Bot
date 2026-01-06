
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose API Keys
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
      // Automatically use the provided key if no environment variable is set in Vercel
      'process.env.OPENROUTER_API_KEY': JSON.stringify(
        env.OPENROUTER_API_KEY || 
        env.VITE_OPENROUTER_API_KEY || 
        "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"
      ),
    },
  };
});
