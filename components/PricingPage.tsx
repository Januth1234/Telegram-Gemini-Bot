
import React, { useEffect, useState } from 'react';
import { Language, DbPlan } from '../types';
import { translations } from '../translations';
import { subscriptionService } from '../services/subscriptionService';
import { geminiService } from '../services/geminiService';

interface PricingPageProps {
  onClose: () => void;
  lang: Language;
  onPlanActivated?: () => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onClose, lang, onPlanActivated }) => {
  const t = translations[lang];
  const [plans, setPlans] = useState<DbPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const content = {
    en: {
        loading: "Loading Plans...",
        popular: "Most Popular",
        benefits: "Core Benefits",
        initPlan: "Initialize Plan",
        processing: "Processing...",
        comparisonTitle: "Detailed Comparison",
        comparisonSub: "Neural Feature Roadmap",
        tableFeature: "Feature",
        tableBasic: "Basic",
        tablePro: "Pro",
        tableElite: "Elite",
        rows: [
            { label: "Daily Processing Limit", s: "200 Commands", p: "500 Commands", e: "Infinite" },
            { label: "Deep Reasoning Engine", s: "Standard", p: "Advanced", e: "Neural Research" },
            { label: "Vision & OCR", s: "No", p: "Yes", e: "Advanced" },
            { label: "Creative Synthesis", s: "Text Only", p: "1K Assets", e: "4K Production" },
            { label: "Grounding Precision", s: "Web", p: "Web + Maps", e: "Deep Grounding" },
            { label: "Technical Support", s: "Community", p: "Priority", e: "Dedicated Engineer" }
        ],
        footer: "JN Productions Commercial Protocol • 2026"
    },
    si: {
        loading: "පැකේජයන් පූරණය වෙමින්...",
        popular: "බොහෝ දෙනෙක් තෝරාගන්නා",
        benefits: "ප්‍රධාන වාසි",
        initPlan: "සක්‍රිය කරන්න",
        processing: "සකසමින්...",
        comparisonTitle: "සවිස්තරාත්මක සංසන්දනය",
        comparisonSub: "පහසුකම් සටහන",
        tableFeature: "විශේෂාංගය",
        tableBasic: "සාමාන්‍ය",
        tablePro: "ප්‍රෝ",
        tableElite: "එලයිට්",
        rows: [
            { label: "දෛනික සීමාව", s: "200 විධානයන්", p: "500 විධානයන්", e: "සීමා නැත" },
            { label: "බුද්ධිමය එන්ජිම", s: "සාමාන්‍ය", p: "දියුණු කළ", e: "පර්යේෂණ මට්ටමේ" },
            { label: "Vision සහ OCR", s: "නැත", p: "ඔව්", e: "ඉහළම" },
            { label: "නිර්මාණකරණය", s: "ලිපි පමණයි", p: "1K පින්තූර", e: "4K වීඩියෝ" },
            { label: "තොරතුරු මූලාශ්‍ර", s: "වෙබ්", p: "වෙබ් + සිතියම්", e: "ගැඹුරු සෙවුම්" },
            { label: "තාක්ෂණික සහාය", s: "පොදු", p: "ප්‍රමුඛතාවය", e: "විශේෂ ඉංජිනේරු" }
        ],
        footer: "JN Productions වාණිජ නීති • 2026"
    },
    ta: {
        loading: "திட்டங்கள் ஏற்றப்படுகின்றன...",
        popular: "மிகவும் பிரபலமானது",
        benefits: "முக்கிய நன்மைகள்",
        initPlan: "செயல்படுத்து",
        processing: "செயலாக்குகிறது...",
        comparisonTitle: "விரிவான ஒப்பீடு",
        comparisonSub: "அம்சங்களின் வரைபடம்",
        tableFeature: "அம்சம்",
        tableBasic: "அடிப்படை",
        tablePro: "புரோ",
        tableElite: "எலைட்",
        rows: [
            { label: "தினசரி வரம்பு", s: "200 கட்டளைகள்", p: "500 கட்டளைகள்", e: "வரம்பற்றது" },
            { label: "நுண்ணறிவு இயந்திரம்", s: "தரமான", p: "மேம்பட்ட", e: "ஆராய்ச்சி நிலை" },
            { label: "Vision மற்றும் OCR", s: "இல்லை", p: "ஆம்", e: "மேம்பட்டது" },
            { label: "படைப்பாற்றல்", s: "உரை மட்டும்", p: "1K படங்கள்", e: "4K வீடியோ" },
            { label: "தகவல் மூலங்கள்", s: "இணையம்", p: "இணையம் + வரைபடம்", e: "ஆழமான தேடல்" },
            { label: "தொழில்நுட்ப ஆதரவு", s: "சமூகம்", p: "முன்னுரிமை", e: "அர்ப்பணிப்பு பொறியாளர்" }
        ],
        footer: "JN Productions வணிக நெறிமுறை • 2026"
    }
  };

  const text = content[lang];

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const data = await subscriptionService.getPlans();
    if (data.length === 0) {
        console.warn("No plans found in DB.");
    }
    setPlans(data);
    setLoading(false);
  };

  const handlePlanSelect = async (plan: DbPlan) => {
    const user = geminiService.getCurrentUser();
    
    if (!user) {
        alert(lang === 'si' ? "කරුණාකර පළමුව ගිණුමට පිවිසෙන්න." : (lang === 'ta' ? "முதலில் உங்கள் கணக்கில் உள்நுழையவும்." : "Please sign in to your account first."));
        return;
    }

    const confirmMsg = lang === 'si' 
        ? `${plan.name} පැකේජය සක්‍රිය කිරීමට ඔබට විශ්වාසද? (රු. ${plan.price_lkr})` 
        : lang === 'ta'
        ? `${plan.name} திட்டத்தை செயல்படுத்த விரும்புகிறீர்களா? (ரூ. ${plan.price_lkr})`
        : `Are you sure you want to subscribe to ${plan.name}? (LKR ${plan.price_lkr})`;

    if (confirm(confirmMsg)) {
        setProcessingId(plan.id);
        const success = await subscriptionService.subscribeUser(user.id, plan, user.email);
        
        if (success) {
            alert(lang === 'si' ? "පැකේජය සාර්ථකව සක්‍රිය විය!" : (lang === 'ta' ? "திட்டம் வெற்றிகரமாக செயல்படுத்தப்பட்டது!" : "Plan activated successfully!"));
            if (onPlanActivated) onPlanActivated();
            onClose(); 
        } else {
            alert("Activation failed. Please try again.");
        }
        setProcessingId(null);
    }
  };

  const getPlanColor = (name: string) => {
     const n = name.toLowerCase();
     if (n.includes('elite') || n.includes('best')) return 'indigo';
     if (n.includes('pro')) return 'cyan';
     return 'blue';
  };

  const getPlanIcon = (name: string) => {
     const n = name.toLowerCase();
     if (n.includes('elite')) return 'fa-crown';
     if (n.includes('pro')) return 'fa-bolt';
     return 'fa-seedling';
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 animate-neural">
              <i className="fa-solid fa-tags"></i>
            </div>
            <div>
              <h2 className={`text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase ${lang !== 'en' ? 'sinhala-text' : ''}`}>{t.pricing}</h2>
              <p className={`text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ${lang !== 'en' ? 'sinhala-text' : ''}`}>{t.pricingDesc}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className={`text-[10px] font-black uppercase tracking-widest text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.loading}</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                {plans.map((plan, i) => {
                const color = getPlanColor(plan.name);
                const icon = getPlanIcon(plan.name);
                const isPopular = plan.name.toLowerCase().includes('pro');

                return (
                    <div 
                        key={plan.id} 
                        className={`glass-panel p-8 rounded-[40px] border flex flex-col gap-8 transition-all relative hover-lift animate-scale-in ${
                        isPopular ? 'border-cyan-500 shadow-2xl shadow-cyan-500/10 scale-105 z-10' : 'border-black/5 dark:border-white/5'
                        }`}
                        style={{ animationDelay: `${0.1 + i * 0.1}s` }}
                    >
                        {isPopular && (
                        <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-bounce-subtle ${lang !== 'en' ? 'sinhala-text' : ''}`}>
                            {text.popular}
                        </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 flex items-center justify-center text-${color}-500 text-xl group-hover:scale-110 transition-transform`}>
                            <i className={`fa-solid ${icon}`}></i>
                        </div>
                        </div>

                        <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{plan.price_lkr}</span>
                            <span className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${lang !== 'en' ? 'sinhala-text' : ''}`}>{t.lkr}</span>
                            <span className="text-[10px] text-slate-400 font-bold ml-1">/ month</span>
                        </div>
                        </div>

                        <div className="flex-1 space-y-4">
                        <div className={`text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-2 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.benefits}</div>
                        <ul className="space-y-3">
                            {plan.features?.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 leading-tight group">
                                <i className={`fa-solid fa-circle-check text-${color}-500 mt-0.5 transition-transform group-hover:scale-125`}></i>
                                {f}
                            </li>
                            ))}
                        </ul>
                        </div>

                        <button 
                        onClick={() => handlePlanSelect(plan)}
                        disabled={processingId === plan.id}
                        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                            isPopular 
                            ? 'bg-cyan-500 text-white shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40' 
                            : 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100'
                        }`}
                        >
                        {processingId === plan.id && <i className="fa-solid fa-circle-notch animate-spin"></i>}
                        <span className={lang !== 'en' ? 'sinhala-text' : ''}>{processingId === plan.id ? text.processing : text.initPlan}</span>
                        </button>
                    </div>
                );
                })}
            </div>
        )}

        <div className="glass-panel p-10 md:p-16 rounded-[48px] border border-black/5 dark:border-white/5 space-y-12 animate-fade">
            <div className="text-center space-y-2">
                <h3 className={`text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.comparisonTitle}</h3>
                <p className={`text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.comparisonSub}</p>
            </div>

            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-black/5 dark:border-white/5">
                    <th className={`py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.tableFeature}</th>
                    <th className={`py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.tableBasic}</th>
                    <th className={`py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.tablePro}</th>
                    <th className={`py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{text.tableElite}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {text.rows.map((row, i) => (
                        <ComparisonRow key={i} label={row.label} s={row.s} p={row.p} e={row.e} lang={lang} />
                    ))}
                </tbody>
                </table>
            </div>
        </div>

        <footer className="pt-20 pb-10 text-center opacity-30">
            <p className={`text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>
            {text.footer}
            </p>
        </footer>
      </div>
    </div>
  );
};

const ComparisonRow = ({ label, s, p, e, lang }: any) => (
  <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
    <td className={`py-6 text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight ${lang !== 'en' ? 'sinhala-text' : ''}`}>{label}</td>
    <td className={`py-6 text-[11px] font-bold text-slate-500 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{s}</td>
    <td className={`py-6 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{p}</td>
    <td className={`py-6 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 ${lang !== 'en' ? 'sinhala-text' : ''}`}>{e}</td>
  </tr>
);

export default PricingPage;
