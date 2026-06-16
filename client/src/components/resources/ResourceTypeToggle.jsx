import React from 'react';

export function ResourceTypeToggle({ value, onChange, className = '', embedded = false }) {
  const base =
    'px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blaster-accent/40';
  const active =
    'bg-gradient-to-r from-blaster-accent/20 to-blaster-orange/30 text-blaster-fg shadow-sm';
  const inactive = 'text-blaster-muted hover:text-blaster-fg';

  const wrapperClass = embedded
    ? `inline-flex rounded-lg bg-blaster-bg-app p-1 gap-0.5 ${className}`
    : `inline-flex rounded-xl border border-blaster-border bg-white p-1 gap-0.5 ${className}`;

  return (
    <div
      className={wrapperClass}
      role="tablist"
      aria-label="Resource type"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'video'}
        onClick={() => onChange('video')}
        className={`${base} ${value === 'video' ? active : inactive}`}
      >
        Videos
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'document'}
        onClick={() => onChange('document')}
        className={`${base} ${value === 'document' ? active : inactive}`}
      >
        PDFs
      </button>
    </div>
  );
}
