import React, { useState, useEffect } from 'react';
import { Check, X } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { SlideInNotice } from '../components/SlideInNotice.jsx';
import {
  PLANS,
  MONTHS_BILLED_ANNUALLY,
  formatPriceNum,
  getDisplayPrice,
  storeSelectedPlan,
} from '../data/plans';

export function PricingPlansPage() {
  const { authFetch } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [subscription, setSubscription] = useState(null);
  const [subscribingPlanId, setSubscribingPlanId] = useState(null);
  const [notice, setNotice] = useState({ visible: false, message: '', title: null });
  const isAnnually = billingPeriod === 'annually';

  const showNotice = (message, title = 'Could not start subscription') => {
    setNotice({ visible: true, message, title });
  };

  useEffect(() => {
    authFetch(`${API}/billing/subscription`)
      .then((d) => setSubscription(d.subscription || null))
      .catch(() => setSubscription(null));
  }, [authFetch]);

  const handleSubscribe = async (plan) => {
    if (plan.customContact) {
      window.location.href = 'mailto:support@wiblaster.com?subject=Custom%20Plan%20Inquiry';
      return;
    }
    
    // Check if user already has an active subscription
    if (subscription && subscription.status === 'active' && subscription.planId !== 'free') {
      showNotice('You already have an active subscription. Go to Account Settings to manage your plan.');
      navigate('/app/account/settings/usage', { replace: true });
      return;
    }
    
    if (plan.id === 'trial_weekly') {
      // For weekly trial, use the weekly plan ID directly
      const planId = 'trial_weekly';
      setSubscribingPlanId(planId);
      try {
        const res = await authFetch(`${API}/billing/initialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.authorizationUrl) {
          if (data.reference) {
            try {
              sessionStorage.setItem('paystack-pending-reference', data.reference);
            } catch (_) {}
          }
          window.location.href = data.authorizationUrl;
          return;
        }
        throw new Error(data.error || 'Payment initialization failed');
      } catch (err) {
        showNotice(err.message || 'Failed to start subscription. Please try again.');
      } finally {
        setSubscribingPlanId(null);
      }
      return;
    }
    
    // For monthly/annual plans
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
        if (data.reference) {
          try {
            sessionStorage.setItem('paystack-pending-reference', data.reference);
          } catch (_) {}
        }
        window.location.href = data.authorizationUrl;
        return;
      }
      throw new Error(data.error || 'Payment initialization failed');
    } catch (err) {
      showNotice(err.message || 'Failed to start subscription. Please try again.');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const currentPlanId = subscription?.planId || null;
  const hasPaidSubscription = Boolean(currentPlanId && currentPlanId !== 'free');

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <SlideInNotice
        visible={notice.visible}
        message={notice.message}
        title={notice.title}
        type="error"
        onClose={() => setNotice((n) => ({ ...n, visible: false }))}
        autoDismissMs={8000}
      />
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
          (() => {
            const isFreeDisabledForSubscriber = plan.id === 'free' && hasPaidSubscription;
            return (
          <div
            key={plan.id}
            className={`bg-blaster-bg-card rounded-xl md:rounded-2xl border card-body-mobile relative ${
              plan.tag ? 'border-blaster-accent/50 ring-2 ring-blaster-accent/20' : 'border-blaster-border'
            } ${isFreeDisabledForSubscriber ? 'opacity-55 pointer-events-none select-none' : ''}`}
            aria-disabled={isFreeDisabledForSubscriber ? 'true' : 'false'}
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
                if (plan.id === 'trial_weekly') {
                  return (
                    <span className="text-xl md:text-2xl font-bold text-blaster-fg">$1/week trial*</span>
                  );
                }
                if (plan.customContact) {
                  return (
                    <span className="text-xl md:text-2xl font-bold text-blaster-fg">Contact for custom</span>
                  );
                }
                const display = getDisplayPrice(plan.price, isAnnually, plan.period);
                const showOriginal = plan.originalPrice != null && !isAnnually;
                if (showOriginal) {
                  return (
                    <>
                      <span className="text-blaster-muted line-through mr-2">${formatPriceNum(plan.originalPrice)}</span>
                      <span className="text-xl md:text-2xl font-bold text-blaster-fg">${formatPriceNum(display.primary)}</span>
                      <span className="text-blaster-muted text-sm">/{display.primaryLabel}*</span>
                    </>
                  );
                }
                return (
                  <>
                    <span className="text-xl md:text-2xl font-bold text-blaster-fg">${formatPriceNum(display.primary)}</span>
                    <span className="text-blaster-muted text-sm">/{display.primaryLabel}*</span>
                    {display.secondary != null && (
                      <span className="ml-1.5 text-blaster-muted text-xs">
                        (~${formatPriceNum(display.secondary)}/{display.secondaryLabel})
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
                  disabled={isFreeDisabledForSubscriber || (plan.id !== 'free' && subscribingPlanId != null)}
                  className="w-full py-2.5 rounded-xl btn-blaster-accent text-sm mb-4 disabled:opacity-50"
                >
                  {isFreeDisabledForSubscriber
                    ? 'Unavailable on active subscription'
                    : plan.customContact
                    ? 'Contact support'
                    : plan.id === 'free'
                    ? 'Start trial'
                    : (subscribingPlanId === planIdForCard ? 'Redirecting…' : 'Get this')}
                </button>
              );
            })()}
          </div>
            );
          })()
        ))}
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
        <h2 className="card-header-mobile font-semibold text-blaster-fg card-title-mobile">Feature comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blaster-border">
                <th className="text-left px-6 py-3 text-blaster-muted font-medium">Feature</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Free trial</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Essentials</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Standard</th>
                <th className="text-left px-6 py-3 text-blaster-fg font-medium">Custom</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Email sends per month</td>
                <td className="px-6 py-3 text-blaster-fg">200 total (trial)</td>
                <td className="px-6 py-3 text-blaster-fg">5,000</td>
                <td className="px-6 py-3 text-blaster-fg">50,000</td>
                <td className="px-6 py-3 text-blaster-fg">Contact for custom</td>
              </tr>
              <tr className="border-b border-blaster-border">
                <td className="px-6 py-3 text-blaster-muted">Store links extracted</td>
                <td className="px-6 py-3 text-blaster-fg">200 (48-hour trial)</td>
                <td className="px-6 py-3 text-blaster-fg">20,000</td>
                <td className="px-6 py-3 text-blaster-fg">100,000</td>
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
