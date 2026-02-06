import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Lock, RefreshCw } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';

function formatBrand(brand) {
  if (!brand || brand === 'card') return 'Card';
  const s = String(brand).toLowerCase();
  if (s.includes('visa')) return 'Visa';
  if (s.includes('master')) return 'Mastercard';
  if (s.includes('verve')) return 'Verve';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BillingInformationPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchPaymentMethods = () => {
    setLoading(true);
    setError('');
    fetch(`${API}/billing/payment-methods`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setCards(data.cards || []);
      })
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPaymentMethods();
    const params = new URLSearchParams(window.location.search);
    if (params.get('updated') === '1') {
      setMessage('Your payment method was updated successfully.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const openUpdateCardLink = () => {
    if (!authFetch) return;
    setLinkLoading(true);
    setError('');
    setMessage('');
    authFetch(`${API}/billing/payment-methods/update-link`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.link) throw new Error(data.error || 'Could not open update page');
        window.location.href = data.link;
      })
      .catch((e) => {
        setError(e.message || 'Failed to open update page');
        setLinkLoading(false);
      });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <Link to="/app/account/billing" className="text-xs md:text-sm text-blaster-accent hover:underline mb-2 inline-block">← Back to billing</Link>
        <h1 className="page-title-mobile">Billing information</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">View and update the payment method used for your subscription</p>
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile max-w-xl">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
          <h2 className="card-title-mobile">Payment methods</h2>
        </div>

        <p className="text-xs text-blaster-muted mb-4 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Card details are stored and processed securely by Paystack. We never see or store your full card number.
        </p>

        {message && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{message}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

        {loading ? (
          <div className="py-8 flex items-center justify-center text-blaster-muted">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" aria-hidden />
            <span className="text-sm">Loading payment methods…</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-4 md:p-5">
            <p className="text-sm text-blaster-muted mb-3">No payment method on file.</p>
            <p className="text-xs text-blaster-muted mb-4">
              Subscribe to a paid plan to add a card. You can add or update your card from the billing plan page when you subscribe.
            </p>
            <Link
              to="/app/account/billing/monthly-plan"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800"
            >
              View plans
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card, index) => (
              <div
                key={index}
                className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-4 md:p-5 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 rounded bg-blaster-border/50 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blaster-muted" strokeWidth={2} aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium text-blaster-fg">
                      {formatBrand(card.brand)} •••• {card.last4}
                    </p>
                    <p className="text-xs text-blaster-muted mt-0.5">
                      {card.expMonth && card.expYear ? (
                        <>Expires {card.expMonth}/{String(card.expYear).slice(-2)}</>
                      ) : (
                        'Expiry on file'
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openUpdateCardLink}
                  disabled={linkLoading}
                  className="px-4 py-2 rounded-lg border border-blaster-border text-blaster-fg hover:bg-blaster-bg-app text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {linkLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                      Opening…
                    </>
                  ) : (
                    'Update card'
                  )}
                </button>
              </div>
            ))}

            <div className="pt-2">
              <button
                type="button"
                onClick={openUpdateCardLink}
                disabled={linkLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {linkLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                    Opening…
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" aria-hidden />
                    Add or change card
                  </>
                )}
              </button>
              <p className="text-xs text-blaster-muted mt-2">
                You’ll be taken to Paystack’s secure page to add a new card or update the one on file.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
