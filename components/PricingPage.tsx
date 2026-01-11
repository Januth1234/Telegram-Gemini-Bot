
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';

interface PricingPageProps {
  onClose: () => void;
  lang: Language;
}

const PricingPage: React.FC<PricingPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];

  const handlePlanSelect = (planName: string) => {
    alert(`The ${planName} plan selection is currently in preview. Full billing integration coming soon in Orin v5.0.`);
  };

  const contentMap = {
    en: {
      f1: "200 Daily Neural Prompts",
      f2: "Basic Reasoning Core",
      f3: "Bilingual Support (SI/EN)",
      f4: "Standard Web Grounding",
      f5: "Community Access",
      p1: "500 Daily Neural Prompts",
      p2: "Advanced Reasoning Mode",
      p3: "Visual Intelligence Tools",
      p4: "1K Studio Synthesis",
      p5: "Priority Support Line",
      e1: "Unlimited Neural Prompts",
      e2: "Deep Research Logic Map",
      e3: "4K Studio Asset Creation",
      e4: "Multimodal Voice Flow",
      e5: "Dedicated Account Lead",
      comp1: "Daily Processing Limit",
      comp2: "Deep Reasoning Engine",
      comp3: "Vision & OCR",
      comp4: "Creative Synthesis",
      comp5: "Grounding Precision",
      comp6: "Technical Support",
      val1: "200 Commands", val2: "500 Commands", val3: "Infinite",
      val4: "Standard", val5: "Advanced", val6: "Neural Research",
      val7: "No", val8: "Yes", val9: "Advanced",
      val10: "Text Only", val11: "1K Assets", val12: "4K Production",
      val13: "Web", val14: "Web + Maps", val15: "Deep Grounding",
      val16: "Community", val17: "Priority", val18: "Dedicated Engineer",
      core: "Core Benefits",
      month: "/ month",
      init: "Initialize Plan"
    },
    si: {
      f1: "දිනකට විධාන 200",
      f2: "මූලික තර්කන පද්ධතිය",
      f3: "ද්විභාෂා සහාය (SI/EN)",
      f4: "අන්තර්ජාල සම්බන්ධතාවය",
      f5: "ප්‍රජා සහාය",
      p1: "දිනකට විධාන 500",
      p2: "උසස් තර්කන පද්ධතිය",
      p3: "රූප විශ්ලේෂණ මෙවලම්",
      p4: "1K ගුණාත්මක නිර්මාණ",
      p5: "ප්‍රමුඛතා සහාය",
      e1: "සීමාරහිත විධාන",
      e2: "ගැඹුරු පර්යේෂණ පද්ධතිය",
      e3: "4K උසස් නිර්මාණ",
      e4: "හඬ සහ රූප සහාය",
      e5: "පුද්ගලික සහායකයෙක්",
      comp1: "දෛනික සීමාව",
      comp2: "තර්කන එන්ජිම",
      comp3: "රූප කියවීම (OCR)",
      comp4: "නිර්මාණකරණය",
      comp5: "තොරතුරු මූලාශ්‍ර",
      comp6: "තාක්ෂණික සහාය",
      val1: "200", val2: "500", val3: "සීමාරහිත",
      val4: "සාමාන්‍ය", val5: "උසස්", val6: "පර්යේෂණ",
      val7: "නැත", val8: "ඔව්", val9: "උසස්",
      val10: "පමණයි", val11: "1K", val12: "4K",
      val13: "වෙබ්", val14: "වෙබ් + සිතියම්", val15: "ගැඹුරු",
      val16: "ප්‍රජාව", val17: "ප්‍රමුඛතාව", val18: "ඉංජිනේරු",
      core: "ප්‍රධාන වාසි",
      month: "/ මසකට",
      init: "තෝරාගන්න"
    },
    ta: {
      f1: "தினசரி 200 கட்டளைகள்",
      f2: "அடிப்படை சிந்தனை மையம்",
      f3: "இருமொழி ஆதரவு (SI/EN)",
      f4: "இணைய இணைப்பு",
      f5: "சமூக அணுகல்",
      p1: "தினசரி 500 கட்டளைகள்",
      p2: "மேம்பட்ட சிந்தனை முறை",
      p3: "பட நுண்ணறிவு கருவிகள்",
      p4: "1K ஸ்டுடியோ உருவாக்கம்",
      p5: "முன்னுரிமை ஆதரவு",
      e1: "வரம்பற்ற கட்டளைகள்",
      e2: "ஆழ்ந்த ஆராய்ச்சி வரைபடம்",
      e3: "4K சொத்து உருவாக்கம்",
      e4: "குரல் மற்றும் பட ஆதரவு",
      e5: "தனிப்பட்ட கணக்கு தலைவர்",
      comp1: "தினசரி வரம்பு",
      comp2: "சிந்தனை என்ஜின்",
      comp3: "பார்வை & OCR",
      comp4: "படைப்பு தொகுப்பு",
      comp5: "துல்லியம்",
      comp6: "தொழில்நுட்ப ஆதரவு",
      val1: "200", val2: "500", val3: "வரம்பற்ற",
      val4: "வழக்கமான", val5: "மேம்பட்ட", val6: "ஆராய்ச்சி",
      val7: "இல்லை", val8: "ஆம்", val9: "மேம்பட்ட",
      val10: "எழுத்து மட்டும்", val11: "1K சொத்து", val12: "4K உற்பத்தி",
      val13: "இணையம்", val14: "இணையம் + வரைபடம்", val15: "ஆழமான",
      val16: "சமூகம்", val17: "முன்னுரிமை", val18: "பொறியாளர்",
      core: "முக்கிய நன்மைகள்",
      month: "/ மாதம்",
      init: "திட்டத்தைத் தேர்வுசெய்க"
    }
  };

  const localT = contentMap[lang];

  const plans = [
    {
      name: t.starterPlan,
      price: "300",
      icon: "fa-seedling",
      color: "blue",
      features: [localT.f1, localT.f2, localT.f3, localT.f4, localT.f5]
    },
    {
      name: t.proPlan,
      price: "1000",
      icon: "fa-bolt",
      color: "cyan",
      popular: true,
      features: [localT.p1, localT.p2, localT.p3, localT.p4, localT.p5]
    },
    {
      name: t.elitePlan,
      price: "3000",
      icon: "fa-crown",
      color: "indigo",
      features: [localT.e1, localT.e2, localT.e3, localT.e4, localT.e5]
    }
  ];

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 animate-neural">
              <i className="fa-solid fa-tags"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">{t.pricing}</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.pricingDesc}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:rotate-90"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </header>

        <div className="space-y-20">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <div 
                key={i} 
                className={`glass-panel p-8 rounded-[40px] border flex flex-col gap-8 transition-all relative hover-lift animate-scale-in ${
                  plan.popular ? 'border-cyan-500 shadow-2xl shadow-cyan-500/10 scale-105 z-10' : 'border-black/5 dark:border-white/5'
                }`}
                style={{ animationDelay: `${0.1 + i * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-bounce-subtle">
                    Most Popular
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl bg-${plan.color}-500/10 flex items-center justify-center text-${plan.color}-500 text-xl group-hover:scale-110 transition-transform`}>
                    <i className={`fa-solid ${plan.icon}`}></i>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{plan.price}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.lkr}</span>
                    <span className="text-[10px] text-slate-400 font-bold ml-1">{localT.month}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-2">{localT.core}</div>
                  <ul className="space-y-3">
                    {plan.features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 leading-tight group">
                        <i className={`fa-solid fa-circle-check text-${plan.color}-500 mt-0.5 transition-transform group-hover:scale-125`}></i>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={() => handlePlanSelect(plan.name)}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${
                    plan.popular 
                      ? 'bg-cyan-500 text-white shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40' 
                      : 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100'
                  }`}
                >
                  {localT.init}
                </button>
              </div>
            ))}
          </div>

          <div className="glass-panel p-10 md:p-16 rounded-[48px] border border-black/5 dark:border-white/5 space-y-12 animate-fade" style={{ animationDelay: '0.5s' }}>
             <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Detailed Comparison</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Neural Feature Roadmap</p>
             </div>

             <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/5">
                      <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Feature</th>
                      <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Starter</th>
                      <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pro</th>
                      <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Elite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    <ComparisonRow label={localT.comp1} s={localT.val1} p={localT.val2} e={localT.val3} />
                    <ComparisonRow label={localT.comp2} s={localT.val4} p={localT.val5} e={localT.val6} />
                    <ComparisonRow label={localT.comp3} s={localT.val7} p={localT.val8} e={localT.val9} />
                    <ComparisonRow label={localT.comp4} s={localT.val10} p={localT.val11} e={localT.val12} />
                    <ComparisonRow label={localT.comp5} s={localT.val13} p={localT.val14} e={localT.val15} />
                    <ComparisonRow label={localT.comp6} s={localT.val16} p={localT.val17} e={localT.val18} />
                  </tbody>
                </table>
             </div>
          </div>

          <footer className="pt-20 pb-10 text-center opacity-30">
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
               JN Productions Commercial Protocol • 2026
             </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

const ComparisonRow = ({ label, s, p, e }: any) => (
  <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
    <td className="py-6 text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{label}</td>
    <td className="py-6 text-[11px] font-bold text-slate-500">{s}</td>
    <td className="py-6 text-[11px] font-bold text-cyan-600 dark:text-cyan-400">{p}</td>
    <td className="py-6 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{e}</td>
  </tr>
);

export default PricingPage;
