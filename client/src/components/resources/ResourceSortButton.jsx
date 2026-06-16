import React from 'react';

const SORT_LABELS = {
  newest: 'New to old',
  oldest: 'Old to new',
};

function SortNewToOldIcon({ className }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4h13" />
      <path d="M3 8h9" />
      <path d="M3 12h6" />
      <path d="M16 8l4 4-4 4" />
      <path d="M20 12H12" />
    </svg>
  );
}

function SortOldToNewIcon({ className }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 20h13" />
      <path d="M3 16h9" />
      <path d="M3 12h6" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H12" />
    </svg>
  );
}

export function ResourceSortButton({ order, onChange }) {
  const label = SORT_LABELS[order] || SORT_LABELS.newest;
  const Icon = order === 'newest' ? SortNewToOldIcon : SortOldToNewIcon;

  const toggle = () => onChange(order === 'newest' ? 'oldest' : 'newest');

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Sort: ${label}`}
      aria-label={`Sort: ${label}. Click to switch.`}
      className="p-2 rounded-lg text-blaster-muted hover:text-blaster-fg hover:bg-blaster-bg-app transition shrink-0"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
