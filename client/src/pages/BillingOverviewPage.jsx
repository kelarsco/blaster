import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'react-feather';

export function BillingOverviewPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Billing</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Manage your plans and payment methods</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="card-title-mobile">Free Marketing Plan</h2>
              <Link to="/app/account/billing/monthly-plan" className="text-xs md:text-sm text-blaster-accent hover:underline">Change Plan</Link>
            </div>
            <p className="text-xl md:text-2xl font-bold text-blaster-fg mb-3 md:mb-4">$0 per month</p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blaster-muted">Contacts</span>
                  <span className="text-blaster-fg">1 of 250 used · 249 remaining</span>
                </div>
                <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                  <div className="h-full bg-blaster-accent/40 rounded-full" style={{ width: '0.4%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blaster-muted">Email sends</span>
                  <span className="text-blaster-fg">0 of 500 used · 500 remaining</span>
                </div>
                <div className="h-2 rounded-full bg-blaster-bg-app overflow-hidden">
                  <div className="h-full bg-blaster-accent/40 rounded-full" style={{ width: '0%' }} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-blaster-bg-card rounded-2xl border border-blaster-border p-6">
            <h2 className="font-semibold text-blaster-fg mb-4">No upcoming bill</h2>
            <p className="text-sm text-blaster-muted mb-4">You are on a Free plan, so you do not have any upcoming charges.</p>
            <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blaster-muted">Free plan</span>
                <span className="text-blaster-fg">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blaster-muted">Tax</span>
                <span className="text-blaster-fg">$0.00</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-blaster-border">
                <span className="text-blaster-fg">Estimated total</span>
                <span className="text-blaster-fg">$0.00</span>
              </div>
            </div>
          </section>

          <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
            <h2 className="card-title-mobile mb-2">Billing information</h2>
            <Link to="/app/account/billing/information" className="text-blaster-accent hover:underline text-sm">
              Add a payment method
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
