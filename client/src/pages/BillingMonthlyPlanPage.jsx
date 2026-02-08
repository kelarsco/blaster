import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { formatUTCDateOnly } from '../utils/dateUtils';

export function BillingMonthlyPlanPage() {
  const { authFetch } = useAuth();
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

  const planName = subscription?.planName || 'Free';
  const planDetail = subscription
    ? `${subscription.interval === 'annually' ? 'Billed annually' : 'Billed monthly'} · Next billing ${formatUTCDateOnly(subscription.currentPeriodEnd) ?? '—'}`
    : '500 email sends per month · 1 seat';

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <Link to="/app/account/billing" className="text-xs md:text-sm text-blaster-accent hover:underline mb-2 inline-block">← Back to billing</Link>
        <h1 className="page-title-mobile">Monthly plan</h1>
        <p className="text-blaster-muted mt-0.5">Choose the plan that fits your outreach needs</p>
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile max-w-2xl">
        <h2 className="card-title-mobile mb-3 md:mb-4">Current plan</h2>
        {loading ? (
          <div className="py-4 text-blaster-muted text-sm">Loading…</div>
        ) : (
          <>
            <div className="flex items-center justify-between py-4 border-b border-blaster-border">
              <div>
                <p className="font-medium text-blaster-fg">{planName}</p>
                <p className="text-sm text-blaster-muted">{planDetail}</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">Active</span>
            </div>
            <p className="text-sm text-blaster-muted mt-4">Need more capacity? Upgrade to a paid plan for additional contacts and email sends.</p>
            <Link to="/app/account/pricing" className="inline-block mt-4 btn-blaster-accent text-sm">
              View pricing plans
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
