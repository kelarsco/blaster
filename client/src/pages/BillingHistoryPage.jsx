import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'react-feather';

export function BillingHistoryPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <Link to="/app/account/billing" className="text-xs md:text-sm text-blaster-accent hover:underline mb-2 inline-block">← Back to billing</Link>
        <h1 className="page-title-mobile">Billing history</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">View past invoices and payments</p>
      </div>

      <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border overflow-hidden">
        <div className="card-header-mobile flex items-center gap-2">
          <FileText className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
          <h2 className="card-title-mobile">Invoices</h2>
        </div>
        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-blaster-muted mx-auto mb-3 opacity-50" strokeWidth={1.5} />
          <p className="text-blaster-muted">No invoices yet</p>
          <p className="text-sm text-blaster-muted mt-1">Invoices will appear here when you upgrade to a paid plan.</p>
          <Link to="/app/account/pricing" className="inline-block mt-4 text-blaster-accent hover:underline text-sm">
            View pricing plans
          </Link>
        </div>
      </section>
    </div>
  );
}
