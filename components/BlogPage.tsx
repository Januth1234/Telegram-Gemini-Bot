import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface BlogPageProps {
  onClose?: () => void;
  lang?: Language;
}

const BlogPage: React.FC<BlogPageProps> = ({ onClose, lang = 'en' }) => {
  const t = translations[lang];
  return (
    <div className="h-full w-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Blog</h2>
        <p className="text-sm text-slate-500 mt-2">Orin AI updates and articles.</p>
        {onClose && (
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold">
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
