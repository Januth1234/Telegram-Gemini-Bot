import React from 'react';

const PrivacyPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const isSinhala = document.documentElement.lang === 'si';

  const content = isSinhala ? {
    title: "පෞද්ගලිකත්ව ප්‍රොටෝකෝලය",
    version: "නිල ආරක්ෂණ v4.8 (සම්පූර්ණ)",
    sections: [
      {
        head: "01. දත්ත ස්වෛරීභාවය සහ 'Local-First' දර්ශනය",
        body: "ඔරින් AI නිර්මාණය කර ඇත්තේ පරිශීලකයාගේ පෞද්ගලිකත්වය මූලික කරගනිමිනි. ඔබගේ සියලුම සංවාද දත්ත ඔබගේ උපාංගය තුළ පමණක් සුරැකෙන අතර, ඒවා අපගේ සර්වර් වෙත යවනු නොලැබේ. ඔබ Puter Cloud හරහා සමමුහුර්ත කිරීමක් සිදු කරන්නේ නම් මිස, ඔබගේ තොරතුරු වල පාලනය 100% ක් ඔබ සතුය."
      },
      {
        head: "02. නියුරල් සැකසුම් සහ තෙවන පාර්ශවීය සම්බන්ධතා",
        body: "අපගේ පද්ධතිය Google Gemini API මඟින් බලගැන්වේ. ඔබගේ ප්‍රශ්න සැකසීම සඳහා තාවකාලිකව Google වෙත යවනු ලබන අතර, එම දත්ත Google හි උසස් රහස්‍යතා ප්‍රතිපත්ති මගින් ආරක්ෂා කර ඇත. Orin AI හරහා යවන කිසිදු දත්තයක් AI මොඩල පුහුණු කිරීම සඳහා (Training) භාවිතා නොකරන බවට අපි සහතික වන්නෙමු."
      },
      {
        head: "03. ගුප්තකේතනය සහ ආරක්ෂක ස්ථර",
        body: "ඔබගේ උපාංගය සහ Orin පද්ධතිය අතර සිදුවන සියලුම දත්ත හුවමාරු කිරීම් TLS 1.3 මට්ටමේ ගුප්තකේතනයක් (Encryption) මගින් ආවරණය කර ඇත. මෙය අන්තර්ජාලය හරහා සිදුවන දත්ත සොරකම් වලින් ඔබව සම්පූර්ණයෙන්ම ආරක්ෂා කරයි."
      },
      {
        head: "04. කුකීස් සහ ලුහුබැඳීමේ ප්‍රතිපත්තිය",
        body: "අපි පරිශීලකයන් ලුහුබැඳීම සඳහා හෝ වෙළඳ දැන්වීම් පෙන්වීම සඳහා කිසිදු කුකීස් (Cookies) භාවිතා නොකරමු. ඔබගේ භාෂා මනාපයන් සහ තේමා වැනි දෑ පවත්වා ගැනීමට පමණක් අවශ්‍ය දත්ත ඔබගේ බ්‍රවුසරයේ තාවකාලිකව තබාගනු ලැබේ."
      },
      {
        head: "05. දත්ත මකාදැමීමේ අයිතිය",
        body: "ඔබ ඕනෑම අවස්ථාවක 'Logout' වීමෙන් හෝ බ්‍රවුසරයේ දත්ත මැකීමෙන් ඔබගේ සම්පූර්ණ ඉතිහාසය ස්ථිරවම මකා දැමිය හැකිය. ඔබ පද්ධතියෙන් ඉවත් වූ සැණින් සියලුම තාවකාලික 'Cache' දත්ත මැකී යයි."
      },
      {
        head: "06. ජෛවමිතික සහ හඬ දත්ත",
        body: "Voice මාදිලිය භාවිතා කරන විට ඔබගේ හඬ දත්ත තාවකාලිකව පෙළ (Text) බවට පත් කරන අතර, එම හඬ පටිගත කිරීම් කිසිදු අවස්ථාවක ගබඩා කරගනු නොලැබේ. සැසිය අවසන් වූ පසු එම දත්ත ක්ෂණිකව විනාශ කෙරේ."
      }
    ],
    footer: "නිල පෞද්ගලිකත්ව ප්‍රකාශය • JN Productions Global"
  } : {
    title: "Privacy Protocol",
    version: "Official Safety v4.8 (Extended)",
    sections: [
      {
        head: "01. Data Sovereignty & Local-First Philosophy",
        body: "Orin AI is engineered on a 'Privacy-by-Design' foundation. Your conversation data stays exclusively within your local environment. We do not maintain centralized databases of your chats or generated assets. Unless you explicitly utilize Puter Cloud Sync, your digital footprint remains entirely under your sovereign control."
      },
      {
        head: "02. Neural Processing & External Handshakes",
        body: "Intelligence logic is provided via encrypted handshakes with the Google Gemini API. Your prompts are transmitted through secure tunnels for real-time inference. We have configured our integration to prevent the use of your data for model training purposes, ensuring your intellectual property remains confidential."
      },
      {
        head: "03. Cryptographic Security Layers",
        body: "All communication between the Orin interface and the Neural Core is protected by TLS 1.3 industry-standard encryption. Local storage values are isolated within your browser's sandboxed environment, preventing cross-site scripting attacks from accessing your workspace memory."
      },
      {
        head: "04. Cookies & Non-Tracking Policy",
        body: "We operate a strict no-tracking policy. We do not use persistent identifiers for advertising or profiling. Small local storage objects are used purely for functional continuity, such as remembering your language toggle, theme selection, and session-specific conversation markers."
      },
      {
        head: "05. The Right to Immediate Erasure",
        body: "You possess the absolute right to clear your data. Logging out or purging browser cache immediately destroys all local session tokens and conversation blobs. Once deleted, this data is unrecoverable, reinforcing our commitment to ephemeral intelligence."
      },
      {
        head: "06. Biometric and Audio Transparency",
        body: "During Voice Mode interaction, audio streams are converted to text tokens in real-time. No actual audio recordings are stored on our infrastructure or transmitted to third parties for archival. The session is discarded the moment the voice connection is severed."
      },
      {
        head: "07. Global Compliance Standards",
        body: "Orin AI aligns with the principles of the General Data Protection Regulation (GDPR) and regional Sri Lankan data protection statutes. We continually audit our neural pathways to ensure compliance with the highest international safety standards."
      }
    ],
    footer: "Official Privacy Statement • JN Productions Global"
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-16 pb-32 px-8 pt-20 text-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-10">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{content.title}</h2>
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{content.version}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="space-y-12 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
          {content.sections.map((s, i) => (
            <section key={i} className="space-y-4 animate-reveal" style={{ animationDelay: `${i * 0.1}s` }}>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.head}</h3>
              <p className={isSinhala ? 'sinhala-text' : ''}>{s.body}</p>
            </section>
          ))}

          <footer className="pt-20 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">{content.footer}</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;