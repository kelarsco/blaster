/**
 * Shared pricing plans for public pricing page and in-app PricingPlansPage.
 * Client ids map to API plan ids: essentials_monthly | essentials_annual | standard_* | premium_*
 */
export const PLANS = [
  {
    id: 'free',
    name: 'Trial (Free)',
    tag: null,
    description:
      'Explore Wiblaster at no cost. Scan or upload up to 100 stores and send your first campaign — everything you need to see it in action.',
    price: 0,
    originalPrice: null,
    period: 'trial',
    current: false,
    isFreeTrial: true,
    noCard: true,
    highlights: [
      'Up to 100 stores (scan or upload)',
      'Send your first campaign',
      'No credit card required',
    ],
    features: {
      stores: '100',
      campaigns: 'First campaign',
      senders: '1',
      scans: '100',
    },
  },
  {
    id: 'essentials',
    name: 'Basic',
    tag: null,
    description:
      'For operators getting consistent. Run unlimited campaigns, reach referrals, and build your streak — with no scan limits and up to 5 sender emails.',
    price: 3.99,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Unlimited campaigns',
      'Referral program access',
      'Streaks & badges',
      'No scan limits',
      'Up to 5 sender emails',
    ],
    features: {
      emails: 'Unlimited campaigns',
      senders: '5',
      scans: 'Unlimited',
      campaigns: 'Unlimited',
    },
  },
  {
    id: 'standard',
    name: 'Growth',
    tag: 'Most popular',
    description:
      'Full platform access with analytics, stores, and advanced filters. Use up to 500 filters per month — and unlock pay-as-you-go if you need more.',
    price: 29.9,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Analytics & stores',
      'Advanced filters (500/month)',
      'Pay-as-you-go filter packs',
      'Everything in Basic',
    ],
    features: {
      filters: '500/month',
      analytics: true,
      stores: 'Full access',
      scans: 'Unlimited',
    },
  },
  {
    id: 'premium',
    name: 'Pro',
    tag: null,
    description:
      'No restrictions, no caps. Unlimited everything — filters, exports, senders, groups, and every feature on the platform.',
    price: 75,
    originalPrice: null,
    period: 'month',
    current: false,
    highlights: [
      'Unlimited filters & exports',
      'Unlimited senders & groups',
      'Every platform feature',
      'No caps or restrictions',
    ],
    features: {
      filters: 'Unlimited',
      senders: 'Unlimited',
      exports: 'Unlimited',
      scans: 'Unlimited',
    },
  },
];

export const PLAN_COMPARISON = {
  columns: ['Trial (Free)', 'Basic', 'Growth', 'Pro'],
  rows: [
    { label: 'Price', values: ['Free / 24 hours', '$3.99/month', '$29.90/month', '$75/month'] },
    { label: 'Store scans / uploads', values: ['Up to 100', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'Campaigns', values: ['First campaign', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'Sender emails', values: ['1', 'Up to 5', 'Up to 5', 'Unlimited'] },
    { label: 'Referrals & streaks', values: [false, true, true, true] },
    { label: 'Analytics & stores', values: [false, false, true, true] },
    { label: 'Advanced filters', values: [false, false, '500/month + pay-as-you-go', 'Unlimited'] },
    { label: 'Exports', values: [false, 'Standard', 'Advanced', 'Unlimited'] },
    { label: 'Credit card required', values: ['No', 'Yes', 'Yes', 'Yes'] },
  ],
};

export const MONTHS_BILLED_ANNUALLY = 10; // pay 10 months, get 12

export function formatPriceNum(n) {
  if (n == null) return '0';
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
}

export function getBillingPlanId(plan, isAnnually) {
  if (plan.id === 'free' || plan.isFreeTrial) return 'free';
  return isAnnually ? `${plan.id}_annual` : `${plan.id}_monthly`;
}

/** Map API subscription plan_id to client plan card id (free | essentials | standard | premium). */
export function subscriptionPlanIdToTier(planId) {
  if (!planId || planId === 'free') return 'free';
  if (planId.startsWith('essentials')) return 'essentials';
  if (planId.startsWith('standard')) return 'standard';
  if (planId.startsWith('premium')) return 'premium';
  if (planId === 'trial_weekly') return 'free';
  return null;
}

const PLAN_TIER_RANK = { free: 0, essentials: 1, standard: 2, premium: 3 };

export function getPlanTierRank(planId) {
  const tier = subscriptionPlanIdToTier(planId);
  return tier ? (PLAN_TIER_RANK[tier] ?? 0) : 0;
}

/** Button label for pricing card CTA (new subscribe, upgrade, downgrade, or billing switch). */
export function getSubscribeButtonLabel(plan, currentPlanId, isAnnually, subscribingPlanId) {
  const targetPlanId = getBillingPlanId(plan, isAnnually);
  if (subscribingPlanId === targetPlanId) return 'Redirecting…';
  if (plan.isFreeTrial) return 'Start free trial';

  if (!currentPlanId || currentPlanId === 'free') {
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
  if (plan.isFreeTrial || plan.id === 'free') return tier === 'free';
  return plan.id === tier;
}

export function getDisplayPrice(monthlyPrice, isAnnually, period) {
  if (period === 'trial') {
    return {
      primary: 0,
      primaryLabel: '24 hours',
      pricePrefix: 'Free',
      secondary: null,
      secondaryLabel: null,
    };
  }

  if (period === 'week') {
    return {
      primary: monthlyPrice,
      primaryLabel: 'week',
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
