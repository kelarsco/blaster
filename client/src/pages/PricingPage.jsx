import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, X, ChevronDown } from 'react-feather';
import {
  PLANS,
  MONTHS_BILLED_ANNUALLY,
  formatPriceNum,
  getDisplayPrice,
  storeSelectedPlan,
  PLAN_KEY,
} from '../data/plans';

const SIDEBAR_DURATION_MS = 300;

const NAV_LINKS = [
  { href: '/#features', label: 'Solutions' },
  { href: '/#security', label: 'Security' },
  { href: '/#how', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const closeTimeoutRef = useRef(null);
  const isAnnually = billingPeriod === 'annually';

  useEffect(() => {
    if (sidebarOpen && !sidebarClosing) {
      const t = setTimeout(() => setSidebarVisible(true), 10);
      return () => clearTimeout(t);
    }
    setSidebarVisible(false);
  }, [sidebarOpen, sidebarClosing]);

  const closeSidebar = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setSidebarClosing(true);
    setSidebarVisible(false);
    closeTimeoutRef.current = setTimeout(() => {
      setSidebarOpen(false);
      setSidebarClosing(false);
      closeTimeoutRef.current = null;
    }, SIDEBAR_DURATION_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleChoosePlan = (plan) => {
    if (plan.customContact) {
      window.location.href = 'mailto:support@wiblaster.com?subject=Custom%20Plan%20Inquiry';
      return;
    }
    const planId = plan.id === 'free' ? 'free' : isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
    storeSelectedPlan(planId);
    if (user) {
      navigate('/app/account/pricing', { replace: true });
      return;
    }
    navigate('/signup?from=pricing', { replace: true });
  };

  return (
    <div className="min-h-screen bg-blaster-bg font-landing text-blaster-fg">
      <header className="sticky top-0 z-40 bg-blaster-bg">
        <div className="max-w-6xl mx-auto px-4 py-1.5 sm:py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 font-bold text-sm sm:text-lg uppercase tracking-tight text-blaster-fg shrink-0 min-w-0">
            <span className="text-blaster-accent">⚡</span>
            <span className="truncate">wiblaster</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-blaster-fg text-white text-sm font-semibold btn-landing-pop whitespace-nowrap scale-[0.84] sm:scale-100 origin-center"
            >
              Get Started Free
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-blaster-fg hover:bg-blaster-border/50 transition btn-landing-pop"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <>
          <div
            className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm sidebar-overlay ${sidebarVisible ? 'sidebar-overlay-open' : ''} ${sidebarClosing ? 'sidebar-overlay-closing' : ''}`}
            onClick={closeSidebar}
            aria-hidden
          />
          <aside
            className={`fixed top-0 right-0 z-50 w-full max-w-sm h-full bg-white border-l border-blaster-border shadow-xl flex flex-col sidebar-panel rounded-tl-2xl rounded-bl-2xl ${sidebarVisible ? 'sidebar-panel-open' : ''} ${sidebarClosing ? 'sidebar-panel-closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-blaster-border">
              <span className="font-bold text-black">Menu</span>
              <button
                type="button"
                onClick={closeSidebar}
                className="p-2 rounded-lg text-black hover:bg-blaster-bg-app transition"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  onClick={closeSidebar}
                  className="block py-3 text-black font-medium hover:opacity-80 transition"
                >
                  {l.label}
                </Link>
              ))}
              <Link to="/login" onClick={closeSidebar} className="block py-3 text-black font-medium hover:opacity-80 transition">
                Log in
              </Link>
              <Link
                to="/signup"
                onClick={closeSidebar}
                className="block py-3 text-black font-medium hover:opacity-80 transition"
              >
                Get Started Free
              </Link>
            </nav>
            <div className="p-4 border-t border-blaster-border shrink-0">
              <div className="rounded-xl bg-blaster-accent/10 border border-blaster-accent/20 p-4">
                <h3 className="font-bold text-black text-center">Scale your outreach</h3>
                <p className="text-sm text-blaster-muted text-center mt-1">
                  Find emails from store sites and send campaigns with multiple senders.
                </p>
                <Link
                  to="/signup"
                  onClick={closeSidebar}
                  className="mt-3 block text-center text-sm font-medium text-black hover:underline"
                >
                  Learn more →
                </Link>
              </div>
              <p className="text-xs text-blaster-muted mt-4">© {new Date().getFullYear()} wiblaster.</p>
              <Link to="/privacy" onClick={closeSidebar} className="text-xs text-blaster-muted hover:underline mt-1 inline-block">
                Privacy Policy
              </Link>
            </div>
          </aside>
        </>
      )}

      <main className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-blaster-fg">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-blaster-muted max-w-xl mx-auto">
            Start free. Upgrade when you need more emails, senders, and campaigns. All plans include store scanning and export.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!isAnnually ? 'text-blaster-fg' : 'text-blaster-muted'}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAnnually}
              onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'annually' : 'monthly'))}
              className="relative inline-flex h-7 w-12 shrink-0 rounded-full border border-blaster-border bg-blaster-bg-app transition-colors focus:outline-none focus:ring-2 focus:ring-blaster-accent/40 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-blaster-fg transition-transform mt-1 ml-1 ${isAnnually ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnually ? 'text-blaster-fg' : 'text-blaster-muted'}`}>
              Annually
            </span>
            <span className="text-xs font-medium text-blaster-accent bg-blaster-accent/10 px-2 py-0.5 rounded">
              2 months free
            </span>
          </div>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const display = getDisplayPrice(plan.price, isAnnually);
            return (
              <div
                key={plan.id}
                className={`bg-blaster-bg-card rounded-2xl border flex flex-col ${
                  plan.tag ? 'border-blaster-accent/50 ring-2 ring-blaster-accent/20' : 'border-blaster-border'
                } shadow-md overflow-hidden`}
              >
                {plan.tag && (
                  <div className="bg-blaster-accent/10 border-b border-blaster-accent/20 px-4 py-1.5 text-center">
                    <span className="text-xs font-semibold text-blaster-accent">{plan.tag}</span>
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-blaster-fg">{plan.name}</h3>
                  <p className="text-sm text-blaster-muted mt-1 mb-4 line-clamp-3">{plan.description}</p>
                  <div className="mt-auto">
                    {plan.id === 'free' ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-bold text-blaster-fg">48-hour free trial</span>
                      </div>
                    ) : plan.customContact ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-bold text-blaster-fg">Contact for custom</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-2xl font-bold text-blaster-fg">${formatPriceNum(display.primary)}</span>
                          <span className="text-blaster-muted text-sm">/{display.primaryLabel}</span>
                        </div>
                        {display.secondary != null && (
                          <p className="text-xs text-blaster-muted mt-0.5">
                            ~${formatPriceNum(display.secondary)}/mo billed annually
                          </p>
                        )}
                      </>
                    )}
                    {plan.originalPrice != null && !isAnnually && (
                      <p className="text-xs text-blaster-muted mt-0.5">
                        <span className="line-through">${formatPriceNum(plan.originalPrice)}</span>/mo
                      </p>
                    )}
                    <ul className="mt-4 space-y-2 text-sm text-blaster-fg">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        {plan.features.emails} emails/mo
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        {plan.features.users}
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                        {plan.features.support}
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleChoosePlan(plan)}
                      className={`w-full mt-6 py-2.5 rounded-xl text-sm font-semibold btn-landing-pop ${
                        plan.id === 'free'
                          ? 'btn-blaster-accent'
                          : 'bg-blaster-accent text-white hover:opacity-90'
                      }`}
                    >
                      {plan.id === 'free' ? 'Start 48-hour trial' : plan.customContact ? 'Contact support' : 'Choose plan'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-blaster-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-blaster-fg font-medium hover:underline">
            Log in
          </Link>
        </p>

        <section className="mt-12 border-t border-blaster-border pt-8">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="w-full flex items-center justify-center gap-2 text-blaster-fg font-medium hover:text-blaster-accent transition-colors py-2"
            aria-expanded={detailsOpen}
          >
            <ChevronDown
              className={`w-5 h-5 shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
            See details
          </button>
          {detailsOpen && (
            <div className="mt-6 bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
              <h2 className="px-6 py-3 text-base font-semibold text-blaster-fg border-b border-blaster-border">
                Feature comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blaster-border">
                      <th className="text-left px-6 py-3 text-blaster-muted font-medium">Feature</th>
                      <th className="text-left px-6 py-3 text-blaster-fg font-medium">Free trial</th>
                      <th className="text-left px-6 py-3 text-blaster-fg font-medium">Essentials</th>
                      <th className="text-left px-6 py-3 text-blaster-fg font-medium">Standard</th>
                      <th className="text-left px-6 py-3 text-blaster-fg font-medium">Custom</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Email sends per month</td>
                      <td className="px-6 py-3 text-blaster-fg">200 total (trial)</td>
                      <td className="px-6 py-3 text-blaster-fg">5,000</td>
                      <td className="px-6 py-3 text-blaster-fg">50,000</td>
                      <td className="px-6 py-3 text-blaster-fg">Contact for custom</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Store links extracted</td>
                      <td className="px-6 py-3 text-blaster-fg">1,000 (48-hour trial)</td>
                      <td className="px-6 py-3 text-blaster-fg">15,000</td>
                      <td className="px-6 py-3 text-blaster-fg">40,000</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Email senders</td>
                      <td className="px-6 py-3 text-blaster-fg">1 SMTP sender</td>
                      <td className="px-6 py-3 text-blaster-fg">Up to 3</td>
                      <td className="px-6 py-3 text-blaster-fg">Up to 7</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Campaigns</td>
                      <td className="px-6 py-3 text-blaster-fg">1 active</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited concurrent</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Recipients source</td>
                      <td className="px-6 py-3 text-blaster-fg">Scan results only</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Sender rotation</td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                      <td className="px-6 py-3 text-blaster-fg">Advanced</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Campaign presets</td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Delay controls</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">Basic</td>
                      <td className="px-6 py-3 text-blaster-fg">Min/max randomization</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">One-email-per-store</td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                      <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Exports</td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3 text-blaster-fg">Excel (.xlsx)</td>
                      <td className="px-6 py-3 text-blaster-fg">Advanced (custom fields)</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Users</td>
                      <td className="px-6 py-3 text-blaster-fg">1 seat</td>
                      <td className="px-6 py-3 text-blaster-fg">3 seats</td>
                      <td className="px-6 py-3 text-blaster-fg">5 seats</td>
                      <td className="px-6 py-3 text-blaster-fg">Unlimited</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Personalized onboarding</td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3 text-blaster-fg">1 session</td>
                      <td className="px-6 py-3 text-blaster-fg">4 sessions</td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Advanced retry & error recovery</td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><X className="w-4 h-4 text-blaster-muted/60 inline" strokeWidth={2} /></td>
                      <td className="px-6 py-3"><Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={2.5} /></td>
                    </tr>
                    <tr className="border-b border-blaster-border">
                      <td className="px-6 py-3 text-blaster-muted">Activity logs & monitoring</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">—</td>
                      <td className="px-6 py-3 text-blaster-fg">Full access</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3 text-blaster-muted">Customer support</td>
                      <td className="px-6 py-3 text-blaster-fg">Email (limited)</td>
                      <td className="px-6 py-3 text-blaster-fg">24/7 email & chat</td>
                      <td className="px-6 py-3 text-blaster-fg">24/7 email & chat</td>
                      <td className="px-6 py-3 text-blaster-fg">Phone + priority</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="mt-16 text-center">
          <h2 className="text-xl font-bold text-blaster-fg">What’s included in every plan</h2>
          <ul className="mt-4 inline-flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-blaster-muted">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Store URL scanner & email extraction
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Export to Excel
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Campaigns & templates
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
              Secure payment via Paystack
            </li>
          </ul>
        </section>

        <div className="mt-16 rounded-2xl bg-blaster-accent/10 border border-blaster-accent/20 p-8 text-center">
          <h2 className="text-xl font-bold text-blaster-fg">Ready to scale your outreach?</h2>
          <p className="mt-2 text-blaster-muted max-w-lg mx-auto">
            Create an account in under a minute. Pick a plan and complete payment securely with Paystack.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="btn-blaster-cta btn-landing-pop">
              Create free account
            </Link>
            <Link to="/login" className="btn-blaster-accent px-5 py-2.5 rounded-lg btn-landing-pop">
              I already have an account
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-blaster-border text-center text-sm text-blaster-muted mt-12">
        <Link to="/" className="text-blaster-accent hover:underline">← Back to home</Link>
        <p className="mt-2">© {new Date().getFullYear()} wiblaster.</p>
      </footer>
    </div>
  );
}
