import React from 'react';
import { Pause, Trash2 } from 'react-feather';

export function ManagePlanPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="page-title-mobile">Manage my plan</h1>
        <p className="text-xs md:text-sm text-blaster-muted mt-0.5">Upgrade, pause, or cancel your subscription</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Pause className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Temporarily pause my plan</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-3 md:mb-4">
            When you pause your billing, you will still have access to your account and data, but you will not be able to send any emails.
          </p>
          <p className="text-xs text-blaster-muted mb-4">Note: Plans can only be paused twice a year. <span className="text-blaster-accent hover:underline cursor-pointer">Learn more</span></p>
          <div className="rounded-xl bg-blaster-bg-app/80 border border-blaster-border p-3 flex items-start gap-2 mb-4">
            <span className="text-blaster-muted">i</span>
            <p className="text-sm text-blaster-muted">Free plans cannot be paused.</p>
          </div>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-xl border border-blaster-border text-blaster-muted bg-blaster-bg-app cursor-not-allowed text-sm"
          >
            Pause my plan
          </button>
        </section>

        <section className="bg-blaster-bg-card rounded-xl md:rounded-2xl border border-blaster-border card-body-mobile">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-blaster-muted" strokeWidth={2} />
            <h2 className="card-title-mobile">Permanently delete my account</h2>
          </div>
          <p className="text-xs md:text-sm text-blaster-muted mb-4 md:mb-6">
            Lose access to your account and all of its data, effective immediately.
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm transition"
          >
            Delete my account
          </button>
        </section>
      </div>
    </div>
  );
}
