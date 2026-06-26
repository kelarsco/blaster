import { getDb } from '../db.js';
import { getPeriodForUser } from './planLimitsPeriod.js';
import { getSignupTrialState } from './signupTrial.js';

/** Default sender limit when user has no subscription. */
const DEFAULT_SENDER_LIMIT = 999999;
const DEFAULT_DOMAIN_LIMIT = 5;
/** No automatic signup trial — access requires trial_7day, paid plan, or signup welcome period. */
const FREE_TRIAL_EMAILS_LIMIT = 0;
const FREE_TRIAL_SCANS_LIMIT = 0;

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
async function getPeriodForUserLocal(db, userId) {
  return getPeriodForUser(db, userId);
}

async function getFreeTrialState(db, userId) {
  const sub = await db.query(
    `SELECT current_period_end FROM subscriptions
     WHERE user_id = $1 AND plan_id IN ('trial_7day', 'trial_3day') AND status IN ('active', 'trialing')
       AND current_period_end > NOW()
     ORDER BY current_period_end DESC LIMIT 1`,
    [userId]
  );
  const endsAt = sub.rows?.[0]?.current_period_end ? new Date(sub.rows[0].current_period_end) : null;
  return { active: Boolean(endsAt), endsAt };
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
  if (!db) {
    defaults.isFreePlan = true;
    return defaults;
  }

  const sub = await db.query(
    `SELECT s.plan_id, s.current_period_start, s.current_period_end, p.features
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
       AND s.current_period_end > NOW()
     ORDER BY s.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [userId]
  );
  const row = sub.rows?.[0];
  const features = row?.features || {};
  const planId = row?.plan_id ?? 'free';

  const period = await getPeriodForUserLocal(db, userId);
  defaults.periodStart = period.start;
  defaults.periodEnd = period.end;

  const feats = row ? features : (await db.query(`SELECT features FROM plans WHERE id = 'free' LIMIT 1`).then((r) => r.rows?.[0]?.features || {}));
  defaults.emailsLimit = parseFeatureNum(feats, 'emails', FREE_TRIAL_EMAILS_LIMIT);
  defaults.scansLimit = parseFeatureNum(feats, 'scans', FREE_TRIAL_SCANS_LIMIT);

  if (row && (planId.startsWith('essentials') || planId.startsWith('standard') || planId.startsWith('premium') || planId === 'trial_7day' || planId === 'trial_3day')) {
    defaults.emailsLimit = UNLIMITED_NUM;
    defaults.scansLimit = UNLIMITED_NUM;
    defaults.campaignsLimit = UNLIMITED_NUM;
  }

  defaults.usersLimit = row ? parseFeatureNum(features, 'users', 1) : 1;
  const camp = feats.campaigns;
  if (camp != null) {
    const s = String(camp).toLowerCase();
    defaults.campaignsLimit = s === 'unlimited' || s === '∞' ? UNLIMITED_NUM : Math.max(0, parseInt(camp, 10) || 1);
  }

  defaults.sendersLimit = 0;
  defaults.sendersUsed = 0;

  if (!row) {
    const signupTrial = await getSignupTrialState(db, userId);
    defaults.isTrial = false;
    defaults.trialEndsAt = null;
    if (signupTrial.active) {
      defaults.planId = 'signup_trial';
      defaults.emailsLimit = UNLIMITED_NUM;
      defaults.scansLimit = UNLIMITED_NUM;
      defaults.campaignsLimit = UNLIMITED_NUM;
      defaults.signupTrialActive = true;
      defaults.signupTrialEndsAt = signupTrial.endsAt;
    } else {
      defaults.emailsLimit = 0;
      defaults.scansLimit = 0;
    }
  } else if (planId === 'trial_7day' || planId === 'trial_3day') {
    const trial = await getFreeTrialState(db, userId);
    defaults.isTrial = trial.active;
    defaults.trialEndsAt = trial.endsAt;
  }

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
  defaults.isFreePlan = !row && !defaults.signupTrialActive;

  return defaults;
}

/**
 * @deprecated Legacy sender accounts removed — always returns zero limit.
 */
export async function getSenderLimitForUser(userId) {
  return { limit: 0, planId: null };
}

/**
 * Get the sending-domain limit for a user based on their active subscription plan.
 * Premium users can add up to 5 sending domains.
 * @param {string} userId
 * @returns {Promise<{ limit: number, planId: string | null }>}
 */
export async function getDomainLimitForUser(userId) {
  const db = getDb();
  if (!db) return { limit: DEFAULT_DOMAIN_LIMIT, planId: null };

  const sub = await db.query(
    `SELECT s.plan_id, p.features
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
       AND s.current_period_end > NOW()
     ORDER BY s.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [userId]
  );
  const row = sub.rows?.[0];
  if (!row) return { limit: DEFAULT_DOMAIN_LIMIT, planId: null };

  const features = row.features || {};
  const domains = features.domains;
  if (domains != null) {
    const str = String(domains).toLowerCase();
    if (str === 'unlimited' || str === '∞') return { limit: UNLIMITED_NUM, planId: row.plan_id };
    const num = parseInt(domains, 10);
    if (!Number.isNaN(num) && num >= 0) return { limit: Math.min(num, UNLIMITED_NUM), planId: row.plan_id };
  }

  // Backward compatible fallback: existing premium plans without domains feature.
  if (String(row.plan_id || '').startsWith('premium')) return { limit: 5, planId: row.plan_id };
  return { limit: DEFAULT_DOMAIN_LIMIT, planId: row.plan_id };
}
