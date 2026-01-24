
import React, { useEffect, useState } from 'react';
import { codeTrackerService as tracker, CodeSnapshot } from '../services/codeTrackerService';
import { Language } from '../types';
import { translations } from '../translations';

interface ReleasesPageProps {
  onClose: () => void;
  lang: Language;
}

interface LocalCodeSnapshot extends CodeSnapshot {
  bodySi?: string;
  bodyTa?: string;
  featuresSi?: string[];
  featuresTa?: string[];
}

const ReleasesPage: React.FC<ReleasesPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const [updates, setUpdates] = useState<LocalCodeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Historical log using official language
  const officialUpdates: LocalCodeSnapshot[] = [
    {
      version: "5.0.0-Beta",
      date: "February 1, 2026",
      features: [
        "Studio Create Refinements",
        "Secure Blob Asset Downloads",
        "Dark Mode Visibility Optimization",
        "Official Platform Release Log",
        "Enhanced Multimodal Pipeline"
      ],
      featuresSi: [
        "Studio Create වැඩි දියුණු කිරීම්",
        "ආරක්ෂිත වත්කම් බාගත කිරීම",
        "රාත්‍රී ප්‍රකාරයේ දෘශ්‍යතාව",
        "නිල වේදිකා නිකුතු සටහන්",
        "බහුමාධ්‍ය නල පද්ධතිය"
      ],
      featuresTa: [
        "Studio Create மேம்பாடுகள்",
        "பாதுகாப்பான பதிவிறக்கங்கள்",
        "இரவுப் பயன்முறை மேம்பாடு",
        "அதிகாரப்பூர்வ வெளியீட்டுப் பதிவு",
        "மல்டிமோடல் பைப்லைன்"
      ],
      body: "Major platform update focusing on Studio Create stability and visual consistency. This release introduces secure download protocols for generated assets and optimized readability across high-contrast environments.",
      bodySi: "Studio Create හි ස්ථායීතාවය සහ දෘශ්‍ය අනුකූලතාවය කෙරෙහි අවධානය යොමු කරමින් සිදු කළ ප්‍රධාන යාවත්කාලීනයකි. මෙම සංස්කරණය මගින් උත්පාදනය කරන ලද වත්කම් සඳහා ආරක්ෂිත බාගත කිරීමේ ක්‍රම සහ ඉහළ කියවීමේ හැකියාව හඳුන්වා දෙයි.",
      bodyTa: "Studio Create நிலைத்தன்மை மற்றும் காட்சி நிலைத்தன்மையில் கவனம் செலுத்தும் முக்கிய இயங்குதள மேம்படுத்தல். இந்த வெளியீடு உருவாக்கப்பட்ட சொத்துக்களுக்கான பாதுகாப்பான பதிவிறக்க நெறிமுறைகள் மற்றும் உயர் மாறுபட்ட சூழல்களில் உகந்த வாசிப்புத்திறனை அறிமுகப்படுத்துகிறது.",
      htmlUrl: "#"
    },
    {
      version: "4.1.2",
      date: "January 25, 2026",
      features: [
        "Memory Core History Sync",
        "Cloud Storage Handshake",
        "Logic Flow UI Overhaul"
      ],
      featuresSi: [
        "මතක ඉතිහාස සමමුහුර්තකරණය",
        "වලාකුළු ගබඩා සම්බන්ධතාව",
        "Logic Flow අතුරු මුහුණත"
      ],
      featuresTa: [
        "நினைவக வரலாற்று ஒத்திசைவு",
        "மேகக்கணி சேமிப்பு ஹேண்ட்ஷேக்",
        "Logic Flow UI மாற்றம்"
      ],
      body: "Introduced local and cloud-synchronized history management. Refined the Logic Flow visualization to accurately represent neural processing steps.",
      bodySi: "දේශීය සහ වලාකුළු සමමුහුර්ත ඉතිහාස කළමනාකරණය හඳුන්වා දෙන ලදී. ස්නායු සැකසුම් පියවර නිවැරදිව නිරූපණය කිරීම සඳහා Logic Flow දර්ශනය වැඩි දියුණු කරන ලදී.",
      bodyTa: "உள்ளூர் மற்றும் மேகக்கணி-ஒத்திசைக்கப்பட்ட வரலாற்று மேலாண்மை அறிமுகப்படுத்தப்பட்டது. நியூரல் செயலாக்க படிகளை துல்லியமாக பிரதிநிதித்துவப்படுத்த Logic Flow காட்சிப்படுத்தல் செம்மைப்படுத்தப்பட்டது.",
      htmlUrl: "#"
    },
    {
      version: "4.0.0",
      date: "January 10, 2026",
      features: [
        "Initial Neural Workspace Release",
        "Bilingual Reason Engine",
        "Gemini 2.5 Integration"
      ],
      featuresSi: [
        "මුල් නිකුතුව",
        "ද්විභාෂා තර්ක එන්ජිම",
        "Gemini 2.5 ඒකාබද්ධ කිරීම"
      ],
      featuresTa: [
        "ஆரம்ப வெளியீடு",
        "இருமொழி பகுத்தறிவு இயந்திரம்",
        "Gemini 2.5 ஒருங்கிணைப்பு"
      ],
      body: "The official launch of Orin AI Platform. Providing advanced neural workspace capabilities to Sri Lankan users in both Sinhala and English.",
      bodySi: "ඔරින් AI වේදිකාවේ නිල දියත් කිරීම. ශ්‍රී ලාංකික පරිශීලකයින්ට සිංහල සහ ඉංග්‍රීසි යන භාෂා දෙකෙන්ම උසස් ස්නායු වැඩබිම් හැකියාවන් ලබා දීම.",
      bodyTa: "ஓரின் AI இயங்குதளத்தின் அதிகாரப்பூர்வ அறிமுகம். இலங்கை பயனர்களுக்கு சிங்களம் மற்றும் ஆங்கிலம் ஆகிய இரு மொழிகளிலும் மேம்பட்ட நியூரல் பணியிட திறன்களை வழங்குதல்.",
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

  const getFeatures = (update: LocalCodeSnapshot) => {
      if (lang === 'si' && update.featuresSi) return update.featuresSi;
      if (lang === 'ta' && update.featuresTa) return update.featuresTa;
      return update.features;
  };

  const getBody = (update: LocalCodeSnapshot) => {
      if (lang === 'si' && update.bodySi) return update.bodySi;
      if (lang === 'ta' && update.bodyTa) return update.bodyTa;
      return update.body;
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-4xl mx-auto space-y-12 pb-32 px-6 pt-12 text-slate-900 dark:text-slate-100">
        
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8">
          <div className="space-y-1">
            <h2 className={`text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase ${lang !== 'en' ? 'sinhala-text' : ''}`}>
                {lang === 'si' ? 'නිල නිකුතු' : lang === 'ta' ? 'அதிகாரப்பூர்வ வெளியீடுகள்' : 'Official Releases'}
            </h2>
            <p className={`text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em] ${lang !== 'en' ? 'sinhala-text' : ''}`}>{lang === 'si' ? 'අලුත් දේවල්' : lang === 'ta' ? 'புதிய மாற்றங்கள்' : 'What\'s New'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-16">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Synchronizing Logs...</p>
            </div>
          ) : (
            <div className="space-y-16">
              {updates.map((update, i) => (
                <article key={i} className="animate-reveal space-y-6" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/5">Platform Release</span>
                         {i === 0 && <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest animate-pulse">LATEST</span>}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">BUILD {update.version}</h3>
                    </div>
                    <div className="px-4 py-2 glass-panel rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest border border-black/5 dark:border-white/5 shadow-sm">
                      {update.date}
                    </div>
                  </div>

                  <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-black/5 dark:border-white/5 space-y-8 shadow-sm relative overflow-hidden bg-white/40 dark:bg-slate-900/40">
                    <div className="space-y-6">
                      <h4 className={`text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] border-b border-black/5 dark:border-white/5 pb-4 ${lang !== 'en' ? 'sinhala-text' : ''}`}>
                        {lang === 'si' ? 'නව අංග' : lang === 'ta' ? 'அம்சங்கள்' : 'Updates'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {getFeatures(update).map((f, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full mt-1.5 shrink-0"></div>
                            <span className={`text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight uppercase tracking-wide ${lang !== 'en' ? 'sinhala-text' : ''}`}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-black/5 dark:border-white/5">
                      <p className={`text-base leading-relaxed text-slate-800 dark:text-slate-300 font-medium ${lang !== 'en' ? 'sinhala-text' : ''}`}>
                        {getBody(update)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="pt-24 border-t border-black/5 dark:border-white/5 text-center space-y-4 opacity-40">
           <p className={`text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 ${lang !== 'en' ? 'sinhala-text' : ''}`}>
             {lang === 'si' ? 'ඔරින් නිල ලොග් සටහන • 2026' : lang === 'ta' ? 'ஓரின் அதிகாரப்பூர்வ பதிவு • 2026' : 'Orin AI Official Log • 2026'}
           </p>
        </footer>
      </div>
    </div>
  );
};

export default ReleasesPage;
