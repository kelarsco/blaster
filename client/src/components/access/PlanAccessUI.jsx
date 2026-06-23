import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, X } from 'react-feather';
import { Logo } from '../Logo.jsx';
import { getTrialRemainingMs } from '../../utils/trialCountdown.js';
import { TrialCountdown } from './TrialCountdown.jsx';

const UPGRADE_PATH = '/app/account/pricing';

/** Routes where users without a plan can go to upgrade or manage billing. */
export function isPlanUpgradeRoute(pathname) {
  if (!pathname) return false;
  if (pathname === UPGRADE_PATH || pathname.startsWith(`${UPGRADE_PATH}/`)) return true;
  if (pathname.startsWith('/app/account/billing')) return true;
  if (pathname.startsWith('/app/account/settings/usage')) return true;
  if (pathname.startsWith('/app/account/settings/manage-plan')) return true;
  return false;
}

export function isFreeUserHomeRoute(pathname) {
  return pathname === '/app/dashboard';
}

export function isFreeUserAllowedRoute(pathname) {
  return isFreeUserHomeRoute(pathname) || isPlanUpgradeRoute(pathname);
}

export function FeatureLockWrap({ locked, message, children, className = '' }) {
  if (!locked) return children;
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div className="pointer-events-none select-none opacity-50 blur-[1px]">{children}</div>
      <FeatureLockOverlay message={message} className="absolute inset-0 z-10" minHeight="100%" />
    </div>
  );
}

export function FeatureLockOverlay({ message, className = '', minHeight = '12rem' }) {
  return (
    <div
      className={`plan-lock-overlay ${className}`}
      style={{ minHeight }}
      role="region"
      aria-label="Upgrade required"
    >
      <div className="plan-lock-blur" aria-hidden />
      <div className="plan-lock-card">
        <div className="plan-lock-icon-wrap">
          <Lock className="w-5 h-5" strokeWidth={2} />
        </div>
        <p className="plan-lock-message">{message}</p>
        <Link to={UPGRADE_PATH} className="plan-lock-cta">
          Upgrade Plan
        </Link>
      </div>
    </div>
  );
}

export function TrialUpgradeModal({ open, onUpgrade, onClose, loading = false, error = '' }) {
  if (!open) return null;

  return (
    <div className="plan-upgrade-modal-root" role="dialog" aria-modal="true" aria-labelledby="trial-upgrade-title">
      <div className="plan-upgrade-modal-backdrop" aria-hidden onClick={loading ? undefined : onClose} />
      <div className="plan-upgrade-modal-card relative">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition disabled:opacity-40"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
        <div className="plan-lock-icon-wrap mx-auto mb-4">
          <Lock className="w-6 h-6" strokeWidth={2} />
        </div>
        <h2 id="trial-upgrade-title" className="text-xl font-semibold text-blaster-fg text-center">
          Upgrade to free trial
        </h2>
        <p className="text-sm text-blaster-muted mt-2 text-center max-w-md mx-auto">
          Start your $1 seven-day trial for full platform access — scanner, stores, campaigns, and more.
        </p>
        {error ? (
          <p className="text-sm text-red-600 mt-3 text-center">{error}</p>
        ) : null}
        <button
          type="button"
          className="plan-lock-cta mt-6 w-full justify-center disabled:opacity-50"
          onClick={onUpgrade}
          disabled={loading}
        >
          {loading ? 'Redirecting to Paystack…' : 'Upgrade now'}
        </button>
      </div>
    </div>
  );
}

export function TrialExpiredWall() {
  return null;
}

export function TrialBanner({ trialEndsAt }) {
  const [remainingMs, setRemainingMs] = useState(() => getTrialRemainingMs(trialEndsAt));

  useEffect(() => {
    if (!trialEndsAt) return undefined;
    const tick = () => setRemainingMs(getTrialRemainingMs(trialEndsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trialEndsAt]);

  if (!trialEndsAt) return null;

  return (
    <div className="plan-trial-banner">
      <span>
        {remainingMs > 0 ? (
          <>
            Your trial expires in{' '}
            <TrialCountdown ms={remainingMs} trialEndsAt={trialEndsAt} className="plan-trial-countdown" size="banner" />
            .
          </>
        ) : (
          'Your free trial is ending soon.'
        )}
      </span>
      <Link to="/app/account/pricing" className="plan-trial-banner-link">
        Upgrade now
      </Link>
    </div>
  );
}

export function MiniLockIcon({ tooltip = 'Upgrade to unlock' }) {
  return (
    <span className="plan-mini-lock" title={tooltip} aria-label={tooltip}>
      <Lock className="w-4 h-4" strokeWidth={2} />
    </span>
  );
}

export function UpgradeActionModal({
  open,
  title,
  message,
  tierName,
  tierPrice,
  onUpgrade,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="plan-upgrade-modal-root" role="dialog" aria-modal="true">
      <div className="plan-upgrade-modal-backdrop" aria-hidden />
      <div className="plan-upgrade-modal-card">
        <Logo className="h-7 w-auto mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-blaster-fg text-center">{title}</h2>
        <p className="text-sm text-blaster-muted mt-2 text-center">{message}</p>
        {tierName && (
          <p className="text-center mt-4 text-sm font-medium text-blaster-fg">
            {tierName}
            {tierPrice && <span className="text-blaster-muted"> · {tierPrice}</span>}
          </p>
        )}
        <div className="flex flex-col gap-2 mt-6">
          <button type="button" className="plan-lock-cta w-full justify-center" onClick={onUpgrade}>
            Upgrade Now
          </button>
          <button type="button" className="plan-upgrade-secondary" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaygConfirmModal({ open, onConfirm, onCancel, loading }) {
  if (!open) return null;

  return (
    <div className="plan-upgrade-modal-root" role="dialog" aria-modal="true">
      <div className="plan-upgrade-modal-backdrop" aria-hidden />
      <div className="plan-upgrade-modal-card">
        <h2 className="text-lg font-semibold text-blaster-fg text-center">Activate pay-as-you-go searches</h2>
        <p className="text-sm text-blaster-muted mt-2 text-center">
          After your included store searches, each additional search costs <strong>$0.01</strong> (100 searches = $1).
          Charges are capped per billing cycle and added to your next invoice.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button
            type="button"
            className="plan-lock-cta w-full justify-center"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Activating…' : 'Confirm & activate PAYG'}
          </button>
          <button type="button" className="plan-upgrade-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
