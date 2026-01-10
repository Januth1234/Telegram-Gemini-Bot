
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

  // Historical log using simple language
  const officialUpdates: LocalCodeSnapshot[] = [
    {
      version: "5.0.0",
      date: "January 10, 2026",
      features: [
        "Smart Multi-Task Mode",
        "Telegram Link Support",
        "Better Voice Chat",
        "Auto Chat Titles",
        "Smart Data Design"
      ],
      body: "A big update that lets Orin handle many jobs at once. Now works better with Telegram and has a faster voice chat engine.",
      bodySi: "ඔරින් හට එකවර වැඩ කිහිපයක් කිරීමේ හැකියාව ලබා දෙන ලොකු යාවත්කාලීනයක්. දැන් Telegram සමඟ වැඩ කිරීමට සහ වේගවත් හඬ සංවාද සඳහා සහාය දක්වයි.",
      htmlUrl: "#"
    },
    {
      version: "4.9.2",
      date: "January 8, 2026",
      features: ["Faster Thinking", "Better Camera View", "Smoother Look"],
      body: "Fixed some errors to make thinking faster and updated the look of the drawing room.",
      bodySi: "පද්ධතිය වේගවත් කිරීමට සහ අලුත් පෙනුමක් ලබා දීමට සිදු කළ යාවත්කාලීනයකි.",
      htmlUrl: "#"
    },
    {
      version: "4.8.0",
      date: "January 4, 2026",
      features: ["New Voice Engine", "Less Waiting Time", "Sinhala Voice Fixes"],
      body: "Updated the voice system so it talks to you instantly without any delays.",
      bodySi: "කිසිදු ප්‍රමදයකින් තොරව ඔබ සමඟ කතා කිරීමට හඬ පද්ධතිය වැඩි දියුණු කිරීම.",
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
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{lang === 'si' ? 'අලුත් දේවල්' : 'What\'s New'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
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
            <div className="space-y-16">
              {updates.map((update, i) => (
                <article key={i} className="animate-reveal space-y-6" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/5">Release</span>
                         {i === 0 && <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest animate-pulse">LATEST</span>}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">BUILD {update.version}</h3>
                    </div>
                    <div className="px-4 py-2 glass-panel rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-black/5 dark:border-white/5 shadow-sm">
                      {update.date}
                    </div>
                  </div>

                  <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-black/5 dark:border-white/5 space-y-8 shadow-sm relative overflow-hidden bg-white/40 dark:bg-slate-900/40">
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b border-black/5 dark:border-white/5 pb-4">{lang === 'si' ? 'නව අංග' : 'Updates'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {update.features.map((f, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full mt-1.5 shrink-0"></div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight uppercase tracking-wide">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-black/5 dark:border-white/5">
                      <p className={`text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium ${lang === 'si' ? 'sinhala-text' : ''}`}>
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
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Orin AI • 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default ReleasesPage;
