import React from 'react';

export function PagePreloader() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-blaster-bg-app/80 backdrop-blur-sm" aria-hidden="true">
      <div
        className="w-10 h-10 rounded-full border-2 border-blaster-border border-t-blaster-accent animate-spin"
        role="presentation"
      />
    </div>
  );
}
