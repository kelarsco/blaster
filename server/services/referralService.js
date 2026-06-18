import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { resolveFrontendUrl } from './oauthUrls.js';
import { shouldUseSecureCookies, getCookieSameSite, getCookieDomain } from './cookiePolicy.js';
import {
  sendReferralSignupNotification,
  sendReferralUpgradeNotification,
  sendReferralTierUnlocked,
  sendReferralPremiumExpiring,
} from './transactionalEmail.js';

export const REFERRAL_REF_COOKIE = 'referral_ref';
const REFERRAL_REF_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function setReferralRefCookie(res, code) {
  const norm = String(code || '').trim().toUpperCase();
  if (!norm) return;
  const secure = shouldUseSecureCookies();
  const sameSite = getCookieSameSite();
  const domain = getCookieDomain();
  res.cookie(REFERRAL_REF_COOKIE, norm, {
    maxAge: REFERRAL_REF_MAX_AGE_MS,
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(domain && { domain }),
  });
}

export function clearReferralRefCookie(res) {
  const secure = shouldUseSecureCookies();
  const sameSite = getCookieSameSite();
  const domain = getCookieDomain();
  res.clearCookie(REFERRAL_REF_COOKIE, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(domain && { domain }),
  });
}

export function getReferralCodeFromRequest(req) {
  return String(req.body?.referralCode || req.cookies?.[REFERRAL_REF_COOKIE] || req.query?.ref || '').trim();
}

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_PLAN_ID = 'premium_monthly';
const TIERS = [
  { tier: 1, threshold: 3, days: 14, claimedField: 'tier_1_claimed', claimedAtField: 'tier_1_claimed_at', label: '14 Days Premium Free' },
  { tier: 2, threshold: 6, days: 30, claimedField: 'tier_2_claimed', claimedAtField: 'tier_2_claimed_at', label: '30 Days Premium Free' },
  { tier: 3, threshold: 10, days: 60, claimedField: 'tier_3_claimed', claimedAtField: 'tier_3_claimed_at', label: '60 Days Premium Free' },
];

function randomCode() {
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  }
  return s;
}

export function maskEmail(email) {
  const norm = String(email || '').trim().toLowerCase();
  const [local, domain] = norm.split('@');
  if (!domain) return '****';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}****@${domain}`;
}

export function getProgressMessage(upgradeCount) {
  const n = Math.max(0, upgradeCount);
  if (n >= 10) return "🏆 You've hit the top tier! Enjoy 60 days of Premium on us.";
  if (n >= 6) return `🔥 Tier 2 unlocked! ${10 - n} more upgrade(s) to earn 60 days free.`;
  if (n >= 3) return `🎉 Tier 1 unlocked! ${6 - n} more upgrade(s) to earn 30 days free.`;
  if (n >= 1) return `You're ${3 - n} upgrade(s) away from 14 free days of Premium.`;
  return 'Get 3 people to upgrade to unlock your first 14 days of Premium.';
}

export function buildReferralUrl(code, req) {
  const base = resolveFrontendUrl(req);
  return `${base}/signup?ref=${encodeURIComponent(code)}`;
}

export async function ensureUserReferralCode(userId) {
  const db = getDb();
  if (!db) return null;
  const existing = await db.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
  const code = existing.rows?.[0]?.referral_code;
  if (code) return code;
  for (let i = 0; i < 10; i++) {
    const candidate = randomCode();
    try {
      await db.query('UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2', [candidate, userId]);
      return candidate;
    } catch (e) {
      if (e?.code !== '23505') throw e;
    }
  }
  return null;
}

export async function findReferrerByCode(code) {
  const db = getDb();
  if (!db || !code) return null;
  const norm = String(code).trim().toUpperCase();
  const r = await db.query(
    `SELECT id, email, name, deactivated_at, suspended_at FROM users WHERE referral_code = $1`,
    [norm]
  );
  const row = r.rows?.[0];
  if (!row || row.deactivated_at || row.suspended_at) return null;
  return row;
}

export async function recordReferralClick(code) {
  const db = getDb();
  if (!db) return false;
  const referrer = await findReferrerByCode(code);
  if (!referrer) return false;
  await db.query(
    `UPDATE users SET referral_link_clicks = COALESCE(referral_link_clicks, 0) + 1, updated_at = NOW() WHERE id = $1`,
    [referrer.id]
  );
  return true;
}

export async function attachReferralOnSignup(referredUserId, referredEmail, referralCode) {
  const db = getDb();
  if (!db || !referralCode) return { ok: false, reason: 'no_code' };

  const referrer = await findReferrerByCode(referralCode);
  if (!referrer) return { ok: false, reason: 'invalid_code' };
  if (referrer.id === referredUserId) return { ok: false, reason: 'self_referral' };
  if (referrer.email?.toLowerCase() === referredEmail?.toLowerCase()) return { ok: false, reason: 'self_referral' };

  const dup = await db.query('SELECT id FROM user_referrals WHERE referred_user_id = $1', [referredUserId]);
  if (dup.rows?.[0]) return { ok: false, reason: 'already_attached' };

  await db.query(
    `INSERT INTO user_referrals (id, referred_user_id, referrer_user_id, signed_up_at, counts_toward_reward)
     VALUES ($1, $2, $3, NOW(), 0)`,
    [uuidv4(), referredUserId, referrer.id]
  );
  await db.query(
    `UPDATE users SET signup_referral_count = COALESCE(signup_referral_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
    [referrer.id]
  );
  await db.query('UPDATE users SET referred_by_user_id = $2 WHERE id = $1', [referredUserId, referrer.id]);

  sendReferralSignupNotification(referrer.email, referredEmail).catch((e) =>
    console.warn('[referral signup email]', e?.message || e)
  );

  await syncReferralUpgradeFromSubscription(referredUserId);

  return { ok: true, referrerId: referrer.id };
}

function isPaidPlanId(planId) {
  return Boolean(planId && planId !== 'free');
}

async function getActivePaidSubscription(db, userId) {
  const r = await db.query(
    `SELECT s.id, s.plan_id, s.current_period_end, s.paystack_subscription_code
     FROM subscriptions s
     WHERE s.user_id = $1 AND s.status IN ('active', 'trialing') AND s.plan_id != 'free'
     ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  return r.rows?.[0] || null;
}

/** If referred user has an active paid plan but referral row is not counted yet, record the upgrade. */
export async function syncReferralUpgradeFromSubscription(referredUserId) {
  const db = getDb();
  if (!db) return { ok: false, reason: 'no_db' };

  const paidSub = await getActivePaidSubscription(db, referredUserId);
  if (!paidSub?.plan_id) return { ok: false, reason: 'not_paid' };

  return handleReferralUpgrade(referredUserId, paidSub.plan_id);
}

async function grantReferralPremiumDays(userId, days) {
  const db = getDb();
  if (!db) return;
  const userRow = await db.query('SELECT premium_expires_at, email, name FROM users WHERE id = $1', [userId]);
  const user = userRow.rows?.[0];
  if (!user) return;

  const now = new Date();
  const existingPremium = user.premium_expires_at ? new Date(user.premium_expires_at) : null;
  const paidSub = await getActivePaidSubscription(db, userId);

  let base = now;
  if (paidSub?.current_period_end) {
    const paidEnd = new Date(paidSub.current_period_end);
    if (paidEnd > base) base = paidEnd;
  }
  if (existingPremium && existingPremium > base) base = existingPremium;

  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE users SET premium_expires_at = $2, premium_source = 'referral', updated_at = NOW() WHERE id = $1`,
    [userId, newExpiry]
  );

  if (!paidSub || !paidSub.paystack_subscription_code) {
    const refSub = await db.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND paystack_subscription_code IS NULL ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    const periodStart = now;
    if (refSub.rows?.[0]?.id) {
      await db.query(
        `UPDATE subscriptions SET plan_id = $2, status = 'active', current_period_start = $3, current_period_end = $4, updated_at = NOW() WHERE id = $1`,
        [refSub.rows[0].id, REFERRAL_PLAN_ID, periodStart, newExpiry]
      );
    } else {
      await db.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, updated_at)
         VALUES ($1, $2, $3, 'active', $4, $5, NOW())`,
        [uuidv4(), userId, REFERRAL_PLAN_ID, periodStart, newExpiry]
      );
    }
  }
}

async function checkAndGrantTiers(referrerId) {
  const db = getDb();
  if (!db) return;

  const r = await db.query(
    `SELECT id, email, name, upgrade_referral_count, tier_1_claimed, tier_2_claimed, tier_3_claimed
     FROM users WHERE id = $1`,
    [referrerId]
  );
  const user = r.rows?.[0];
  if (!user) return;

  const count = user.upgrade_referral_count || 0;
  const email = user.email;
  const name = user.name || email?.split('@')[0] || 'there';

  for (const tier of TIERS) {
    const claimed = Boolean(user[tier.claimedField]);
    if (count >= tier.threshold && !claimed) {
      await db.query(
        `UPDATE users SET ${tier.claimedField} = 1, ${tier.claimedAtField} = NOW(), updated_at = NOW() WHERE id = $1`,
        [referrerId]
      );
      await grantReferralPremiumDays(referrerId, tier.days);
      user[tier.claimedField] = 1;
      sendReferralTierUnlocked(email, name, tier.tier, tier.days).catch((e) =>
        console.warn('[referral tier email]', e?.message || e)
      );
    }
  }
}

export async function handleReferralUpgrade(referredUserId, planId) {
  const db = getDb();
  if (!db) return { ok: false, reason: 'no_db' };
  if (!isPaidPlanId(planId)) return { ok: false, reason: 'not_paid_plan' };

  const refRow = await db.query(
    `SELECT id, referrer_user_id, counts_toward_reward FROM user_referrals WHERE referred_user_id = $1`,
    [referredUserId]
  );
  const referral = refRow.rows?.[0];
  if (!referral) return { ok: false, reason: 'no_referral' };
  if (referral.counts_toward_reward) return { ok: false, reason: 'already_counted' };

  await db.query(
    `UPDATE user_referrals SET upgraded_at = NOW(), plan_upgraded_to = $2, counts_toward_reward = 1 WHERE id = $1`,
    [referral.id, planId]
  );

  await db.query(
    `UPDATE users SET upgrade_referral_count = COALESCE(upgrade_referral_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
    [referral.referrer_user_id]
  );

  const referrer = await db.query('SELECT email, name FROM users WHERE id = $1', [referral.referrer_user_id]);
  const refUser = referrer.rows?.[0];
  if (refUser?.email) {
    sendReferralUpgradeNotification(refUser.email, refUser.name).catch((e) =>
      console.warn('[referral upgrade email]', e?.message || e)
    );
  }

  await checkAndGrantTiers(referral.referrer_user_id);
  return { ok: true, referrerId: referral.referrer_user_id };
}

export async function activateQueuedReferralPremium(userId) {
  const db = getDb();
  if (!db) return;
  const r = await db.query('SELECT premium_expires_at FROM users WHERE id = $1', [userId]);
  const expires = r.rows?.[0]?.premium_expires_at;
  if (!expires || new Date(expires) <= new Date()) return;

  const paidSub = await getActivePaidSubscription(db, userId);
  if (paidSub?.paystack_subscription_code) return;

  const refSub = await db.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND paystack_subscription_code IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  const now = new Date();
  const end = new Date(expires);
  if (refSub.rows?.[0]?.id) {
    await db.query(
      `UPDATE subscriptions SET plan_id = $2, status = 'active', current_period_start = $3, current_period_end = $4, updated_at = NOW() WHERE id = $1`,
      [refSub.rows[0].id, REFERRAL_PLAN_ID, now, end]
    );
  } else {
    await db.query(
      `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, updated_at)
       VALUES ($1, $2, $3, 'active', $4, $5, NOW())`,
      [uuidv4(), userId, REFERRAL_PLAN_ID, now, end]
    );
  }
}

function tierStatus(tier, upgradeCount, claimed, claimedAt, prevThreshold = 0) {
  if (claimed) return { status: 'claimed', claimedAt };
  if (upgradeCount >= tier.threshold) return { status: 'in_progress' };
  if (upgradeCount >= prevThreshold && upgradeCount < tier.threshold) return { status: 'in_progress' };
  return { status: 'locked' };
}

export async function getReferralDashboard(userId, req) {
  const db = getDb();
  if (!db) throw new Error('Database unavailable');

  const code = await ensureUserReferralCode(userId);

  const referralsR = await db.query(
    `SELECT ur.referred_user_id, ur.counts_toward_reward
     FROM user_referrals ur
     WHERE ur.referrer_user_id = $1`,
    [userId]
  );

  for (const row of referralsR.rows || []) {
    if (!row.counts_toward_reward) {
      await syncReferralUpgradeFromSubscription(row.referred_user_id);
    }
  }

  const userR = await db.query(
    `SELECT referral_link_clicks, signup_referral_count, upgrade_referral_count,
            tier_1_claimed, tier_1_claimed_at, tier_2_claimed, tier_2_claimed_at,
            tier_3_claimed, tier_3_claimed_at, premium_expires_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const u = userR.rows?.[0] || {};

  const referralsListR = await db.query(
    `SELECT ur.signed_up_at, ur.upgraded_at, ur.plan_upgraded_to, ur.counts_toward_reward, u.email
     FROM user_referrals ur
     JOIN users u ON u.id = ur.referred_user_id
     WHERE ur.referrer_user_id = $1
     ORDER BY ur.signed_up_at DESC`,
    [userId]
  );

  const upgradeCount = u.upgrade_referral_count || 0;
  const tiers = TIERS.map((t, idx) => {
    const claimed = Boolean(u[t.claimedField]);
    const claimedAt = u[t.claimedAtField] || null;
    const prevThreshold = idx === 0 ? 0 : TIERS[idx - 1].threshold;
    const st = tierStatus(t, upgradeCount, claimed, claimedAt, prevThreshold);
    let expiresAt = null;
    if (claimed && u.premium_expires_at) expiresAt = u.premium_expires_at;
    return {
      tier: t.tier,
      threshold: t.threshold,
      rewardLabel: t.label,
      milestoneLabel: `${t.threshold} Upgrades`,
      status: st.status,
      claimedAt,
      expiresAt,
      icon: t.tier === 1 ? '🥉' : t.tier === 2 ? '🥈' : '🥇',
    };
  });

  const referrals = (referralsListR.rows || []).map((row, i) => ({
    index: i + 1,
    emailMasked: maskEmail(row.email),
    joinedAt: row.signed_up_at,
    planStatus: row.counts_toward_reward ? 'Upgraded' : 'Free',
    countsTowardGoal: Boolean(row.counts_toward_reward),
    planId: row.plan_upgraded_to || null,
  }));

  return {
    referralCode: code,
    referralUrl: buildReferralUrl(code, req),
    linkClicks: u.referral_link_clicks || 0,
    signupCount: u.signup_referral_count || 0,
    upgradeCount,
    tiers,
    referrals,
    progressMessage: getProgressMessage(upgradeCount),
    progressPercent: Math.min(100, (upgradeCount / 10) * 100),
    premiumExpiresAt: u.premium_expires_at || null,
  };
}

export async function getAdminReferralOverview() {
  const db = getDb();
  if (!db) return null;

  const statsR = await db.query(`
    SELECT
      COUNT(*)::int AS total_referrals,
      COUNT(*) FILTER (WHERE counts_toward_reward = 1)::int AS total_upgrades,
      COUNT(DISTINCT referrer_user_id)::int AS active_referrers
    FROM user_referrals
  `);
  const stats = statsR.rows?.[0] || {};

  const topR = await db.query(`
    SELECT u.id, u.email, u.name, u.referral_code, u.signup_referral_count, u.upgrade_referral_count,
           u.referral_link_clicks, u.tier_1_claimed, u.tier_2_claimed, u.tier_3_claimed, u.premium_expires_at
    FROM users u
    WHERE COALESCE(u.signup_referral_count, 0) > 0 OR COALESCE(u.upgrade_referral_count, 0) > 0
    ORDER BY u.upgrade_referral_count DESC, u.signup_referral_count DESC
    LIMIT 50
  `);

  const recentR = await db.query(`
    SELECT ur.id, ur.signed_up_at, ur.upgraded_at, ur.plan_upgraded_to, ur.counts_toward_reward,
           ref.email AS referrer_email, ref.referral_code AS referrer_code,
           ru.email AS referred_email
    FROM user_referrals ur
    JOIN users ref ON ref.id = ur.referrer_user_id
    JOIN users ru ON ru.id = ur.referred_user_id
    ORDER BY ur.signed_up_at DESC
    LIMIT 100
  `);

  return {
    stats: {
      totalReferrals: stats.total_referrals || 0,
      totalUpgrades: stats.total_upgrades || 0,
      activeReferrers: stats.active_referrers || 0,
    },
    topReferrers: topR.rows || [],
    recentReferrals: recentR.rows || [],
  };
}

export async function checkPremiumExpiryWarnings() {
  const db = getDb();
  if (!db) return;
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const r = await db.query(
    `SELECT id, email, name, premium_expires_at FROM users
     WHERE premium_source = 'referral' AND premium_expires_at IS NOT NULL
       AND premium_expires_at > NOW() AND premium_expires_at <= $1`,
    [in3Days]
  );
  for (const row of r.rows || []) {
    sendReferralPremiumExpiring(row.email, row.name).catch(() => {});
  }
}
