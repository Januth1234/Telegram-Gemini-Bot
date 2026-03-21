import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/** Injects build timestamp into public/sw.js when writing to dist so cache version auto-bumps on deploy. */
function swVersionPlugin() {
  let outDir = 'dist';
  return {
    name: 'sw-version',
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const publicSw = path.resolve(process.cwd(), 'public/sw.js');
      const distSw = path.resolve(process.cwd(), outDir, 'sw.js');
      if (!fs.existsSync(publicSw) || !fs.existsSync(path.dirname(distSw))) return;
      let content = fs.readFileSync(publicSw, 'utf-8');
      content = content.replace(/%SW_VERSION%/g, Date.now().toString());
      fs.writeFileSync(distSw, content);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react(), swVersionPlugin()],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            // AI/Google SDK — large, rarely changes
            'vendor-ai': ['@google/genai'],
            // Firebase
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
            // Math libraries — only loaded in maths tab
            'vendor-math': ['mathjs', 'nerdamer'],
            // KaTeX for math rendering
            'vendor-katex': ['katex'],
          },
        },
      },
    },
    define: {
      // Expose API Keys
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID),
      'process.env.VAPID_KEY': JSON.stringify(env.VAPID_KEY || env.VITE_VAPID_KEY),
      'process.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY || env.RECAPTCHA_SITE_KEY || ''),
      // Shim Node's global for browser-only libs (e.g. plotly/has-hover)
      global: 'window',
    },
  };
});
