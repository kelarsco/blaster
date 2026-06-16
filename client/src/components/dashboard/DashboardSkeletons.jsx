import React from 'react';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} aria-hidden />;
}

export function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div className="space-y-2.5">
        <Skeleton className="h-8 sm:h-9 w-36" />
        <Skeleton className="h-4 w-48 sm:w-56" />
      </div>
      <Skeleton className="h-[42px] w-full sm:w-[176px] rounded-xl shrink-0" />
    </div>
  );
}

export function PerformanceStatsCardSkeleton({ embedded = false, showRangePicker = true }) {
  const shell = embedded
    ? 'bg-white overflow-hidden'
    : 'rounded-2xl border border-blaster-border bg-white overflow-hidden';

  return (
    <div className={shell}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-b border-blaster-border">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-24" />
        </div>
        {showRangePicker && <Skeleton className="h-8 w-[188px] rounded-full" />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-blaster-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-5 sm:px-6 py-6">
            <Skeleton className="h-4 w-28 mb-4" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-8 sm:h-9 w-14" />
              <Skeleton className="h-5 w-12 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StreaksAndBadgesPanelSkeleton({ fullWidth = false }) {
  const badgeCols = fullWidth ? 'grid-cols-3 sm:grid-cols-10' : 'grid-cols-3 sm:grid-cols-5';

  return (
    <div className="px-5 sm:px-6 py-5">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex flex-col items-end mb-5">
        <Skeleton className="h-9 w-[136px] rounded-full" />
      </div>
      <div className="space-y-2 mb-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-blaster-border/50 bg-gray-50/60"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton className="h-4 w-28 mb-3" />
      <div className={`grid gap-2 sm:gap-3 ${badgeCols}`}>
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function RecentActivityListSkeleton() {
  return (
    <div className="py-1 space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-4 sm:px-5 py-3">
          <div className="flex items-center gap-3 rounded-xl border border-blaster-border/50 bg-gray-50/60 p-3">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-[58%] max-w-[220px]" />
              <Skeleton className="h-3 w-[42%] max-w-[160px]" />
            </div>
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardActivityAchievementsSkeleton({ embedded = false, fullWidth = false }) {
  const shell = embedded
    ? 'bg-white overflow-hidden'
    : 'rounded-2xl border border-blaster-border bg-white overflow-hidden';

  return (
    <div className={shell}>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-blaster-border">
        <StreaksAndBadgesPanelSkeleton fullWidth={fullWidth} />
        <div>
          <div className="px-5 sm:px-6 py-4 border-b border-blaster-border space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <RecentActivityListSkeleton />
        </div>
      </div>
    </div>
  );
}
