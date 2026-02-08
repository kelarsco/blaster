import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { SlideInNotice } from '../components/SlideInNotice.jsx';

const THRESHOLDS = [10, 30, 50, 100];
const AMOUNT_CENTS = { 10: 1000, 30: 3000, 50: 5000, 100: 10000 };

export function BillingExtraCreditPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [notice, setNotice] = useState({ visible: false, message: '', title: 'Payment issue' });

  useEffect(() => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    authFetch(`${API}/billing/overview`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setOverview(d))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const plan = overview?.plan ?? { amount: 0 };
  const isFree = plan.amount === 0;

  useEffect(() => {
    if (!loading && isFree) {
      navigate('/app/account/billing', { replace: true });
    }
  }, [loading, isFree, navigate]);

  const extra = overview?.extraCredit ?? { owed: 0, nextThreshold: 10, blocked: false };
  const nextAmount = extra.nextThreshold;
  const amountCents = AMOUNT_CENTS[nextAmount] ?? 1000;

  const handlePay = () => {
    if (!authFetch) return;
    setPaying(nextAmount);
    try {
      sessionStorage.setItem('paystack-extra-amount', String(amountCents));
      sessionStorage.setItem('paystack-pending-reference', '');
    } catch (_) {}
    authFetch(`${API}/billing/extra-credit/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.authorizationUrl) {
          window.location.href = data.authorizationUrl;
          return;
        }
        setPaying(null);
        setNotice({ visible: true, message: data.error || 'Could not start payment', title: 'Payment issue' });
      })
      .catch((e) => {
        setPaying(null);
        setNotice({ visible: true, message: e?.message || 'Failed to start payment', title: 'Payment issue' });
      });
  };

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
        <Link to="/app/account/billing" className="text-xs md:text-sm text-blaster-accent hover:underline mb-2 inline-block">← Back to billing</Link>
        <h1 className="page-title-mobile">Extra credit</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Pay your extra credit balance to continue scanning and sending</p>
      </div>

      {loading || isFree ? (
        <div className="animate-pulse h-24 rounded-xl bg-blaster-border/40" />
      ) : (
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border p-6 max-w-lg">
          <p className="text-sm text-blaster-muted mb-2">Current balance</p>
          <p className="text-2xl font-bold text-blaster-fg mb-4">${extra.owed}</p>
          <p className="text-sm text-blaster-muted mb-4">
            Extra credits apply when you exceed your plan limits before the period ends: $1 per 500 extra scans and $1 per 300 extra email sends.
            Pay when you reach the limit to keep using scans and campaigns.
          </p>
          {extra.blocked ? (
            <>
              <p className="text-sm font-medium text-amber-600 mb-2">Pay ${nextAmount} to unlock</p>
              <button
                type="button"
                onClick={handlePay}
                disabled={paying !== null}
                className="w-full py-2.5 rounded-xl btn-blaster-accent font-medium disabled:opacity-50"
              >
                {paying !== null ? 'Redirecting…' : `Pay $${nextAmount}`}
              </button>
            </>
          ) : (
            <p className="text-sm text-blaster-muted">You have not reached the ${nextAmount} limit yet. Keep an eye on your usage on the billing overview.</p>
          )}
          <p className="text-xs text-blaster-muted mt-4">Limits: $10 → $30 → $50 → $100 max per period.</p>
        </section>
      )}
    </div>
  );
}
