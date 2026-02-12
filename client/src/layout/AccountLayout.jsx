import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown } from 'react-feather';

const settingsItems = [
  { label: 'Usage', to: '/app/account/settings/usage' },
  { label: 'Manage my plan', to: '/app/account/settings/manage-plan' },
];

const billingItems = [
  { label: 'Monthly plan', to: '/app/account/billing/monthly-plan' },
  { label: 'Billing information', to: '/app/account/billing/information' },
  { label: 'Billing history', to: '/app/account/billing/history' },
];

function isSettingsActive(pathname) {
  return pathname.startsWith('/app/account/settings');
}

function isBillingActive(pathname) {
  return pathname.startsWith('/app/account/billing');
}

export function AccountLayout() {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const settingsRef = useRef(null);
  const billingRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
      if (billingRef.current && !billingRef.current.contains(e.target)) setBillingOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col min-h-0">
      <nav className="flex flex-wrap items-center gap-1 sm:gap-2 border-b border-blaster-border bg-white px-1 shrink-0">
        <NavLink
          to="/app/account"
          end
          className={({ isActive }) =>
            `px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              isActive
                ? 'border-blaster-accent text-blaster-fg'
                : 'border-transparent text-blaster-muted hover:text-blaster-fg'
            }`
          }
        >
          Overview
        </NavLink>

        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => {
              setSettingsOpen((o) => !o);
              setBillingOpen(false);
            }}
            className={`flex items-center gap-1 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              isSettingsActive(location.pathname)
                ? 'border-blaster-accent text-blaster-fg'
                : 'border-transparent text-blaster-muted hover:text-blaster-fg'
            }`}
          >
            Settings
            <ChevronDown className={`w-4 h-4 transition ${settingsOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
          {settingsOpen && (
            <div className="absolute left-0 top-full mt-0.5 min-w-[180px] py-1 bg-white rounded-lg border border-blaster-border shadow-lg z-20">
              {settingsItems.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSettingsOpen(false)}
                  className="block px-4 py-2 text-sm text-blaster-fg hover:bg-gray-50"
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={billingRef}>
          <button
            type="button"
            onClick={() => {
              setBillingOpen((o) => !o);
              setSettingsOpen(false);
            }}
            className={`flex items-center gap-1 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              isBillingActive(location.pathname)
                ? 'border-blaster-accent text-blaster-fg'
                : 'border-transparent text-blaster-muted hover:text-blaster-fg'
            }`}
          >
            Billing
            <ChevronDown className={`w-4 h-4 transition ${billingOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
          </button>
          {billingOpen && (
            <div className="absolute left-0 top-full mt-0.5 min-w-[180px] py-1 bg-white rounded-lg border border-blaster-border shadow-lg z-20">
              {billingItems.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setBillingOpen(false)}
                  className="block px-4 py-2 text-sm text-blaster-fg hover:bg-gray-50"
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink
          to="/app/account/pricing"
          className={({ isActive }) =>
            `px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              isActive
                ? 'border-blaster-accent text-blaster-fg'
                : 'border-transparent text-blaster-muted hover:text-blaster-fg'
            }`
          }
        >
          Pricing plans
        </NavLink>
      </nav>

      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
