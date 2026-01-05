import React from 'react';

const TermsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const isSinhala = document.documentElement.lang === 'si';

  const content = isSinhala ? {
    title: "සේවා කොන්දේසි",
    version: "Terms of Service v4.8 (සම්පූර්ණ)",
    sections: [
      {
        head: "01. ගිවිසුම පිළිගැනීම",
        body: "ඔබ ඔරින් AI (Orin AI) සේවාව භාවිතා කිරීම ආරම්භ කිරීමත් සමඟ මෙම කොන්දේසි මාලාවට ඔබ එකඟ වූ බව සලකනු ලැබේ. ඔබ මෙම පද්ධතිය භාවිතා කරන්නේ වෘත්තීය හෝ පෞද්ගලික මට්ටමකින් වුවද, මෙම නීති රීති වලට යටත් වීම අනිවාර්ය වේ."
      },
      {
        head: "02. අවසර ලත් භාවිතය සහ සීමාවන්",
        body: "ඔබ මෙම පද්ධතිය භාවිතා කළ යුත්තේ නිර්මාණාත්මක, අධ්‍යාපනික සහ වෘත්තීය අරමුණු සඳහා පමණි. නීති විරෝධී පණිවිඩ යැවීම, පද්ධතියට හානි කිරීම හෝ නීති විරෝධී අන්තර්ගතයන් නිර්මාණය කිරීම දැඩි ලෙස තහනම් වේ. එවැනි ක්‍රියාවන් සිදු කරන්නන්ගේ ගිණුම් ක්ෂණිකව අත්හිටුවීමට අපට අයිතිය ඇත."
      },
      {
        head: "03. කෘතිම බුද්ධිය පිළිබඳ වගකීම (Neural Disclaimer)",
        body: "කෘතිම බුද්ධිය මඟින් ලබාදෙන තොරතුරු සැමවිටම 100% නිවැරදි නොවිය හැක. පද්ධතිය මගින් වැරදි තොරතුරු (Hallucinations) ලබාදීමේ හැකියාවක් ඇති බැවින්, තීරණාත්මක තීරණ ගැනීමට පෙර තොරතුරු තහවුරු කර ගැනීම පරිශීලකයාගේ වගකීමකි."
      },
      {
        head: "04. බුද්ධිමය දේපල සහ නිර්මාණ අයිතිය",
        body: "ඔබ විසින් මෙහි නිර්මාණය කරන සියලුම පණිවිඩ සහ රූපවල අයිතිය ඔබට හිමිවේ. කෙසේ වෙතත්, පද්ධතියේ ක්‍රියාකාරීත්වය සඳහා යොදාගන්නා යටින් පවතින තාක්ෂණයන් සහ AI මොඩලවල අයිතිය අදාළ සමාගම් (Google/Puter) සතු වේ."
      },
      {
        head: "05. වගකීම් සීමා කිරීම",
        body: "පද්ධතියේ ඇති විය හැකි තාක්ෂණික දෝෂ, දත්ත ප්‍රමාදයන් හෝ අන්තර්ජාල සම්බන්ධතාවල දෝෂ හේතුවෙන් සිදුවන කිසිදු මූල්‍ය හෝ වෙනත් අලාභයක් සඳහා JN Productions වගකීම දරනු නොලැබේ."
      },
      {
        head: "06. නීතිමය බලපෑම",
        body: "මෙම කොන්දේසි ශ්‍රී ලංකා ප්‍රජාතාන්ත්‍රික සමාජවාදී ජනරජයේ නීති පද්ධතියට අනුකූලව සකස් කර ඇත. ඕනෑම නීතිමය ආරවුලක් කොළඹ අධිකරණ බල ප්‍රදේශය තුළ විසඳිය යුතුය."
      }
    ],
    footer: "නිල සේවා ගිවිසුම • JN Productions Global"
  } : {
    title: "Terms of Compliance",
    version: "Terms of Service v4.8 (Extended)",
    sections: [
      {
        head: "01. Acceptance of Terms",
        body: "By initializing this workspace, you signify your irrevocable consent to these operational parameters. These terms constitute a legally binding agreement between you and the Orin AI Platform, managed by JN Productions Global."
      },
      {
        head: "02. Permissible Operational Scope",
        body: "The platform is provided for research, synthesis, and creative production. You agree not to utilize the neural engine for automated spam generation, phishing cycles, or the creation of harmful or illegal content. We reserve the right to terminate access for any user violating these ethical boundaries."
      },
      {
        head: "03. Neural Performance Disclaimer",
        body: "Users acknowledge that artificial intelligence is subject to 'hallucinations'—the generation of factually incorrect data. All outputs should be verified against legacy grounding sources. Orin AI does not guarantee the absolute veracity of its reasoning cycles."
      },
      {
        head: "04. Intellectual Asset Ownership",
        body: "While the underlying neural weights remain the property of their respective creators (Google/Puter), specific outputs generated through your unique prompts are assigned to you. You maintain full copyright of text and images produced during your active session."
      },
      {
        head: "05. Limitation of Liability",
        body: "JN Productions Global shall not be liable for any indirect, incidental, or consequential damages arising from system downtime, API errors, or loss of local session data. The service is provided on an 'as-is' and 'as-available' basis."
      },
      {
        head: "06. API and Quota Management",
        body: "Users are responsible for the security of their own credentials. If using a personal API key, you are solely responsible for managing costs and quotas associated with your Google Cloud or Puter instance."
      },
      {
        head: "07. Jurisdiction & Dispute Resolution",
        body: "This agreement is governed by the laws of the Democratic Socialist Republic of Sri Lanka. Any disputes arising from the use of this service shall be settled exclusively within the courts of Colombo."
      }
    ],
    footer: "Official Protocol Agreement • JN Productions Global"
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#020617] absolute inset-0 z-[60]">
      <div className="max-w-4xl mx-auto space-y-16 animate-fade pb-32 px-8 pt-16 text-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-10">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{content.title}</h2>
            <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.4em] opacity-60">{content.version}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-12 text-slate-600 dark:text-slate-400 font-medium">
          {content.sections.map((s, i) => (
            <section key={i} className="space-y-4 animate-reveal" style={{ animationDelay: `${i * 0.1}s` }}>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.head}</h3>
              <p className={`leading-relaxed ${isSinhala ? 'sinhala-text' : ''}`}>{s.body}</p>
            </section>
          ))}

          <footer className="pt-20 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">{content.footer}</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;