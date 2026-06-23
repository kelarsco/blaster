/** Shared Tailwind class strings for the admin dashboard design system. */

export const adminHoverBg = 'hover:bg-black/[0.01]';

export const adminCard =
  `rounded-xl border border-blaster-border bg-blaster-bg-card hover:border-blaster-border/80 ${adminHoverBg} transition-colors`;

export const adminPanel =
  'rounded-2xl border border-blaster-border bg-blaster-bg-card shadow-sm overflow-hidden';

export const adminPillBtn =
  'inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 rounded-full border border-blaster-border/80 bg-blaster-bg-card text-sm font-medium text-blaster-fg shadow-sm hover:border-blaster-border hover:shadow transition-all';

export const adminInput =
  'w-full px-3.5 py-2.5 rounded-xl border border-blaster-border bg-blaster-bg-card text-blaster-fg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-blaster-muted';

export const adminPrimaryBtn =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-black text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50';

export const adminGhostBtn =
  `inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-blaster-fg ${adminHoverBg} transition-colors disabled:opacity-50`;

export const adminIconBtn =
  'flex items-center justify-center w-9 h-9 rounded-full bg-black text-white hover:opacity-90 transition-opacity shadow-sm';

export const adminLabel = 'block text-xs font-medium text-blaster-muted mb-1.5';
