import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, RefreshCw } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { BillingBackLink, BillingPrimaryButton, BillingPrimaryLink } from '../components/billing/BillingBackLink.jsx';
import { PaymentMethodCard } from '../components/billing/PaymentMethodCard.jsx';

export function BillingInformationPage() {
  const auth = useAuth();
  const authFetch = auth?.authFetch;
  const [cards, setCards] = useState([]);
  const [canUpdateCard, setCanUpdateCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchPaymentMethods = () => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    authFetch(`${API}/billing/payment-methods`)
      .then((r) => r.json())
      .then((data) => {
        setCards(data.cards || []);
        setCanUpdateCard(Boolean(data.canUpdateCard));
      })
      .catch(() => {
        setCards([]);
        setCanUpdateCard(false);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPaymentMethods();
    const params = new URLSearchParams(window.location.search);
    if (params.get('updated') === '1') {
      setMessage('Your payment method was updated successfully.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [authFetch]);

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
        <BillingBackLink />
        <h1 className="page-title-mobile">Billing information</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">
          View and update the card used for your subscription
        </p>
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
          <div className="py-10 flex items-center justify-center text-blaster-muted">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" aria-hidden />
            <span className="text-sm">Loading payment methods…</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-4 md:p-5">
            <p className="text-sm font-medium text-blaster-fg mb-1">No payment method on file</p>
            <p className="text-xs text-blaster-muted mb-4">
              Add a card when you start your $1 trial or subscribe to a plan. Your card is saved securely with Paystack for renewals.
            </p>
            <BillingPrimaryLink to="/app/account/pricing">View plans</BillingPrimaryLink>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <PaymentMethodCard key={`${card.brand}-${card.last4}-${card.expMonth}`} card={card} />
            ))}

            {canUpdateCard ? (
              <div className="pt-1">
                <BillingPrimaryButton onClick={openUpdateCardLink} disabled={linkLoading}>
                  {linkLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                      Opening Paystack…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" aria-hidden />
                      Update card
                    </>
                  )}
                </BillingPrimaryButton>
                <p className="text-xs text-blaster-muted mt-2">
                  You&apos;ll be taken to Paystack&apos;s secure page to replace the card on your subscription.
                </p>
              </div>
            ) : (
              <p className="text-xs text-blaster-muted">
                This card is on file from your trial payment. When you upgrade to a monthly plan, you can update it here.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
