/**
 * Admin-assignable plans — matches in-app pricing tiers.
 */
export const ADMIN_PLAN_OPTIONS = [
  { id: 'trial_3day', label: '3-Day Trial — $1' },
  { id: 'essentials_monthly', label: 'Basic — $29/month' },
  { id: 'essentials_annual', label: 'Basic — $290/year' },
  { id: 'standard_monthly', label: 'Growth — $75/month' },
  { id: 'standard_annual', label: 'Growth — $750/year' },
  { id: 'premium_monthly', label: 'Pro — $120/month' },
  { id: 'premium_annual', label: 'Pro — $1,200/year' },
];

export const ADMIN_PLAN_IDS = ADMIN_PLAN_OPTIONS.map((p) => p.id);

export function normalizeAdminPlanId(planId) {
  if (!planId) return null;
  return ADMIN_PLAN_IDS.includes(planId) ? planId : null;
}
