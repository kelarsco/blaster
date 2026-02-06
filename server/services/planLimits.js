import { getDb } from '../db.js';

/** Default sender limit when user has no subscription (free). */
const DEFAULT_SENDER_LIMIT = 1;

/** Cap for "unlimited" plans. */
const UNLIMITED_SENDERS = 999;

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
  if (!row) return { limit: DEFAULT_SENDER_LIMIT, planId: null };

  const features = row.features || {};
  const senders = features.senders;
  if (senders == null) return { limit: DEFAULT_SENDER_LIMIT, planId: row.plan_id };
  const str = String(senders).toLowerCase();
  if (str === 'unlimited' || str === '∞') return { limit: UNLIMITED_SENDERS, planId: row.plan_id };
  const num = parseInt(senders, 10);
  if (Number.isNaN(num) || num < 0) return { limit: DEFAULT_SENDER_LIMIT, planId: row.plan_id };
  return { limit: Math.min(num, UNLIMITED_SENDERS), planId: row.plan_id };
}
