import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { UpgradeActionModal, TrialUpgradeModal, isFreeUserAllowedRoute } from '../components/access/PlanAccessUI.jsx';
import '../styles/plan-access.css';

const PlanAccessContext = createContext(null);

const UPGRADE_PATH = '/app/account/pricing';

const DEFAULT_UPGRADE = {
  open: false,
  title: 'Upgrade required',
  message: 'Upgrade your plan to unlock this feature.',
  tierName: 'Growth',
  tierPrice: '$75/month',
};

export function PlanAccessProvider({ children }) {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [upgradeModal, setUpgradeModal] = useState(DEFAULT_UPGRADE);
  const [trialUpgradeOpen, setTrialUpgradeOpen] = useState(false);
  const [trialUpgrading, setTrialUpgrading] = useState(false);
  const [trialUpgradeError, setTrialUpgradeError] = useState('');
  const shownInitialRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !authFetch) {
      setStatus(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await authFetch(`${API}/user/plan-status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return data;
      }
    } catch (_) {}
    setLoading(false);
    return null;
  }, [user, authFetch]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const trialExpired = status?.trialExpired ?? false;

  const openTrialUpgradeModal = useCallback(() => {
    setTrialUpgradeError('');
    setTrialUpgradeOpen(true);
  }, []);

  const closeTrialUpgradeModal = useCallback(() => {
    if (trialUpgrading) return;
    setTrialUpgradeOpen(false);
    setTrialUpgradeError('');
  }, [trialUpgrading]);

  const goTrialUpgrade = useCallback(async () => {
    if (!authFetch || trialUpgrading) return;
    setTrialUpgradeError('');
    setTrialUpgrading(true);
    try {
      const res = await authFetch(`${API}/billing/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'trial_3day' }),
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
      throw new Error(data.error || 'Could not start payment');
    } catch (err) {
      setTrialUpgradeError(err?.message || 'Failed to start payment. Please try again.');
      setTrialUpgrading(false);
    }
  }, [authFetch, trialUpgrading]);

  useEffect(() => {
    if (loading || !trialExpired) return;

    if (!isFreeUserAllowedRoute(location.pathname)) {
      openTrialUpgradeModal();
      navigate('/app/dashboard', { replace: true });
      return;
    }

    if (location.pathname === '/app/dashboard' && !shownInitialRef.current) {
      shownInitialRef.current = true;
      openTrialUpgradeModal();
    }
  }, [loading, trialExpired, location.pathname, navigate, openTrialUpgradeModal]);

  useEffect(() => {
    if (!trialExpired) {
      shownInitialRef.current = false;
      setTrialUpgradeOpen(false);
    }
  }, [trialExpired]);

  const showToast = useCallback((message) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const openUpgradeModal = useCallback((opts = {}) => {
    const tier = status?.upgradeTierInfo?.[2] || { name: 'Growth', price: '$75/month' };
    setUpgradeModal({
      open: true,
      title: opts.title || 'Upgrade required',
      message: opts.message || 'Upgrade your plan to unlock this feature.',
      tierName: opts.tierName || tier.name,
      tierPrice: opts.tierPrice || tier.price,
    });
  }, [status]);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal((m) => ({ ...m, open: false }));
  }, []);

  const goUpgrade = useCallback(() => {
    closeUpgradeModal();
    navigate(UPGRADE_PATH);
  }, [closeUpgradeModal, navigate]);

  const recordFilterUse = useCallback(async () => {
    if (!authFetch) return { ok: false };
    const res = await authFetch(`${API}/user/plan-status/filter-use`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (data.status) setStatus(data.status);
    if (!res.ok) {
      if (data.error === 'filter_limit') {
        const limit = data.status?.filterLimit ?? 500;
        showToast(`You've reached your ${limit}-filter limit for this period.`);
      } else if (data.error === 'payg_cap') {
        showToast('You\'ve reached your pay-as-you-go limit. Upgrade to Pro for unlimited filters.');
      }
      return { ok: false, data };
    }
    return { ok: true, data };
  }, [authFetch, showToast]);

  const activatePayg = useCallback(async () => {
    if (!authFetch) return { ok: false };
    const res = await authFetch(`${API}/user/plan-status/activate-payg`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (data.status) setStatus(data.status);
    return { ok: res.ok, data };
  }, [authFetch]);

  const value = useMemo(
    () => ({
      status,
      loading,
      refresh,
      showToast,
      openUpgradeModal,
      openTrialUpgradeModal,
      closeTrialUpgradeModal,
      recordFilterUse,
      activatePayg,
      tier: status?.tier ?? 0,
      trialExpired,
      access: status?.access ?? null,
    }),
    [status, loading, refresh, showToast, openUpgradeModal, openTrialUpgradeModal, closeTrialUpgradeModal, recordFilterUse, activatePayg, trialExpired]
  );

  return (
    <PlanAccessContext.Provider value={value}>
      {children}
      <TrialUpgradeModal
        open={trialUpgradeOpen}
        onUpgrade={goTrialUpgrade}
        onClose={closeTrialUpgradeModal}
        loading={trialUpgrading}
        error={trialUpgradeError}
      />
      <UpgradeActionModal
        open={upgradeModal.open}
        title={upgradeModal.title}
        message={upgradeModal.message}
        tierName={upgradeModal.tierName}
        tierPrice={upgradeModal.tierPrice}
        onUpgrade={goUpgrade}
        onClose={closeUpgradeModal}
      />
      <div className="plan-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="plan-toast">{t.message}</div>
        ))}
      </div>
    </PlanAccessContext.Provider>
  );
}

export function usePlanAccess() {
  const ctx = useContext(PlanAccessContext);
  if (!ctx) throw new Error('usePlanAccess must be used within PlanAccessProvider');
  return ctx;
}
