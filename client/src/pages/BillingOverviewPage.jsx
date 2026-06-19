import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { formatUTCDateOnly } from '../utils/dateUtils';

function formatPrice(amountCents, interval) {
  const dollars = (amountCents / 100).toFixed(2);
  if (interval === 'annually') return `$${dollars} per year`;
  return `$${dollars} per month`;
}

export function BillingOverviewPage() {
  const { authFetch } = useAuth();
  const { status: planStatus, refresh: refreshPlanStatus } = usePlanAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let reference = searchParams.get('reference') || searchParams.get('trxref');
    const paystackSuccess = searchParams.get('paystack') === 'success';
    const isExtraCredit = searchParams.get('extra') === '1';
    if (!reference && typeof sessionStorage !== 'undefined') {
      try {
        const pending = sessionStorage.getItem('paystack-pending-reference');
        if (pending && (paystackSuccess || searchParams.get('trxref'))) {
          reference = pending;
          sessionStorage.removeItem('paystack-pending-reference');
        }
      } catch (_) {}
    }
    if (reference && authFetch) {
      if (isExtraCredit && typeof sessionStorage !== 'undefined') {
        try {
          const amountCents = sessionStorage.getItem('paystack-extra-amount');
          if (amountCents) {
            sessionStorage.removeItem('paystack-extra-amount');
            authFetch(`${API}/billing/extra-credit/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference, amountCents: Number(amountCents) }),
            })
              .then((r) => r.json().catch(() => ({})))
              .then((data) => {
                if (data.ok) {
                  setSearchParams({}, { replace: true });
                  setTimeout(() => fetchOverview(), 100);
                }
              })
              .finally(() => {});
            return;
          }
        } catch (_) {}
      }
      authFetch(`${API}/billing/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      })
        .then((r) => r.json().catch(() => ({})))
        .then((data) => {
          if (data.ok) {
            setSearchParams({}, { replace: true });
            refreshPlanStatus();
          }
        })
        .finally(() => {});
    }
  }, [searchParams, authFetch, setSearchParams]);

  const fetchOverview = useCallback(({ silent = false } = {}) => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    Promise.all([
      authFetch(`${API}/billing/overview`).then((r) => (r.ok ? r.json() : {})),
      authFetch(`${API}/billing/payment-methods`).then((r) => (r.ok ? r.json() : { cards: [] })),
    ])
      .then(([overviewData, paymentData]) => {
        setOverview(overviewData);
        setCards(paymentData.cards || []);
        refreshPlanStatus();
      })
      .catch((e) => {
        setError(e?.message || 'Failed to load billing');
        setOverview(null);
        setCards([]);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [authFetch]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Refetch when tab becomes visible (e.g. after returning from Paystack or changing plan elsewhere)
  useEffect(() => {
    const onFocus = () => fetchOverview({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchOverview]);

  const hasData = Boolean(overview?.plan && overview?.usage);
  const plan = overview?.plan || null;
  const usage = overview?.usage || null;
  const extraCredit = overview?.extraCredit || { owed: 0, paidCents: 0, nextThreshold: 10, blocked: false };
  const showInitialLoading = loading && !hasData;
  const isFree = (plan?.amount ?? 0) === 0;
  const scansRemaining = usage ? Math.max(0, (usage.scansLimit >= 999999 ? 999999 : usage.scansLimit) - (usage.scansUsed ?? 0)) : 0;
  const sendersRemaining = usage ? Math.max(0, usage.sendersLimit >= 999 ? 999 : usage.sendersLimit - usage.sendersUsed) : 0;
  const emailsRemaining = usage ? Math.max(0, (usage.emailsLimit >= 999999 ? 999999 : usage.emailsLimit) - usage.emailsUsed) : 0;
  const scansPct = usage && (usage.scansLimit > 0 && usage.scansLimit < 999999) ? (Math.min((usage.scansUsed ?? 0) / usage.scansLimit, 1) * 100) : 0;
  const sendersPct = usage && usage.sendersLimit > 0 && usage.sendersLimit < 999 ? (usage.sendersUsed / usage.sendersLimit) * 100 : 0;
  const emailsPct = usage && usage.emailsLimit > 0 && usage.emailsLimit < 999999 ? (usage.emailsUsed / usage.emailsLimit) * 100 : 0;
  const extraPct = extraCredit.nextThreshold > 0 ? Math.min(100, (extraCredit.owed / extraCredit.nextThreshold) * 100) : 0;

  const filterUses = planStatus?.filterUses ?? 0;
  const filterLimit = planStatus?.filterLimit ?? 0;
  const filterPct =
    filterLimit > 0 && filterLimit < 999999 ? Math.min(100, (filterUses / filterLimit) * 100) : 0;
  const paygChargesCents = planStatus?.paygChargesCents ?? 0;
  const paygCapCents = planStatus?.paygCapCents ?? 1000;
  const paygPct = paygCapCents > 0 ? Math.min(100, (paygChargesCents / paygCapCents) * 100) : 0;
  const showFilterUsage = planStatus?.tier === 2;
  const showPaygUsage = planStatus?.paygActive || paygChargesCents > 0;
  const paygInvoiceCents = planStatus?.paygPendingInvoiceCents ?? paygChargesCents;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Usage</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          Manage your usage{refreshing ? ' (updating...)' : ''}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="card-title-mobile">
                {showInitialLoading ? '...' : `${plan?.name || 'Plan'} Plan`}
              </h2>
              <Link to="/app/account/billing/monthly-plan" className="text-xs md:text-sm text-blaster-accent hover:underline">Change Plan</Link>
            </div>
            <p className="text-xl md:text-2xl font-bold text-blaster-fg mb-3 md:mb-4">
              {showInitialLoading ? '...' : formatPrice(plan?.amount || 0, plan?.interval || 'monthly')}
            </p>
            {planStatus?.tierName && !showInitialLoading && (
              <p className="text-sm text-blaster-muted mb-3">
                Access tier: <span className="text-blaster-fg font-medium">{planStatus.tierName}</span>
                {planStatus.trialActive && planStatus.trialHoursRemaining > 0 && (
                  <span>
                    {' '}
                    · Trial ends in {Math.floor(planStatus.trialHoursRemaining)}h
                    {Math.floor((planStatus.trialHoursRemaining % 1) * 60)}m
                  </span>
                )}
              </p>
            )}
            {showInitialLoading ? (
              <div className="space-y-4">
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
              </div>
            ) : hasData ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blaster-muted">Stores scanned</span>
                    <span className="text-blaster-fg">
                      {usage.scansLimit >= 999999 ? `${usage.scansUsed ?? 0} scanned · Unlimited` : `${usage.scansUsed ?? 0} of ${usage.scansLimit} used · ${scansRemaining} remaining`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                    <div className="h-full bg-blaster-accent/40 rounded-full transition-[width]" style={{ width: `${Math.min(100, scansPct)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blaster-muted">Email sends</span>
                    <span className="text-blaster-fg">
                      {usage.emailsLimit >= 999999 ? `${usage.emailsUsed} sent · Unlimited` : `${usage.emailsUsed} of ${usage.emailsLimit} used · ${emailsRemaining} remaining`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                    <div className="h-full bg-blaster-accent/40 rounded-full transition-[width]" style={{ width: `${Math.min(100, emailsPct)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blaster-muted">Email senders</span>
                    <span className="text-blaster-fg">
                      {usage.sendersLimit >= 999 ? `${usage.sendersUsed} used · Unlimited` : `${usage.sendersUsed} of ${usage.sendersLimit} used · ${sendersRemaining} remaining`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                    <div className="h-full bg-blaster-accent/40 rounded-full transition-[width]" style={{ width: `${Math.min(100, sendersPct)}%` }} />
                  </div>
                </div>
                {showFilterUsage && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-blaster-muted">Store filter uses</span>
                      <span className="text-blaster-fg">
                        {filterUses} of {filterLimit} used this period
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                      <div className="h-full bg-blaster-accent/40 rounded-full transition-[width]" style={{ width: `${filterPct}%` }} />
                    </div>
                    <p className="text-xs text-blaster-muted mt-1">
                      Filter, copy, and export actions on the Stores page share this monthly limit.
                    </p>
                  </div>
                )}
                {showPaygUsage && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-blaster-muted">Pay-as-you-go filtering</span>
                      <span className="text-blaster-fg">
                        ${(paygChargesCents / 100).toFixed(2)} of ${(paygCapCents / 100).toFixed(2)} used
                        {planStatus?.paygActive ? ' · Active' : ''}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                      <div className="h-full bg-indigo-500/50 rounded-full transition-[width]" style={{ width: `${paygPct}%` }} />
                    </div>
                    <p className="text-xs text-blaster-muted mt-1">
                      $0.05 per filter use beyond {filterLimit}. Charges are added to your next subscription invoice.
                    </p>
                  </div>
                )}
                {!isFree && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-blaster-muted">Extra credit</span>
                      <span className="text-blaster-fg">${extraCredit.owed} of ${extraCredit.nextThreshold} limit</span>
                    </div>
                    <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                      <div className="h-full bg-amber-500/50 rounded-full transition-[width]" style={{ width: `${Math.min(100, extraPct)}%` }} />
                    </div>
                    <p className="text-xs text-blaster-muted mt-1">
                      $1 per 500 extra scans + $1 per 300 extra email sends when you exceed your plan before the period ends. Pay at limit to continue.
                    </p>
                    {extraCredit.blocked && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm">
                        Pay ${extraCredit.nextThreshold} to continue scanning and sending.
                        <Link to="/app/account/billing/extra-credit" className="block mt-1 font-medium text-blaster-accent hover:underline">Go to payment →</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-blaster-muted">Unable to load usage data right now. Please refresh.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-blaster-bg-card rounded-2xl border border-blaster-border p-6">
            <h2 className="font-semibold text-blaster-fg mb-4">
              {showInitialLoading ? 'Billing' : (isFree ? 'No upcoming bill' : 'Upcoming bill')}
            </h2>
            {showInitialLoading ? (
              <p className="text-sm text-blaster-muted">Loading…</p>
            ) : !hasData ? (
              <p className="text-sm text-blaster-muted">Billing details are currently unavailable.</p>
            ) : isFree ? (
              <>
                <p className="text-sm text-blaster-muted mb-4">You are on a Free plan, so you do not have any upcoming charges.</p>
                <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blaster-muted">{plan.name} plan</span>
                    <span className="text-blaster-fg">$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blaster-muted">Tax</span>
                    <span className="text-blaster-fg">$0.00</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t border-blaster-border">
                    <span className="text-blaster-fg">Estimated total</span>
                    <span className="text-blaster-fg">$0.00</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-blaster-muted mb-4">
                  {overview?.subscription?.currentPeriodEnd
                    ? `Your next billing date is ${formatUTCDateOnly(overview.subscription.currentPeriodEnd) ?? '—'}.`
                    : 'You will be charged according to your plan.'}
                </p>
                <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blaster-muted">{plan.name} plan</span>
                    <span className="text-blaster-fg">${(plan.amount / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blaster-muted">Tax</span>
                    <span className="text-blaster-fg">—</span>
                  </div>
                  {paygInvoiceCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blaster-muted">PAYG filtering (pending)</span>
                      <span className="text-blaster-fg">${(paygInvoiceCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-2 border-t border-blaster-border">
                    <span className="text-blaster-fg">Estimated total</span>
                    <span className="text-blaster-fg">
                      ${((plan.amount + paygInvoiceCents) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
