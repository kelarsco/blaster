/**
 * Admin manual plan assignment — syncs subscription + usage quotas with tier access rules.
 */
import { v4 as uuidv4 } from 'uuid';
import { syncReferralUpgradeFromSubscription } from './referralService.js';

export const ADMIN_ASSIGNABLE_PLAN_IDS = [
  'free',
  'trial_3day',
  'essentials_monthly',
  'essentials_annual',
  'standard_monthly',
  'standard_annual',
  'premium_monthly',
  'premium_annual',
];

function periodEndFromInterval(interval, start = new Date()) {
  const end = new Date(start);
  if (interval === 'annually') {
    end.setFullYear(end.getFullYear() + 1);
  } else if (interval === 'trial') {
    end.setDate(end.getDate() + 3);
  } else if (interval === 'weekly') {
    end.setDate(end.getDate() + 7);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export async function resetUserPlanUsageForPeriod(db, userId, periodStart, periodEnd) {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  await db.query(
    `INSERT INTO user_plan_usage (user_id, filter_uses, period_start, period_end, payg_filters_active, payg_filter_charges_cents, payg_pending_invoice_cents, updated_at)
     VALUES ($1, 0, $2, $3, 0, 0, 0, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       filter_uses = 0,
       period_start = $2,
       period_end = $3,
       payg_filters_active = 0,
       payg_filter_charges_cents = 0,
       payg_pending_invoice_cents = 0,
       updated_at = NOW()`,
    [userId, startIso, endIso]
  );
}

/**
 * Assign a user to a plan tier (or free trial). Updates subscription, resets filter/PAYG usage for paid tiers.
 */
export async function applyAdminUserPlanChange(db, userId, planId) {
  if (!ADMIN_ASSIGNABLE_PLAN_IDS.includes(planId)) {
    return { ok: false, error: 'Invalid plan ID' };
  }

  const sub = await db.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND status IN ('active','trialing')
     ORDER BY current_period_end DESC NULLS LAST LIMIT 1`,
    [userId]
  );

  if (planId === 'free') {
    if (sub.rows?.[0]) {
      await db.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
    }
    return { ok: true, planId: 'free' };
  }

  const planRow = await db.query('SELECT id, interval FROM plans WHERE id = $1', [planId]);
  if (!planRow.rows?.[0]) {
    return { ok: false, error: 'Plan not found in database' };
  }

  const interval = planRow.rows[0].interval || 'monthly';
  const periodStart = new Date();
  const periodEnd = periodEndFromInterval(interval, periodStart);

  if (sub.rows?.[0]) {
    await db.query(
      `UPDATE subscriptions SET plan_id = $1, status = 'active', current_period_start = $2, current_period_end = $3, updated_at = NOW() WHERE id = $4`,
      [planId, periodStart, periodEnd, sub.rows[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, 'active', $4, $5)`,
      [uuidv4(), userId, planId, periodStart, periodEnd]
    );
  }

  await resetUserPlanUsageForPeriod(db, userId, periodStart, periodEnd);

  try {
    await syncReferralUpgradeFromSubscription(userId);
  } catch (e) {
    console.warn('[referral upgrade admin]', e?.message || e);
  }

  return { ok: true, planId, periodStart, periodEnd };
}

export async function listAdminAssignablePlans(db) {
  const r = await db.query(
    `SELECT id, name, amount, interval FROM plans
     WHERE id = ANY($1::text[])
     ORDER BY CASE id
       WHEN 'free' THEN 0
       WHEN 'essentials_monthly' THEN 1
       WHEN 'essentials_annual' THEN 2
       WHEN 'standard_monthly' THEN 3
       WHEN 'standard_annual' THEN 4
       WHEN 'premium_monthly' THEN 5
       WHEN 'premium_annual' THEN 6
       ELSE 99 END`,
    [ADMIN_ASSIGNABLE_PLAN_IDS]
  );
  return r.rows || [];
}
