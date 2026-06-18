import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, X, ChevronDown } from 'react-feather';
import { Logo } from '../components/Logo.jsx';
import { MarketingHeader } from '../layout/MarketingHeader.jsx';
import {
  PLANS,
  PLAN_COMPARISON,
  formatPriceNum,
  getDisplayPrice,
  getBillingPlanId,
  storeSelectedPlan,
} from '../data/plans';

function ComparisonCell({ value }) {
  if (value === true) {
    return <Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} />;
  }
  if (value === false) {
    return <X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} />;
  }
  return <span>{value}</span>;
}

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isAnnually = billingPeriod === 'annually';

  const handleChoosePlan = (plan) => {
    const planId = getBillingPlanId(plan, isAnnually);
    storeSelectedPlan(planId);

    if (user) {
      navigate('/app/account/pricing', { replace: true });
      return;
    }

    navigate('/signup?from=pricing', { replace: true });
  };

  return (
    <div className="min-h-screen bg-blaster-bg font-poppins text-black">
      <MarketingHeader />

      <main className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-blaster-fg">
            Choose a plan that fits your outreach scale
          </h1>
          <p className="mt-3 text-blaster-muted max-w-2xl mx-auto">
            Start with a 24-hour free trial — no card required. Upgrade when you need unlimited campaigns, filters, and senders.
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
            const display = getDisplayPrice(plan.price, isAnnually, plan.period);
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
                  <p className="text-sm text-blaster-muted mt-1 mb-4">{plan.description}</p>
                  <div className="mt-auto">
                    {plan.isFreeTrial ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-bold text-blaster-fg">Free</span>
                        <span className="text-blaster-muted text-sm">/ 24 hours</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-2xl font-bold text-blaster-fg">${formatPriceNum(display.primary)}</span>
                          <span className="text-blaster-muted text-sm">/{display.primaryLabel}</span>
                        </div>
                        {display.secondary != null && (
                          <p className="text-xs text-blaster-muted mt-0.5">
                            ~${formatPriceNum(display.secondary)}/mo billed annually
                          </p>
                        )}
                      </>
                    )}
                    {plan.highlights?.length > 0 && (
                      <ul className="mt-4 space-y-2 text-sm text-blaster-fg">
                        {plan.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => handleChoosePlan(plan)}
                      className={`w-full mt-6 py-2.5 rounded-xl text-sm font-semibold btn-landing-pop ${
                        plan.isFreeTrial
                          ? 'btn-blaster-accent'
                          : 'bg-blaster-accent text-white hover:opacity-90'
                      }`}
                    >
                      {plan.isFreeTrial ? 'Start free trial' : 'Choose plan'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-blaster-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-blaster-fg font-medium hover:underline">
            Log in
          </Link>
        </p>

        <section className="mt-12 border-t border-blaster-border pt-8">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="w-full flex items-center justify-center gap-2 text-blaster-fg font-medium hover:text-blaster-accent transition-colors py-2"
            aria-expanded={detailsOpen}
          >
            <ChevronDown
              className={`w-5 h-5 shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
            See details
          </button>
          {detailsOpen && (
            <div className="mt-6 bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
              <h2 className="px-6 py-3 text-base font-semibold text-blaster-fg border-b border-blaster-border">
                Feature comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blaster-border">
                      <th className="text-left px-6 py-3 text-blaster-muted font-medium">Feature</th>
                      {PLAN_COMPARISON.columns.map((col) => (
                        <th key={col} className="text-left px-6 py-3 text-blaster-fg font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_COMPARISON.rows.map((row) => (
                      <tr key={row.label} className="border-b border-blaster-border last:border-0">
                        <td className="px-6 py-3 text-blaster-muted">{row.label}</td>
                        {row.values.map((value, i) => (
                          <td key={PLAN_COMPARISON.columns[i]} className="px-6 py-3 text-blaster-fg">
                            <ComparisonCell value={value} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

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
        <p className="mt-2">© {new Date().getFullYear()} <Logo className="inline w-auto h-auto" />. All rights reserved.</p>
      </footer>
    </div>
  );
}
