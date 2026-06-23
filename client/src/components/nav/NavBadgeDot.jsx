import React from 'react';

export function NavBadgeDot({ show }) {
  if (!show) return null;
  return (
    <span
      className="ml-auto w-2 h-2 rounded-full bg-blaster-orange shadow-[0_0_0_2px_rgba(255,255,255,0.9)] shrink-0"
      aria-label="New notification"
    />
  );
}
