/**
 * Shared pricing plans for public pricing page and in-app PricingPlansPage.
 * Client ids map to API plan ids: essentials_monthly | essentials_annual | standard_* | premium_* | trial_3day
 */
export const PLANS = [
  {
    id: 'essentials',
    name: 'Basic',
    tag: null,
    description: '',
    price: 29,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Full platform access',
      '500 store filters / month',
      'Unlimited scans & campaigns',
    ],
    features: {
      filters: '500/month',
      emails: 'unlimited',
      scans: 'unlimited',
      campaigns: 'unlimited',
      senders: 'unlimited',
    },
  },
  {
    id: 'standard',
    name: 'Growth',
    tag: 'Most popular',
    description: '',
    price: 75,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Everything in Basic',
      '1,500 store filters / month',
      'Analytics & advanced stores',
    ],
    features: {
      filters: '1500/month',
      analytics: true,
      stores: 'Full access',
      scans: 'unlimited',
      campaigns: 'unlimited',
      senders: 'unlimited',
    },
  },
  {
    id: 'premium',
    name: 'Pro',
    tag: null,
    description: '',
    price: 120,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Everything in Growth',
      'Unlimited store filters',
      'Unlimited exports & senders',
      'Priority platform access',
    ],
    features: {
      filters: 'unlimited',
      senders: 'unlimited',
      exports: 'unlimited',
      scans: 'unlimited',
      campaigns: 'unlimited',
    },
  },
];

export const TRIAL_PLAN = {
  id: 'trial_3day',
  name: '3-Day Trial',
  tag: null,
  description: '',
  price: 1,
  originalPrice: null,
  period: 'trial',
  isPaidTrial: true,
  highlights: [
    '3 days full scanner & campaigns',
    '20 store filters included',
    'Upgrade anytime to keep going',
  ],
  features: {
    filters: '20',
    scans: 'unlimited',
    campaigns: 'unlimited',
    senders: 'unlimited',
  },
};

export const PLAN_COMPARISON = {
  columns: ['3-Day Trial', 'Basic', 'Growth', 'Pro'],
  rows: [
    { label: 'Price', values: ['$1 / 3 days', '$29/month', '$75/month', '$120/month'] },
    { label: 'Store scans & campaigns', values: [true, true, true, true] },
    { label: 'Store filters', values: ['20', '500/month', '1,500/month', 'Unlimited'] },
    { label: 'Pay-as-you-go filters', values: [false, '100 searches / $1', '100 searches / $1', false] },
    { label: 'Analytics & stores', values: [true, true, true, true] },
    { label: 'Sender emails', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'Credit card required', values: ['Yes', 'Yes', 'Yes', 'Yes'] },
  ],
};

export const MONTHS_BILLED_ANNUALLY = 10;

export const FILTER_LIMITS = {
  trial_3day: 20,
  essentials: 500,
  standard: 1500,
  premium: 999999,
};

export const PAYG_PACK_SIZE = 100;
export const PAYG_PACK_PRICE = 1;

export function formatPriceNum(n) {
  if (n == null) return '0';
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
}

export function getBillingPlanId(plan, isAnnually) {
  if (plan.id === 'trial_3day') return 'trial_3day';
  if (plan.isFreeTrial || plan.id === 'free') return 'free';
  return isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
}

export function subscriptionPlanIdToTier(planId) {
  if (!planId || planId === 'free') return null;
  if (planId === 'trial_3day') return 'trial_3day';
  if (planId.startsWith('essentials')) return 'essentials';
  if (planId.startsWith('standard')) return 'standard';
  if (planId.startsWith('premium')) return 'premium';
  if (planId === 'trial_weekly') return 'trial_3day';
  return null;
}

const PLAN_TIER_RANK = { trial_3day: 0, essentials: 1, standard: 2, premium: 3 };

export function getPlanTierRank(planId) {
  const tier = subscriptionPlanIdToTier(planId);
  return tier ? (PLAN_TIER_RANK[tier] ?? 0) : -1;
}

export function getSubscribeButtonLabel(plan, currentPlanId, isAnnually, subscribingPlanId) {
  const targetPlanId = getBillingPlanId(plan, isAnnually);
  if (subscribingPlanId === targetPlanId) return 'Redirecting…';
  if (plan.isPaidTrial || plan.id === 'trial_3day') return 'Start 3-day trial';

  if (!currentPlanId) {
    return 'Get this plan';
  }

  if (currentPlanId === targetPlanId) {
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
  if (plan.id === 'trial_3day') return tier === 'trial_3day';
  return plan.id === tier;
}

export function getDisplayPrice(monthlyPrice, isAnnually, period) {
  if (period === 'trial') {
    return {
      primary: monthlyPrice,
      primaryLabel: '3 days',
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
