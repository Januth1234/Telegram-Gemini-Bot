
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
    { 
      name: t.starterPlan, 
      price: "Free", 
      key: "starter",
      desc: "For casual exploration",
      features: ["Daily Reset Limit", "Standard Speed", "Community Support"],
      style: "border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5"
    },
    { 
      name: t.proPlan, 
      price: "1000", 
      key: "pro", 
      popular: true,
      desc: "For creators & students",
      features: ["Expanded Limits", "Priority Access", "Standard Logic Flow", "Voice Mode"],
      style: "border-cyan-500/50 bg-gradient-to-b from-cyan-500/10 to-transparent shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]"
    },
    { 
      name: t.elitePlan, 
      price: "3000", 
      key: "elite",
      desc: "For professionals",
      features: ["Unlimited Reasoning", "Orin Ultra Model", "4K Image Studio", "Veo Video Gen", "Dedicated Support"],
      style: "border-indigo-500/50 bg-gradient-to-b from-indigo-600/20 to-purple-900/20 shadow-[0_0_40px_-10px_rgba(79,70,229,0.4)]"
    }
  ];

  const comparisons = [
    { name: "Neural Engine", basic: "Orin Core", pro: "Orin Core+", elite: "Orin Ultra" },
    { name: "Daily Message Cap", basic: "200", pro: "500", elite: "Unlimited" },
    { name: "Context Window", basic: "128K", pro: "1M", elite: "2M (Long Context)" },
    { name: "Studio (Images)", basic: "10 / day", pro: "50 / day", elite: "Unlimited" },
    { name: "Veo (Video)", basic: "-", pro: "5 / day", elite: "Unlimited" },
    { name: "Memory Sync", basic: "Local Only", pro: "Cloud Sync", elite: "Full Neural Graph" },
    { name: "Response Speed", basic: "Standard", pro: "Fast", elite: "Instant" },
  ];

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
           <div className="space-y-1">
             <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.pricing}</h2>
             <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">Upgrade Your Intelligence</p>
           </div>
           <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl glass-panel text-slate-500 hover:text-red-500 transition-all hover:rotate-90"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 items-start">
            {plans.map((plan, i) => (
              <div key={i} className={`relative p-8 rounded-[40px] border flex flex-col gap-6 transition-all duration-500 hover:-translate-y-2 group ${plan.style} ${plan.popular ? 'md:-mt-4 md:mb-4 z-10' : ''}`}>
                
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-cyan-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/30">
                    Most Popular
                  </div>
                )}
                {plan.key === 'elite' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30">
                    Best Performance
                  </div>
                )}

                <div className="space-y-2 text-center pt-4">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{plan.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{plan.desc}</p>
                </div>

                <div className="text-center py-4 border-b border-black/5 dark:border-white/5">
                  <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {plan.price === 'Free' ? '0' : plan.price}
                    <span className="text-xs font-bold text-slate-400 align-top ml-1 mt-2 inline-block">{plan.price !== 'Free' ? t.lkr : ''}</span>
                  </div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{plan.price === 'Free' ? 'Forever' : 'Per Month'}</div>
                </div>

                <ul className="space-y-4 py-4 flex-1">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.key === 'elite' ? 'bg-indigo-500/20 text-indigo-400' : plan.popular ? 'bg-cyan-500/20 text-cyan-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                        <i className="fa-solid fa-check text-[10px]"></i>
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handlePlanSelect(plan.key)}
                  className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-lg ${
                    plan.key === 'elite' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 
                    plan.popular ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/20' : 
                    'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                  }`}
                >
                  {user?.tier.toLowerCase().includes(plan.key) ? "Current Plan" : "Choose Plan"}
                </button>
              </div>
            ))}
        </div>

        {/* Detailed Breakdown */}
        <div className="space-y-8 animate-reveal" style={{ animationDelay: '0.2s' }}>
           <div className="flex items-center gap-4 px-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                 <i className="fa-solid fa-layer-group"></i>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Technical Specifications</h3>
           </div>

           <div className="glass-panel p-6 md:p-10 rounded-[48px] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                       <tr className="border-b border-black/5 dark:border-white/5">
                          <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Capability</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest w-1/4">Starter</th>
                          <th className="p-6 text-[10px] font-black uppercase text-cyan-600 tracking-widest w-1/4">Pro</th>
                          <th className="p-6 text-[10px] font-black uppercase text-indigo-500 tracking-widest w-1/4">Elite</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                       {comparisons.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                             <td className="p-6 text-xs font-bold text-slate-600 dark:text-slate-400">{item.name}</td>
                             <td className="p-6 text-xs font-bold text-slate-800 dark:text-white">{item.basic}</td>
                             <td className="p-6 text-xs font-bold text-slate-800 dark:text-white group-hover:text-cyan-600 transition-colors">{item.pro}</td>
                             <td className="p-6 text-xs font-bold text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">{item.elite}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="mt-20 text-center space-y-4">
           <p className="text-[10px] font-bold text-slate-400 max-w-lg mx-auto leading-relaxed">
             Orin AI plans are billed monthly. You can cancel anytime. Higher tiers unlock advanced neural processing capabilities including "Orin Ultra", our most capable reasoning engine.
           </p>
           <div className="flex justify-center gap-4 opacity-50">
              <i className="fa-brands fa-cc-visa text-2xl text-slate-400"></i>
              <i className="fa-brands fa-cc-mastercard text-2xl text-slate-400"></i>
           </div>
        </div>

      </div>
    </div>
  );
};

export default PricingPage;
