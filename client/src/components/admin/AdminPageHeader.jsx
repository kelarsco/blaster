import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'react-feather';

export function AdminPageHeader({ title, subtitle, backTo, backLabel = 'Back', actions, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm text-blaster-muted hover:text-blaster-fg mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-bold text-blaster-fg tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-blaster-muted mt-0.5">{subtitle}</p>}
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
