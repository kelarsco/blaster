import React, { useState, useEffect } from 'react';
import { formatActivityTimeLeft, normalizeActivityEntry } from '../../utils/activityFeed.js';
import { RecentActivityListSkeleton } from './DashboardSkeletons.jsx';

const PAGE_SIZE = 5;

const BRAND_ICON_BOX =
  'bg-gradient-to-br from-blaster-accent/25 to-blaster-orange/35 border-blaster-accent/25';

function BrandGradientIcon({ Icon, variant = 'stroke', className = 'w-[18px] h-[18px]' }) {
  const id = React.useId().replace(/:/g, '');
  const gradientId = `activity-icon-gradient-${id}`;

  const gradientDef = (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#fcb04c" />
        </linearGradient>
      </defs>
    </svg>
  );

  if (variant === 'dash') {
    return (
      <span className="inline-flex shrink-0">
        {gradientDef}
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="5" y="10.5" width="14" height="3" rx="1.5" fill={`url(#${gradientId})`} />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0">
      {gradientDef}
      <Icon className={className} stroke={`url(#${gradientId})`} strokeWidth={2} />
    </span>
  );
}

function ActivityRow({ item }) {
  const entry = normalizeActivityEntry(item);
  if (!entry) return null;

  const Icon = entry.icon;
  const timeLabel = formatActivityTimeLeft(entry.createdAt);

  return (
    <div className="px-4 sm:px-5 py-3">
      <div className="flex items-center gap-3 rounded-xl border border-blaster-border/70 bg-gray-50/80 p-3">
        <div
          className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border ${BRAND_ICON_BOX}`}
        >
          <BrandGradientIcon Icon={Icon} variant={entry.iconVariant} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blaster-fg leading-snug">{entry.title}</p>
          {entry.detail && (
            <p className="text-xs text-blaster-muted mt-0.5 leading-relaxed">{entry.detail}</p>
          )}
        </div>
        <div className="shrink-0 w-14 flex items-center justify-center">
          <p className="text-[11px] sm:text-xs font-medium text-blaster-muted leading-tight text-center">{timeLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function RecentActivityList({ items, loading, emptyMessage = 'No activity yet' }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [items]);

  if (loading) {
    return <RecentActivityListSkeleton />;
  }

  if (!items?.length) {
    return (
      <div className="px-5 sm:px-6 py-10 text-sm text-blaster-muted text-center">{emptyMessage}</div>
    );
  }

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <div>
      <div className="py-1 space-y-1">
        {visibleItems.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </div>
      {hasMore && (
        <div className="px-4 sm:px-5 pb-4 pt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black border border-blaster-orange text-[#faf8f5] text-sm font-medium shadow-blaster-cta hover:opacity-90 transition shrink-0"
          >
            More
          </button>
        </div>
      )}
    </div>
  );
}
