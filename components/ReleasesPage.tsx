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
    version: "4.6.0",
    date: "March 2026",
    features: [
      "Thinking Mode (Deeper Reasoning)",
      "Descriptive Mode for Step-by-Step Answers",
      "Minimal Neural Themes (5 full skins)",
      "Per-User Workspace Theme Sync",
      "Live Neural Memory Tuning"
    ],
    body: "This release makes Orin feel more personal and modern. Thinking Mode lets Orin slow down and reason more deeply on hard questions, while Descriptive Mode adds clearer, step‑by‑step explanations when you need them. A new set of minimal neural themes (Classic, Midnight, Aurora, Terminal, and Paper) now skin the entire workspace and follow you across devices. Neural memory continues to be updated live from your chats, keeping a short summary of what matters to you.",
    bodySi: "මෙම නිකුතුව ඔරින්‍ව වඩාත් පුද්ගලික සහ නවීන ලෙස පෙනෙන විධියට යාවත්කාලීන කරයි. “Thinking Mode” සක්‍රීය කළ විට අසීරු ප්‍රශ්න සඳහා වඩා ගැඹුරු ව සලකා බැලීමක් කරන අතර “Descriptive Mode” සවිස්තර සතරෙන්, පියවරෙන් පියවර පැහැදිලි කිරීම් ලබා දෙයි. Classic, Midnight, Aurora, Terminal සහ Paper යන අතිමත් සරල නව තේමාවන් මුළු වැඩබිමටම අදාළ වෙමින් ඔබ ගිණුම සමඟ උපාංග අතර සමමුහුර්ත වේ. ඔබට වැදගත් දේ පිළිබඳ කෙටි සාරාංශයක් රඳවා තබා ගැනීමට ස්නායු මතකය ඔබේ සංවාද වලින් දිගටම යාවත්කාලීන වේ.",
    htmlUrl: "#releases"
  },
  {
    version: "5.0.0-Beta",
    date: "February 1, 2026",
    features: [
      "Studio Create Refinements",
      "Secure Blob Asset Downloads",
      "Dark Mode Visibility Optimization",
      "Official Platform Release Log",
      "Enhanced Multimodal Pipeline"
    ],
    body: "Major platform update focusing on Studio Create stability and visual consistency. This release introduces secure download protocols for generated assets and optimized readability across high-contrast environments.",
    bodySi: "Studio Create හි ස්ථායීතාවය සහ දෘශ්‍ය අනුකූලතාවය කෙරෙහි අවධානය යොමු කරමින් සිදු කළ ප්‍රධාන යාවත්කාලීනයකි. මෙම සංස්කරණය මගින් උත්පාදනය කරන ලද වත්කම් සඳහා ආරක්ෂිත බාගත කිරීමේ ක්‍රම සහ ඉහළ කියවීමේ හැකියාව හඳුන්වා දෙයි.",
    htmlUrl: "#"
  },
  {
    version: "4.1.2",
    date: "January 25, 2026",
    features: [
      "Memory Core History Sync",
      "Cloud Storage Handshake",
      "Logic Flow UI Overhaul"
    ],
    body: "Introduced local and cloud-synchronized history management. Refined the Logic Flow visualization to accurately represent neural processing steps.",
    bodySi: "දේශීය සහ වලාකුළු සමමුහුර්ත ඉතිහාස කළමනාකරණය හඳුන්වා දෙන ලදී. ස්නායු සැකසුම් පියවර නිවැරදිව නිරූපණය කිරීම සඳහා Logic Flow දර්ශනය වැඩි දියුණු කරන ලදී.",
    htmlUrl: "#"
  },
  {
    version: "4.0.0",
    date: "January 10, 2026",
    features: [
      "Initial Neural Workspace Release",
      "Bilingual Reason Engine",
      "Gemini 2.5 Integration"
    ],
    body: "The official launch of Orin AI Platform. Providing advanced neural workspace capabilities to Sri Lankan users in both Sinhala and English.",
    bodySi: "ඔරින් AI වේදිකාවේ නිල දියත් කිරීම. ශ්‍රී ලාංකික පරිශීලකයින්ට සිංහල සහ ඉංග්‍රීසි යන භාෂා දෙකෙන්ම උසස් ස්නායු වැඩබිම් හැකියාවන් ලබා දීම.",
    htmlUrl: "#"
  }
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
