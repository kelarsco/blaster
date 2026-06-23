import React from 'react';
import { adminCard } from './adminStyles.js';

export function AdminListCard({ children, onClick, onDoubleClick, className = '' }) {
  const interactive = onClick || onDoubleClick;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={interactive ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={`flex items-center gap-4 p-4 ${adminCard} ${interactive ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function AdminListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-4 p-4 ${adminCard}`}>
          <div className="h-10 w-10 rounded-lg bg-blaster-border/40 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-32 rounded bg-blaster-border/40 animate-pulse" />
            <div className="h-3 w-48 rounded bg-blaster-border/40 animate-pulse" />
          </div>
          <div className="h-4 w-24 rounded bg-blaster-border/40 animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  );
}
