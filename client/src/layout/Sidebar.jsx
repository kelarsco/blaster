import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/app/scanner', label: 'Scanner', icon: ScannerIcon },
  { to: '/app/campaigns', label: 'Campaigns', icon: CampaignsIcon },
  { to: '/app/senders', label: 'Senders', icon: SendersIcon },
  { to: '/app/settings', label: 'Scan settings', icon: SettingsIcon },
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
function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
const PLAN_KEY = 'wiblaster-plan';

function getStoredPlanId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PLAN_KEY);
  } catch {
    return null;
  }
}

function computeDaysLeft() {
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

export function Sidebar({ loading, onOpenActivity, mobileOpen = false, onMobileClose }) {
  const [planId] = React.useState(() => getStoredPlanId());
  const [daysLeft] = React.useState(() => computeDaysLeft());

  const hasPaidPlan = planId && planId !== 'free';

  return (
    <>
      {/* Backdrop when sidebar is open on mobile */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === 'Escape' && onMobileClose()}
          className="md:hidden fixed inset-0 z-20 bg-black/50 transition-opacity"
          aria-label="Close menu"
        />
      )}
      <aside
        className={`
          fixed left-0 top-0 z-20 h-screen w-64 bg-blaster-sidebar border-r border-blaster-border flex flex-col overflow-y-auto
          transform transition-transform duration-300 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
      <div className="p-4 border-b border-blaster-border">
        <NavLink to="/app/dashboard" onClick={onMobileClose} className="flex items-center gap-2 text-blaster-fg font-semibold text-lg">
          <span className="text-blaster-accent">⚡</span>
          wiblaster
        </NavLink>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {loading ? (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
                end={to === '/app/dashboard' || to === '/app/scanner' || to === '/app/campaigns' || to === '/app/senders' || to === '/app/settings'}
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
            {onOpenActivity && (
              <button
                type="button"
                onClick={() => { onOpenActivity?.(); onMobileClose?.(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blaster-muted hover:bg-blaster-sidebar-hover hover:text-blaster-fg transition-colors w-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Activity
              </button>
            )}
          </>
        )}
      </nav>
      <div className="shrink-0 p-3 border-t border-blaster-border">
        {loading ? (
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
        ) : hasPaidPlan ? (
          <div className="bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
            <p className="text-xs text-blaster-muted mb-2">Thank you for upgrading</p>
            <div className="flex items-center gap-3 mb-3">
              <CrownIcon />
              <div>
                <p className="text-sm font-semibold text-blaster-fg">You&apos;re a premium user</p>
                <p className="text-xs text-blaster-muted">Enjoy higher limits and priority sending.</p>
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
        ) : (
          <div className="bg-white rounded-xl border border-blaster-border p-4 shadow-sm">
            <p className="text-xs text-blaster-muted mb-3">Time sensitive</p>
            <div className="flex items-start gap-2 mb-3">
              <ClockIcon />
              <div>
                <p className="text-sm text-blaster-fg">
                  {daysLeft} day{daysLeft === 1 ? '' : 's'} left to get
                </p>
                <p className="text-base font-bold text-blaster-fg">50% off for 3 months</p>
              </div>
            </div>
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
