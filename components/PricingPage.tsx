
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

  const plans = [
    {
      name: t.starterPlan,
      price: "300",
      icon: "fa-seedling",
      color: "blue",
      features: [
        "200 Daily Neural Prompts",
        "Basic Reasoning Core",
        "Bilingual Support (SI/EN)",
        "Standard Web Grounding",
        "Community Access"
      ]
    },
    {
      name: t.proPlan,
      price: "1000",
      icon: "fa-bolt",
      color: "cyan",
      popular: true,
      features: [
        "500 Daily Neural Prompts",
        "Advanced Reasoning Mode",
        "Visual Intelligence Tools",
        "1K Studio Synthesis",
        "Priority Support Line"
      ]
    },
    {
      name: t.elitePlan,
      price: "3000",
      icon: "fa-crown",
      color: "indigo",
      features: [
        "Unlimited Neural Prompts",
        "Deep Research Logic Map",
        "4K Studio Asset Creation",
        "Multimodal Voice Flow",
        "Dedicated Account Lead"
      ]
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
                    <span className="text-[10px] text-slate-400 font-bold ml-1">/ month</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-2">Core Benefits</div>
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
                  Initialize Plan
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
                    <ComparisonRow label="Daily Processing Limit" s="200 Commands" p="500 Commands" e="Infinite" />
                    <ComparisonRow label="Deep Reasoning Engine" s="Standard" p="Advanced" e="Neural Research" />
                    <ComparisonRow label="Vision & OCR" s="No" p="Yes" e="Advanced" />
                    <ComparisonRow label="Creative Synthesis" s="Text Only" p="1K Assets" e="4K Production" />
                    <ComparisonRow label="Grounding Precision" s="Web" p="Web + Maps" e="Deep Grounding" />
                    <ComparisonRow label="Technical Support" s="Community" p="Priority" e="Dedicated Engineer" />
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
