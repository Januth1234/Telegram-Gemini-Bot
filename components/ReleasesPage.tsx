import React, { useCallback, useEffect, useState } from 'react';
import { githubReleasesService } from '../services/githubReleasesService';
import type { GitHubReleaseItem } from '../services/githubReleasesService';
import { Language } from '../types';
import { translations } from '../translations';
import { APP_CONFIG } from '../config';

interface ReleasesPageProps {
  onClose: () => void;
  lang: Language;
}

interface LocalCodeSnapshot extends GitHubReleaseItem {
  bodySi?: string;
}

// Historical log using official language — static, so defined outside component to avoid re-creation on every render.
const OFFICIAL_UPDATES: LocalCodeSnapshot[] = [
  {
    version: "5.5.0",
    date: "April 2026",
    features: [
      "Creations Feed — Instagram-style social platform",
      "Your Creations tab — personal generation history with prompts",
      "Image-to-Image generation with reference photo",
      "Generate Summary button in every chat",
      "Agent Mode — auto-executes browser tasks step by step",
      "Language toggle saves across sessions",
      "Voice & Camera — fixed false error on close",
      "VAD bark filter — 250ms sustained speech required",
      "Upgrade greeting popup on plan change",
      "All users logged to database on sign-in",
      "Plain-language translations in Sinhala and Tamil",
    ],
    body: "A major quality-of-life release. Creations is now a full social platform — post AI-generated images, like, comment, and share. The new 'Your Creations' tab keeps your personal generation history. Image generation now supports a reference photo for image-to-image editing. Agent Mode auto-plans and opens URLs for browser tasks. Voice mode no longer shows false errors when you close it. Language preference now persists across refreshes. All translations rewritten in plain everyday language.",
    bodySi: "Creations දැන් සම්පූර්ණ සමාජ වේදිකාවක් — like, comment, share. 'Your Creations' ඔබේ AI රූප ඉතිහාසය ගබඩා කරයි. Image gen ට reference photo හැකි. Voice close කළ විට වැරදි error නිවැරදි. භාෂා toggle refresh කළ විටත් සටහන් රැකේ. සිංහල translations ස්වාභාවික.",
    htmlUrl: "#releases"
  },
  {
    version: "5.4.0",
    date: "March 2026",
    features: [
      "Image generation fixed — Imagen 3 + Gemini fallback",
      "GPU drain in Studio Create eliminated (removed backdrop-blur)",
      "Vercel Blob media uploads for Creations",
      "Firestore-backed Creations with real-time likes and comments",
      "Use It button — reuse any creation prompt in chat or Studio",
      "Edit and delete own posts",
      "Markov chain autocomplete for prompts",
      "Auto tag extraction from prompt keywords",
    ],
    body: "Stability and performance. Image generation no longer fails — tries Imagen 3 first, Gemini Flash as fallback. GPU usage in Studio Create dropped significantly after removing all backdrop-blur effects. Creations are now stored in Firestore with real-time likes, comments, editing, deletion, and the Use It prompt reuse feature. Markov chain autocomplete suggests completions as you type.",
    bodySi: "Image gen 404 දෝෂය නිවැරදි — Imagen 3 මුලින්, Flash fallback. Studio Create GPU භාවිතය අඩු. Creations Firestore හි like, comment, edit, delete, Use It.",
    htmlUrl: "#releases"
  },
  {
    version: "5.3.0",
    date: "March 2026",
    features: [
      "Gemini Live Voice — fixed with correct model and WebSocket config",
      "Camera mode — real-time live video AI",
      "Code execution, URL context, Deep research in chat",
      "File search workspace",
      "Math mode with step-by-step solutions",
      "Creations social feed launched",
      "Points and rewards system",
    ],
    body: "Gemini Live Voice now works after fixing the model name and audio pipeline. Code execution runs Python in chat. URL context reads any webpage. Deep research gives thorough answers. Creations went live as a social platform for AI content.",
    bodySi: "Voice live API නිවැරදිව. Code execution, URL context, deep research chat හි. Creations social feed දියත්.",
    htmlUrl: "#releases"
  },
  {
    version: "4.6.0",
    date: "February 2026",
    features: [
      "Thinking Mode — deeper reasoning on hard questions",
      "Descriptive Mode — step-by-step explanations",
      "5 Minimal Themes (Classic, Midnight, Aurora, Terminal, Paper)",
      "Per-User Theme Sync across devices",
      "Live Memory from conversations",
    ],
    body: "Thinking Mode lets Orin reason more deeply. Five new minimal themes skin the entire workspace and sync across devices. Live memory keeps a short summary of what matters to you.",
    bodySi: "Thinking Mode ගැඹුරු සිතීම. තේමා 5 devices අතර sync. Live memory ඔබ ගැන වැදගත් දේ සටහන් කරයි.",
    htmlUrl: "#releases"
  },
  {
    version: "4.0.0",
    date: "January 2026",
    features: [
      "Initial Orin AI Platform launch",
      "Bilingual — English and Sinhala",
      "Gemini 2.5 Integration",
      "Firebase auth and history sync",
      "Studio Create — image and video generation",
    ],
    body: "The official launch of Orin AI. Sri Lanka's first bilingual AI assistant with image generation, voice, camera, math, and translation.",
    bodySi: "ඔරින් AI නිල දියත් කිරීම. ශ්‍රී ලංකාවේ ප්‍රථම bilingual AI.",
    htmlUrl: "#releases"
  },
];

const ReleasesPage: React.FC<ReleasesPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [updates, setUpdates] = useState<LocalCodeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpdates = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await githubReleasesService.getReleases(forceRefresh);
      const merged = data.length > 0
        ? data.map((r) => {
            const local = OFFICIAL_UPDATES.find((o) => o.version === r.version);
            return { ...r, bodySi: local?.bodySi } as LocalCodeSnapshot;
          })
        : OFFICIAL_UPDATES;
      setUpdates(merged);
    } catch {
      setUpdates(OFFICIAL_UPDATES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpdates(false);
  }, [fetchUpdates]);

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-transparent animate-reveal">
      <div className="max-w-4xl mx-auto space-y-12 pb-32 px-6 pt-12 text-slate-900 dark:text-slate-100">
        
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Official Releases</h2>
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{lang === 'si' ? 'අලුත් දේවල්' : 'What\'s New'} · v{APP_CONFIG.version}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchUpdates(true)}
              disabled={loading}
              className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm disabled:opacity-50"
              title={lang === 'si' ? 'GitHub ගෙන් යාවත්කාලීන කරන්න' : 'Refresh from GitHub'}
            >
              <i className={`fa-solid fa-arrows-rotate text-lg ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </header>

        <div className="space-y-16">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Synchronizing Logs...</p>
            </div>
          ) : (
            <div className="space-y-16">
              {updates.map((update, i) => (
                <article key={i} className="animate-reveal space-y-6" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/5">Platform Release</span>
                         {i === 0 && <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest animate-pulse">LATEST</span>}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">BUILD {update.version}</h3>
                    </div>
                    <div className="px-4 py-2 glass-panel rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border border-black/5 dark:border-white/5 shadow-sm">
                      {update.date}
                    </div>
                  </div>

                  <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-black/5 dark:border-white/5 space-y-8 shadow-sm relative overflow-hidden bg-white/40 dark:bg-slate-900/40">
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] border-b border-black/5 dark:border-white/5 pb-4">{lang === 'si' ? 'නව අංග' : 'Updates'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {update.features.map((f, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full mt-1.5 shrink-0"></div>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight uppercase tracking-wide">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-black/5 dark:border-white/5">
                      <p className={`text-base leading-relaxed text-slate-800 dark:text-slate-300 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`}>
                        {lang === 'si' && update.bodySi ? update.bodySi : update.body}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-24 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Orin AI Official Log • 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default ReleasesPage;
