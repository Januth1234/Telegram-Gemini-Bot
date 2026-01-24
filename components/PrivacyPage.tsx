
import React, { useEffect } from 'react';
import { Language } from '../types';

interface PrivacyPageProps {
  onClose: () => void;
  lang: Language; // Use passed lang prop instead of checking document
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onClose, lang }) => {
  
  const contentMap = {
    si: {
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
          body: "මෙය ඩිජිටල් සේවාවක් බැවින්, සේවාව භාවිතා කිරීමෙන් පසු මුදල් ආපසු ගෙවීමක් (Refund) සිදු නොකෙරේ. නමුත් තාක්ෂණික දෝෂයක් නිසා සේවාව ලබා ගැනීමට නොහැකි වූ අවස්ථාවක දින 7ක් ඇතුලත අපව අමතන්න. දායකත්ව (Subscriptions) ඕනෑම වෙලාවක අවලංගු කළ හැකි අතර, එවිට ඊළඟ වාරිකය අය නොකෙරේ. ඕනෑම මුදල් ආපසු ගෙවීමක් (Refund) ඔබ මුලින් ගෙවීම් කළ මාධ්‍යයටම (Original Payment Method) බැර කෙරේ."
        }
      ],
      footer: "JN Productions Global ආරක්ෂණ ප්‍රතිපත්තිය"
    },
    ta: {
      title: "தனியுரிமைப் பாதுகாப்பு",
      version: "எளிமையான பார்வை v4.9",
      sections: [
        {
          head: "01. உங்கள் தரவு, உங்கள் சாதனத்தில்",
          body: "ஓரின் AI உங்கள் தனியுரிமையை மையமாகக் கொண்டு உருவாக்கப்பட்டுள்ளது. உங்கள் உரையாடல்கள் எங்கள் சேவையகங்களில் சேமிக்கப்படுவதில்லை. அனைத்தும் உங்கள் கணினி அல்லது தொலைபேசியில் பாதுகாப்பாக உள்ளது."
        },
        {
          head: "02. AI பயன்பாடு",
          body: "நாங்கள் Google Gemini தொழில்நுட்பத்தைப் பயன்படுத்துகிறோம். உங்கள் கேள்விகளைச் செயலாக்க மட்டுமே அந்த அமைப்புகளுக்கு அனுப்பப்படுகிறது, மேலும் அந்தத் தரவு AI பயிற்சிக்கு (Training) பயன்படுத்தப்படாது."
        },
        {
          head: "03. பாதுகாப்பான இணைப்பு",
          body: "உங்களுக்கும் ஓரின்-க்கும் இடையிலான அனைத்து தொடர்புகளும் இணைய பாதுகாப்பு முறைகள் (Encryption) மூலம் பாதுகாக்கப்பட்டுள்ளன."
        },
        {
          head: "04. தேவையற்ற குக்கீகள் இல்லை",
          body: "நாங்கள் உங்களைப் பின்தொடர குக்கீகளைப் பயன்படுத்துவதில்லை. உங்கள் மொழி மற்றும் தீம் நினைவில் கொள்ள மட்டுமே சிறிய தரவுக் கோப்புகள் பயன்படுத்தப்படுகின்றன."
        },
        {
          head: "05. தரவை நீக்குதல்",
          body: "நீங்கள் எந்த நேரத்திலும் 'Logout' செய்து அல்லது உலாவி தரவை அழிப்பதன் மூலம் அனைத்தையும் அகற்றலாம். எங்களிடம் உங்கள் நகல் எதுவும் இல்லை."
        },
        {
          head: "06. குரல் கட்டளைகள்",
          body: "நீங்கள் பேசும்போது அந்த குரல் நேரடியாக உரையாக மாற்றப்படுகிறது, மேலும் குரல் பதிவுகள் எங்கும் சேமிக்கப்படுவதில்லை."
        },
        {
          head: "07. பணத்தைத் திரும்பப்பெறும் கொள்கை (Return Policy)",
          body: "இது ஒரு டிஜிட்டல் சேவையாக இருப்பதால், சேவையைப் பயன்படுத்திய பிறகு பணம் திரும்பப் பெறப்படாது (Refund). இருப்பினும், தொழில்நுட்பக் கோளாறு காரணமாக சேவையைப் பெற முடியாத பட்சத்தில் 7 நாட்களுக்குள் எங்களைத் தொடர்பு கொள்ளவும். சந்தாக்களை (Subscriptions) எந்த நேரத்திலும் ரத்து செய்யலாம், அப்போது அடுத்த தவணை வசூலிக்கப்படாது."
        }
      ],
      footer: "JN Productions Global பாதுகாப்பு கொள்கை"
    },
    en: {
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
          body: "Since Orin AI provides instant access to digital neural services, payments are generally non-refundable once the service is utilized. However, if a technical failure prevents service delivery, please contact support within 7 days for a resolution. You may cancel subscriptions at any time. Important: Any approved refunds will be processed directly to the payment-initiated media (original payment method) itself."
        }
      ],
      footer: "JN Productions Global Privacy Statement"
    }
  };

  const content = contentMap[lang] || contentMap.en;

  useEffect(() => {
    if (window.location.hash === '#returnterms') {
      const el = document.getElementById('returnterms');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            <h2 className={`text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase ${lang !== 'en' ? 'sinhala-text' : ''}`}>{content.title}</h2>
            <p className={`text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em] ${lang !== 'en' ? 'sinhala-text' : ''}`}>{content.version}</p>
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
              <h3 className={`text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight ${lang !== 'en' ? 'sinhala-text' : ''}`}>{s.head}</h3>
              <p className={lang !== 'en' ? 'sinhala-text' : ''}>{s.body}</p>
            </section>
          ))}

          <footer className="pt-16 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
             <p className={`text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{content.footer}</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
