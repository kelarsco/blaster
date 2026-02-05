import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export function LandingPage() {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-blaster-bg font-landing text-blaster-fg">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-blaster-bg/95 backdrop-blur border-b border-blaster-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blaster-fg">
            <span className="text-blaster-accent">⚡</span>
            Blaster
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-blaster-muted">
            <a href="#features">Solutions</a>
            <a href="#security">Security</a>
            <a href="#how">How it works</a>
            <span className="text-blaster-fg/60">Pricing</span>
            <span className="text-blaster-fg/60">Contact</span>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-blaster-muted hidden sm:inline">Docs</span>
            <Link to="/login" className="text-sm font-medium text-blaster-fg hover:text-blaster-accent transition">
              Login
            </Link>
            <Link to="/signup" className="text-sm font-medium text-blaster-fg hover:text-blaster-accent transition">
              Sign up
            </Link>
            <Link to="/login" className="btn-blaster-cta text-sm">
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,#faf8f5_100%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-blaster-fg tracking-tight leading-tight">
            Extract emails from any site. Send automated outreach at scale.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-blaster-muted max-w-2xl mx-auto">
            From smart scanning to personalized campaigns, Blaster helps you find contact emails on store sites and reach them with multiple senders—so you save time and scale outreach without breaking a sweat.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-blaster-border bg-blaster-bg-card text-blaster-fg placeholder-blaster-muted focus:outline-none focus:ring-2 focus:ring-blaster-accent/40"
            />
            <Link to="/login" className="w-full sm:w-auto btn-blaster-cta whitespace-nowrap text-center">
              Start Free Trial
            </Link>
          </div>
          {/* Hero visual: metric-style cards */}
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: 'Stores scanned', value: '1000+', change: 'per run' },
              { label: 'Emails found', value: 'Support, Contact, Info', change: 'prioritized' },
              { label: 'Senders', value: 'Multiple', change: 'rotate & throttle' },
              { label: 'Deliverability', value: 'Smart', change: 'rate limits' },
            ].map((m) => (
              <div key={m.label} className="bg-blaster-bg-card rounded-xl p-4 border border-blaster-border shadow-sm text-left">
                <div className="text-2xl font-bold text-blaster-fg">{m.value}</div>
                <div className="text-sm text-blaster-muted">{m.label}</div>
                <div className="text-xs text-blaster-accent mt-0.5">{m.change}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Powerful automation */}
      <section id="features" className="py-20 px-4 bg-blaster-bg-card border-y border-blaster-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blaster-accent">SEND AT THE RIGHT TIME, EVERY TIME.</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-blaster-fg">
            Powerful automation to transform your outreach
          </h2>
          <p className="mt-4 text-blaster-muted text-lg">
            Simplify workflows, save time, and boost results with scanning and sending built for scale.
          </p>
          <Link to="/login" className="inline-block mt-8 btn-blaster-cta">
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-blaster-fg text-center">
            Enterprise-grade security and deliverability
          </h2>
          <div className="mt-12 grid sm:grid-cols-3 gap-8">
            {[
              { icon: '🔐', title: 'SMTP & auth', desc: 'Use your own SMTP; we never store passwords.' },
              { icon: '🛡️', title: 'Privacy-first', desc: 'You control your lists and sender accounts.' },
              { icon: '✓', title: 'Rate-aware', desc: 'Respect provider limits with configurable throttling.' },
            ].map((f) => (
              <div key={f.title} className="bg-blaster-bg-card rounded-xl p-6 border border-blaster-border shadow-sm text-center">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-blaster-fg">{f.title}</h3>
                <p className="mt-2 text-sm text-blaster-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works / Become a pro */}
      <section id="how" className="py-20 px-4 bg-blaster-bg-card border-y border-blaster-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-blaster-fg text-center">
            Become an outreach pro
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 gap-8">
            <div className="rounded-xl border border-blaster-border p-6">
              <h3 className="font-semibold text-blaster-fg">Scanner</h3>
              <p className="mt-2 text-blaster-muted text-sm">Paste store URLs; we hit contact, about, and privacy pages and extract every valid email.</p>
              <ul className="mt-3 text-sm text-blaster-muted space-y-1">
                <li>• Support, contact, info@ prioritized</li>
                <li>• No-reply filtered out</li>
                <li>• Export or send to campaign</li>
              </ul>
            </div>
            <div className="rounded-xl border border-blaster-border p-6">
              <h3 className="font-semibold text-blaster-fg">Campaigns & senders</h3>
              <p className="mt-2 text-blaster-muted text-sm">Add multiple sender emails; run campaigns with templates and delays.</p>
              <ul className="mt-3 text-sm text-blaster-muted space-y-1">
                <li>• Multiple SMTP senders</li>
                <li>• Subject and body templates</li>
                <li>• One email per store option</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-blaster-fg">
            Scale your outreach without sacrificing control
          </h2>
          <p className="mt-3 text-blaster-muted">Extract emails from any website. Send automated campaigns with multiple senders.</p>
          <Link to="/login" className="inline-flex items-center gap-2 mt-6 text-blaster-accent font-semibold hover:text-blaster-accent-hover">
            Try Blaster →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-blaster-border text-center text-sm text-blaster-muted">
        <div className="flex items-center justify-center gap-2">
          <span className="text-blaster-fg font-medium">Blaster</span>
          <span>– Extract emails & automated outreach.</span>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} Blaster. All rights reserved.</p>
      </footer>
    </div>
  );
}
