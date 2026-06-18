import React from 'react';

function Skeleton({ className = '' }) {
  return <div className={`stores-skeleton-block ${className}`} aria-hidden />;
}

function FilterPanelSkeleton() {
  return (
    <div className="stores-filter-panel stores-glass">
      <div className="stores-filter-header">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3.5 w-44 mt-2" />
      </div>
      <div className="stores-filter-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[46px] w-full rounded-[0.625rem]" />
        ))}
      </div>
      <div className="stores-filter-result-count">
        <Skeleton className="h-3.5 w-32" />
      </div>
    </div>
  );
}

function BulkBarSkeleton() {
  return (
    <div className="stores-glass stores-bulk-bar stores-bulk-bar-full">
      <Skeleton className="h-9 w-28 rounded-lg" />
      <div className="stores-bulk-right">
        <Skeleton className="h-9 w-[72px] rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}

function StoreListRowSkeleton() {
  return (
    <div className="stores-glass stores-list-row">
      <Skeleton className="stores-logo stores-logo-sm shrink-0 rounded-lg" />
      <Skeleton className="h-4 flex-1 max-w-md rounded-md" />
      <div className="stores-list-right">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-12 rounded-full" />
        <Skeleton className="h-7 w-10 rounded-full" />
      </div>
    </div>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-9 w-9 rounded-lg" />
    </div>
  );
}

export function StoresPageSkeleton({ rowCount = 8 }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading store leads">
      <FilterPanelSkeleton />
      <BulkBarSkeleton />
      <div className="stores-list">
        {Array.from({ length: rowCount }).map((_, i) => (
          <StoreListRowSkeleton key={i} />
        ))}
      </div>
      <PaginationSkeleton />
    </div>
  );
}
