
import React, { useEffect, useState } from 'react';
import { codeTrackerService as tracker, CodeSnapshot } from '../services/codeTrackerService';
import { Language } from '../types';
import { translations } from '../translations';

interface ReleasesPageProps {
  onClose: () => void;
  lang: Language;
}

interface LocalCodeSnapshot extends CodeSnapshot {
  bodySi?: string;
}

const ReleasesPage: React.FC<ReleasesPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [updates, setUpdates] = useState<LocalCodeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Historical log
  const officialUpdates: LocalCodeSnapshot[] = [
    {
      version: "5.0.0",
      date: "January 10, 2026",
      features: [
        "Autonomous Multi-Task Engine",
        "Telegram AI Bot Integration",
        "Neural Voice Interruptions",
        "Cross-Functional Chat Titles",
        "Deep SQL Architect"
      ],
      body: "Major Version Release: Introducing the first fully autonomous multi-task agent capable of handling complex file generation and real-time Telegram bot synchronization.",
      bodySi: "මහා සංස්කරණ නිකුතුව: ලිපිගොනු නිර්මාණය කිරීමේ සහ Telegram සමඟ සෘජුව සම්බන්ධ වීමේ හැකියාව ඇති ස්වයංක්‍රීය බහුකාර්ය පද්ධතිය හඳුන්වා දීම.",
      htmlUrl: "#"
    },
    {
      version: "4.9.2",
      date: "January 8, 2026",
      features: ["Memory Optimization", "Faster Vision Scanning", "UI Glass Refinement"],
      body: "Small patches for memory leaks in long reasoning sessions and visual enhancements for the Studio module.",
      bodySi: "දිගු සංවාද වලදී ඇතිවන දෝෂ නිවැරදි කිරීම සහ Studio මොඩියුලයේ පෙනුම වැඩි දියුණු කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.8.0",
      date: "January 4, 2026",
      features: ["New Voice Engine", "Low Latency Audio", "Sinhala Voice-to-Text Fixes"],
      body: "Upgraded the underlying audio bridge for near-zero latency in Live Voice mode.",
      bodySi: "කටහඬ පද්ධතියේ වේගය සහ නිරවද්‍යතාවය ඉහළ නැංවීම.",
      htmlUrl: "#"
    },
    {
      version: "4.7.5",
      date: "December 30, 2025",
      features: ["Year-End Security Patch", "Identity Protection", "Auth Persistence"],
      body: "Improved session security and fixed an issue with Firebase token expiry.",
      bodySi: "ගිණුම් ආරක්ෂාව සහ පද්ධතියට පිවිසීමේ වේගය වැඩි දියුණු කිරීම.",
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
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-12 pb-32 px-6 pt-12 text-slate-900 dark:text-slate-100">
        
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t.releases}</h2>
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{lang === 'si' ? 'යාවත්කාලීන ඉතිහාසය' : 'Update Timeline'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-16">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Loading...</p>
            </div>
          ) : (
            <div className="space-y-20">
              {updates.map((update, i) => (
                <article key={i} className="animate-reveal space-y-6" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/5">Production</span>
                         {i === 0 && <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest animate-pulse">LATEST</span>}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">BUILD {update.version}</h3>
                    </div>
                    <div className="px-4 py-2 glass-panel rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-black/5 dark:border-white/5 shadow-sm">
                      {update.date}
                    </div>
                  </div>

                  <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-black/5 dark:border-white/5 space-y-10 shadow-sm relative overflow-hidden bg-white/40 dark:bg-slate-900/40">
                    <div className="space-y-6 relative z-10">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b border-black/5 dark:border-white/5 pb-4">{lang === 'si' ? 'නව අංග' : 'What\'s New'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {update.features.map((f, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full mt-1.5 shrink-0"></div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight uppercase tracking-wide">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-8 border-t border-black/5 dark:border-white/5 relative z-10">
                      <div className="space-y-4">
                        <p className={`text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`}>
                          {lang === 'si' && update.bodySi ? update.bodySi : update.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-24 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Orin AI • 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default ReleasesPage;
