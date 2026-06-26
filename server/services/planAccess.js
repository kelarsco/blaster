/**
 * Plan access: 7-Day Trial ($1), Basic, Growth, Pro.
 * All paid tiers get full platform access; limits are store-search quotas only.
 */
import { getDb } from '../db.js';
import { getPeriodForUser } from './planLimitsPeriod.js';
import { getSignupTrialState, SIGNUP_TRIAL_HOURS } from './signupTrial.js';

export const TRIAL_PLAN_ID = 'trial_7day';
export const LEGACY_TRIAL_PLAN_IDS = ['trial_3day', 'trial_weekly'];

export const TIER_TRIAL = 0;
export const TIER_BASIC = 1;
export const TIER_GROWTH = 2;
export const TIER_PRO = 3;

export const TRIAL_DAYS = 7;
export const SIGNUP_TRIAL_HOURS_DEFAULT = SIGNUP_TRIAL_HOURS;
export const BASIC_FILTER_LIMIT = 1000;
export const GROWTH_FILTER_LIMIT = 3000;
export const UNLIMITED_FILTER_LIMIT = 999999;
export const PAYG_FILTER_CAP_CENTS = 10000;
export const PAYG_PER_USE_CENTS = 1;
export const PAYG_PACK_SIZE = 100;
export const PAYG_PACK_CENTS = 100;

const TIER_NAMES = {
  [TIER_TRIAL]: '7-Day Trial',
  [TIER_BASIC]: 'Basic',
  [TIER_GROWTH]: 'Growth',
  [TIER_PRO]: 'Pro',
};

const UPGRADE_TIER_INFO = {
  [TIER_BASIC]: { name: 'Basic', price: '$19/month', planId: 'essentials_monthly' },
  [TIER_GROWTH]: { name: 'Growth', price: '$49/month', planId: 'standard_monthly' },
  [TIER_PRO]: { name: 'Pro', price: '$99/month', planId: 'premium_monthly' },
};

function filterLimitForTier(tier) {
  if (tier === TIER_TRIAL || tier === TIER_PRO) return UNLIMITED_FILTER_LIMIT;
  if (tier === TIER_BASIC) return BASIC_FILTER_LIMIT;
  if (tier === TIER_GROWTH) return GROWTH_FILTER_LIMIT;
  return 0;
}

function tierHasPayg(tier) {
  return tier === TIER_BASIC || tier === TIER_GROWTH;
}

function tierTracksFilters(tier) {
  return tier === TIER_BASIC || tier === TIER_GROWTH;
}

async function getActiveSubscription(db, userId) {
  const r = await db.query(
    `SELECT s.plan_id, s.current_period_start, s.current_period_end, p.name AS plan_name, p.amount
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
       AND s.current_period_end > NOW()
     ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  return r.rows?.[0] || null;
}

export function planIdToTier(planId) {
  if (!planId || planId === 'free') return null;
  if (planId === TRIAL_PLAN_ID || LEGACY_TRIAL_PLAN_IDS.includes(planId)) return TIER_TRIAL;
  if (planId.startsWith('essentials')) return TIER_BASIC;
  if (planId.startsWith('standard')) return TIER_GROWTH;
  if (planId.startsWith('premium')) return TIER_PRO;
  return null;
}

async function ensureUsageRow(db, userId, periodStart, periodEnd) {
  const existing = await db.query('SELECT * FROM user_plan_usage WHERE user_id = $1', [userId]);
  const row = existing.rows?.[0];
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  if (!row) {
    await db.query(
      `INSERT INTO user_plan_usage (user_id, filter_uses, period_start, period_end, payg_filters_active, payg_filter_charges_cents, payg_pending_invoice_cents, updated_at)
       VALUES ($1, 0, $2, $3, 0, 0, 0, NOW())`,
      [userId, startIso, endIso]
    );
    return { filter_uses: 0, payg_filters_active: 0, payg_filter_charges_cents: 0, period_start: startIso, period_end: endIso };
  }

  const rowStart = row.period_start ? new Date(row.period_start).toISOString() : null;
  if (rowStart !== startIso) {
    await db.query(
      `UPDATE user_plan_usage SET filter_uses = 0, period_start = $2, period_end = $3,
       payg_filters_active = 0, payg_filter_charges_cents = 0, payg_pending_invoice_cents = 0, updated_at = NOW() WHERE user_id = $1`,
      [userId, startIso, endIso]
    );
    return { filter_uses: 0, payg_filters_active: 0, payg_filter_charges_cents: 0, period_start: startIso, period_end: endIso };
  }
  return row;
}

function tierLimitsForTier(tier) {
  const unlimited = 999999;
  const limits = {
    [TIER_TRIAL]: { campaignsActiveMax: unlimited },
    [TIER_BASIC]: { campaignsActiveMax: unlimited },
    [TIER_GROWTH]: { campaignsActiveMax: unlimited },
    [TIER_PRO]: { campaignsActiveMax: unlimited },
  };
  return limits[tier] || { campaignsActiveMax: 0 };
}

function buildAccessFlags(tier, hasAccess) {
  if (!hasAccess) {
    return {
      trialExpired: true,
      storesPage: 'blocked',
      storesFilters: true,
      storesResults: true,
      analytics: false,
      referral: false,
      streak: true,
      campaignsActiveMax: 0,
      filterLimit: 0,
      filtersBlocked: true,
      exportCopyBlocked: true,
      paygAvailable: false,
    };
  }

  const filterLimit = filterLimitForTier(tier);
  const tierLimits = tierLimitsForTier(tier);
  const fullAccess = {
    trialExpired: false,
    storesPage: 'full',
    storesFilters: false,
    storesResults: false,
    analytics: false,
    referral: false,
    streak: false,
    campaignsActiveMax: tierLimits.campaignsActiveMax,
    filterLimit,
    filtersBlocked: false,
    exportCopyBlocked: false,
    paygAvailable: tierHasPayg(tier),
  };

  return fullAccess;
}

export async function getPlanStatusForUser(userId) {
  const db = getDb();
  if (!db) {
    return {
      tier: null,
      tierName: 'No plan',
      planId: null,
      trialExpired: true,
      trialEndsAt: null,
      trialHoursRemaining: null,
      access: buildAccessFlags(null, false),
      filterUses: 0,
      filterLimit: 0,
      paygActive: false,
      paygChargesCents: 0,
      paygCapCents: PAYG_FILTER_CAP_CENTS,
      paygPerUseCents: PAYG_PER_USE_CENTS,
      paygPackSize: PAYG_PACK_SIZE,
      paygPackCents: PAYG_PACK_CENTS,
      paygPendingInvoiceCents: 0,
      filtersBlocked: true,
      exportCopyBlocked: true,
      sendersUsed: 0,
      sendersMax: 0,
      groupsUsed: 0,
      groupsMax: 0,
      campaignsActive: 0,
      campaignsActiveMax: 0,
      scansUsed: 0,
      scansLimit: 0,
      upgradeTierInfo: UPGRADE_TIER_INFO,
    };
  }

  const sub = await getActiveSubscription(db, userId);
  const planId = sub?.plan_id || null;
  let tier = planId ? planIdToTier(planId) : null;
  let hasAccess = tier != null;

  const signupTrial = !sub ? await getSignupTrialState(db, userId) : { active: false, endsAt: null, hoursRemaining: 0 };
  if (!hasAccess && signupTrial.active) {
    hasAccess = true;
    tier = TIER_TRIAL;
  }

  const trialExpired = !hasAccess;
  const isPaidTrial =
    Boolean(sub) &&
    tier === TIER_TRIAL &&
    (planId === TRIAL_PLAN_ID || LEGACY_TRIAL_PLAN_IDS.includes(planId));
  const access = buildAccessFlags(tier, hasAccess);

  const period = sub
    ? { start: new Date(sub.current_period_start), end: new Date(sub.current_period_end) }
    : await getPeriodForUser(db, userId);

  const usageRow = tierTracksFilters(tier) ? await ensureUsageRow(db, userId, period.start, period.end) : null;
  const filterUses = usageRow?.filter_uses || 0;
  const paygActive = Boolean(usageRow?.payg_filters_active);
  const paygChargesCents = usageRow?.payg_filter_charges_cents || 0;
  const paygPendingInvoiceCents = usageRow?.payg_pending_invoice_cents || 0;
  const filterLimit = access.filterLimit;

  let filtersBlocked = access.filtersBlocked;
  let exportCopyBlocked = access.exportCopyBlocked;

  if (tierTracksFilters(tier)) {
    if (filterUses >= filterLimit && !paygActive) {
      filtersBlocked = true;
      exportCopyBlocked = true;
    } else if (paygActive && paygChargesCents >= PAYG_FILTER_CAP_CENTS) {
      filtersBlocked = true;
      exportCopyBlocked = true;
    }
  }

  const campaignsCount = await db.query(
    `SELECT COUNT(*) AS c FROM campaigns WHERE user_id = $1 AND status IN ('running', 'paused')`,
    [userId]
  );

  const start = period.start.toISOString();
  const end = period.end.toISOString();
  const scansRes = await db.query(
    `SELECT COALESCE(SUM(total_urls), 0) AS total FROM scans WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
    [userId, start, end]
  );
  const scansUsed = parseInt(scansRes.rows?.[0]?.total ?? '0', 10);

  const trialEndsAt = isPaidTrial && sub?.current_period_end
    ? new Date(sub.current_period_end).toISOString()
    : null;
  const msRemaining = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const trialHoursRemaining = trialEndsAt ? Math.max(0, msRemaining / (60 * 60 * 1000)) : 0;

  const signupTrialEndsAt = signupTrial.active && signupTrial.endsAt
    ? signupTrial.endsAt.toISOString()
    : null;

  return {
    tier,
    tierName: tier != null ? (TIER_NAMES[tier] || 'Plan') : 'No active plan',
    planId: planId || (signupTrial.active ? 'signup_trial' : null),
    planName: sub?.plan_name || (signupTrial.active ? 'Welcome access' : 'No active plan'),
    planAmountCents: sub?.amount || 0,
    trialActive: isPaidTrial,
    signupTrialActive: signupTrial.active,
    signupTrialEndsAt,
    signupTrialHoursRemaining: signupTrial.hoursRemaining,
    trialExpired,
    trialEndsAt,
    trialHoursRemaining: isPaidTrial ? trialHoursRemaining : 0,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    access: { ...access, filtersBlocked, exportCopyBlocked },
    filterUses,
    filterLimit,
    paygActive,
    paygChargesCents,
    paygCapCents: PAYG_FILTER_CAP_CENTS,
    paygPerUseCents: PAYG_PER_USE_CENTS,
    paygPackSize: PAYG_PACK_SIZE,
    paygPackCents: PAYG_PACK_CENTS,
    paygPendingInvoiceCents,
    filtersBlocked,
    exportCopyBlocked,
    sendersUsed: 0,
    sendersMax: 0,
    groupsUsed: 0,
    groupsMax: 0,
    campaignsActive: parseInt(campaignsCount.rows?.[0]?.c ?? '0', 10),
    campaignsActiveMax: access.campaignsActiveMax,
    scansUsed,
    scansLimit: hasAccess ? 999999 : 0,
    upgradeTierInfo: UPGRADE_TIER_INFO,
  };
}

export async function recordFilterOrExportUse(userId) {
  const status = await getPlanStatusForUser(userId);
  if (status.tier === TIER_PRO) return { ok: true, status };
  if (!tierTracksFilters(status.tier)) return { ok: false, reason: 'not_allowed', status };

  const db = getDb();
  if (!db) return { ok: false, reason: 'no_db', status };

  const period = { start: new Date(status.periodStart), end: new Date(status.periodEnd) };
  const usageRow = await ensureUsageRow(db, userId, period.start, period.end);
  const uses = usageRow.filter_uses || 0;
  const paygActive = Boolean(usageRow.payg_filters_active);
  const paygCharges = usageRow.payg_filter_charges_cents || 0;
  const filterLimit = status.filterLimit;

  if (uses >= filterLimit && !paygActive) {
    return { ok: false, reason: 'filter_limit', status };
  }
  if (paygActive && paygCharges >= PAYG_FILTER_CAP_CENTS) {
    return { ok: false, reason: 'payg_cap', status };
  }

  const result = await db.query(
    `UPDATE user_plan_usage SET
       filter_uses = filter_uses + 1,
       payg_filter_charges_cents = CASE
         WHEN payg_filters_active = 1 AND filter_uses + 1 > $3
         THEN payg_filter_charges_cents + $4
         ELSE payg_filter_charges_cents
       END,
       payg_pending_invoice_cents = CASE
         WHEN payg_filters_active = 1 AND filter_uses + 1 > $3
         THEN payg_pending_invoice_cents + $4
         ELSE payg_pending_invoice_cents
       END,
       updated_at = NOW()
     WHERE user_id = $1
       AND (
         filter_uses < $2
         OR (payg_filters_active = 1 AND payg_filter_charges_cents < $5)
       )
     RETURNING filter_uses, payg_filter_charges_cents`,
    [userId, filterLimit, filterLimit, PAYG_PER_USE_CENTS, PAYG_FILTER_CAP_CENTS]
  );

  if (!result.rows?.length) {
    if (paygActive && paygCharges >= PAYG_FILTER_CAP_CENTS) {
      return { ok: false, reason: 'payg_cap', status };
    }
    return { ok: false, reason: 'filter_limit', status };
  }

  const updated = await getPlanStatusForUser(userId);
  return { ok: true, status: updated };
}

export async function activatePaygFilters(userId) {
  const status = await getPlanStatusForUser(userId);
  if (!tierHasPayg(status.tier)) return { ok: false, reason: 'not_eligible', status };

  const db = getDb();
  if (!db) return { ok: false, reason: 'no_db', status };

  const period = { start: new Date(status.periodStart), end: new Date(status.periodEnd) };
  await ensureUsageRow(db, userId, period.start, period.end);
  await db.query(
    `UPDATE user_plan_usage SET payg_filters_active = 1, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );

  return { ok: true, status: await getPlanStatusForUser(userId) };
}

export async function checkSenderLimit() {
  return { ok: true };
}

export async function checkGroupLimit() {
  return { ok: true };
}

export async function checkCampaignLimit(userId) {
  const status = await getPlanStatusForUser(userId);
  if (!status.trialExpired && status.campaignsActive >= status.campaignsActiveMax) {
    return { ok: false, reason: 'campaign_limit', status, upgradeTier: TIER_BASIC };
  }
  return { ok: true, status };
}
