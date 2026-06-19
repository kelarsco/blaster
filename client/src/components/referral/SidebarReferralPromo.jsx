import React, { useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, X } from 'react-feather';

const STORAGE_PREFIX = 'wiblaster-sidebar-referral-dismissed';

function UsersIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function isDismissed(userId) {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}-${userId}`) === '1';
  } catch {
    return false;
  }
}

export function SidebarReferralPromo({ userId, onNavigate }) {
  const [dismissed, setDismissed] = useState(() => isDismissed(userId));

  const handleDismiss = useCallback(() => {
    if (!userId) return;
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}-${userId}`, '1');
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  }, [userId]);

  if (!userId || dismissed) return null;

  return (
    <div className="sidebar-referral-promo bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-blaster-fg">
            <UsersIcon />
          </span>
          <p className="text-sm font-semibold text-blaster-fg">Refer a friend</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-0.5 rounded text-blaster-muted hover:text-blaster-fg hover:bg-gray-100 transition"
          aria-label="Dismiss referral promo"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
      <p className="text-xs leading-relaxed text-blaster-muted mb-3">
        Send a friend your referral link. When they sign up and upgrade to a paid plan, you unlock free Premium days.
      </p>
      <NavLink
        to="/app/referral"
        onClick={onNavigate}
        className="inline-flex items-center gap-0.5 text-xs font-medium text-blaster-fg hover:text-blaster-accent transition"
      >
        Get referral link
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.25} />
      </NavLink>
    </div>
  );
}
