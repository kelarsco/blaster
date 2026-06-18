import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { usePlanAccess } from '../context/PlanAccessContext.jsx';
import { API } from '../api.js';
import { formatUTCDateOnly } from '../utils/dateUtils';
import { getTrialRemainingMs } from '../utils/trialCountdown.js';
import { TrialCountdown } from '../components/access/TrialCountdown.jsx';
import { Logo } from '../components/Logo.jsx';

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/app/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { to: '/app/stores', label: 'Stores', icon: StoresIcon },
  { to: '/app/scanner', label: 'Scanner', icon: ScannerIcon },
  { to: '/app/campaigns', label: 'Campaigns', icon: CampaignsIcon },
  { to: '/app/templates', label: 'Templates', icon: TemplatesIcon },
  { to: '/app/senders', label: 'Senders', icon: SendersIcon },
  { to: '/app/resources', label: 'Resources', icon: ResourcesIcon },
  { to: '/app/referral', label: 'Referral', icon: ReferralIcon },
];

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function ScannerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
    </svg>
  );
}
function CampaignsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
function SendersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
function TemplatesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function ResourcesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function StoresIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function ReferralIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5 text-blaster-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg className="w-6 h-6 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 19h16l-1.2-9-4.3 3.5L12 5 9.5 13.5 5.2 10 4 19z" />
    </svg>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-blaster-border/60 ${className}`} />;
}

const DISCOUNT_START_KEY = 'wiblaster-discount-start';
const DISCOUNT_DAYS = 30;
const RENEWAL_WARNING_DAYS = 7;

function computePromoDaysLeft() {
  if (typeof window === 'undefined') return DISCOUNT_DAYS;
  try {
    const now = Date.now();
    let start = Number(window.localStorage.getItem(DISCOUNT_START_KEY));
    if (!start || Number.isNaN(start)) {
      start = now;
      window.localStorage.setItem(DISCOUNT_START_KEY, String(start));
    }
    const elapsedDays = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    const remaining = DISCOUNT_DAYS - elapsedDays;
    return remaining > 0 ? remaining : 0;
  } catch {
    return DISCOUNT_DAYS;
  }
}

function daysUntilDate(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((end - now) / msPerDay);
}

export function Sidebar({ loading, mobileOpen = false, onMobileClose }) {
  const { user, authFetch } = useAuth();
  const { status: planStatus } = usePlanAccess();
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [promoDaysLeft, setPromoDaysLeft] = useState(computePromoDaysLeft);
  const [now, setNow] = useState(() => Date.now());
  const [trialRemainingMs, setTrialRemainingMs] = useState(0);

  const trialEndsAt = planStatus?.trialEndsAt;
  const trialActive = planStatus?.trialActive;

  useEffect(() => {
    if (!trialEndsAt || !trialActive) {
      setTrialRemainingMs(0);
      return undefined;
    }
    const tick = () => setTrialRemainingMs(getTrialRemainingMs(trialEndsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trialEndsAt, trialActive]);
  const fetchSubscription = useCallback(() => {
    if (!user) {
      setSubscription(null);
      setSubscriptionLoaded(true);
      return;
    }
    
    // Use Railway API to fetch subscription
    authFetch(`${API}/billing/subscription`).then(async (res) => {
      if (!res.ok) {
        console.warn('Failed to fetch subscription:', res.statusText);
        setSubscription(null);
      } else {
        const data = await res.json();
        setSubscription(data.subscription);
      }
      setSubscriptionLoaded(true);
    });
  }, [user, authFetch]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchSubscription();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchSubscription]);

  useEffect(() => {
    const interval = setInterval(fetchSubscription, 180 * 1000); // 3 minutes instead of 90 seconds
    return () => clearInterval(interval);
  }, [fetchSubscription]);

  useEffect(() => {
    const interval = setInterval(() => setPromoDaysLeft(computePromoDaysLeft()), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const hasPaidPlan = subscription && subscription.planId && subscription.planId !== 'free';
  const periodEnd = subscription?.currentPeriodEnd;
  const daysUntilRenewal = useMemo(() => (periodEnd ? daysUntilDate(periodEnd) : null), [periodEnd, now]);
  const showRenewalCountdown = hasPaidPlan && daysUntilRenewal !== null && daysUntilRenewal <= RENEWAL_WARNING_DAYS && daysUntilRenewal >= 0;
  const renewalDueDate = periodEnd ? formatUTCDateOnly(periodEnd) : null;

  const freePlanTitle = trialActive ? 'Free trial' : 'Free';
  const showTrialCountdown = trialActive && trialEndsAt && trialRemainingMs > 0;
  const freePlanSubtitle = (() => {
    if (planStatus?.trialExpired) {
      return 'Trial ended · upgrade to continue';
    }
    if (promoDaysLeft > 0) {
      return `${promoDaysLeft} days left for 50% off`;
    }
    return 'Plans from $3.99/month';
  })();

  return (
    <>
      {/* Backdrop when sidebar is open on mobile */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === 'Escape' && onMobileClose()}
          className="md:hidden fixed inset-0 z-[60] bg-black/50 transition-opacity"
          aria-label="Close menu"
        />
      )}
      <aside
        className={`
          fixed left-0 top-0 z-[70] h-screen w-64 bg-blaster-sidebar border-r border-blaster-border flex flex-col overflow-y-auto
          transform transition-transform duration-300 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
      <div className="relative p-4 border-b border-blaster-border flex items-center justify-between min-h-[3.5rem]">
        <NavLink
          to="/app/dashboard"
          onClick={onMobileClose}
          className="hidden md:flex items-center gap-2 text-blaster-fg font-semibold text-lg"
        >
          <Logo />
        </NavLink>
        <button
          type="button"
          onClick={onMobileClose}
          className="md:hidden absolute right-3 top-3 flex items-center justify-center w-9 h-9 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-sidebar-hover transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {loading ? (
          <>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <Skeleton className="h-5 w-5 shrink-0" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </>
        ) : (
          <>
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={
                  to === '/app/dashboard' ||
                  to === '/app/analytics' ||
                  to === '/app/stores' ||
                  to === '/app/scanner' ||
                  to === '/app/campaigns' ||
                  to === '/app/templates' ||
                  to === '/app/senders' ||
                  to === '/app/resources'
                }
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blaster-sidebar-hover text-blaster-fg'
                      : 'text-blaster-muted hover:bg-blaster-sidebar-hover hover:text-blaster-fg'
                  }`
                }
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className="sidebar-plan-panel shrink-0 p-3 border-t border-blaster-border">
        {loading || !subscriptionLoaded ? (
          <div className="bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
            <Skeleton className="h-3 w-20 mb-3" />
            <div className="flex items-start gap-2 mb-3">
              <Skeleton className="h-5 w-5 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : showRenewalCountdown ? (
          <div className="bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
            <p className="text-xs text-blaster-muted mb-2">Renewal</p>
            <div className="flex items-start gap-2 mb-3">
              <ClockIcon />
              <div>
                <p className="text-sm font-semibold text-blaster-fg">
                  {daysUntilRenewal === 0
                    ? 'Renews today'
                    : daysUntilRenewal === 1
                      ? '1 day left'
                      : `${daysUntilRenewal} days left`}
                </p>
                <p className="text-xs text-blaster-muted">
                  {subscription?.planName} renews {renewalDueDate ? `on ${renewalDueDate}` : 'soon'}
                </p>
              </div>
            </div>
            <NavLink
              to="/app/account/billing"
              onClick={onMobileClose}
              className="block w-full py-2 rounded-lg bg-gray-100 text-blaster-fg font-medium text-sm hover:bg-gray-200 transition text-center"
            >
              Manage plan
            </NavLink>
          </div>
        ) : hasPaidPlan ? (
          <div className="bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <CrownIcon />
              <p className="text-sm font-semibold text-blaster-fg">{subscription?.planName ?? 'Premium'}</p>
            </div>
            <NavLink
              to="/app/account/billing"
              onClick={onMobileClose}
              className="block w-full py-2 rounded-lg bg-gray-100 text-blaster-fg font-medium text-sm hover:bg-gray-200 transition text-center"
            >
              Manage plan
            </NavLink>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-semibold text-blaster-fg">{freePlanTitle}</p>
            </div>
            {showTrialCountdown ? (
              <TrialCountdown
                ms={trialRemainingMs}
                trialEndsAt={trialEndsAt}
                size="sidebar"
                className="mb-2 block"
              />
            ) : (
              <p className="text-xs text-blaster-muted mb-2">{freePlanSubtitle}</p>
            )}
            <NavLink
              to="/app/account/pricing"
              onClick={onMobileClose}
              className="block w-full py-2 rounded-lg bg-gray-100 text-blaster-fg font-medium text-sm hover:bg-gray-200 transition text-center"
            >
              Upgrade
            </NavLink>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
