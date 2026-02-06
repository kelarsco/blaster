import React, { useState, useEffect } from 'react';
import { Check, X } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tag: null,
    description:
      'All the basics to test wiblaster and validate results. Built for founders and small teams getting started with store discovery and cold outreach.',
    price: 0,
    originalPrice: null,
    period: 'month',
    current: true,
    features: {
      emails: '500',
      users: '1 seat',
      audiences: '1 audience',
      support: 'Email (limited)',
      onboarding: false,
      ai: false,
    },
  },
  {
    id: 'essentials',
    name: 'Essentials',
    tag: null,
    description:
      'Reliable outreach for early-stage growth. Designed for solo operators and agencies beginning consistent outreach.',
    // 50% off monthly: original $30 → $15
    price: 15,
    originalPrice: 30,
    period: 'month',
    current: false,
    features: {
      emails: '5,000',
      users: '3 seats',
      audiences: '3 audiences',
      support: '24/7 email & chat support',
      onboarding: false,
      ai: false,
    },
  },
  {
    id: 'standard',
    name: 'Standard',
    tag: 'Best value',
    description:
      'Scale outreach with control, personalization, and automation. Built for serious outreach workflows that need stability and performance.',
    // 50% off monthly: original $70 → $35
    price: 35,
    originalPrice: 70,
    period: 'month',
    current: false,
    features: {
      emails: '15,000',
      users: '5 seats',
      audiences: '5 audiences',
      support: '24/7 email & chat support',
      onboarding: '1 session',
      ai: true,
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    tag: null,
    description:
      'High-volume outreach for teams and power users. Built for agencies and teams running large-scale cold email operations.',
    // 50% off monthly: original $320 → $160
    price: 160,
    originalPrice: 320,
    period: 'month',
    current: false,
    features: {
      emails: '150,000',
      users: 'Unlimited',
      audiences: 'Unlimited',
      support: 'Phone + priority support',
      onboarding: '4 sessions',
      ai: true,
    },
  },
];

// 2 months free = pay 10 months, get 12
const MONTHS_BILLED_ANNUALLY = 10;

function getDisplayPrice(monthlyPrice, isAnnually) {
  if (isAnnually && monthlyPrice > 0) {
    const totalAnnual = monthlyPrice * MONTHS_BILLED_ANNUALLY;
    const effectivePerMonth = totalAnnual / 12;
    return {
      primary: totalAnnual,
      primaryLabel: 'year',
      secondary: effectivePerMonth,
      secondaryLabel: 'mo',
    };
  }
  return {
    primary: monthlyPrice,
    primaryLabel: 'month',
    secondary: null,
    secondaryLabel: null,
  };
}

const PLAN_KEY = 'wiblaster-plan';

function storeSelectedPlan(planId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAN_KEY, planId);
  } catch (_) {
    // ignore
  }
}

export function PricingPlansPage() {
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [subscription, setSubscription] = useState(null);
  const [subscribingPlanId, setSubscribingPlanId] = useState(null);
  const isAnnually = billingPeriod === 'annually';

  useEffect(() => {
    fetch(`${API}/billing/subscription`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSubscription(d.subscription || null))
      .catch(() => setSubscription(null));
  }, []);

  const handleSubscribe = async (plan) => {
    if (plan.id === 'free') {
      storeSelectedPlan(plan.id);
      return;
    }
    const planId = isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
    setSubscribingPlanId(planId);
    try {
      const res = await authFetch(`${API}/billing/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      if (!res.ok) {
        const msg = data.error || 'Could not start subscription.';
        alert(msg.includes('Invalid Amount') ? 'Payment setup is updating. Please try again in a moment or contact support.' : msg);
      }
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const currentPlanId = subscription?.planId || null;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Pricing plans</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Choose the plan that fits your outreach scale</p>

        {/* Monthly / Annually toggle with 2 months free badge */}
        <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2 md:gap-3">
          <span
            className={`text-xs md:text-sm font-medium transition-colors ${!isAnnually ? 'text-blaster-fg' : 'text-blaster-muted'}`}
          >
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAnnually}
            onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'annually' : 'monthly'))}
            className="relative inline-flex h-6 w-10 md:h-7 md:w-12 shrink-0 rounded-full border border-blaster-border bg-blaster-bg-app transition-colors focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:ring-offset-2"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 md:h-5 md:w-5 rounded-full bg-blaster-fg shadow-sm transition-transform mt-0.5 ml-0.5 ${
                isAnnually ? 'translate-x-[22px] md:translate-x-[26px]' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5 md:gap-2">
            <span
              className={`text-xs md:text-sm font-medium transition-colors ${isAnnually ? 'text-blaster-fg' : 'text-blaster-muted'}`}
            >
              Annually
            </span>
            <span className="relative inline-flex items-center rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-2 py-0.5 md:px-2.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              2 months free
              <svg className="absolute -bottom-1 left-1.5 md:left-2 w-2.5 h-1.5 md:w-3 md:h-2 text-emerald-600" viewBox="0 0 12 8" fill="currentColor" aria-hidden>
                <path d="M6 8L0 0h4l2 4 2-4h4L6 8z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`bg-blaster-bg-card rounded-xl md:rounded-2xl border card-body-mobile relative ${plan.tag ? 'border-blaster-accent/50 ring-2 ring-blaster-accent/20' : 'border-blaster-border'}`}
          >
            {plan.tag && (
              <span className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-blaster-accent/20 text-blaster-accent text-xs font-medium">
                {plan.tag}
              </span>
            )}
            <h3 className="card-title-mobile text-base md:text-lg">{plan.name}</h3>
            <p className="text-sm text-blaster-muted mt-2 mb-4">{plan.description}</p>
            <div className="mb-4">
              {(() => {
                const display = getDisplayPrice(plan.price, isAnnually);
                const showOriginal = plan.originalPrice != null && !isAnnually;
                if (showOriginal) {
                  return (
                    <>
                      <span className="text-blaster-muted line-through mr-2">${plan.originalPrice}</span>
                      <span className="text-xl md:text-2xl font-bold text-blaster-fg">${display.primary}</span>
                      <span className="text-blaster-muted text-sm">/{display.primaryLabel}*</span>
                    </>
                  );
                }
                return (
                  <>
                    <span className="text-xl md:text-2xl font-bold text-blaster-fg">${display.primary}</span>
                    <span className="text-blaster-muted text-sm">/{display.primaryLabel}*</span>
                    {display.secondary != null && (
                      <span className="ml-1.5 text-blaster-muted text-xs">
                        (~${Number.isInteger(display.secondary) ? display.secondary : display.secondary.toFixed(2)}/{display.secondaryLabel})
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
            {(() => {
              const planIdForCard = plan.id === 'free' ? 'free' : (isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`);
              const isCurrent = plan.id === 'free' ? !currentPlanId || currentPlanId === 'free' : currentPlanId === planIdForCard;
              return isCurrent ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm mb-4">
                  <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  Your current plan
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan)}
                  disabled={plan.id !== 'free' && subscribingPlanId != null}
                  className="w-full py-2.5 rounded-xl btn-blaster-accent text-sm mb-4 disabled:opacity-50"
                >
                  {plan.id === 'free'
                    ? 'Get this'
                    : (subscribingPlanId === planIdForCard ? 'Redirecting…' : 'Get this')}
                </button>
              );
            })()}
          </div>
        ))}
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
        <h2 className="card-header-mobile font-semibold text-blaster-fg card-title-mobile">Feature comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blaster-border">
                <th className="text-left px-6 py-3 text-blaster-muted font-medium">Feature</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Free</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Essentials</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Standard</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Weekly email sends</td>
                <td className="px-6 py-3 text-blaster-fg">500 total</td>
                <td className="px-6 py-3 text-blaster-fg">5,000</td>
                <td className="px-6 py-3 text-blaster-fg">15,000</td>
                <td className="px-6 py-3 text-blaster-fg">150,000</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Store links extracted</td>
                <td className="px-6 py-3 text-blaster-fg">1,000</td>
                <td className="px-6 py-3 text-blaster-fg">10,000</td>
                <td className="px-6 py-3 text-blaster-fg">30,000</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Email senders</td>
                <td className="px-6 py-3 text-blaster-fg">1 SMTP sender</td>
                <td className="px-6 py-3 text-blaster-fg">Up to 3</td>
                <td className="px-6 py-3 text-blaster-fg">Up to 7</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Campaigns</td>
                <td className="px-6 py-3 text-blaster-fg">1 active</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited concurrent</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Recipients source</td>
                <td className="px-6 py-3 text-blaster-fg">Scan results only</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Sender rotation</td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                <td className="px-6 py-3 text-blaster-fg">Advanced</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Campaign presets</td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Delay controls</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">Basic</td>
                <td className="px-6 py-3 text-blaster-fg">Min/max randomization</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">One-email-per-store</td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Exports</td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3 text-blaster-fg">Excel (.xlsx)</td>
                <td className="px-6 py-3 text-blaster-fg">Advanced (custom fields)</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Users</td>
                <td className="px-6 py-3 text-blaster-fg">1 seat</td>
                <td className="px-6 py-3 text-blaster-fg">3 seats</td>
                <td className="px-6 py-3 text-blaster-fg">5 seats</td>
                <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Personalized onboarding</td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3 text-blaster-fg">1 session</td>
                <td className="px-6 py-3 text-blaster-fg">4 sessions</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Advanced retry & error recovery</td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Activity logs & monitoring</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">—</td>
                <td className="px-6 py-3 text-blaster-fg">Full access</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-blaster-muted">Customer support</td>
                <td className="px-6 py-3 text-blaster-fg">Email (limited)</td>
                <td className="px-6 py-3 text-blaster-fg">24/7 email & chat</td>
                <td className="px-6 py-3 text-blaster-fg">24/7 email & chat</td>
                <td className="px-6 py-3 text-blaster-fg">Phone + priority</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
