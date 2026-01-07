
import React, { useEffect, useState } from 'react';
import { codeTrackerService as tracker, CodeSnapshot } from '../services/codeTrackerService';
import { Language } from '../types';
import { translations } from '../translations';

interface ReleasesPageProps {
  onClose: () => void;
  lang: Language;
}

// Extends CodeSnapshot to include Sinhala summary
interface LocalCodeSnapshot extends CodeSnapshot {
  bodySi?: string;
}

const ReleasesPage: React.FC<ReleasesPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [updates, setUpdates] = useState<LocalCodeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded official platform logs with Sinhala summaries
  const officialUpdates: LocalCodeSnapshot[] = [
    {
      version: "4.5.0",
      date: "January 20, 2026",
      features: [
        "Dynamic Time-Sync Intelligence",
        "Orin Engine v4.5 Latency Reduction",
        "Creator Hub high-resolution UI",
        "Bilingual memory optimization"
      ],
      body: "Major synchronization update. Orin now maintains perfect temporal awareness across all reasoning chains.",
      bodySi: "ප්‍රධාන කාල-සමමුහුර්තකරණ යාවත්කාලීන කිරීම. ඔරින් දැන් සියලු තර්ක දාමයන් හරහා පරිපූර්ණ කාලීන අවබෝධයක් පවත්වා ගනී.",
      htmlUrl: "#"
    },
    {
      version: "4.4.2",
      date: "January 12, 2026",
      features: [
        "Refined Vision OCR capabilities",
        "Stability patch for long conversations",
        "Sinhala Noto Sans rendering fix"
      ],
      body: "Iterative stabilization of the vision pipeline and typography refinements for better accessibility.",
      bodySi: "දෘශ්‍ය කියවීමේ (OCR) හැකියාවන් වැඩි දියුණු කිරීම සහ සිංහල අකුරු දර්ශනය වීමේ දෝෂ නිවැරදි කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.4.0",
      date: "January 5, 2026",
      features: [
        "Real-time Neural Voice Integration",
        "Biometric handshake protocols",
        "Multi-speaker TTS (Beta)"
      ],
      body: "A new way to interact. Version 4.4.0 brings the Voice module to the main workspace as an experimental feature.",
      bodySi: "හඬ මොඩියුලය (Voice Module) පද්ධතියට එක් කිරීම. දැන් ඔබට ඔරින් සමඟ කතා කළ හැක.",
      htmlUrl: "#"
    },
    {
      version: "4.3.5",
      date: "December 28, 2025",
      features: [
        "Web Grounding accuracy v2",
        "Citation map visualization",
        "Performance boost for thinking mode"
      ],
      body: "Enhanced the way Orin navigates the web for factual verification, providing clearer knowledge sources.",
      bodySi: "තොරතුරු තහවුරු කර ගැනීමේ හැකියාව වැඩි දියුණු කිරීම සහ මූලාශ්‍ර පෙන්වීමේ ක්‍රමවේදය යාවත්කාලීන කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.3.0",
      date: "December 15, 2025",
      features: [
        "Studio 4K asset resolution support",
        "New creative prompts architecture",
        "Style transfer optimizations"
      ],
      body: "The Studio gets a massive upgrade with 4K generation capabilities for Pro users.",
      bodySi: "4K ගුණාත්මක භාවයෙන් රූප නිර්මාණය කිරීමේ හැකියාව Studio වෙත එක් කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.2.5",
      date: "December 8, 2025",
      features: [
        "Logic Flow visualization engine",
        "Neural Bridge connection stability",
        "Hardware-accelerated animations"
      ],
      body: "Visualizing the 'how'. Users can now see the internal logic steps of the AI's reasoning process.",
      bodySi: "AI ක්‍රියා කරන ආකාරය පෙන්වන 'Logic Flow' දර්ශනය හඳුන්වා දීම.",
      htmlUrl: "#"
    },
    {
      version: "4.2.0",
      date: "November 25, 2025",
      features: [
        "Puter Cloud Persistence rollout",
        "Automated workspace memory",
        "Cross-device sync protocol"
      ],
      body: "Your workspace now follows you. All conversations are securely synced with your Puter instance.",
      bodySi: "ඔබගේ සංවාද දත්ත Puter Cloud හරහා ස්වයංක්‍රීයව සුරැකීමේ පහසුකම.",
      htmlUrl: "#"
    },
    {
      version: "4.1.8",
      date: "November 18, 2025",
      features: [
        "Enhanced Sinhala translation relay",
        "Native idiom support refinement",
        "Contextual greeting intelligence"
      ],
      body: "Refining the 'From a Sri Lankan to Sri Lankans' experience with better native phrasing.",
      bodySi: "සිංහල භාෂා පරිවර්තනය සහ දේශීය ව්‍යවහාරයන් තේරුම් ගැනීමේ හැකියාව වැඩි දියුණු කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.1.0",
      date: "November 10, 2025",
      features: [
        "Unified Workspace redesign",
        "Sidepanel history management",
        "Pagination for older memories"
      ],
      body: "Complete UI overhaul for the Workspace to allow better management of many conversations.",
      bodySi: "වැඩ අවකාශයේ (Workspace) නව මුහුණුවර සහ ඉතිහාසය (History) කළමනාකරණය කිරීමේ පහසුකම්.",
      htmlUrl: "#"
    },
    {
      version: "4.0.5",
      date: "November 3, 2025",
      features: [
        "Bilingual Search Grounding",
        "Image-to-Text OCR stability",
        "Neural core safety filtering"
      ],
      body: "Stabilizing the core multimodal features after the initial 4.0 launch.",
      bodySi: "මූලික ආරක්ෂක පද්ධති සහ ද්විභාෂා සෙවුම් හැකියාවන් ස්ථායි කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.0.0",
      date: "November 1, 2025",
      features: [
        "Total Platform Launch: Orin AI",
        "Dual-engine Reasoning (Flash/Pro)",
        "Sinhala-English synchronized logic",
        "Foundational Studio Synthesis"
      ],
      body: "The genesis of the Orin platform. A unified workspace built specifically for the needs of Sri Lankan professionals.",
      bodySi: "ඔරින් AI වේදිකාවේ මංගල එළිදැක්වීම. ශ්‍රී ලාංකික වෘත්තිකයන් සඳහාම නිර්මාණය වූ විශේෂිත AI පද්ධතිය.",
      htmlUrl: "#"
    }
  ];

  useEffect(() => {
    const fetchUpdates = async () => {
      setLoading(true);
      try {
        const data = await tracker.getHistory();
        setUpdates(data.length > 0 ? data : officialUpdates);
      } catch (e) {
        setUpdates(officialUpdates);
      } finally {
        setLoading(false);
      }
    };
    fetchUpdates();
  }, []);

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-16 pb-32 px-8 pt-20 text-slate-900 dark:text-slate-100">
        
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-10">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.releases}</h2>
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">Platform Evolution Log</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-12">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center space-y-6">
              <div className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Deployment Logs...</p>
            </div>
          ) : (
            <div className="space-y-16">
              {updates.map((update, i) => (
                <article key={i} className="animate-reveal" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">Production Build</span>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Build v{update.version} Stable</h3>
                    </div>
                    <div className="px-5 py-2 glass-panel rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-black/5 dark:border-white/5">
                      {update.date}
                    </div>
                  </div>

                  <div className="glass-panel p-8 md:p-12 rounded-[48px] border border-black/5 dark:border-white/5 space-y-10 shadow-sm">
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Neural Protocol Updates</h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {update.features.map((f, idx) => (
                          <li key={idx} className="flex items-start gap-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full mt-2 shrink-0 shadow-[0_0_8px_rgba(8,145,178,0.4)]"></div>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-8 border-t border-black/5 dark:border-white/5">
                      <p className={`text-sm leading-relaxed text-slate-500 italic ${lang === 'si' ? 'sinhala-text' : ''}`}>
                        {lang === 'si' && update.bodySi ? `"${update.bodySi}"` : `"${update.body}"`}
                      </p>
                      {update.htmlUrl !== "#" && (
                        <div className="mt-8 flex justify-end">
                          <a 
                            href={update.htmlUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] font-black text-cyan-600 uppercase tracking-widest hover:underline flex items-center gap-2"
                          >
                            Explore Source <i className="fa-solid fa-arrow-right-long"></i>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-20 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Official Release Artifacts • Orin AI Platform</p>
        </footer>
      </div>
    </div>
  );
};

export default ReleasesPage;
    