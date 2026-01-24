
import React from 'react';
import { Language } from '../types';

interface TermsPageProps {
  onClose: () => void;
  lang: Language; // Use passed lang prop
}

const TermsPage: React.FC<TermsPageProps> = ({ onClose, lang }) => {
  
  const contentMap = {
    si: {
      title: "භාවිත කොන්දේසි",
      version: "සරල දසුන v4.8",
      sections: [
        {
          head: "01. එකඟතාවය",
          body: "ඔරින් AI භාවිතා කිරීමෙන් ඔබ මෙම මූලික නීති වලට එකඟ වේ. මෙම කොන්දේසි කාලයෙන් කාලයට යාවත්කාලීන විය හැක."
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
          body: "මෙම කොන්දේසි ශ්‍රී ලංකාවේ නීතියට යටත් වේ. යම් ගැටලුවක් මතු වුවහොත් එය ශ්‍රී ලංකා අධිකරණ බල සීමාව යටතේ විසඳා ගත යුතුය."
        }
      ],
      footer: "JN Productions Global සේවා ගිවිසුම"
    },
    ta: {
      title: "பயன்பாட்டு விதிமுறைகள்",
      version: "எளிமையான பார்வை v4.8",
      sections: [
        {
          head: "01. ஒப்பந்தம்",
          body: "ஓரின் AI ஐப் பயன்படுத்துவதன் மூலம், இந்த அடிப்படை விதிகளுக்கு நீங்கள் ஒப்புக்கொள்கிறீர்கள். இந்த விதிமுறைகள் அவ்வப்போது புதுப்பிக்கப்படலாம்."
        },
        {
          head: "02. சரியான பயன்பாடு",
          body: "இந்த அமைப்பை கல்வி மற்றும் ஆக்கப்பூர்வமான பணிகளுக்கு மட்டுமே பயன்படுத்தவும். சட்டவிரோதமான அல்லது பிறருக்குத் தீங்கு விளைவிக்கும் எதையும் உருவாக்குவது தடைசெய்யப்பட்டுள்ளது."
        },
        {
          head: "03. AI பதில்கள் பற்றி",
          body: "செயற்கை நுண்ணறிவு சில நேரங்களில் தவறான பதில்களைத் தரக்கூடும் (Hallucinations). முக்கியமான முடிவுகளை எடுப்பதற்கு முன் தகவலை மீண்டும் சரிபார்க்கவும்."
        },
        {
          head: "04. படைப்புகளின் உரிமை",
          body: "ஓரின் மூலம் நீங்கள் உருவாக்கும் அனைத்து படங்கள் மற்றும் உரைகளின் உரிமை உங்களுக்கே உரியது. அவற்றை நீங்கள் எந்த வேலைக்கும் பயன்படுத்தலாம்."
        },
        {
          head: "05. பொறுப்பு",
          body: "தொழில்நுட்பக் கோளாறுகளால் ஏற்படும் எந்தவொரு இழப்புக்கும் நாங்கள் பொறுப்பேற்க முடியாது. சேவையை 'உள்ளபடியே' (As-is) வழங்குகிறோம்."
        },
        {
          head: "06. சட்டம்",
          body: "இவ்விதிமுறைகள் இலங்கை சட்டத்திற்கு உட்பட்டவை. ஏதேனும் சிக்கல் ஏற்பட்டால் அது இலங்கை நீதிமன்ற அதிகார வரம்பிற்குள் தீர்க்கப்பட வேண்டும்."
        }
      ],
      footer: "JN Productions Global சேவை ஒப்பந்தம்"
    },
    en: {
      title: "Terms of Service",
      version: "Simplified View v4.8",
      sections: [
        {
          head: "01. Agreement",
          body: "By using Orin AI, you agree to these simple rules designed to keep the platform safe and functional for everyone."
        },
        {
          head: "02. Fair Use",
          body: "Use this workspace for research, creativity, and professional work. Do not use it to generate spam, illegal content, or anything that harms others."
        },
        {
          head: "03. AI Accuracy Warning",
          body: "AI can make mistakes. Always double-check important facts, especially for medical, legal, or financial decisions."
        },
        {
          head: "04. You Own Your Creations",
          body: "The text and images you create here belong to you. You are free to use them for your personal or commercial projects without extra fees."
        },
        {
          head: "05. Our Liability",
          body: "We try our best to keep Orin running perfectly, but we aren't responsible if the service goes down or makes a calculation error."
        },
        {
          head: "06. Account Security",
          body: "Keep your login details safe. If you bring your own API keys, you are responsible for their usage and security."
        },
        {
          head: "07. Legal Disputes",
          body: "These terms are governed by the laws of Sri Lanka. Any disputes shall be handled within the jurisdiction of Sri Lankan courts."
        }
      ],
      footer: "JN Productions Global Terms Protocol"
    }
  };

  const content = contentMap[lang] || contentMap.en;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-12 pb-32 px-6 pt-12 text-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                <i className="fa-solid fa-file-contract text-xl"></i>
             </div>
             <div>
               <h2 className={`text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase ${lang !== 'en' ? 'sinhala-text' : ''}`}>{content.title}</h2>
               <p className={`text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.4em] opacity-60 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{content.version}</p>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 hover:rotate-90 transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="space-y-12">
          {content.sections.map((s, i) => (
            <section key={i} className="animate-reveal space-y-4" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center gap-3">
                 <div className="w-1.5 h-6 bg-cyan-600 rounded-full"></div>
                 <h3 className={`text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight ${lang !== 'en' ? 'sinhala-text' : ''}`}>{s.head}</h3>
              </div>
              <p className={`text-slate-600 dark:text-slate-400 font-medium leading-relaxed indent-4 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{s.body}</p>
            </section>
          ))}

          <footer className="pt-16 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 mx-auto rounded-full mb-4"></div>
            <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${lang !== 'en' ? 'sinhala-text' : ''}`}>{content.footer}</p>
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Last updated February 2026</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
