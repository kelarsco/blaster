/**
 * Shared pricing plans for public pricing page and in-app PricingPlansPage.
 * Client ids map to API plan ids: essentials_monthly | essentials_annual | standard_* | premium_* | trial_7day
 */
export const TRIAL_PLAN_ID = 'trial_7day';

/** User-facing label for qualified-store database lookups (replaces "store filters"). */
export const SEARCH_LIMIT_LABEL = 'store searches';

export const PLANS = [
  {
    id: 'essentials',
    name: 'Basic',
    tag: null,
    description: '',
    price: 19,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Full platform access',
      '1,000 store searches / month',
      'Unlimited scans & campaigns',
    ],
    features: {
      filters: '1000/month',
      emails: 'unlimited',
      scans: 'unlimited',
      campaigns: 'unlimited',
    },
  },
  {
    id: 'standard',
    name: 'Growth',
    tag: 'Most popular',
    description: '',
    price: 49,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Everything in Basic',
      '3,000 store searches / month',
      'Pay-as-you-go after limit',
    ],
    features: {
      filters: '3000/month',
      analytics: true,
      stores: 'Full access',
      scans: 'unlimited',
      campaigns: 'unlimited',
    },
  },
  {
    id: 'premium',
    name: 'Pro',
    tag: null,
    description: '',
    price: 99,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Everything in Growth',
      'Unlimited store searches',
      'Priority platform access',
    ],
    features: {
      filters: 'unlimited',
      exports: 'unlimited',
      scans: 'unlimited',
      campaigns: 'unlimited',
    },
  },
];

export const TRIAL_PLAN = {
  id: TRIAL_PLAN_ID,
  name: '7-Day Trial',
  tag: 'Try first',
  description: '',
  price: 1,
  originalPrice: null,
  period: 'trial',
  isPaidTrial: true,
  highlights: [
    '7 days full platform access',
    'Unlimited store searches during trial',
  ],
  features: {
    filters: 'unlimited',
    scans: 'unlimited',
    campaigns: 'unlimited',
  },
};

export const PLAN_COMPARISON = {
  columns: ['7-Day Trial', 'Basic', 'Growth', 'Pro'],
  rows: [
    { label: 'Price', values: ['$1 / 7 days', '$19/month', '$49/month', '$99/month'] },
    { label: 'Platform access', values: [true, true, true, true] },
    { label: 'Store searches', values: ['Unlimited', '1,000/month', '3,000/month', 'Unlimited'] },
    { label: 'Pay-as-you-go searches', values: [false, '100 searches / $1', '100 searches / $1', false] },
    { label: 'Scans & campaigns', values: [true, true, true, true] },
    { label: 'Credit card required', values: ['Yes', 'Yes', 'Yes', 'Yes'] },
  ],
};

export const MONTHS_BILLED_ANNUALLY = 10;

export const FILTER_LIMITS = {
  trial_7day: 999999,
  trial_3day: 999999,
  essentials: 1000,
  standard: 3000,
  premium: 999999,
};

export const PAYG_PACK_SIZE = 100;
export const PAYG_PACK_PRICE = 1;

export function formatPriceNum(n) {
  if (n == null) return '0';
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
}

export function getBillingPlanId(plan, isAnnually) {
  if (plan.id === TRIAL_PLAN_ID || plan.id === 'trial_3day') return TRIAL_PLAN_ID;
  if (plan.isFreeTrial || plan.id === 'free') return 'free';
  return isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
}

export function subscriptionPlanIdToTier(planId) {
  if (!planId || planId === 'free') return null;
  if (planId === TRIAL_PLAN_ID || planId === 'trial_3day' || planId === 'trial_weekly') return TRIAL_PLAN_ID;
  if (planId.startsWith('essentials')) return 'essentials';
  if (planId.startsWith('standard')) return 'standard';
  if (planId.startsWith('premium')) return 'premium';
  return null;
}

const PLAN_TIER_RANK = { trial_7day: 0, trial_3day: 0, essentials: 1, standard: 2, premium: 3 };

export function getPlanTierRank(planId) {
  const tier = subscriptionPlanIdToTier(planId);
  return tier ? (PLAN_TIER_RANK[tier] ?? 0) : -1;
}

export function isTrialPlanId(planId) {
  return planId === TRIAL_PLAN_ID || planId === 'trial_3day' || planId === 'trial_weekly';
}

export function getSubscribeButtonLabel(plan, currentPlanId, isAnnually, subscribingPlanId) {
  const targetPlanId = getBillingPlanId(plan, isAnnually);
  if (subscribingPlanId === targetPlanId) return 'Redirecting…';
  if (plan.isPaidTrial || plan.id === TRIAL_PLAN_ID) return 'Start 7-day trial';

  if (!currentPlanId) {
    return 'Get this plan';
  }

  if (currentPlanId === targetPlanId || (isTrialPlanId(currentPlanId) && isTrialPlanId(targetPlanId))) {
    return 'Current plan';
  }

  const currentRank = getPlanTierRank(currentPlanId);
  const targetRank = getPlanTierRank(targetPlanId);

  if (currentRank === targetRank) {
    return 'Switch billing period';
  }

  return targetRank > currentRank ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`;
}

export function isPlanCurrentForUser(plan, subscriptionPlanId) {
  const tier = subscriptionPlanIdToTier(subscriptionPlanId);
  if (plan.id === TRIAL_PLAN_ID) return isTrialPlanId(subscriptionPlanId);
  return plan.id === tier;
}

export function getDisplayPrice(monthlyPrice, isAnnually, period) {
  if (period === 'trial') {
    return {
      primary: monthlyPrice,
      primaryLabel: '7 days',
      pricePrefix: null,
      secondary: null,
      secondaryLabel: null,
    };
  }

  if (isAnnually && monthlyPrice > 0) {
    const totalAnnual = monthlyPrice * MONTHS_BILLED_ANNUALLY;
    const effectivePerMonth = totalAnnual / 12;
    return {
      primary: totalAnnual,
      primaryLabel: 'year',
      secondary: effectivePerMonth,
      secondaryLabel: 'mo',
    };
  }

  return {
    primary: monthlyPrice,
    primaryLabel: 'month',
    secondary: null,
    secondaryLabel: null,
  };
}

export const PLAN_KEY = 'wiblaster-plan';

export function storeSelectedPlan(planId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAN_KEY, planId);
  } catch (_) {}
}

export function getStoredPlanId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PLAN_KEY);
  } catch (_) {
    return null;
  }
}
