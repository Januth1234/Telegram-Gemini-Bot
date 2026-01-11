
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface PrivacyPageProps {
  onClose: () => void;
  lang: Language;
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];

  const contentMap = {
    si: {
      title: "පෞද්ගලිකත්ව ආරක්ෂාව",
      version: "සරල දසුන v4.8",
      sections: [
        { head: "01. ඔබේ දත්ත, ඔබේ උපාංගයේ", body: "ඔරින් AI නිර්මාණය කර ඇත්තේ ඔබේ පෞද්ගලිකත්වය මුල් කරගෙනය. ඔබේ සංවාද අපගේ සර්වර් වල ගබඩා නොවේ. සියල්ල ඔබේ පරිගණකයේ හෝ දුරකථනයේ සුරක්ෂිතව පවතී." },
        { head: "02. AI භාවිතය", body: "අපි Google Gemini තාක්ෂණය භාවිතා කරමු. ඔබේ ප්‍රශ්න සැකසීමට පමණක් එම පද්ධති වෙත යවන අතර, එම දත්ත AI පුහුණු කිරීම සඳහා (Training) භාවිතා නොකරයි." },
        { head: "03. ආරක්ෂිත සම්බන්ධතාවය", body: "ඔබ සහ ඔරින් අතර සිදුවන සියලුම සම්බන්ධතා අන්තර්ජාල ආරක්ෂණ ක්‍රම (Encryption) මගින් සුරක්ෂිත කර ඇත." },
        { head: "04. අනවශ්‍ය කුකීස් නැත", body: "අපි ඔබව ලුහුබැඳීමට කුකීස් භාවිතා නොකරමු. ඔබේ භාෂාව සහ තේමාව මතක තබා ගැනීමට පමණක් කුඩා දත්ත ගොනු භාවිතා වේ." },
        { head: "05. දත්ත මකා දැමීම", body: "ඔබට ඕනෑම වෙලාවක 'Logout' වී හෝ බ්‍රවුසර දත්ත මැකීමෙන් සියල්ල ඉවත් කළ හැක. අප ළඟ ඔබේ කිසිදු පිටපතක් නැත." },
        { head: "06. හඬ විධාන", body: "ඔබ කතා කරන විට එම හඬ කෙලින්ම අකුරු බවට පත් කරන අතර, හඬ පටිගත කිරීම් කොහේවත් ගබඩා නොවේ." }
      ],
      footer: "JN Productions Global ආරක්ෂණ ප්‍රතිපත්තිය"
    },
    ta: {
      title: "தனியுரிமை கொள்கை",
      version: "எளிமையான பார்வை v4.8",
      sections: [
        { head: "01. உங்கள் தரவு, உங்கள் சாதனத்தில்", body: "ஒரின் AI உங்கள் தனியுரிமையை மையமாகக் கொண்டு உருவாக்கப்பட்டுள்ளது. உங்கள் அரட்டைகள் எங்கள் சேவையகங்களில் சேமிக்கப்படாது. அனைத்தும் உங்கள் கணினி அல்லது தொலைபேசியில் பாதுகாப்பாக இருக்கும்." },
        { head: "02. AI பயன்பாடு", body: "நாங்கள் Google Gemini தொழில்நுட்பத்தைப் பயன்படுத்துகிறோம். உங்கள் கேள்விகளைச் செயலாக்க மட்டுமே அந்த அமைப்புகளுக்கு அனுப்பப்படுகிறது, மேலும் அந்த தரவு AI பயிற்சிக்கு பயன்படுத்தப்படாது." },
        { head: "03. பாதுகாப்பான இணைப்பு", body: "உங்களுக்கும் ஒரினுக்குக்கும் இடையிலான அனைத்து தொடர்புகளும் இணைய பாதுகாப்பு முறைகளால் (Encryption) பாதுகாக்கப்படுகிறது." },
        { head: "04. தேவையற்ற குக்கீகள் இல்லை", body: "நாங்கள் உங்களைப் பின்தொடர குக்கீகளைப் பயன்படுத்துவதில்லை. உங்கள் மொழி மற்றும் தீம் அமைப்புகளை நினைவில் கொள்ள மட்டுமே சிறிய தரவு கோப்புகள் பயன்படுத்தப்படுகின்றன." },
        { head: "05. தரவை நீக்குதல்", body: "நீங்கள் எப்போது வேண்டுமானாலும் 'Logout' செய்தோ அல்லது உலாவி தரவை அழித்தோ அனைத்தையும் அகற்றலாம். எங்களிடம் உங்கள் தரவின் நகல் எதுவும் இல்லை." },
        { head: "06. குரல் கட்டளைகள்", body: "நீங்கள் பேசும்போது அந்த குரல் நேரடியாக எழுத்துக்களாக மாற்றப்படுகிறது, மேலும் குரல் பதிவுகள் எங்கும் சேமிக்கப்படாது." }
      ],
      footer: "JN Productions Global பாதுகாப்பு அறிக்கை"
    },
    en: {
      title: "Privacy Policy",
      version: "Simplified View v4.8",
      sections: [
        { head: "01. Your Data Stays on Your Device", body: "We built Orin AI with a 'Local-First' approach. Your chat history lives in your browser, not on our servers. Unless you explicitly sync, you are the only one holding your data." },
        { head: "02. How We Use AI Models", body: "We use Google's Gemini to power the intelligence. Your prompts are sent securely for processing and then immediately forgotten. We do not use your data to train AI models." },
        { head: "03. Secure Connection", body: "Everything sent between you and Orin is encrypted. No one can intercept your creative or professional work." },
        { head: "04. No Tracking Cookies", body: "We don't track you across the internet. We only use tiny storage bits to remember your dark mode setting and language preference." },
        { head: "05. Delete Your Data Anytime", body: "Want a fresh start? Just log out or clear your browser cache. Since we don't store your history, this permanently wipes everything instantly." },
        { head: "06. Voice Data Privacy", body: "When you use Voice Mode, audio is converted to text in real-time. We never store or listen to your audio recordings." }
      ],
      footer: "JN Productions Global Privacy Statement"
    }
  };

  const content = contentMap[lang];

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
            <section key={i} className="space-y-3 animate-reveal" style={{ animationDelay: `${i * 0.05}s` }}>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.head}</h3>
              <p>{s.body}</p>
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
