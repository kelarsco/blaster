import React from 'react';

function Sk({ className = '' }) {
  return <div className={`referral-skeleton ${className}`} aria-hidden />;
}

export function ReferralPageSkeleton() {
  return (
    <div className="min-h-full bg-white p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-8">
        <div>
          <Sk className="h-8 w-48 max-w-full rounded-lg" />
          <Sk className="h-4 w-full max-w-md mt-2 rounded" />
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white p-5">
          <Sk className="h-3 w-28 rounded mb-3" />
          <div className="referral-link-row">
            <Sk className="h-[42px] flex-1 min-w-[200px] rounded-xl" />
            <Sk className="h-[42px] w-28 rounded-xl shrink-0" />
            <Sk className="h-[42px] w-24 rounded-xl shrink-0" />
          </div>
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 sm:px-6 py-6 border-b border-blaster-border last:border-b-0">
              <Sk className="h-4 w-32 rounded mb-3" />
              <Sk className="h-8 w-16 rounded" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white overflow-hidden p-5">
          <Sk className="h-4 w-36 rounded mb-4" />
          <div className="referral-tiers">
            {[0, 1, 2].map((i) => (
              <div key={i} className="referral-tier-card items-center">
                <Sk className="w-11 h-11 rounded-xl" />
                <Sk className="h-4 w-24 rounded" />
                <Sk className="h-3 w-32 rounded" />
                <Sk className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-blaster-border bg-white p-5 space-y-3">
          <Sk className="h-4 w-32 rounded" />
          <Sk className="h-10 w-full rounded-lg" />
          {[0, 1, 2].map((i) => (
            <Sk key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>

        <div className="referral-progress-section space-y-4">
          <Sk className="h-4 w-full max-w-lg rounded mx-auto" />
          <Sk className="h-2 w-full rounded-full" />
          <Sk className="h-4 w-full max-w-sm rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
