/** Admin dropdown labels for manual plan assignment */
export const ADMIN_PLAN_OPTIONS = [
  { id: 'trial_7day', label: '7-Day Trial — $1' },
  { id: 'essentials_monthly', label: 'Basic — $19/month' },
  { id: 'essentials_annual', label: 'Basic — $190/year' },
  { id: 'standard_monthly', label: 'Growth — $49/month' },
  { id: 'standard_annual', label: 'Growth — $490/year' },
  { id: 'premium_monthly', label: 'Pro — $99/month' },
  { id: 'premium_annual', label: 'Pro — $990/year' },
  { id: 'free', label: 'No plan (free)' },
];

const ADMIN_PLAN_IDS = new Set(ADMIN_PLAN_OPTIONS.map((p) => p.id));

const LEGACY_PLAN_ALIASES = {
  trial_3day: 'trial_7day',
  trial_weekly: 'trial_7day',
  essentials: 'essentials_monthly',
  standard: 'standard_monthly',
  premium: 'premium_monthly',
};

/** Map stored plan ids to a valid admin dropdown value. */
export function normalizeAdminPlanId(planId) {
  if (!planId || planId === 'free') return 'free';
  if (ADMIN_PLAN_IDS.has(planId)) return planId;
  if (LEGACY_PLAN_ALIASES[planId]) return LEGACY_PLAN_ALIASES[planId];
  return 'free';
}
