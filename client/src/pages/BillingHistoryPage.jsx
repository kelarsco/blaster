import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CreditCard } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

function formatPrice(amountCents, interval) {
  const dollars = (amountCents / 100).toFixed(2);
  if (interval === 'annually') return `$${dollars}/yr`;
  return `$${dollars}/mo`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function BillingHistoryPage() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [extraCreditPaidCents, setExtraCreditPaidCents] = useState(0);

  useEffect(() => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    authFetch(`${API}/billing/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load history'))))
      .then((data) => {
        setSubscriptions(data.subscriptions || []);
        setExtraCreditPaidCents(data.extraCreditPaidCents ?? 0);
      })
      .catch((e) => setError(e?.message || 'Failed to load billing history'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const hasHistory = subscriptions.length > 0 || extraCreditPaidCents > 0;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <Link to="/app/account/billing" className="text-xs md:text-sm text-blaster-accent hover:underline mb-2 inline-block">← Back to billing</Link>
        <h1 className="page-title-mobile">Billing history</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">View past plan payments and extra credit</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 rounded bg-blaster-bg-app w-1/3" />
            <div className="h-10 rounded bg-blaster-bg-app" />
            <div className="h-10 rounded bg-blaster-bg-app" />
            <div className="h-10 rounded bg-blaster-bg-app" />
          </div>
        </section>
      ) : !hasHistory ? (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
          <div className="card-header-mobile flex items-center gap-2">
            <FileText className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Invoices & payments</h2>
          </div>
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-blaster-muted mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="text-blaster-muted">No billing history yet</p>
            <p className="text-sm text-blaster-muted mt-1">Plan payments and extra credit will appear here after you make a payment.</p>
            <Link to="/app/account/pricing" className="inline-block mt-4 text-blaster-accent hover:underline text-sm">
              View pricing plans
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {subscriptions.length > 0 && (
            <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
              <div className="card-header-mobile flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 border-b border-blaster-border">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
                <h2 className="card-title-mobile">Plan payments</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blaster-border text-left text-blaster-muted">
                      <th className="px-4 md:px-6 py-3 font-medium">Date</th>
                      <th className="px-4 md:px-6 py-3 font-medium">Plan</th>
                      <th className="px-4 md:px-6 py-3 font-medium">Period</th>
                      <th className="px-4 md:px-6 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 md:px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="border-b border-blaster-border/50 last:border-0">
                        <td className="px-4 md:px-6 py-3 text-blaster-fg">{formatDate(sub.createdAt)}</td>
                        <td className="px-4 md:px-6 py-3 text-blaster-fg">{sub.planName}</td>
                        <td className="px-4 md:px-6 py-3 text-blaster-muted">
                          {formatDate(sub.periodStart)} – {formatDate(sub.periodEnd)}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-blaster-fg text-right font-medium">
                          {formatPrice(sub.amount, sub.interval)}
                        </td>
                        <td className="px-4 md:px-6 py-3">
                          <span
                            className={
                              sub.status === 'active' || sub.status === 'trialing'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-blaster-muted'
                            }
                          >
                            {sub.status === 'active' ? 'Active' : sub.status === 'trialing' ? 'Trialing' : sub.status === 'cancelled' ? 'Cancelled' : sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {extraCreditPaidCents > 0 && (
            <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
              <div className="card-header-mobile flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 border-b border-blaster-border">
                <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
                <h2 className="card-title-mobile">Extra credit</h2>
              </div>
              <div className="p-4 md:p-6">
                <p className="text-sm text-blaster-fg">
                  Total extra credit paid: <span className="font-semibold">${(extraCreditPaidCents / 100).toFixed(2)}</span>
                </p>
                <p className="text-xs text-blaster-muted mt-1">Used for overage when you exceed plan limits (scans and email sends).</p>
                <Link to="/app/account/billing/extra-credit" className="inline-block mt-3 text-blaster-accent hover:underline text-sm">
                  Add extra credit →
                </Link>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
