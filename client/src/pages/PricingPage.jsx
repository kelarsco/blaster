import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check } from 'react-feather';
import {
  PLANS,
  MONTHS_BILLED_ANNUALLY,
  formatPriceNum,
  getDisplayPrice,
  storeSelectedPlan,
  PLAN_KEY,
} from '../data/plans';

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const isAnnually = billingPeriod === 'annually';

  const handleChoosePlan = (plan) => {
    const planId = plan.id === 'free' ? 'free' : isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
    storeSelectedPlan(planId);
    if (user) {
      navigate('/app/account/pricing', { replace: true });
      return;
    }
    navigate('/signup?from=pricing', { replace: true });
  };

  return (
    <div className="min-h-screen bg-blaster-bg font-landing text-blaster-fg">
      <header className="sticky top-0 z-40 bg-blaster-bg">
        <div className="max-w-6xl mx-auto px-4 py-1.5 sm:py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 font-bold text-sm sm:text-lg uppercase tracking-tight text-blaster-fg shrink-0 min-w-0">
            <span className="text-blaster-accent">⚡</span>
            <span className="truncate">wiblaster</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link to="/login" className="text-sm font-medium text-blaster-fg hover:text-blaster-accent transition">
              Log in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-blaster-fg text-white text-sm font-semibold btn-landing-pop whitespace-nowrap scale-[0.7] sm:scale-100 origin-center"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-blaster-fg">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-blaster-muted max-w-xl mx-auto">
            Start free. Upgrade when you need more emails, senders, and campaigns. All plans include store scanning and export.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!isAnnually ? 'text-blaster-fg' : 'text-blaster-muted'}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAnnually}
              onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'annually' : 'monthly'))}
              className="relative inline-flex h-7 w-12 shrink-0 rounded-full border border-blaster-border bg-blaster-bg-app transition-colors focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-blaster-fg transition-transform mt-1 ml-1 ${isAnnually ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnually ? 'text-blaster-fg' : 'text-blaster-muted'}`}>
              Annually
            </span>
            <span className="text-xs font-medium text-blaster-accent bg-blaster-accent/10 px-2 py-0.5 rounded">
              2 months free
            </span>
          </div>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const display = getDisplayPrice(plan.price, isAnnually);
            return (
              <div
                key={plan.id}
                className={`bg-blaster-bg-card rounded-2xl border flex flex-col ${
                  plan.tag ? 'border-blaster-accent/50 ring-2 ring-blaster-accent/20' : 'border-blaster-border'
                } shadow-md overflow-hidden`}
              >
                {plan.tag && (
                  <div className="bg-blaster-accent/10 border-b border-blaster-accent/20 px-4 py-1.5 text-center">
                    <span className="text-xs font-semibold text-blaster-accent">{plan.tag}</span>
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-blaster-fg">{plan.name}</h3>
                  <p className="text-sm text-blaster-muted mt-1 mb-4 line-clamp-3">{plan.description}</p>
                  <div className="mt-auto">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl font-bold text-blaster-fg">${formatPriceNum(display.primary)}</span>
                      <span className="text-blaster-muted text-sm">/{display.primaryLabel}</span>
                    </div>
                    {display.secondary != null && (
                      <p className="text-xs text-blaster-muted mt-0.5">
                        ~${formatPriceNum(display.secondary)}/mo billed annually
                      </p>
                    )}
                    {plan.originalPrice != null && !isAnnually && (
                      <p className="text-xs text-blaster-muted mt-0.5">
                        <span className="line-through">${formatPriceNum(plan.originalPrice)}</span>/mo
                      </p>
                    )}
                    <ul className="mt-4 space-y-2 text-sm text-blaster-fg">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        {plan.features.emails} emails/mo
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        {plan.features.users}
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        {plan.features.support}
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleChoosePlan(plan)}
                      className={`w-full mt-6 py-2.5 rounded-xl text-sm font-semibold btn-landing-pop ${
                        plan.id === 'free'
                          ? 'btn-blaster-accent'
                          : 'bg-blaster-accent text-white hover:opacity-90'
                      }`}
                    >
                      {plan.id === 'free' ? 'Get started free' : 'Choose plan'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-16 text-center">
          <h2 className="text-xl font-bold text-blaster-fg">What’s included in every plan</h2>
          <ul className="mt-4 inline-flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-blaster-muted">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Store URL scanner & email extraction
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Export to Excel
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Campaigns & templates
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Secure payment via Paystack
            </li>
          </ul>
        </section>

        <div className="mt-16 rounded-2xl bg-blaster-accent/10 border border-blaster-accent/20 p-8 text-center">
          <h2 className="text-xl font-bold text-blaster-fg">Ready to scale your outreach?</h2>
          <p className="mt-2 text-blaster-muted max-w-lg mx-auto">
            Create an account in under a minute. Pick a plan and complete payment securely with Paystack.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="btn-blaster-cta btn-landing-pop">
              Create free account
            </Link>
            <Link to="/login" className="btn-blaster-accent px-5 py-2.5 rounded-lg btn-landing-pop">
              I already have an account
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-blaster-border text-center text-sm text-blaster-muted mt-12">
        <Link to="/" className="text-blaster-accent hover:underline">← Back to home</Link>
        <p className="mt-2">© {new Date().getFullYear()} wiblaster.</p>
      </footer>
    </div>
  );
}
