/** Max store URLs per single scan batch. */
export const MAX_URLS_PER_SCAN = Math.max(Number(process.env.MAX_URLS_PER_SCAN) || 1000, 1);

/** Rolling window cap for complimentary signup access (no paid plan). */
export const FREE_SIGNUP_SCANS_24H = Math.max(Number(process.env.FREE_SIGNUP_SCANS_24H) || 500, 1);
export const FREE_SIGNUP_SCANS_WINDOW_HOURS = Math.max(Number(process.env.FREE_SIGNUP_SCANS_WINDOW_HOURS) || 24, 1);

export async function countScansInWindow(db, userId, hours) {
  const r = await db.query(
    `SELECT COALESCE(SUM(total_urls), 0) AS total
     FROM scans
     WHERE user_id = $1 AND created_at >= NOW() - ($2::text || ' hours')::interval`,
    [userId, String(hours)]
  );
  return parseInt(r.rows?.[0]?.total ?? '0', 10);
}

export function scansRemainingFromLimits(limits) {
  const limit = limits?.scansLimit ?? 0;
  if (limit >= 999999) return 999999;
  return Math.max(0, limit - (limits?.scansUsed ?? 0));
}
