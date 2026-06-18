import { getDb } from '../db.js';

/** Billing period for usage counters (subscription period or calendar month). */
export async function getPeriodForUser(db, userId) {
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
