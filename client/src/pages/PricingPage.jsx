import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, X, ChevronDown, Link2, Download, Mail, CreditCard } from 'react-feather';
import { Logo } from '../components/Logo.jsx';
import { MarketingHeader } from '../layout/MarketingHeader.jsx';
import {
  PLANS,
  TRIAL_PLAN,
  PLAN_COMPARISON,
  formatPriceNum,
  getDisplayPrice,
  getBillingPlanId,
  storeSelectedPlan,
} from '../data/plans';
import { usePageSeo } from '../utils/seo.js';

const PLAN_INCLUDES = [
  { label: 'Store URL scanner & email extraction', Icon: Link2 },
  { label: 'Export to Excel', Icon: Download },
  { label: 'Campaigns & templates', Icon: Mail },
  { label: 'Secure payment via Paystack', Icon: CreditCard },
];

function PrimaryPillButton({ children, className = '', as: Tag = 'button', ...props }) {
  const classes = `inline-flex items-center justify-center h-[53px] px-6 rounded-full bg-black border border-blaster-orange text-[#faf8f5] font-poppins font-medium text-base tracking-wide shadow-blaster-cta transition hover:opacity-90 ${className}`;
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}

function ComparisonCell({ value }) {
  if (value === true) {
    return <Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} />;
  }
  if (value === false) {
    return <X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} />;
  }
  return <span>{value}</span>;
}

function PlanCard({ plan, isAnnually, onChoose, featured }) {
  const display = getDisplayPrice(plan.price, isAnnually, plan.period);
  const isTrial = plan.period === 'trial';

  return (
    <div
      className={`bg-blaster-bg-card rounded-2xl border flex flex-col h-full relative overflow-hidden ${
        featured
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
          : isTrial
            ? 'border-black/20 ring-2 ring-black/5 shadow-md'
            : 'border-blaster-border shadow-md'
      }`}
    >
      {plan.tag && (
        <div className={`px-4 py-1.5 text-center ${isTrial ? 'bg-black' : 'bg-emerald-600'}`}>
          <span className="text-xs font-semibold text-white">{plan.tag}</span>
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-bold text-xl text-blaster-fg">{plan.name}</h3>
        <div className="mt-4 flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl sm:text-4xl font-bold text-blaster-fg">
            ${formatPriceNum(display.primary)}
          </span>
          <span className="text-blaster-muted text-sm">USD/{display.primaryLabel}</span>
        </div>
        {display.secondary != null && (
          <p className="text-xs text-blaster-muted mt-1">
            ~${formatPriceNum(display.secondary)}/mo billed annually
          </p>
        )}
        {plan.highlights?.length > 0 && (
          <ul className="mt-6 space-y-2.5 text-sm text-blaster-fg flex-1">
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
          onClick={() => onChoose(plan)}
          className={`w-full mt-6 py-3 rounded-xl text-sm font-semibold transition ${
            isTrial || !featured
              ? 'bg-black text-white hover:opacity-90'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isTrial ? 'Start for $1' : `Start ${plan.name}`}
        </button>
      </div>
    </div>
  );
}

export function PricingPage() {
  usePageSeo('pricing');
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
            Start with a $1 seven-day trial for full access, then pick a plan based on how many store searches you need each month.
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

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <PlanCard plan={TRIAL_PLAN} isAnnually={false} onChoose={handleChoosePlan} featured={false} />
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isAnnually={isAnnually}
              onChoose={handleChoosePlan}
              featured={plan.id === 'standard'}
            />
          ))}
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
          <ul className="mt-4 inline-flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-blaster-muted">
            {PLAN_INCLUDES.map(({ label, Icon }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-blaster-accent shrink-0" strokeWidth={2} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 max-w-[850px] mx-auto bg-white border border-[rgba(99,101,242,0.13)] rounded-[25px] shadow-step p-8 md:p-10 text-center">
          <h2 className="font-rubik text-2xl md:text-[32px] text-[#030303] leading-tight">Ready to scale your outreach?</h2>
          <p className="mt-3 font-poppins font-light text-base text-[#030303] leading-relaxed max-w-lg mx-auto">
            Create an account in under a minute. Try for $1 or pick a plan and complete payment securely with Paystack.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryPillButton as={Link} to="/signup">
              Create account
            </PrimaryPillButton>
            <Link
              to="/login"
              className="inline-flex items-center justify-center h-[45px] px-6 rounded-full border border-black font-medium text-base tracking-wide hover:bg-black/5 transition"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-10 px-4 sm:px-8 border-t border-blaster-border bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-blaster-muted">
          <Link to="/" className="shrink-0">
            <Logo className="!w-[100px]" />
          </Link>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/pricing" className="hover:text-black transition">
              Pricing
            </Link>
            <Link to="/login" className="hover:text-black transition">
              Login
            </Link>
            <Link to="/privacy" className="hover:text-black transition">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-black transition">
              Terms
            </Link>
          </div>
          <p className="text-center sm:text-right">© {new Date().getFullYear()} wiblaster</p>
        </div>
      </footer>
    </div>
  );
}
