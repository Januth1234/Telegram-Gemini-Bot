
import React, { useEffect } from 'react';

const PrivacyPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const isSinhala = document.documentElement.lang === 'si';

  const content = isSinhala ? {
    title: "පෞද්ගලිකත්ව ආරක්ෂාව",
    version: "සරල දසුන v4.9",
    sections: [
      {
        head: "01. ඔබේ දත්ත, ඔබේ උපාංගයේ",
        body: "ඔරින් AI නිර්මාණය කර ඇත්තේ ඔබේ පෞද්ගලිකත්වය මුල් කරගෙනය. ඔබේ සංවාද අපගේ සර්වර් වල ගබඩා නොවේ. සියල්ල ඔබේ පරිගණකයේ හෝ දුරකථනයේ සුරක්ෂිතව පවතී."
      },
      {
        head: "02. AI භාවිතය",
        body: "අපි Google Gemini තාක්ෂණය භාවිතා කරමු. ඔබේ ප්‍රශ්න සැකසීමට පමණක් එම පද්ධති වෙත යවන අතර, එම දත්ත AI පුහුණු කිරීම සඳහා (Training) භාවිතා නොකරයි."
      },
      {
        head: "03. ආරක්ෂිත සම්බන්ධතාවය",
        body: "ඔබ සහ ඔරින් අතර සිදුවන සියලුම සම්බන්ධතා අන්තර්ජාල ආරක්ෂණ ක්‍රම (Encryption) මගින් සුරක්ෂිත කර ඇත."
      },
      {
        head: "04. අනවශ්‍ය කුකීස් නැත",
        body: "අපි ඔබව ලුහුබැඳීමට කුකීස් භාවිතා නොකරමු. ඔබේ භාෂාව සහ තේමාව මතක තබා ගැනීමට පමණක් කුඩා දත්ත ගොනු භාවිතා වේ."
      },
      {
        head: "05. දත්ත මකා දැමීම",
        body: "ඔබට ඕනෑම වෙලාවක 'Logout' වී හෝ බ්‍රවුසර දත්ත මැකීමෙන් සියල්ල ඉවත් කළ හැක. අප ළඟ ඔබේ කිසිදු පිටපතක් නැත."
      },
      {
        head: "06. හඬ විධාන",
        body: "ඔබ කතා කරන විට එම හඬ කෙලින්ම අකුරු බවට පත් කරන අතර, හඬ පටිගත කිරීම් කොහේවත් ගබඩා නොවේ."
      },
      {
        head: "07. මුදල් ආපසු ගෙවීමේ ප්‍රතිපත්තිය (Return Policy)",
        body: "මෙය ඩිජිටල් සේවාවක් බැවින්, සේවාව භාවිතා කිරීමෙන් පසු මුදල් ආපසු ගෙවීමක් (Refund) සිදු නොකෙරේ. නමුත් තාක්ෂණික දෝෂයක් නිසා සේවාව ලබා ගැනීමට නොහැකි වූ අවස්ථාවක දින 7ක් ඇතුලත අපව අමතන්න. දායකත්ව (Subscriptions) ඕනෑම වෙලාවක අවලංගු කළ හැකි අතර, එවිට ඊළඟ වාරිකය අය නොකෙරේ."
      }
    ],
    footer: "JN Productions Global ආරක්ෂණ ප්‍රතිපත්තිය"
  } : {
    title: "Privacy Policy",
    version: "Simplified View v4.9",
    sections: [
      {
        head: "01. Your Data Stays on Your Device",
        body: "We built Orin AI with a 'Local-First' approach. Your chat history lives in your browser, not on our servers. Unless you explicitly sync, you are the only one holding your data."
      },
      {
        head: "02. How We Use AI Models",
        body: "We use Google's Gemini to power the intelligence. Your prompts are sent securely for processing and then immediately forgotten. We do not use your data to train AI models."
      },
      {
        head: "03. Secure Connection",
        body: "Everything sent between you and Orin is encrypted. No one can intercept your creative or professional work."
      },
      {
        head: "04. No Tracking Cookies",
        body: "We don't track you across the internet. We only use tiny storage bits to remember your dark mode setting and language preference."
      },
      {
        head: "05. Delete Your Data Anytime",
        body: "Want a fresh start? Just log out or clear your browser cache. Since we don't store your history, this permanently wipes everything instantly."
      },
      {
        head: "06. Voice Data Privacy",
        body: "When you use Voice Mode, audio is converted to text in real-time. We never store or listen to your audio recordings."
      },
      {
        head: "07. Safety Standards",
        body: "We follow global safety standards to ensure Orin is safe for daily professional and personal use."
      },
      {
        head: "08. Refund & Return Policy",
        body: "Since Orin AI provides instant access to digital neural services, payments are generally non-refundable once the service is utilized. However, if a technical failure prevents service delivery, please contact support within 7 days for a full refund resolution. You may cancel subscriptions at any time to prevent future billing charges."
      }
    ],
    footer: "JN Productions Global Privacy Statement"
  };

  useEffect(() => {
    // Check if the URL hash is #returnterms and scroll to it
    if (window.location.hash === '#returnterms') {
      const el = document.getElementById('returnterms');
      if (el) {
        // Small delay to ensure rendering and animations are done
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Optional: Add a highlight effect
          el.classList.add('bg-cyan-50', 'dark:bg-cyan-900/20', 'rounded-2xl', 'p-4', '-mx-4');
          setTimeout(() => el.classList.remove('bg-cyan-50', 'dark:bg-cyan-900/20', 'rounded-2xl', 'p-4', '-mx-4'), 3000);
        }, 300);
      }
    }
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-12 pb-32 px-6 pt-12 text-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{content.title}</h2>
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{content.version}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="space-y-10 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
          {content.sections.map((s, i) => (
            <section 
              key={i} 
              className="space-y-3 animate-reveal transition-all duration-500" 
              style={{ animationDelay: `${i * 0.05}s` }}
              id={s.head.toLowerCase().includes('return') || s.head.includes('ආපසු') ? 'returnterms' : undefined}
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.head}</h3>
              <p className={isSinhala ? 'sinhala-text' : ''}>{s.body}</p>
            </section>
          ))}

          <footer className="pt-16 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">{content.footer}</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
