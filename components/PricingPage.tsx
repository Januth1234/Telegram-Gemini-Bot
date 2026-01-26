
import React from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { firebaseService } from '../services/firebaseService';
import { geminiService } from '../services/geminiService';

interface PricingPageProps {
  onClose: () => void;
  lang: Language;
}

const PricingPage: React.FC<PricingPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const user = geminiService.getCurrentUser();

  const handlePlanSelect = async (planName: string) => {
    if (!user) {
        alert("Please sign in to upgrade.");
        return;
    }
    if (confirm(`Confirm upgrade to ${planName}?`)) {
       await firebaseService.updatePlan(user.id, planName);
       alert("Plan upgraded successfully! Refreshing session...");
       window.location.reload();
    }
  };

  const plans = [
    { name: t.starterPlan, price: "Free", color: "blue", key: "starter" },
    { name: t.proPlan, price: "1000", color: "cyan", popular: true, key: "pro" },
    { name: t.elitePlan, price: "3000", color: "indigo", key: "elite" }
  ];

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
           <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{t.pricing}</h2>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-500"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <div key={i} className={`glass-panel p-8 rounded-[40px] border flex flex-col gap-8 transition-all ${plan.popular ? 'border-cyan-500 shadow-2xl scale-105 z-10' : 'border-black/5 dark:border-white/5'}`}>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">{plan.name}</h3>
                <div className="text-3xl font-black text-slate-900 dark:text-white">{plan.price} <span className="text-xs text-slate-400">{plan.price !== 'Free' && t.lkr}</span></div>
                <button 
                  onClick={() => handlePlanSelect(plan.key)}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${plan.popular ? 'bg-cyan-500 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-black'}`}
                >
                  {user?.tier.toLowerCase().includes(plan.key) ? "Current Plan" : "Select Plan"}
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
