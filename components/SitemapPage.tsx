import React from 'react';
import { translations } from '../translations';
import { Language } from '../types';

interface SitemapPageProps {
  onClose: () => void;
  lang: Language;
}

const SitemapPage: React.FC<SitemapPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];

  const links = [
    { href: "#", label: t.welcome, icon: "fa-house" },
    { href: "#chat", label: t.reasoning, icon: "fa-message" },
    { href: "#art", label: t.creative, icon: "fa-palette" },
    { href: "#camera", label: t.vision, icon: "fa-camera" },
    { href: "#voice", label: t.voice, icon: "fa-microphone-lines" },
    { href: "#math", label: t.maths, icon: "fa-calculator" },
    { href: "#help", label: t.getHelp, icon: "fa-life-ring" },
    { href: "#account", label: t.profile, icon: "fa-id-card" },
    { href: "#releases", label: t.releases, icon: "fa-rocket" },
    { href: "#logic", label: t.logicFlow, icon: "fa-diagram-project" },
    { href: "#creator", label: t.creator, icon: "fa-user-tie" },
    { href: "#pricing", label: t.pricing, icon: "fa-tags" },
    { href: "#privacy", label: t.privacy, icon: "fa-shield-halved" },
    { href: "#terms", label: t.terms, icon: "fa-file-contract" },
  ];

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
               <i className="fa-solid fa-sitemap"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Sitemap</h2>
              <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Site Index</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {links.map((link, i) => (
                <a 
                    key={i} 
                    href={link.href}
                    className="glass-panel p-6 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between group hover:bg-white dark:hover:bg-slate-800 transition-all hover:scale-[1.01]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-cyan-600 transition-colors">
                            <i className={`fa-solid ${link.icon}`}></i>
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-cyan-600 transition-colors">{link.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 opacity-60 bg-slate-100 dark:bg-black/20 px-2 py-1 rounded">{link.href}</span>
                </a>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SitemapPage;