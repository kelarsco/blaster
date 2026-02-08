import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Trash2, X } from 'react-feather';
import { API } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { SlideInNotice } from '../components/SlideInNotice.jsx';

const DEACTIVATE_PHRASE = 'DEACTIVATE THIS ACCOUNT';

export function ManagePlanPage() {
  const { authFetch, logout } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState('');
  const [pauseSuccess, setPauseSuccess] = useState('');
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  useEffect(() => {
    if (!authFetch) {
      setLoading(false);
      return;
    }
    authFetch(`${API}/billing/subscription`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSubscription(d.subscription || null))
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const hasPaidPlan = subscription && (subscription.amount ?? 0) > 0;

  const handlePause = async () => {
    if (!authFetch || !hasPaidPlan) return;
    setPauseError('');
    setPauseLoading(true);
    try {
      const res = await authFetch(`${API}/billing/subscription/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPauseError(data.error || 'Failed to pause plan');
        return;
      }
      setSubscription(null);
      setPauseSuccess(data.message || 'Your plan has been paused.');
      setTimeout(() => setPauseSuccess(''), 5000);
    } catch (e) {
      setPauseError(e?.message || 'Failed to pause plan');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleDeactivateOpen = () => {
    setDeactivateModalOpen(true);
    setDeactivateConfirm('');
    setDeactivateError('');
  };

  const handleDeactivateClose = () => {
    if (deactivateLoading) return;
    setDeactivateModalOpen(false);
    setDeactivateConfirm('');
    setDeactivateError('');
  };

  const handleDeactivateSubmit = async (e) => {
    e.preventDefault();
    if (deactivateConfirm.trim() !== DEACTIVATE_PHRASE) return;
    if (!authFetch) return;
    setDeactivateError('');
    setDeactivateLoading(true);
    try {
      const res = await authFetch(`${API}/auth/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPhrase: deactivateConfirm.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeactivateError(data.error || 'Failed to deactivate account');
        setDeactivateLoading(false);
        return;
      }
      logout();
      window.location.href = '/login';
    } catch (e) {
      setDeactivateError(e?.message || 'Failed to deactivate account');
      setDeactivateLoading(false);
    }
  };

  const canDeactivate = deactivateConfirm.trim() === DEACTIVATE_PHRASE;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <SlideInNotice
        visible={!!pauseSuccess}
        message={pauseSuccess}
        type="success"
        title="Plan paused"
        onClose={() => setPauseSuccess('')}
        autoDismissMs={5000}
      />
      <div className="mb-6 md:mb-8">
        <Link to="/app/account/billing" className="text-xs md:text-sm text-blaster-accent hover:underline mb-2 inline-block">← Back to billing</Link>
        <h1 className="page-title-mobile">Manage my plan</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Upgrade, pause, or cancel your subscription</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Pause plan */}
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Pause className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Temporarily pause my plan</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-3 md:mb-4">
            When you pause your billing, you will still have access to your account and data, but you will not be able to send any emails. Billing stops immediately. You can resubscribe anytime from Pricing plans.
          </p>
          <p className="text-xs text-blaster-muted mb-4">Note: Plans can only be paused by stopping your subscription. You can resubscribe when ready.</p>
          {loading ? (
            <div className="h-10 rounded-xl bg-blaster-bg-app/80 animate-pulse" />
          ) : (
            <>
              <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-3 flex items-start gap-2 mb-4">
                <span className="text-blaster-muted">i</span>
                <p className="text-sm text-blaster-muted">
                  {hasPaidPlan ? `You can pause your ${subscription?.planName || 'paid'} plan below.` : 'Free plans cannot be paused.'}
                </p>
              </div>
              {pauseError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">{pauseError}</p>
              )}
              <button
                type="button"
                onClick={handlePause}
                disabled={!hasPaidPlan || pauseLoading}
                className="px-4 py-2 rounded-xl border border-blaster-border text-blaster-fg bg-blaster-bg-app hover:bg-blaster-border/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pauseLoading ? 'Pausing…' : 'Pause my plan'}
              </button>
            </>
          )}
        </section>

        {/* Deactivate account */}
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Deactivate my account</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-4 md:mb-6">
            Deactivating your account will revoke access immediately. Your data remains in our system but you will not be able to sign in. Contact support if you want to reactivate later.
          </p>
          <button
            type="button"
            onClick={handleDeactivateOpen}
            className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm transition"
          >
            Deactivate my account
          </button>
        </section>
      </div>

      {/* Deactivate confirmation modal */}
      {deactivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true" role="dialog">
          <div className="bg-blaster-bg-card rounded-2xl border border-blaster-border shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-blaster-border">
              <h3 className="font-semibold text-blaster-fg">Deactivate this account</h3>
              <button
                type="button"
                onClick={handleDeactivateClose}
                disabled={deactivateLoading}
                className="p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-bg-app focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
                aria-label="Close"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleDeactivateSubmit} className="p-4 md:p-6 space-y-4">
              <p className="text-sm text-blaster-muted">
                This will deactivate your account. You will be signed out and will not be able to sign in again until your account is reactivated by support. Your data is not deleted.
              </p>
              <p className="text-sm font-medium text-blaster-fg">Type the exact phrase below to confirm:</p>
              <p className="text-sm font-mono bg-blaster-bg-app px-3 py-2 rounded-lg border border-blaster-border text-amber-600 dark:text-amber-400">
                {DEACTIVATE_PHRASE}
              </p>
              <div>
                <input
                  type="text"
                  value={deactivateConfirm}
                  onChange={(e) => setDeactivateConfirm(e.target.value)}
                  placeholder="Paste or type the phrase above"
                  className="w-full px-4 py-2.5 rounded-lg border border-blaster-border bg-blaster-bg-app text-blaster-fg placeholder-blaster-muted focus:ring-2 focus:ring-blaster-accent/40 focus:border-blaster-accent"
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>
              {deactivateError && (
                <p className="text-sm text-red-600 dark:text-red-400">{deactivateError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeactivateClose}
                  disabled={deactivateLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-blaster-border text-blaster-fg hover:bg-blaster-bg-app transition text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canDeactivate || deactivateLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {deactivateLoading ? 'Deactivating…' : 'Deactivate account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
