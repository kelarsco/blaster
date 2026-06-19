/**
 * Plan access: 3-Day Trial ($1), Basic, Growth, Pro.
 */
import { getDb } from '../db.js';
import { getPeriodForUser } from './planLimitsPeriod.js';

export const TIER_TRIAL = 0;
export const TIER_BASIC = 1;
export const TIER_GROWTH = 2;
export const TIER_PRO = 3;

export const TRIAL_DAYS = 3;
export const TRIAL_FILTER_LIMIT = 20;
export const BASIC_FILTER_LIMIT = 500;
export const GROWTH_FILTER_LIMIT = 1500;
export const PAYG_FILTER_CAP_CENTS = 10000;
export const PAYG_PER_USE_CENTS = 1;
export const PAYG_PACK_SIZE = 100;
export const PAYG_PACK_CENTS = 100;

const TIER_NAMES = {
  [TIER_TRIAL]: '3-Day Trial',
  [TIER_BASIC]: 'Basic',
  [TIER_GROWTH]: 'Growth',
  [TIER_PRO]: 'Pro',
};

const UPGRADE_TIER_INFO = {
  [TIER_BASIC]: { name: 'Basic', price: '$29/month', planId: 'essentials_monthly' },
  [TIER_GROWTH]: { name: 'Growth', price: '$75/month', planId: 'standard_monthly' },
  [TIER_PRO]: { name: 'Pro', price: '$120/month', planId: 'premium_monthly' },
};

function filterLimitForTier(tier) {
  if (tier === TIER_TRIAL) return TRIAL_FILTER_LIMIT;
  if (tier === TIER_BASIC) return BASIC_FILTER_LIMIT;
  if (tier === TIER_GROWTH) return GROWTH_FILTER_LIMIT;
  return 999999;
}

function tierHasPayg(tier) {
  return tier === TIER_BASIC || tier === TIER_GROWTH;
}

function tierTracksFilters(tier) {
  return tier === TIER_TRIAL || tier === TIER_BASIC || tier === TIER_GROWTH;
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
  if (planId === 'trial_3day' || planId === 'trial_weekly') return TIER_TRIAL;
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
      sendersMax: 0,
      groupsMax: 0,
      campaignsActiveMax: 0,
      filterLimit: 0,
      filtersBlocked: true,
      exportCopyBlocked: true,
      paygAvailable: false,
    };
  }

  const filterLimit = filterLimitForTier(tier);
  const fullAccess = {
    trialExpired: false,
    storesPage: 'full',
    storesFilters: false,
    storesResults: false,
    analytics: false,
    referral: false,
    streak: false,
    sendersMax: 999999,
    groupsMax: 999999,
    campaignsActiveMax: 999999,
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
  const tier = planId ? planIdToTier(planId) : null;
  const hasAccess = tier != null;
  const trialExpired = !hasAccess;
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

  const sendersCount = await db.query('SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1', [userId]);
  const groupsCount = await db.query('SELECT COUNT(*) AS c FROM sender_groups WHERE user_id = $1', [userId]);
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

  const trialEndsAt = tier === TIER_TRIAL && sub?.current_period_end
    ? new Date(sub.current_period_end).toISOString()
    : null;
  const msRemaining = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const trialHoursRemaining = trialEndsAt ? Math.max(0, msRemaining / (60 * 60 * 1000)) : 0;

  return {
    tier,
    tierName: tier != null ? (TIER_NAMES[tier] || 'Plan') : 'No active plan',
    planId,
    planName: sub?.plan_name || 'No active plan',
    planAmountCents: sub?.amount || 0,
    trialActive: tier === TIER_TRIAL,
    trialExpired,
    trialEndsAt,
    trialHoursRemaining: tier === TIER_TRIAL ? trialHoursRemaining : 0,
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
    sendersUsed: parseInt(sendersCount.rows?.[0]?.c ?? '0', 10),
    sendersMax: access.sendersMax,
    groupsUsed: parseInt(groupsCount.rows?.[0]?.c ?? '0', 10),
    groupsMax: access.groupsMax,
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

  const newUses = uses + 1;
  let newCharges = paygCharges;
  if (newUses > filterLimit && paygActive) {
    newCharges += PAYG_PER_USE_CENTS;
  }

  await db.query(
    `UPDATE user_plan_usage SET filter_uses = $2, payg_filter_charges_cents = $3, payg_pending_invoice_cents = $3, updated_at = NOW() WHERE user_id = $1`,
    [userId, newUses, newCharges]
  );

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

export async function checkSenderLimit(userId) {
  const status = await getPlanStatusForUser(userId);
  if (!status.trialExpired && status.sendersUsed >= status.sendersMax) {
    return { ok: false, reason: 'sender_limit', status, upgradeTier: TIER_BASIC };
  }
  return { ok: true, status };
}

export async function checkGroupLimit(userId) {
  const status = await getPlanStatusForUser(userId);
  if (!status.trialExpired && status.groupsUsed >= status.groupsMax) {
    return { ok: false, reason: 'group_limit', status, upgradeTier: TIER_BASIC };
  }
  return { ok: true, status };
}

export async function checkCampaignLimit(userId) {
  const status = await getPlanStatusForUser(userId);
  if (!status.trialExpired && status.campaignsActive >= status.campaignsActiveMax) {
    return { ok: false, reason: 'campaign_limit', status, upgradeTier: TIER_BASIC };
  }
  return { ok: true, status };
}
