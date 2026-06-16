/**
 * Streaks & badges: daily target, consecutive qualifying days, volume milestones.
 */
import { getDb } from '../db.js';
import { sendStreakBadgeCelebration } from './transactionalEmail.js';

const STREAK_BADGE_THRESHOLDS = [3, 7, 14, 30];
const EMAIL_BADGE_THRESHOLDS = [500, 1000, 5000, 10000, 30000, 50000];
const MIN_DAILY_TARGET = 100;

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDateKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function streakIsBroken(lastQualifyingDate, today = todayDateKey()) {
  if (!lastQualifyingDate) return false;
  const yesterday = yesterdayDateKey();
  return lastQualifyingDate < yesterday;
}

async function countTotalEmailsSent(db, userId) {
  const regular = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM campaign_sends cs
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE c.user_id = $1 AND cs.status = 'sent'`,
    [userId]
  );
  const manual = await db.query(
    `SELECT COUNT(*)::int AS total FROM manual_send_events mse
     JOIN manual_campaign_runs mcr ON mcr.id = mse.run_id
     WHERE mcr.user_id = $1`,
    [userId]
  );
  const domain = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM domain_campaign_sends dcs
     JOIN domain_campaigns dc ON dc.id = dcs.campaign_id
     WHERE dc.user_id = $1 AND dcs.status = 'sent'`,
    [userId]
  );
  return (regular.rows[0]?.total || 0) + (manual.rows[0]?.total || 0) + (domain.rows[0]?.total || 0);
}

async function countThisWeekEmails(db, userId) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const regular = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM campaign_sends cs
     JOIN campaigns c ON c.id = cs.campaign_id
     WHERE c.user_id = $1 AND cs.status = 'sent' AND cs.sent_at >= $2`,
    [userId, weekAgo]
  );
  const domain = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM domain_campaign_sends dcs
     JOIN domain_campaigns dc ON dc.id = dcs.campaign_id
     WHERE dc.user_id = $1 AND dcs.status = 'sent' AND dcs.sent_at >= $2`,
    [userId, weekAgo]
  );
  return (regular.rows[0]?.total || 0) + (domain.rows[0]?.total || 0);
}

function rowToState(row) {
  const dailyTarget = row.daily_target != null ? Number(row.daily_target) : null;
  const currentStreak = Number(row.current_streak_days) || 0;
  const highestBadge = Number(row.highest_streak_badge_earned) || 0;
  const totalEmails = Number(row.total_emails_sent) || 0;
  const emailsSentToday = Number(row.emails_sent_today) || 0;

  const streakLabel = !dailyTarget
    ? 'Set your daily target'
    : currentStreak === 0
      ? 'No streak yet'
      : currentStreak === 1
        ? '1 day streak'
        : `${currentStreak} day streak`;

  const badges = [
    { id: 'streak-3', label: '3-Day Streak', icon: 'fire', type: 'streak', threshold: 3 },
    { id: 'streak-7', label: '7-Day Streak', icon: 'zap', type: 'streak', threshold: 7 },
    { id: 'streak-14', label: '14-Day Streak', icon: 'wallet', type: 'streak', threshold: 14 },
    { id: 'streak-30', label: '30-Day Streak', icon: 'trophy', type: 'streak', threshold: 30 },
    { id: 'emails-500', label: '500 Emails', icon: 'target', type: 'emails', threshold: 500 },
    { id: 'emails-1000', label: '1,000 Emails', icon: 'medal', type: 'emails', threshold: 1000 },
    { id: 'emails-5000', label: '5,000 Emails', icon: 'rocket', type: 'emails', threshold: 5000 },
    { id: 'emails-10000', label: '10,000 Emails', icon: 'star', type: 'emails', threshold: 10000 },
    { id: 'emails-30000', label: '30,000 Emails', icon: 'crown', type: 'emails', threshold: 30000 },
    { id: 'emails-50000', label: '50,000 Emails', icon: 'ribbon', type: 'emails', threshold: 50000 },
  ].map((badge) => ({
    ...badge,
    unlocked:
      badge.type === 'streak'
        ? highestBadge >= badge.threshold
        : totalEmails >= badge.threshold,
  }));

  return {
    dailyTarget,
    hasDailyTarget: dailyTarget != null,
    currentStreak,
    highestStreakBadgeEarned: highestBadge,
    totalEmailsSent: totalEmails,
    emailsSentToday,
    lastQualifyingDate: row.last_qualifying_date || null,
    streakLabel,
    thisWeekEmails: row._thisWeekEmails ?? 0,
    allTimeEmails: totalEmails,
    badges,
  };
}

function defaultState() {
  return rowToState({
    daily_target: null,
    current_streak_days: 0,
    highest_streak_badge_earned: 0,
    total_emails_sent: 0,
    emails_sent_today: 0,
    last_qualifying_date: null,
    _thisWeekEmails: 0,
  });
}

async function ensureUserStreakRow(db, userId) {
  let result = await db.query('SELECT * FROM user_streaks WHERE user_id = $1', [userId]);
  if (result.rows[0]) return result.rows[0];

  const total = await countTotalEmailsSent(db, userId);
  await db.query(
    `INSERT INTO user_streaks (user_id, total_emails_sent, emails_today_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, total, todayDateKey()]
  );
  result = await db.query('SELECT * FROM user_streaks WHERE user_id = $1', [userId]);
  return result.rows[0];
}

async function reconcileStreakRow(db, row) {
  const today = todayDateKey();
  let {
    daily_target: dailyTarget,
    current_streak_days: currentStreak,
    highest_streak_badge_earned: highestBadge,
    total_emails_sent: totalEmails,
    emails_sent_today: emailsSentToday,
    emails_today_date: emailsTodayDate,
    last_qualifying_date: lastQualifyingDate,
  } = row;

  dailyTarget = dailyTarget != null ? Number(dailyTarget) : null;
  currentStreak = Number(currentStreak) || 0;
  highestBadge = Number(highestBadge) || 0;
  totalEmails = Number(totalEmails) || 0;
  emailsSentToday = Number(emailsSentToday) || 0;
  lastQualifyingDate = lastQualifyingDate
    ? String(lastQualifyingDate).slice(0, 10)
    : null;

  if (emailsTodayDate && String(emailsTodayDate).slice(0, 10) !== today) {
    emailsSentToday = 0;
    emailsTodayDate = today;
  } else if (!emailsTodayDate) {
    emailsTodayDate = today;
  }

  if (dailyTarget && streakIsBroken(lastQualifyingDate, today)) {
    currentStreak = 0;
  }

  await db.query(
    `UPDATE user_streaks SET
      current_streak_days = $2,
      emails_sent_today = $3,
      emails_today_date = $4,
      updated_at = NOW()
     WHERE user_id = $1`,
    [row.user_id, currentStreak, emailsSentToday, emailsTodayDate]
  );

  return {
    ...row,
    daily_target: dailyTarget,
    current_streak_days: currentStreak,
    highest_streak_badge_earned: highestBadge,
    total_emails_sent: totalEmails,
    emails_sent_today: emailsSentToday,
    emails_today_date: emailsTodayDate,
    last_qualifying_date: lastQualifyingDate,
  };
}

async function maybeUnlockStreakBadges(db, userId, row, userEmail, userName) {
  const currentStreak = Number(row.current_streak_days) || 0;
  let highestBadge = Number(row.highest_streak_badge_earned) || 0;
  const newlyUnlocked = [];

  for (const threshold of STREAK_BADGE_THRESHOLDS) {
    if (currentStreak >= threshold && highestBadge < threshold) {
      highestBadge = threshold;
      newlyUnlocked.push(threshold);
    }
  }

  if (newlyUnlocked.length === 0) return row;

  await db.query(
    `UPDATE user_streaks SET highest_streak_badge_earned = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, highestBadge]
  );

  if (userEmail) {
    for (const days of newlyUnlocked) {
      sendStreakBadgeCelebration(userEmail, userName, days, currentStreak).catch((err) => {
        console.warn('[streak] celebration email failed:', err?.message || err);
      });
    }
  }

  return { ...row, highest_streak_badge_earned: highestBadge };
}

async function qualifyDayIfNeeded(db, userId, row, userEmail, userName) {
  const dailyTarget = Number(row.daily_target);
  if (!dailyTarget || dailyTarget < MIN_DAILY_TARGET) return row;

  const today = todayDateKey();
  const yesterday = yesterdayDateKey();
  let currentStreak = Number(row.current_streak_days) || 0;
  let lastQualifyingDate = row.last_qualifying_date
    ? String(row.last_qualifying_date).slice(0, 10)
    : null;
  const emailsSentToday = Number(row.emails_sent_today) || 0;

  if (emailsSentToday < dailyTarget || lastQualifyingDate === today) {
    return row;
  }

  if (lastQualifyingDate === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }
  lastQualifyingDate = today;

  await db.query(
    `UPDATE user_streaks SET
      current_streak_days = $2,
      last_qualifying_date = $3,
      updated_at = NOW()
     WHERE user_id = $1`,
    [userId, currentStreak, lastQualifyingDate]
  );

  const updated = {
    ...row,
    current_streak_days: currentStreak,
    last_qualifying_date: lastQualifyingDate,
  };

  return maybeUnlockStreakBadges(db, userId, updated, userEmail, userName);
}

export async function getStreakState(userId, { userEmail, userName } = {}) {
  const db = getDb();
  if (!db || !userId) return defaultState();

  let row = await ensureUserStreakRow(db, userId);
  row = await reconcileStreakRow(db, row);

  const dbTotal = await countTotalEmailsSent(db, userId);
  if (dbTotal > Number(row.total_emails_sent || 0)) {
    await db.query(
      'UPDATE user_streaks SET total_emails_sent = $2, updated_at = NOW() WHERE user_id = $1',
      [userId, dbTotal]
    );
    row.total_emails_sent = dbTotal;
  }

  row = await qualifyDayIfNeeded(db, userId, row, userEmail, userName);

  const thisWeekEmails = await countThisWeekEmails(db, userId);
  const state = rowToState({ ...row, _thisWeekEmails: thisWeekEmails });
  return state;
}

export async function setDailyTarget(userId, dailyTarget, { userEmail, userName } = {}) {
  const db = getDb();
  if (!db || !userId) {
    const err = new Error('Database unavailable');
    err.status = 503;
    throw err;
  }

  const target = Number(dailyTarget);
  if (!Number.isFinite(target) || target < MIN_DAILY_TARGET) {
    const err = new Error(`Daily target must be at least ${MIN_DAILY_TARGET}`);
    err.status = 400;
    throw err;
  }

  await ensureUserStreakRow(db, userId);
  await db.query(
    `UPDATE user_streaks SET
      daily_target = $2,
      current_streak_days = 0,
      last_qualifying_date = NULL,
      updated_at = NOW()
     WHERE user_id = $1`,
    [userId, Math.floor(target)]
  );

  return getStreakState(userId, { userEmail, userName });
}

export async function recordEmailSent(userId, count = 1) {
  const db = getDb();
  if (!db || !userId || count <= 0) return;

  try {
    let row = await ensureUserStreakRow(db, userId);
    row = await reconcileStreakRow(db, row);

    const today = todayDateKey();
    let emailsSentToday = Number(row.emails_sent_today) || 0;
    if (String(row.emails_today_date || '').slice(0, 10) !== today) {
      emailsSentToday = 0;
    }
    emailsSentToday += count;
    const totalEmails = (Number(row.total_emails_sent) || 0) + count;

    await db.query(
      `UPDATE user_streaks SET
        emails_sent_today = $2,
        emails_today_date = $3,
        total_emails_sent = $4,
        updated_at = NOW()
       WHERE user_id = $1`,
      [userId, emailsSentToday, today, totalEmails]
    );

    row = {
      ...row,
      emails_sent_today: emailsSentToday,
      emails_today_date: today,
      total_emails_sent: totalEmails,
    };

    const userRow = await db.query('SELECT email, name FROM users WHERE id = $1', [userId]);
    const userEmail = userRow.rows[0]?.email;
    const userName = userRow.rows[0]?.name;

    await qualifyDayIfNeeded(db, userId, row, userEmail, userName);
  } catch (err) {
    console.warn('[streak] recordEmailSent failed:', err?.message || err);
  }
}

export { MIN_DAILY_TARGET, STREAK_BADGE_THRESHOLDS, EMAIL_BADGE_THRESHOLDS };
