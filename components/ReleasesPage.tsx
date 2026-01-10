
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
        "Better Time Awareness",
        "Faster Responses",
        "Clearer Creation Tools",
        "Memory Fixes"
      ],
      body: "We improved how Orin understands time and context in long chats.",
      bodySi: "කාලය සහ සංවාද සන්දර්භය තේරුම් ගැනීමේ හැකියාව වැඩි දියුණු කරන ලදී.",
      htmlUrl: "#"
    },
    {
      version: "4.4.2",
      date: "January 12, 2026",
      features: [
        "Smarter Vision (OCR)",
        "Chat Stability",
        "Sinhala Font Fixes"
      ],
      body: "Better at reading text from images and fixing Sinhala font display issues.",
      bodySi: "පින්තූර වලින් අකුරු කියවීම සහ සිංහල අකුරු දර්ශනය නිවැරදි කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.4.0",
      date: "January 5, 2026",
      features: [
        "Live Voice Mode",
        "Secure Connections",
        "Multi-speaker Support"
      ],
      body: "Introduced Voice Mode! Now you can talk to Orin directly.",
      bodySi: "හඬ මොඩියුලය (Voice Mode) හඳුන්වා දීම. දැන් ඔබට ඔරින් සමඟ කතා කළ හැක.",
      htmlUrl: "#"
    },
    {
      version: "4.3.5",
      date: "December 28, 2025",
      features: [
        "Better Web Search",
        "Clearer Sources",
        "Faster Thinking"
      ],
      body: "Orin is now better at finding facts from the web and showing you where they came from.",
      bodySi: "අන්තර්ජාලයෙන් තොරතුරු සෙවීම සහ මූලාශ්‍ර පෙන්වීම වැඩි දියුණු කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.3.0",
      date: "December 15, 2025",
      features: [
        "4K Studio Images",
        "New Creative Tools",
        "Better Styles"
      ],
      body: "Studio mode can now create ultra-high quality 4K images.",
      bodySi: "ඉතා ඉහළ ගුණාත්මක (4K) පින්තූර නිර්මාණය කිරීමේ හැකියාව.",
      htmlUrl: "#"
    },
    {
      version: "4.2.5",
      date: "December 8, 2025",
      features: [
        "Logic Visualization",
        "Stable Connections",
        "Smoother Animations"
      ],
      body: "See how Orin thinks with the new Logic Flow view.",
      bodySi: "AI සිතන ආකාරය බලාගැනීමට 'Logic Flow' පහසුකම.",
      htmlUrl: "#"
    },
    {
      version: "4.2.0",
      date: "November 25, 2025",
      features: [
        "Cloud Save",
        "Auto-Memory",
        "Device Sync"
      ],
      body: "Your chats now save automatically if you sign in.",
      bodySi: "ඔබගේ සංවාද ස්වයංක්‍රීයව සුරැකීමේ පහසුකම.",
      htmlUrl: "#"
    },
    {
      version: "4.1.8",
      date: "November 18, 2025",
      features: [
        "Better Sinhala",
        "Native Phrasing",
        "Smart Greetings"
      ],
      body: "Refining the 'From a Sri Lankan' experience with more natural language.",
      bodySi: "සිංහල භාෂාව සහ දේශීය ව්‍යවහාරයන් තේරුම් ගැනීම වැඩි දියුණු කිරීම.",
      htmlUrl: "#"
    },
    {
      version: "4.1.0",
      date: "November 10, 2025",
      features: [
        "New Look",
        "Better History",
        "Page Navigation"
      ],
      body: "A fresh new look for the workspace to help you manage more chats.",
      bodySi: "වැඩ අවකාශයේ (Workspace) නව පෙනුම සහ ඉතිහාසය කළමනාකරණය.",
      htmlUrl: "#"
    },
    {
      version: "4.0.0",
      date: "November 1, 2025",
      features: [
        "Platform Launch",
        "Reasoning Engine",
        "Bilingual Logic",
        "Studio Mode"
      ],
      body: "The beginning of Orin AI. A workspace built for Sri Lanka.",
      bodySi: "ඔරින් AI ආරම්භය. ශ්‍රී ලංකාව වෙනුවෙන්ම නිර්මාණය වූ පද්ධතිය.",
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
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">Updates Log</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-12">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Checking...</p>
            </div>
          ) : (
            <div className="space-y-12">
              {updates.map((update, i) => (
                <article key={i} className="animate-reveal" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">Stable Release</span>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">Version {update.version}</h3>
                    </div>
                    <div className="px-4 py-1.5 glass-panel rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-black/5 dark:border-white/5">
                      {update.date}
                    </div>
                  </div>

                  <div className="glass-panel p-8 md:p-10 rounded-[32px] border border-black/5 dark:border-white/5 space-y-8 shadow-sm">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Key Changes</h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {update.features.map((f, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_rgba(8,145,178,0.4)]"></div>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-6 border-t border-black/5 dark:border-white/5">
                      <p className={`text-sm leading-relaxed text-slate-500 italic ${lang === 'si' ? 'sinhala-text' : ''}`}>
                        {lang === 'si' && update.bodySi ? `"${update.bodySi}"` : `"${update.body}"`}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-16 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Official Changelog • Orin AI</p>
        </footer>
      </div>
    </div>
  );
};

export default ReleasesPage;
