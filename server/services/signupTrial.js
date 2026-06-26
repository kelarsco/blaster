/**
 * Complimentary full-access period for new accounts (no payment required).
 */
export const SIGNUP_TRIAL_HOURS = Math.max(Number(process.env.SIGNUP_TRIAL_HOURS) || 48, 1);

export async function getSignupTrialState(db, userId) {
  if (!db || !userId) {
    return { active: false, endsAt: null, hoursRemaining: 0 };
  }

  const r = await db.query('SELECT created_at FROM users WHERE id = $1', [userId]);
  const createdAt = r.rows?.[0]?.created_at ? new Date(r.rows[0].created_at) : null;
  if (!createdAt) {
    return { active: false, endsAt: null, hoursRemaining: 0 };
  }

  const endsAt = new Date(createdAt.getTime() + SIGNUP_TRIAL_HOURS * 60 * 60 * 1000);
  const msRemaining = endsAt.getTime() - Date.now();
  const active = msRemaining > 0;

  return {
    active,
    endsAt: active ? endsAt : null,
    hoursRemaining: active ? msRemaining / (60 * 60 * 1000) : 0,
  };
}
