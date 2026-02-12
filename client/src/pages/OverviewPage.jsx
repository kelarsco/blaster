import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Send, Mail, CreditCard } from 'react-feather';

export function OverviewPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Overview</h1>
        <p className="text-blaster-muted mt-0.5">Quick access to your Store Scouter workflows</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          to="/app/scanner"
          className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile hover:border-blaster-accent/40 transition group"
        >
          <Search className="w-10 h-10 text-blaster-accent mb-3 group-hover:scale-105 transition" strokeWidth={2} />
          <h3 className="card-title-mobile">Scanner</h3>
          <p className="text-sm text-blaster-muted mt-1">Extract emails from store websites</p>
        </Link>
        <Link
          to="/app/campaigns"
          className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile hover:border-blaster-accent/40 transition group"
        >
          <Send className="w-10 h-10 text-blaster-accent mb-3 group-hover:scale-105 transition" strokeWidth={2} />
          <h3 className="card-title-mobile">Campaigns</h3>
          <p className="text-sm text-blaster-muted mt-1">Run and manage outreach campaigns</p>
        </Link>
        <Link
          to="/app/senders"
          className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile hover:border-blaster-accent/40 transition group"
        >
          <Mail className="w-10 h-10 text-blaster-accent mb-3 group-hover:scale-105 transition" strokeWidth={2} />
          <h3 className="card-title-mobile">Senders</h3>
          <p className="text-sm text-blaster-muted mt-1">Configure email accounts</p>
        </Link>
        <Link
          to="/app/account/settings/usage"
          className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile hover:border-blaster-accent/40 transition group"
        >
          <CreditCard className="w-10 h-10 text-blaster-accent mb-3 group-hover:scale-105 transition" strokeWidth={2} />
          <h3 className="card-title-mobile">Usage</h3>
          <p className="text-sm text-blaster-muted mt-1">Review limits, usage, and billing details</p>
        </Link>
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
        <h2 className="card-title-mobile mb-3 md:mb-4">Get started</h2>
        <ol className="space-y-3 text-sm text-blaster-muted">
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blaster-accent/20 text-blaster-accent flex items-center justify-center text-xs font-medium">1</span>
            Run a scan to collect store contacts
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blaster-accent/20 text-blaster-accent flex items-center justify-center text-xs font-medium">2</span>
            Add senders in Senders and create a campaign
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blaster-accent/20 text-blaster-accent flex items-center justify-center text-xs font-medium">3</span>
            Launch your campaign and track results
          </li>
        </ol>
      </section>
    </div>
  );
}
