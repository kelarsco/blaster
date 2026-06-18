import React from 'react';

const BRAND_ICON_BOX =
  'bg-gradient-to-br from-blaster-accent/25 to-blaster-orange/35 border border-blaster-accent/25';

export function BrandGradientIcon({ Icon, variant = 'stroke', className = 'w-4 h-4' }) {
  const id = React.useId().replace(/:/g, '');
  const gradientId = `brand-gradient-${id}`;

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
      <Icon className={className} stroke={`url(#${gradientId})`} strokeWidth={1.75} />
    </span>
  );
}

export function BrandIconBox({ children, className = '' }) {
  return (
    <div
      className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${BRAND_ICON_BOX} ${className}`}
    >
      {children}
    </div>
  );
}

export function CrownIcon({ className = 'w-5 h-5', stroke }) {
  return (
    <svg className={className} fill="none" stroke={stroke || 'currentColor'} viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 16l-1-9 5 4 3-6 3 6 5-4-1 9H5z" />
    </svg>
  );
}
