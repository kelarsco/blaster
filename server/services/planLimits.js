import { getDb } from '../db.js';

/** Default sender limit when user has no subscription (free). */
const DEFAULT_SENDER_LIMIT = 1;

/** Cap for "unlimited" plans. */
const UNLIMITED_SENDERS = 999;
const UNLIMITED_NUM = 999999;

function parseFeatureNum(features, key, defaultVal) {
  const v = features?.[key];
  if (v == null) return defaultVal;
  const str = String(v).toLowerCase();
  if (str === 'unlimited' || str === '∞') return UNLIMITED_NUM;
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? defaultVal : n;
}

/**
 * Get period boundaries for usage: subscribed users use subscription period; free use current calendar month.
 */
async function getPeriodForUser(db, userId) {
  const sub = await db.query(
    `SELECT current_period_start, current_period_end FROM subscriptions
     WHERE user_id = $1 AND status IN ('active', 'trialing')
     ORDER BY current_period_end DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  const row = sub.rows?.[0];
  if (row?.current_period_start != null && row?.current_period_end != null) {
    return { start: new Date(row.current_period_start), end: new Date(row.current_period_end) };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Full plan limits and current usage for a user (emails, scans, senders, campaigns, seats).
 * Used for enforcement and UI.
 */
export async function getPlanLimitsForUser(userId) {
  const db = getDb();
  const defaults = {
    planId: 'free',
    emailsLimit: 500,
    scansLimit: 1000,
    sendersLimit: 1,
    campaignsLimit: 1,
    usersLimit: 1,
    periodStart: null,
    periodEnd: null,
    emailsUsed: 0,
    scansUsed: 0,
    sendersUsed: 0,
    campaignsActive: 0,
  };
  if (!db) return defaults;

  const sub = await db.query(
    `SELECT s.plan_id, s.current_period_start, s.current_period_end, p.features
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
     ORDER BY s.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [userId]
  );
  const row = sub.rows?.[0];
  const features = row?.features || {};
  const planId = row?.plan_id ?? 'free';

  const period = await getPeriodForUser(db, userId);
  defaults.periodStart = period.start;
  defaults.periodEnd = period.end;

  const feats = row ? features : (await db.query(`SELECT features FROM plans WHERE id = 'free' LIMIT 1`).then((r) => r.rows?.[0]?.features || {}));
  defaults.emailsLimit = parseFeatureNum(feats, 'emails', 500);
  defaults.scansLimit = parseFeatureNum(feats, 'scans', 1000);
  defaults.usersLimit = row ? parseFeatureNum(features, 'users', 1) : 1;
  const camp = feats.campaigns;
  if (camp != null) {
    const s = String(camp).toLowerCase();
    defaults.campaignsLimit = s === 'unlimited' || s === '∞' ? UNLIMITED_NUM : Math.max(0, parseInt(camp, 10) || 1);
  }

  const sendersLimit = await getSenderLimitForUser(userId).then((r) => r.limit);
  defaults.sendersLimit = sendersLimit;

  const start = period.start.toISOString();
  const end = period.end.toISOString();

  const [emailsRes, scansRes, campaignsRes] = await Promise.all([
    db.query(
      `SELECT COUNT(*) AS total FROM campaign_sends cs
       JOIN campaigns c ON c.id = cs.campaign_id AND c.user_id = $1
       WHERE cs.status = 'sent' AND cs.sent_at >= $2 AND cs.sent_at <= $3`,
      [userId, start, end]
    ),
    db.query(
      `SELECT COALESCE(SUM(total_urls), 0) AS total FROM scans WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [userId, start, end]
    ),
    db.query(
      `SELECT COUNT(*) AS c FROM campaigns WHERE user_id = $1 AND status IN ('running', 'paused')`,
      [userId]
    ),
  ]);
  defaults.emailsUsed = parseInt(emailsRes.rows?.[0]?.total ?? '0', 10);
  defaults.scansUsed = parseInt(scansRes.rows?.[0]?.total ?? '0', 10);
  defaults.campaignsActive = parseInt(campaignsRes.rows?.[0]?.c ?? '0', 10);

  const sendersCount = await db.query(
    'SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1',
    [userId]
  );
  defaults.sendersUsed = parseInt(sendersCount.rows?.[0]?.c ?? '0', 10);

  const overageScans = Math.max(0, defaults.scansUsed - defaults.scansLimit);
  const overageEmails = Math.max(0, defaults.emailsUsed - defaults.emailsLimit);
  const extraOwed = Math.floor(overageScans / 500) + Math.floor(overageEmails / 300);
  const extraRows = await db.query('SELECT paid_cents FROM user_extra_credit WHERE user_id = $1', [userId]);
  const paidCents = extraRows.rows?.[0]?.paid_cents ?? 0;
  const paidDollars = paidCents / 100;
  const EXTRA_THRESHOLDS = [10, 30, 50, 100];
  const extraNextThreshold = EXTRA_THRESHOLDS.find((t) => t > paidDollars) ?? 100;
  defaults.extraCreditOwed = extraOwed;
  defaults.extraCreditPaidCents = paidCents;
  defaults.extraCreditNextThreshold = extraNextThreshold;
  defaults.extraCreditBlocked = extraOwed >= extraNextThreshold;

  return defaults;
}

/**
 * Get the sender limit for a user based on their active subscription plan.
 * @param {string} userId
 * @returns {Promise<{ limit: number, planId: string | null }>}
 */
export async function getSenderLimitForUser(userId) {
  const db = getDb();
  if (!db) return { limit: DEFAULT_SENDER_LIMIT, planId: null };

  const sub = await db.query(
    `SELECT s.plan_id, p.features
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
     ORDER BY s.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [userId]
  );
  const row = sub.rows?.[0];
  if (!row) {
    const freeRow = await db.query(`SELECT features FROM plans WHERE id = 'free' LIMIT 1`);
    const features = freeRow.rows?.[0]?.features || {};
    const senders = features.senders;
    if (senders == null) return { limit: DEFAULT_SENDER_LIMIT, planId: null };
    const str = String(senders).toLowerCase();
    const num = str === 'unlimited' || str === '∞' ? UNLIMITED_SENDERS : parseInt(senders, 10);
    return { limit: Number.isNaN(num) ? DEFAULT_SENDER_LIMIT : Math.min(Math.max(0, num), UNLIMITED_SENDERS), planId: null };
  }

  const features = row.features || {};
  const senders = features.senders;
  if (senders == null) return { limit: DEFAULT_SENDER_LIMIT, planId: row.plan_id };
  const str = String(senders).toLowerCase();
  if (str === 'unlimited' || str === '∞') return { limit: UNLIMITED_SENDERS, planId: row.plan_id };
  const num = parseInt(senders, 10);
  if (Number.isNaN(num) || num < 0) return { limit: DEFAULT_SENDER_LIMIT, planId: row.plan_id };
  return { limit: Math.min(num, UNLIMITED_SENDERS), planId: row.plan_id };
}
