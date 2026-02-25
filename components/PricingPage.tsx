
import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { geminiService } from '../services/geminiService';
import { createCheckoutSession } from '../services/stripeService';

interface PricingPageProps {
  onClose: () => void;
  lang: Language;
}

type BillingInterval = 'monthly' | 'yearly';

const PricingPage: React.FC<PricingPageProps> = ({ onClose, lang }) => {
  const t = translations[lang];
  const user = geminiService.getCurrentUser();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'cancel' | null }>({ type: null });
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (params.get('success') === 'true') setMessage({ type: 'success' });
    if (params.get('canceled') === 'true') setMessage({ type: 'cancel' });
  }, []);

  const handlePlanSelect = async (planKey: string) => {
    if (!user) {
      alert(t.pleaseSignInToUpgrade);
      return;
    }
    if (planKey === 'starter') return;
    if (!confirm(`${t.confirmUpgrade} ${planKey}?`)) return;

    setCheckoutLoading(planKey);
    try {
      const origin = window.location.origin;
      const result = await createCheckoutSession({
        planKey,
        userId: user.id,
        userEmail: user.email,
        successUrl: `${origin}/#pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/#pricing?canceled=true`,
      });
      if ('url' in result) {
        window.location.href = result.url;
        return;
      }
      alert((result as { error: string }).error || t.planUpgradedSuccess);
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Paid plans: Basic 300/mo or 3000/yr, Pro 1500/mo or 15000/yr (Stripe Price IDs)
  const plans = (() => {
    const isYearly = billingInterval === 'yearly';
    const starter = {
      name: t.freePlan,
      price: t.freeLabel,
      key: 'starter',
      desc: t.planStarterDesc,
      features: [t.planStarterF1, t.planStarterF2, t.planStarterF3],
      style: 'border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5',
    };
    const basic = {
      name: t.basicPlan,
      price: isYearly ? '3000' : '300',
      key: isYearly ? 'basic_yearly' : 'basic',
      desc: t.planStarterDesc,
      periodLabel: isYearly ? t.perYearLabel : t.perMonthLabel,
      features: [t.planStarterF1, t.planStarterF2, t.planStarterF3],
      style: 'border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5',
    };
    const pro = {
      name: t.proPlan,
      price: isYearly ? '15000' : '1500',
      key: isYearly ? 'pro_yearly' : 'pro',
      popular: true,
      desc: t.planProDesc,
      periodLabel: isYearly ? t.perYearLabel : t.perMonthLabel,
      features: [t.planProF1, t.planProF2, t.planProF3, t.planProF4],
      style: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/10 to-transparent shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]',
    };
    return [starter, basic, pro];
  })();

  const comparisons = [
    { name: "Neural Engine", starter: "Orin Core", basic: "Orin Core+", pro: "Orin Ultra" },
    { name: "Daily Message Cap", starter: "200", basic: "500", pro: "Unlimited" },
    { name: "Context Window", starter: "128K", basic: "1M", pro: "2M (Long Context)" },
    { name: "Studio (Images)", starter: "10 / day", basic: "50 / day", pro: "Unlimited" },
    { name: "Veo (Video)", starter: "-", basic: "5 / day", pro: "Unlimited" },
    { name: "Memory Sync", starter: "Local Only", basic: "Cloud Sync", pro: "Full Neural Graph" },
    { name: "Response Speed", starter: "Standard", basic: "Fast", pro: "Instant" },
  ];

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 animate-reveal">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        {message.type === 'success' && (
          <div className="mb-6 p-4 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-800 dark:text-cyan-200 text-sm font-bold text-center">
            Payment successful. Your plan is updated — refresh to see changes.
          </div>
        )}
        {message.type === 'cancel' && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold text-center">
            Checkout canceled. You can try again when ready.
          </div>
        )}
        <header className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-8 mb-12">
           <div className="space-y-1">
             <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t.pricing}</h2>
             <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em]">{t.upgradeSubtitle}</p>
           </div>
           <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl glass-panel text-slate-500 hover:text-red-500 transition-all hover:rotate-90"><i className="fa-solid fa-xmark text-lg"></i></button>
        </header>

        {/* Billing interval toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-bold ${billingInterval === 'monthly' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>{t.billingMonthly}</span>
          <button
            type="button"
            role="switch"
            aria-checked={billingInterval === 'yearly'}
            onClick={() => setBillingInterval((prev) => (prev === 'monthly' ? 'yearly' : 'monthly'))}
            className="relative w-12 h-6 rounded-full bg-slate-300 dark:bg-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billingInterval === 'yearly' ? 'translate-x-7 left-1' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-bold ${billingInterval === 'yearly' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>{t.billingYearly}</span>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 items-start">
            {plans.map((plan, i) => (
              <div key={i} className={`relative p-8 rounded-[40px] border flex flex-col gap-6 transition-all duration-500 hover:-translate-y-2 group ${plan.style} ${plan.popular ? 'md:-mt-4 md:mb-4 z-10' : ''}`}>
                
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-cyan-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/30">
                    Most Popular
                  </div>
                )}

                <div className="space-y-2 text-center pt-4">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{plan.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{plan.desc}</p>
                </div>

                <div className="text-center py-4 border-b border-black/5 dark:border-white/5">
                  <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {plan.price === t.freeLabel ? '0' : plan.price}
                    <span className="text-xs font-bold text-slate-400 align-top ml-1 mt-2 inline-block">{plan.price !== t.freeLabel ? t.lkr : ''}</span>
                  </div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{plan.price === t.freeLabel ? t.foreverLabel : ('periodLabel' in plan ? plan.periodLabel : t.perMonthLabel)}</div>
                </div>

                <ul className="space-y-4 py-4 flex-1">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.popular ? 'bg-cyan-500/20 text-cyan-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                        <i className="fa-solid fa-check text-[10px]"></i>
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handlePlanSelect(plan.key)}
                  disabled={plan.key === 'starter' || checkoutLoading !== null}
                  className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${
                    plan.popular ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/20' : 
                    'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                  }`}
                >
                  {plan.key === 'starter'
                    ? (!user ? t.freeLabel : (user?.tier?.toLowerCase().includes('pro') || user?.tier?.toLowerCase().includes('verified') ? t.freeLabel : 'Current Plan'))
                    : (user?.tier?.toLowerCase().includes('basic') && (plan.key === 'basic' || plan.key === 'basic_yearly')) || ((user?.tier?.toLowerCase().includes('pro') || user?.tier?.toLowerCase().includes('verified')) && (plan.key === 'pro' || plan.key === 'pro_yearly'))
                      ? 'Current Plan'
                      : checkoutLoading === plan.key
                        ? '...'
                        : 'Choose Plan'}
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
                          <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest w-1/4">{t.freePlan}</th>
                          <th className="p-6 text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest w-1/4">{t.basicPlan}</th>
                          <th className="p-6 text-[10px] font-black uppercase text-cyan-600 tracking-widest w-1/4">{t.proPlan}</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                       {comparisons.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                             <td className="p-6 text-xs font-bold text-slate-600 dark:text-slate-400">{item.name}</td>
                             <td className="p-6 text-xs font-bold text-slate-800 dark:text-white">{item.starter}</td>
                             <td className="p-6 text-xs font-bold text-slate-800 dark:text-white group-hover:text-cyan-600 transition-colors">{item.basic}</td>
                             <td className="p-6 text-xs font-bold text-slate-800 dark:text-white group-hover:text-cyan-600 transition-colors">{item.pro}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="mt-20 text-center space-y-4">
           <p className="text-[10px] font-bold text-slate-400 max-w-lg mx-auto leading-relaxed">
             Orin AI plans are billed monthly or yearly. You can cancel anytime. Higher tiers unlock advanced neural processing capabilities including "Orin Ultra", our most capable reasoning engine.
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
