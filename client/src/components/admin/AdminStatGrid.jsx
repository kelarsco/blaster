import React from 'react';
import { adminPanel, adminHoverBg } from './adminStyles.js';

export function AdminStatGrid({ items, columns = 4, className = '' }) {
  const colClass =
    columns === 5
      ? 'sm:grid-cols-2 lg:grid-cols-5'
      : columns === 3
        ? 'sm:grid-cols-3'
        : columns === 2
          ? 'sm:grid-cols-2'
          : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`${adminPanel} ${className}`}>
      <div className={`grid grid-cols-1 ${colClass} divide-y sm:divide-y-0 sm:divide-x divide-blaster-border`}>
        {items.map(({ label, value, onClick, active }) => (
          <div
            key={label}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
            className={`px-5 sm:px-6 py-5 sm:py-6 ${onClick ? `cursor-pointer ${adminHoverBg} transition-colors` : ''} ${
              active ? 'bg-blaster-accent/5' : ''
            }`}
          >
            <p className="text-sm text-blaster-muted">{label}</p>
            <p className="text-2xl font-bold text-blaster-fg mt-1 tracking-tight">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminStatGridSkeleton({ count = 4, columns = 4 }) {
  const colClass =
    columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={adminPanel}>
      <div className={`grid grid-cols-1 ${colClass} divide-y sm:divide-y-0 sm:divide-x divide-blaster-border`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-24 bg-blaster-border/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
