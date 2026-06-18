import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { SlideInNotice } from '../components/SlideInNotice.jsx';
import {
  PLANS,
  PLAN_COMPARISON,
  formatPriceNum,
  getDisplayPrice,
  getBillingPlanId,
  isPlanCurrentForUser,
  subscriptionPlanIdToTier,
} from '../data/plans';

function PlanPrice({ plan, isAnnually }) {
  if (plan.isFreeTrial) {
    return (
      <>
        <span className="text-xl md:text-2xl font-bold text-blaster-fg">Free</span>
        <span className="text-blaster-muted text-sm"> / 24 hours</span>
      </>
    );
  }

  const display = getDisplayPrice(plan.price, isAnnually, plan.period);
  return (
    <>
      <span className="text-xl md:text-2xl font-bold text-blaster-fg">${formatPriceNum(display.primary)}</span>
      <span className="text-blaster-muted text-sm">/{display.primaryLabel}</span>
      {display.secondary != null && (
        <span className="ml-1.5 text-blaster-muted text-xs">
          (~${formatPriceNum(display.secondary)}/{display.secondaryLabel})
        </span>
      )}
    </>
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

export function PricingPlansPage() {
  const navigate = useNavigate();
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
    const loadSubscription = () => {
      authFetch(`${API}/billing/subscription`)
        .then(async (res) => (res.ok ? res.json() : { subscription: null }))
        .then((d) => {
          const sub = d.subscription || null;
          setSubscription(sub);
          if (sub?.planId?.endsWith('_annual')) {
            setBillingPeriod('annually');
          } else if (sub?.planId && sub.planId !== 'free') {
            setBillingPeriod('monthly');
          }
        })
        .catch(() => setSubscription(null));
    };
    loadSubscription();
    window.addEventListener('focus', loadSubscription);
    return () => window.removeEventListener('focus', loadSubscription);
  }, [authFetch]);

  const handleSubscribe = async (plan) => {
    if (plan.isFreeTrial || plan.id === 'free') {
      navigate('/app/dashboard', { replace: true });
      return;
    }

    if (subscription && subscription.status === 'active' && subscription.planId !== 'free') {
      showNotice('You already have an active subscription. Go to Account Settings to manage your plan.');
      navigate('/app/account/settings/usage', { replace: true });
      return;
    }

    const planId = getBillingPlanId(plan, isAnnually);
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
  const currentTier = subscriptionPlanIdToTier(currentPlanId);
  const hasPaidSubscription = currentTier !== 'free' && currentTier != null;

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
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          Choose a plan that fits your outreach scale
        </p>

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
        {PLANS.map((plan) => {
          const planIdForCard = getBillingPlanId(plan, isAnnually);
          const isFreeDisabledForSubscriber = plan.isFreeTrial && hasPaidSubscription;
          const isCurrent = isPlanCurrentForUser(plan, currentPlanId);
          const intervalMatches =
            !currentPlanId ||
            currentPlanId === 'free' ||
            plan.isFreeTrial ||
            (currentPlanId.endsWith('_annual') ? isAnnually : !isAnnually);

          return (
            <div
              key={plan.id}
              className={`bg-blaster-bg-card rounded-xl md:rounded-2xl border card-body-mobile relative flex flex-col ${
                isCurrent
                  ? 'border-emerald-500/60 ring-2 ring-emerald-500/25'
                  : plan.tag
                    ? 'border-blaster-accent/50 ring-2 ring-blaster-accent/20'
                    : 'border-blaster-border'
              } ${isFreeDisabledForSubscriber ? 'opacity-55 pointer-events-none select-none' : ''}`}
              aria-disabled={isFreeDisabledForSubscriber ? 'true' : 'false'}
              aria-current={isCurrent ? 'true' : undefined}
            >
              {isCurrent && (
                <span className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-medium">
                  Current plan
                </span>
              )}
              {plan.tag && (
                <span className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-blaster-accent/20 text-blaster-accent text-xs font-medium">
                  {plan.tag}
                </span>
              )}
              <h3 className="card-title-mobile text-base md:text-lg">{plan.name}</h3>
              <p className="text-sm text-blaster-muted mt-2 mb-4">{plan.description}</p>
              <div className="mb-4">
                <PlanPrice plan={plan} isAnnually={isAnnually} />
              </div>
              {plan.highlights?.length > 0 && (
                <ul className="space-y-2 text-sm text-blaster-fg mb-4 flex-1">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {isCurrent ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                    <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                    Your current plan
                  </div>
                  {subscription?.planName && (
                    <p className="text-xs text-blaster-muted">
                      {subscription.planName}
                      {subscription.interval === 'annually' ? ' · billed annually' : subscription.interval === 'monthly' ? ' · billed monthly' : ''}
                      {!intervalMatches && !plan.isFreeTrial && (
                        <span className="text-blaster-muted"> · switch billing period above to match</span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isFreeDisabledForSubscriber || (!plan.isFreeTrial && subscribingPlanId != null)}
                  className="w-full py-2.5 rounded-xl btn-blaster-accent text-sm disabled:opacity-50"
                >
                  {isFreeDisabledForSubscriber
                    ? 'Unavailable on active subscription'
                    : plan.isFreeTrial
                      ? 'Start free trial'
                      : subscribingPlanId === planIdForCard
                        ? 'Redirecting…'
                        : 'Get this plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
        <h2 className="card-header-mobile font-semibold text-blaster-fg card-title-mobile">Feature comparison</h2>
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
      </section>
    </div>
  );
}
