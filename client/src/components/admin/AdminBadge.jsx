import React from 'react';

const VARIANTS = {
  default: 'bg-blaster-border/50 text-blaster-muted',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  rejected: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-700',
  sending: 'bg-amber-100 text-amber-800',
  sent: 'bg-emerald-100 text-emerald-800',
};

export function AdminBadge({ children, variant = 'default', icon, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANTS[variant] || VARIANTS.default} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
