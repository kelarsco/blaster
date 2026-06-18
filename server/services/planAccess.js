/**
 * 4-tier plan access: Trial (0), Basic (1), Growth (2), Pro (3).
 */
import { getDb } from '../db.js';
import { getPeriodForUser } from './planLimitsPeriod.js';

export const TIER_TRIAL = 0;
export const TIER_BASIC = 1;
export const TIER_GROWTH = 2;
export const TIER_PRO = 3;

export const FREE_TRIAL_HOURS = 24;
export const GROWTH_FILTER_LIMIT = 500;
export const PAYG_FILTER_CAP_CENTS = 1000;
export const PAYG_PER_USE_CENTS = 5;

const TIER_NAMES = {
  [TIER_TRIAL]: 'Trial (Free)',
  [TIER_BASIC]: 'Basic',
  [TIER_GROWTH]: 'Growth',
  [TIER_PRO]: 'Pro',
};

const UPGRADE_TIER_INFO = {
  [TIER_BASIC]: { name: 'Basic', price: '$3.99/month', planId: 'essentials_monthly' },
  [TIER_GROWTH]: { name: 'Growth', price: '$29.90/month', planId: 'standard_monthly' },
  [TIER_PRO]: { name: 'Pro', price: '$75/month', planId: 'premium_monthly' },
};

async function getActiveSubscription(db, userId) {
  const r = await db.query(
    `SELECT s.plan_id, s.current_period_start, s.current_period_end, p.name AS plan_name, p.amount
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
     ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  return r.rows?.[0] || null;
}

async function getTrialState(db, userId) {
  const row = await db.query('SELECT created_at FROM users WHERE id = $1 LIMIT 1', [userId]);
  const createdAt = row.rows?.[0]?.created_at ? new Date(row.rows[0].created_at) : new Date();
  const endsAt = new Date(createdAt.getTime() + FREE_TRIAL_HOURS * 60 * 60 * 1000);
  const active = endsAt.getTime() > Date.now();
  return { active, endsAt, startedAt: createdAt };
}

export function planIdToTier(planId, trialActive) {
  if (!planId || planId === 'free') return TIER_TRIAL;
  if (planId.startsWith('essentials')) return TIER_BASIC;
  if (planId.startsWith('standard')) return TIER_GROWTH;
  if (planId.startsWith('premium')) return TIER_PRO;
  if (planId === 'trial_weekly') return TIER_BASIC;
  return TIER_BASIC;
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
       payg_filters_active = 0, payg_filter_charges_cents = 0, updated_at = NOW() WHERE user_id = $1`,
      [userId, startIso, endIso]
    );
    return { filter_uses: 0, payg_filters_active: 0, payg_filter_charges_cents: 0, period_start: startIso, period_end: endIso };
  }
  return row;
}

function buildAccessFlags(tier, trialExpired) {
  if (trialExpired) {
    return {
      trialExpired: true,
      storesPage: 'blocked',
      storesFilters: true,
      storesResults: true,
      analytics: true,
      referral: true,
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

  if (tier === TIER_TRIAL) {
    return {
      trialExpired: false,
      storesPage: 'partial',
      storesFilters: true,
      storesResults: true,
      analytics: true,
      referral: true,
      streak: true,
      sendersMax: 1,
      groupsMax: 1,
      campaignsActiveMax: 1,
      filterLimit: 0,
      filtersBlocked: true,
      exportCopyBlocked: true,
      paygAvailable: false,
    };
  }

  if (tier === TIER_BASIC) {
    return {
      trialExpired: false,
      storesPage: 'blocked',
      storesFilters: true,
      storesResults: true,
      analytics: true,
      referral: false,
      streak: false,
      sendersMax: 5,
      groupsMax: 999999,
      campaignsActiveMax: 999999,
      filterLimit: 0,
      filtersBlocked: true,
      exportCopyBlocked: true,
      paygAvailable: false,
    };
  }

  if (tier === TIER_GROWTH) {
    return {
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
      filterLimit: GROWTH_FILTER_LIMIT,
      filtersBlocked: false,
      exportCopyBlocked: false,
      paygAvailable: true,
    };
  }

  return {
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
    filterLimit: 999999,
    filtersBlocked: false,
    exportCopyBlocked: false,
    paygAvailable: false,
  };
}

export async function getPlanStatusForUser(userId) {
  const db = getDb();
  if (!db) {
    return {
      tier: TIER_TRIAL,
      tierName: TIER_NAMES[TIER_TRIAL],
      planId: 'free',
      trialExpired: false,
      trialEndsAt: null,
      trialHoursRemaining: null,
      access: buildAccessFlags(TIER_TRIAL, false),
      filterUses: 0,
      filterLimit: 0,
      paygActive: false,
      paygChargesCents: 0,
      paygCapCents: PAYG_FILTER_CAP_CENTS,
      paygPendingInvoiceCents: 0,
      filtersBlocked: true,
      exportCopyBlocked: true,
      sendersUsed: 0,
      sendersMax: 1,
      groupsUsed: 0,
      groupsMax: 1,
      campaignsActive: 0,
      campaignsActiveMax: 1,
      scansUsed: 0,
      scansLimit: 100,
    };
  }

  const sub = await getActiveSubscription(db, userId);
  const trial = await getTrialState(db, userId);
  const planId = sub?.plan_id || 'free';
  const trialExpired = !sub && !trial.active;
  const tier = sub ? planIdToTier(planId, false) : TIER_TRIAL;
  const access = buildAccessFlags(tier, trialExpired);

  const period = sub
    ? { start: new Date(sub.current_period_start), end: new Date(sub.current_period_end) }
    : await getPeriodForUser(db, userId);

  const usageRow = tier === TIER_GROWTH ? await ensureUsageRow(db, userId, period.start, period.end) : null;
  const filterUses = usageRow?.filter_uses || 0;
  const paygActive = Boolean(usageRow?.payg_filters_active);
  const paygChargesCents = usageRow?.payg_filter_charges_cents || 0;
  const paygPendingInvoiceCents = usageRow?.payg_pending_invoice_cents || 0;

  let filtersBlocked = access.filtersBlocked;
  let exportCopyBlocked = access.exportCopyBlocked;

  if (tier === TIER_GROWTH) {
    if (filterUses >= GROWTH_FILTER_LIMIT && !paygActive) {
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

  let scansLimit = 999999;
  if (tier === TIER_TRIAL && !trialExpired) scansLimit = 100;
  if (trialExpired) scansLimit = 0;

  const msRemaining = trial.active ? trial.endsAt.getTime() - Date.now() : 0;
  const trialHoursRemaining = trial.active ? Math.max(0, msRemaining / (60 * 60 * 1000)) : 0;

  return {
    tier,
    tierName: TIER_NAMES[tier] || 'Trial (Free)',
    planId,
    planName: sub?.plan_name || (trialExpired ? 'Free (expired)' : 'Trial (Free)'),
    planAmountCents: sub?.amount || 0,
    trialActive: trial.active && !sub,
    trialExpired,
    trialEndsAt: trial.endsAt?.toISOString() || null,
    trialHoursRemaining: trial.active ? trialHoursRemaining : 0,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    access: { ...access, filtersBlocked, exportCopyBlocked },
    filterUses,
    filterLimit: access.filterLimit,
    paygActive,
    paygChargesCents,
    paygCapCents: PAYG_FILTER_CAP_CENTS,
    paygPerUseCents: PAYG_PER_USE_CENTS,
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
    scansLimit,
    upgradeTierInfo: UPGRADE_TIER_INFO,
  };
}

export async function recordFilterOrExportUse(userId) {
  const status = await getPlanStatusForUser(userId);
  if (status.tier === TIER_PRO) return { ok: true, status };
  if (status.tier !== TIER_GROWTH) return { ok: false, reason: 'not_allowed', status };

  const db = getDb();
  if (!db) return { ok: false, reason: 'no_db', status };

  const period = { start: new Date(status.periodStart), end: new Date(status.periodEnd) };
  const usageRow = await ensureUsageRow(db, userId, period.start, period.end);
  const uses = usageRow.filter_uses || 0;
  const paygActive = Boolean(usageRow.payg_filters_active);
  const paygCharges = usageRow.payg_filter_charges_cents || 0;

  if (uses >= GROWTH_FILTER_LIMIT && !paygActive) {
    return { ok: false, reason: 'filter_limit', status };
  }
  if (paygActive && paygCharges >= PAYG_FILTER_CAP_CENTS) {
    return { ok: false, reason: 'payg_cap', status };
  }

  const newUses = uses + 1;
  let newCharges = paygCharges;
  if (newUses > GROWTH_FILTER_LIMIT && paygActive) {
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
  if (status.tier !== TIER_GROWTH) return { ok: false, reason: 'not_growth', status };

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
  if (status.sendersUsed >= status.sendersMax) {
    return { ok: false, reason: 'sender_limit', status, upgradeTier: status.tier < TIER_GROWTH ? TIER_BASIC : TIER_GROWTH };
  }
  return { ok: true, status };
}

export async function checkGroupLimit(userId) {
  const status = await getPlanStatusForUser(userId);
  if (status.groupsUsed >= status.groupsMax) {
    return { ok: false, reason: 'group_limit', status, upgradeTier: TIER_BASIC };
  }
  return { ok: true, status };
}

export async function checkCampaignLimit(userId) {
  const status = await getPlanStatusForUser(userId);
  if (status.campaignsActive >= status.campaignsActiveMax) {
    return { ok: false, reason: 'campaign_limit', status, upgradeTier: TIER_BASIC };
  }
  return { ok: true, status };
}
