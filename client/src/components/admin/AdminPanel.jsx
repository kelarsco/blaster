import React from 'react';
import { adminPanel } from './adminStyles.js';

export function AdminPanel({ title, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`${adminPanel} ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-blaster-border bg-blaster-sidebar/20">
          <h2 className="text-sm font-semibold text-blaster-fg">{title}</h2>
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
