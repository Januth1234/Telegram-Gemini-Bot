
import React from 'react';

const TermsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const isSinhala = document.documentElement.lang === 'si';

  const content = isSinhala ? {
    title: "භාවිත කොන්දේසි",
    version: "සරල දසුන v4.8",
    sections: [
      {
        head: "01. එකඟතාවය",
        body: "ඔරින් AI භාවිතා කිරීමෙන් ඔබ මෙම මූලික නීති වලට එකඟ වේ."
      },
      {
        head: "02. නිවැරදි භාවිතය",
        body: "මෙම පද්ධතිය අධ්‍යාපනික සහ නිර්මාණාත්මක වැඩ සඳහා පමණක් භාවිතා කරන්න. නීති විරෝධී හෝ අන් අයට හානිකර දේ නිර්මාණය කිරීම තහනම්ය."
      },
      {
        head: "03. AI පිළිතුරු ගැන",
        body: "කෘතිම බුද්ධිය සමහර විට වැරදි පිළිතුරු දිය හැක (Hallucinations). වැදගත් තීරණ ගැනීමට පෙර තොරතුරු නැවත පරීක්ෂා කරගන්න."
      },
      {
        head: "04. නිර්මාණ වල අයිතිය",
        body: "ඔබ ඔරින් සමඟ නිර්මාණය කරන සියලුම පින්තූර සහ ලිපි වල අයිතිය ඔබ සතුය. ඔබට ඒවා ඕනෑම වැඩකට භාවිතා කළ හැක."
      },
      {
        head: "05. වගකීම",
        body: "තාක්ෂණික දෝෂ නිසා සිදුවන යම් අලාභයක් සඳහා අපට වගකීමක් දැරිය නොහැක. අපි සේවාව ලබා දෙන්නේ 'පවතින පරිදි' (As-is) ය."
      },
      {
        head: "06. නීතිය",
        body: "මෙම කොන්දේසි ශ්‍රී ලංකාවේ නීතියට යටත් වේ."
      }
    ],
    footer: "JN Productions Global සේවා ගිවිසුම"
  } : {
    title: "Terms of Service",
    version: "Simplified View v4.8",
    sections: [
      {
        head: "01. Agreement",
        body: "By using Orin AI, you agree to these simple rules designed to keep the platform safe for everyone."
      },
      {
        head: "02. Fair Use",
        body: "Use this workspace for research, creativity, and work. Do not use it to generate spam, illegal content, or anything that harms others."
      },
      {
        head: "03. AI Accuracy Warning",
        body: "AI can make mistakes. Always double-check important facts, especially for medical, legal, or financial decisions."
      },
      {
        head: "04. You Own Your Creations",
        body: "The text and images you create here belong to you. You are free to use them for your personal or commercial projects."
      },
      {
        head: "05. Our Liability",
        body: "We try our best to keep Orin running perfectly, but we aren't responsible if the service goes down or makes an error."
      },
      {
        head: "06. Account Security",
        body: "Keep your login details safe. If you bring your own API keys, you are responsible for their usage."
      },
      {
        head: "07. Legal Disputes",
        body: "These terms are governed by the laws of Sri Lanka."
      }
    ],
    footer: "JN Productions Global Terms Protocol"
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-12 pb-32 px-6 pt-12 text-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{content.title}</h2>
            <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.4em] opacity-60">{content.version}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="space-y-10 text-slate-600 dark:text-slate-400 font-medium">
          {content.sections.map((s, i) => (
            <section key={i} className="space-y-3 animate-reveal" style={{ animationDelay: `${i * 0.05}s` }}>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.head}</h3>
              <p className={`leading-relaxed ${isSinhala ? 'sinhala-text' : ''}`}>{s.body}</p>
            </section>
          ))}

          <footer className="pt-16 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">{content.footer}</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
