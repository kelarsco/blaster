import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, X, ChevronDown } from 'react-feather';
import { Logo } from '../components/Logo.jsx';
import { MarketingHeader } from '../layout/MarketingHeader.jsx';
import {
  PLANS,
  MONTHS_BILLED_ANNUALLY,
  formatPriceNum,
  getDisplayPrice,
  storeSelectedPlan,
  PLAN_KEY,
} from '../data/plans';

export function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isAnnually = billingPeriod === 'annually';

  const handleChoosePlan = (plan) => {
    if (plan.customContact) {
      window.location.href = 'mailto:support@wiblaster.com?subject=Custom%20Plan%20Inquiry';
      return;
    }
    let planId;
    if (plan.id === 'trial_weekly') {
      planId = 'trial_weekly';
    } else {
      planId = isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
    }
    storeSelectedPlan(planId);
    
    if (user) {
      // User is logged in, redirect to billing to pay
      navigate('/app/account/pricing', { replace: true });
      return;
    }
    
    // User is not logged in, redirect to signup
    navigate('/signup?from=pricing', { replace: true });
  };

  return (
    <div className="min-h-screen bg-blaster-bg font-poppins text-black">
      <MarketingHeader />

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
            const display = getDisplayPrice(plan.price, isAnnually, plan.period);
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
                      <td className="px-6 py-3 text-blaster-fg">200 (48-hour trial)</td>
                      <td className="px-6 py-3 text-blaster-fg">20,000</td>
                      <td className="px-6 py-3 text-blaster-fg">100,000</td>
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
        <p className="mt-2">© {new Date().getFullYear()} <Logo className="inline w-auto h-auto" />. All rights reserved.</p>
      </footer>
    </div>
  );
}
