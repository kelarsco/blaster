import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Mail, BarChart2, Shield, Zap, TrendingUp } from 'react-feather';
import { HeroSplitText } from '../components/HeroSplitText';

const SIDEBAR_DURATION_MS = 300;

const NAV_LINKS = [
  { href: '#features', label: 'Solutions' },
  { href: '#security', label: 'Security' },
  { href: '#how', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

const WHY_ITEMS = [
  { Icon: Search, title: 'Visibility boost', desc: 'Find contact and support emails on any eCommerce store in minutes.' },
  { Icon: Mail, title: 'More leads', desc: 'Extract and organize emails at scale, then reach them with personalized campaigns.' },
  { Icon: BarChart2, title: 'Better control', desc: 'Multiple senders, templates, and rate limits so you stay in control.' },
  { Icon: Shield, title: 'Privacy-first', desc: 'Your SMTP, your lists. We never store passwords or sell data.' },
  { Icon: Zap, title: 'Smart scanning', desc: 'Prioritizes support@, contact@, info@ and filters no-reply automatically.' },
  { Icon: TrendingUp, title: 'Scale outreach', desc: 'Run campaigns with delays and one-email-per-store to maximize deliverability.' },
];

const INCLUDED = [
  'Store URL scanner & email extraction',
  'Multiple sender accounts (Gmail, Outlook, SMTP)',
  'Campaign templates & subject lines',
  'Configurable send delays & throttling',
  'One email per store option',
  'Export to Excel',
  'Activity logs & results dashboard',
  'Priority support',
];

const IMAGINE_CARDS = [
  { title: 'Smart scanner', desc: 'Paste store URLs and get every valid contact email from contact, about, and privacy pages.' },
  { title: 'Professional campaigns', desc: 'Templates, multiple senders, and delays so your outreach looks human and lands in inboxes.' },
  { title: 'Results dashboard', desc: 'Track sent, failed, and queued emails per campaign with clear stats and error details.' },
];

const COMPARISON_ROWS = [
  { feature: 'Scan store URLs for emails', free: true, upgraded: true },
  { feature: 'Export emails to Excel', free: true, upgraded: true },
  { feature: 'Single sender (free tier)', free: true, upgraded: true },
  { feature: 'Multiple senders & groups', free: false, upgraded: true },
  { feature: 'Automated campaigns', free: false, upgraded: true },
  { feature: 'Templates & delays', free: false, upgraded: true },
  { feature: 'Higher sending limits', free: false, upgraded: true },
  { feature: 'Priority support', free: false, upgraded: true },
];

const FAQ_ITEMS = [
  { q: 'What is wiblaster?', a: 'wiblaster is an automated platform that finds business email addresses from eCommerce store websites and sends cold outreach emails at scale—safely and efficiently.' },
  { q: 'How does scanning work?', a: 'Paste one or more store URLs. We crawl contact, about, and privacy pages and extract every valid email, prioritizing support@, contact@, and info@ addresses.' },
  { q: 'Can I use my own email accounts?', a: 'Yes. You connect your own Gmail, Outlook, Yahoo, or custom SMTP senders. We never store your passwords; we use OAuth or your SMTP credentials only to send.' },
  { q: 'What are campaigns?', a: 'Campaigns let you send personalized emails to your extracted list using templates, multiple senders, and configurable delays to improve deliverability.' },
  { q: 'Is there a free plan?', a: 'Yes. You can scan stores, export emails, and try the platform. Paid plans unlock multiple senders, automated campaigns, and higher limits.' },
];

export function LandingPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const closeTimeoutRef = useRef(null);

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

  useEffect(() => {
    const els = document.querySelectorAll('.aos-fade-up');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target;
            el.classList.add('aos-visible');
            const delay = el.getAttribute('data-aos-delay');
            if (delay) el.style.transitionDelay = `${delay}ms`;
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-blaster-bg font-landing text-blaster-fg">
      {/* Header – same bg as hero, logo left, pill CTA + menu right */}
      <header className="sticky top-0 z-40 bg-blaster-bg pt-[5px] pb-[5px]">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 font-bold text-sm sm:text-lg uppercase tracking-tight text-blaster-fg shrink-0 min-w-0">
            <span className="text-blaster-accent">⚡</span>
            <span className="truncate">wiblaster</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/pricing"
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

      {/* Sidebar overlay + panel – smooth slide in/out */}
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
                <a
                  key={l.href}
                  href={l.href}
                  onClick={closeSidebar}
                  className="block py-3 text-black font-medium hover:opacity-80 transition"
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={closeSidebar}
                className="block py-3 text-black font-medium hover:opacity-80 transition"
              >
                Login
              </Link>
              <Link
                to="/pricing"
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
                  to="/pricing"
                  onClick={closeSidebar}
                  className="mt-3 block text-center text-sm font-medium text-black hover:underline"
                >
                  View pricing →
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

      {/* Hero – title has no AOS; rest fades up */}
      <section className="relative min-h-[80vh] pt-16 pb-28 px-4 overflow-hidden flex flex-col justify-center">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#faf8f5_100%)] pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center relative">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-blaster-fg tracking-tight leading-tight">
            <HeroSplitText text="Find store emails. Send outreach at scale." delayMs={70} />
          </h1>
          <p className="aos-fade-up mt-6 text-lg sm:text-xl text-blaster-muted max-w-2xl mx-auto">
            wiblaster scans every website for contact emails and powers automated campaigns—so you save time and grow leads without the guesswork.
          </p>
          <div className="aos-fade-up mt-10 flex flex-col sm:flex-row items-center justify-center gap-3" data-aos-delay="100">
            <Link
              to="/pricing"
              className="w-full sm:w-auto btn-blaster-cta whitespace-nowrap text-center btn-landing-pop"
            >
              Start free trial
            </Link>
            <Link
              to="#included"
              className="w-full sm:w-auto btn-blaster-accent text-sm px-5 py-2.5 rounded-lg whitespace-nowrap text-center btn-landing-pop"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* Why wiblaster – card grid like reference */}
      <section id="features" className="pt-8 pb-16 sm:pt-10 sm:pb-20 px-4 bg-blaster-bg">
        <div className="max-w-6xl mx-auto aos-fade-up">
          <h2 className="text-2xl sm:text-3xl font-bold text-blaster-fg text-center">
            Why wiblaster?
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {WHY_ITEMS.map((item, i) => (
              <div
                key={item.title}
                className="aos-fade-up bg-blaster-bg-card rounded-2xl p-6 shadow-md border border-blaster-border/60 flex flex-col"
                data-aos-delay={50 + i * 50}
              >
                <div className="rounded-xl bg-blaster-accent/10 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mb-4 shrink-0 text-blaster-accent">
                  <item.Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2} />
                </div>
                <h3 className="font-bold text-blaster-fg text-base sm:text-lg">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-blaster-muted leading-relaxed flex-1">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="aos-fade-up mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/pricing" className="btn-blaster-cta btn-landing-pop w-full sm:w-auto text-center">
              Get Started Free
            </Link>
            <Link to="#how" className="btn-blaster-accent px-5 py-2.5 rounded-lg btn-landing-pop w-full sm:w-auto text-center">
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section id="included" className="py-16 px-4">
        <div className="max-w-6xl mx-auto text-center aos-fade-up">
          <h2 className="text-2xl sm:text-3xl font-bold text-blaster-fg">
            What's included
          </h2>
          <p className="mt-2 text-blaster-muted max-w-lg mx-auto">
            Everything you need to find emails and run outreach from one place.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-x-12 gap-y-3 max-w-2xl mx-auto text-left">
            {INCLUDED.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="text-blaster-accent shrink-0">✓</span>
                <span className="text-blaster-fg">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/dashboard" className="btn-blaster-accent px-5 py-2.5 rounded-lg btn-landing-pop">
              Explore dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Imagine this */}
      <section className="py-16 px-4 bg-blaster-bg-card border-y border-blaster-border">
        <div className="max-w-6xl mx-auto aos-fade-up">
          <h2 className="text-2xl sm:text-3xl font-bold text-blaster-fg text-center">
            Imagine this
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {IMAGINE_CARDS.map((card, i) => (
              <div
                key={card.title}
                className="aos-fade-up bg-white rounded-xl p-6 border border-blaster-border shadow-sm"
                data-aos-delay={i * 80}
              >
                <h3 className="font-semibold text-blaster-fg">{card.title}</h3>
                <p className="mt-2 text-sm text-blaster-muted">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs Upgraded */}
      <section id="pricing" className="py-16 px-4">
        <div className="max-w-6xl mx-auto aos-fade-up">
          <h2 className="text-2xl sm:text-3xl font-bold text-blaster-fg text-center">
            Free vs paid
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full max-w-3xl mx-auto border border-blaster-border rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-blaster-bg-app">
                  <th className="text-left p-4 font-semibold text-blaster-fg border-b border-blaster-border">
                    Feature
                  </th>
                  <th className="text-center p-4 font-semibold text-blaster-fg border-b border-blaster-border">
                    Free
                  </th>
                  <th className="text-center p-4 font-semibold text-blaster-fg border-b border-blaster-border">
                    Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-blaster-border last:border-0">
                    <td className="p-4 text-blaster-fg">{row.feature}</td>
                    <td className="p-4 text-center">
                      {row.free ? (
                        <span className="text-blaster-accent">✓</span>
                      ) : (
                        <span className="text-blaster-muted">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {row.upgraded ? (
                        <span className="text-emerald-500">✓</span>
                      ) : (
                        <span className="text-blaster-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex justify-center">
            <Link to="/pricing" className="btn-blaster-accent px-5 py-2.5 rounded-lg btn-landing-pop">
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 px-4 bg-blaster-bg-card border-y border-blaster-border">
        <div className="max-w-2xl mx-auto aos-fade-up">
          <h2 className="text-2xl sm:text-3xl font-bold text-blaster-fg text-center">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="aos-fade-up bg-white rounded-lg border border-blaster-border overflow-hidden"
                data-aos-delay={i * 40}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left font-medium text-blaster-fg hover:bg-blaster-bg-app/50 transition"
                >
                  {item.q}
                  <span className="text-blaster-muted shrink-0 ml-2">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-blaster-muted">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA block */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto aos-fade-up">
          <div className="rounded-2xl bg-blaster-accent/10 border border-blaster-accent/20 p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-blaster-fg">
              You find more leads. You send smarter. You scale outreach.
            </h2>
            <p className="mt-3 text-blaster-muted max-w-xl mx-auto">
              wiblaster helps you extract contact emails from store sites and run campaigns with multiple senders—so you spend less time hunting and more time closing.
            </p>
            <Link
              to="/pricing"
              className="inline-block mt-6 btn-blaster-accent px-5 py-2.5 rounded-lg btn-landing-pop"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-blaster-border bg-white">
        <div className="max-w-6xl mx-auto aos-fade-up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <h4 className="font-semibold text-blaster-fg mb-3">Product</h4>
              <a href="#features" className="block text-blaster-muted hover:text-blaster-fg">Solutions</a>
              <a href="#how" className="block text-blaster-muted hover:text-blaster-fg mt-1">How it works</a>
              <Link to="/pricing" className="block text-blaster-muted hover:text-blaster-fg mt-1">Pricing</Link>
            </div>
            <div>
              <h4 className="font-semibold text-blaster-fg mb-3">Company</h4>
              <a href="#" className="block text-blaster-muted hover:text-blaster-fg">About</a>
              <a href="#" className="block text-blaster-muted hover:text-blaster-fg mt-1">Contact</a>
            </div>
            <div>
              <h4 className="font-semibold text-blaster-fg mb-3">Legal</h4>
              <Link to="/privacy" className="block text-blaster-muted hover:text-blaster-fg">Privacy Policy</Link>
            </div>
            <div>
              <h4 className="font-semibold text-blaster-fg mb-3">wiblaster</h4>
              <p className="text-blaster-muted">Extract emails &amp; automated outreach.</p>
            </div>
          </div>
          <p className="mt-8 pt-6 border-t border-blaster-border text-center text-sm text-blaster-muted">
            © {new Date().getFullYear()} wiblaster. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
