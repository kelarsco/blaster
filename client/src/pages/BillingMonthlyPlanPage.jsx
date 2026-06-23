import React, { useState, useEffect, useMemo } from 'react';
import { Check } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { formatUTCDateOnly } from '../utils/dateUtils';
import { isTrialPlanId } from '../data/plans.js';
import { BillingBackLink, BillingPrimaryLink, BillingOutlineLink } from '../components/billing/BillingBackLink.jsx';

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatSearchLimit(limit) {
  if (!limit || limit >= 999999) return 'Unlimited store searches';
  return `${limit.toLocaleString()} store searches / month`;
}

function planHighlights(planId, filterLimit) {
  const base = ['Full platform access', 'Unlimited scans & campaigns'];
  if (isTrialPlanId(planId)) {
    return [...base, 'Unlimited store searches during trial'];
  }
  if (!planId || planId === 'free') {
    return ['Subscribe to unlock scanner, stores, and campaigns'];
  }
  return [...base, formatSearchLimit(filterLimit)];
}

export function BillingMonthlyPlanPage() {
  const { authFetch } = useAuth();
  const { status: planStatus, loading: planLoading } = usePlanAccess();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authFetch) return;
    authFetch(`${API}/billing/subscription`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSubscription(d.subscription || null))
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const planId = subscription?.planId;
  const isTrial = isTrialPlanId(planId) || planStatus?.trialActive;
  const isPaid = subscription && (subscription.amount ?? 0) > 0 && !isTrial;
  const hasAccess = Boolean(subscription) || (planStatus?.tier != null && !planStatus?.trialExpired);

  const planName = useMemo(() => {
    if (subscription?.planName) return subscription.planName;
    if (planStatus?.tierName) return planStatus.tierName;
    return 'No active plan';
  }, [subscription, planStatus]);

  const priceLabel = useMemo(() => {
    if (!subscription) return null;
    if (isTrial) return `${formatMoney(subscription.amount || 100)} · 7-day trial`;
    if ((subscription.amount ?? 0) === 0) return 'Free';
    if (subscription.interval === 'annually') {
      return `${formatMoney(subscription.amount)} / year`;
    }
    return `${formatMoney(subscription.amount)} / month`;
  }, [subscription, isTrial]);

  const periodLabel = useMemo(() => {
    if (!subscription?.currentPeriodEnd) return null;
    const end = formatUTCDateOnly(subscription.currentPeriodEnd);
    if (isTrial) return `Trial ends ${end ?? '—'}`;
    if (isPaid) {
      const billing = subscription.interval === 'annually' ? 'Annual billing' : 'Monthly billing';
      return `${billing} · Next charge ${end ?? '—'}`;
    }
    return `Access until ${end ?? '—'}`;
  }, [subscription, isTrial, isPaid]);

  const filterLimit = planStatus?.filterLimit ?? 0;
  const highlights = planHighlights(planId, filterLimit);

  const statusBadge = useMemo(() => {
    if (!hasAccess) return { label: 'Inactive', className: 'bg-gray-100 text-gray-600' };
    if (isTrial) return { label: 'Trial active', className: 'bg-amber-100 text-amber-800' };
    return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
  }, [hasAccess, isTrial]);

  const showLoading = loading || planLoading;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <BillingBackLink />
        <h1 className="page-title-mobile">Your plan</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          Manage your subscription and see what&apos;s included
        </p>
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile max-w-2xl">
        <h2 className="card-title-mobile mb-3 md:mb-4">Current plan</h2>
        {showLoading ? (
          <div className="py-6 text-blaster-muted text-sm">Loading…</div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 py-4 border-b border-blaster-border">
              <div className="min-w-0">
                <p className="font-semibold text-lg text-blaster-fg">{planName}</p>
                {priceLabel && (
                  <p className="text-sm font-medium text-blaster-fg mt-0.5">{priceLabel}</p>
                )}
                {periodLabel && (
                  <p className="text-sm text-blaster-muted mt-1">{periodLabel}</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium shrink-0 ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>

            <ul className="mt-4 space-y-2.5">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-blaster-fg">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {planStatus?.filterUses != null && filterLimit > 0 && filterLimit < 999999 && (
              <p className="text-xs text-blaster-muted mt-4">
                Store searches this period: {planStatus.filterUses.toLocaleString()} of {filterLimit.toLocaleString()} used
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <BillingPrimaryLink to="/app/account/pricing">
                {hasAccess && !isTrial ? 'Change plan' : 'View pricing plans'}
              </BillingPrimaryLink>
              {hasAccess && (
                <BillingOutlineLink to="/app/account/billing/information">
                  Payment methods
                </BillingOutlineLink>
              )}
            </div>

            {!hasAccess && (
              <p className="text-sm text-blaster-muted mt-4">
                Start with a $1 seven-day trial for full access, or choose Basic, Growth, or Pro based on how many store searches you need.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
