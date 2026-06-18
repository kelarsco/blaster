/**
 * Admin-assignable plans — matches in-app pricing tiers (Trial, Basic, Growth, Pro).
 */
export const ADMIN_PLAN_OPTIONS = [
  { id: 'free', label: 'Trial (Free) — 24 hours' },
  { id: 'essentials_monthly', label: 'Basic — $3.99/month' },
  { id: 'essentials_annual', label: 'Basic — $39.90/year' },
  { id: 'standard_monthly', label: 'Growth — $29.90/month' },
  { id: 'standard_annual', label: 'Growth — $299/year' },
  { id: 'premium_monthly', label: 'Pro — $75/month' },
  { id: 'premium_annual', label: 'Pro — $750/year' },
];

export const ADMIN_PLAN_IDS = ADMIN_PLAN_OPTIONS.map((p) => p.id);

export function normalizeAdminPlanId(planId) {
  if (!planId || planId === 'free') return 'free';
  return ADMIN_PLAN_IDS.includes(planId) ? planId : 'free';
}
