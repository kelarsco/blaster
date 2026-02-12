import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { formatUTCDateOnly } from '../utils/dateUtils';

function formatPrice(amountCents, interval) {
  const dollars = (amountCents / 100).toFixed(2);
  if (interval === 'annually') return `$${dollars} per year`;
  return `$${dollars} per month`;
}

export function BillingOverviewPage() {
  const { authFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let reference = searchParams.get('reference');
    const paystackSuccess = searchParams.get('paystack') === 'success';
    const isExtraCredit = searchParams.get('extra') === '1';
    if (!reference && paystackSuccess && typeof sessionStorage !== 'undefined') {
      try {
        reference = sessionStorage.getItem('paystack-pending-reference');
        if (reference) sessionStorage.removeItem('paystack-pending-reference');
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
          }
        })
        .finally(() => {});
    }
  }, [searchParams, authFetch, setSearchParams]);

  const fetchOverview = useCallback(() => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      authFetch(`${API}/billing/overview`).then((r) => (r.ok ? r.json() : {})),
      authFetch(`${API}/billing/payment-methods`).then((r) => (r.ok ? r.json() : { cards: [] })),
    ])
      .then(([overviewData, paymentData]) => {
        setOverview(overviewData);
        setCards(paymentData.cards || []);
      })
      .catch((e) => {
        setError(e?.message || 'Failed to load billing');
        setOverview(null);
        setCards([]);
      })
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Refetch when tab becomes visible (e.g. after returning from Paystack or changing plan elsewhere)
  useEffect(() => {
    const onFocus = () => fetchOverview();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchOverview]);

  const plan = overview?.plan ?? { name: 'Free', amount: 0, interval: 'monthly', features: { emails: '500', senders: '1', scans: '1000' } };
  const usage = overview?.usage ?? { scansUsed: 0, scansLimit: 1000, sendersUsed: 0, sendersLimit: 1, emailsUsed: 0, emailsLimit: 500 };
  const extraCredit = overview?.extraCredit ?? { owed: 0, paidCents: 0, nextThreshold: 10, blocked: false };
  const isFree = plan.amount === 0;
  const scansRemaining = Math.max(0, (usage.scansLimit >= 999999 ? 999999 : usage.scansLimit) - (usage.scansUsed ?? 0));
  const sendersRemaining = Math.max(0, usage.sendersLimit >= 999 ? 999 : usage.sendersLimit - usage.sendersUsed);
  const emailsRemaining = Math.max(0, (usage.emailsLimit >= 999999 ? 999999 : usage.emailsLimit) - usage.emailsUsed);
  const scansPct = (usage.scansLimit > 0 && usage.scansLimit < 999999) ? (Math.min((usage.scansUsed ?? 0) / usage.scansLimit, 1) * 100) : 0;
  const sendersPct = usage.sendersLimit > 0 && usage.sendersLimit < 999 ? (usage.sendersUsed / usage.sendersLimit) * 100 : 0;
  const emailsPct = usage.emailsLimit > 0 && usage.emailsLimit < 999999 ? (usage.emailsUsed / usage.emailsLimit) * 100 : 0;
  const extraPct = extraCredit.nextThreshold > 0 ? Math.min(100, (extraCredit.owed / extraCredit.nextThreshold) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Usage</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Manage your usage</p>
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
                {loading ? '…' : `${plan.name} Plan`}
              </h2>
              <Link to="/app/account/billing/monthly-plan" className="text-xs md:text-sm text-blaster-accent hover:underline">Change Plan</Link>
            </div>
            <p className="text-xl md:text-2xl font-bold text-blaster-fg mb-3 md:mb-4">
              {loading ? '…' : formatPrice(plan.amount, plan.interval)}
            </p>
            {loading ? (
              <div className="space-y-4">
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
                <div className="h-2 rounded-full bg-blaster-bg-app animate-pulse" />
              </div>
            ) : (
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
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-blaster-bg-card rounded-2xl border border-blaster-border p-6">
            <h2 className="font-semibold text-blaster-fg mb-4">
              {isFree ? 'No upcoming bill' : 'Upcoming bill'}
            </h2>
            {loading ? (
              <p className="text-sm text-blaster-muted">Loading…</p>
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
                  <div className="flex justify-between font-medium pt-2 border-t border-blaster-border">
                    <span className="text-blaster-fg">Estimated total</span>
                    <span className="text-blaster-fg">${(plan.amount / 100).toFixed(2)}</span>
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
