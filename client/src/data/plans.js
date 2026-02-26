/**
 * Shared pricing plans for public pricing page and in-app PricingPlansPage.
 * Plan IDs for API: free | essentials_monthly | essentials_annual | standard_monthly | standard_annual | premium_monthly | premium_annual
 */
export const PLANS = [
  {
    id: 'free',
    name: 'Free trial',
    tag: null,
    description:
      '48-hour free trial to test wiblaster and validate results before upgrading.',
    price: 0,
    originalPrice: null,
    period: 'month',
    current: true,
    features: {
      emails: '200',
      users: '1 seat',
      audiences: '1 audience',
      support: 'Email (limited)',
      onboarding: false,
      ai: false,
    },
  },
  {
    id: 'essentials',
    name: 'Essentials',
    tag: null,
    description:
      'Reliable outreach for early-stage growth. Designed for solo operators and agencies beginning consistent outreach.',
    price: 8,
    originalPrice: 75,
    period: 'month',
    current: false,
    features: {
      emails: '5,000',
      users: '3 seats',
      audiences: '3 audiences',
      support: '24/7 email & chat support',
      onboarding: false,
      ai: false,
    },
  },
  {
    id: 'standard',
    name: 'Standard',
    tag: 'Best value',
    description:
      'Scale outreach with control, personalization, and automation. Built for serious outreach workflows that need stability and performance.',
    price: 160,
    originalPrice: 250,
    period: 'month',
    current: false,
    features: {
      emails: '50,000',
      users: '5 seats',
      audiences: '5 audiences',
      support: '24/7 email & chat support',
      onboarding: '1 session',
      ai: true,
    },
  },
  {
    id: 'premium',
    name: 'Custom',
    tag: null,
    description:
      'Custom package for enterprise and high-volume teams. Contact support for custom pricing and dedicated setup.',
    price: 0,
    originalPrice: null,
    period: 'month',
    current: false,
    customContact: true,
    features: {
      emails: 'Contact for custom',
      users: 'Custom seats',
      audiences: 'Custom',
      support: 'Priority onboarding & support',
      onboarding: 'Dedicated setup',
      ai: true,
    },
  },
];

export const MONTHS_BILLED_ANNUALLY = 10; // pay 10 months, get 12

export function formatPriceNum(n) {
  if (n == null) return '0';
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
}

export function getDisplayPrice(monthlyPrice, isAnnually) {
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
