/**
 * Shared pricing plans for public pricing page and in-app PricingPlansPage.
 * Plan IDs for API: free | essentials_monthly | essentials_annual | standard_monthly | standard_annual | premium_monthly | premium_annual
 */
export const PLANS = [
  {
    id: 'trial_weekly',
    name: 'Starter Trial',
    tag: 'Popular',
    description:
      '7-day trial with full access. Perfect for testing wiblaster with up to 500 store scans daily. Automatically $1/week after trial ends.',
    price: 1,
    originalPrice: null,
    period: 'week',
    current: false,
    isTrial: true,
    features: {
      emails: '2,000',
      users: '1 seat',
      audiences: '1 audience',
      scans: '500 daily',
      support: 'Email support',
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
    price: 39,
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
    price: 79,
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

export function getDisplayPrice(monthlyPrice, isAnnually, period) {
  // Handle weekly pricing
  if (period === 'week') {
    return {
      primary: monthlyPrice,
      primaryLabel: 'week',
      secondary: null,
      secondaryLabel: null,
    };
  }
  
  // Handle annual pricing
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
  
  // Handle monthly pricing
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
