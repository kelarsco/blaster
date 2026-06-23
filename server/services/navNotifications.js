import { getDb } from '../db.js';

function parseMeta(meta) {
  if (!meta) return null;
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

async function getNavSeenRow(db, userId, navKey) {
  const r = await db.query(
    'SELECT seen_at, meta FROM user_nav_seen WHERE user_id = $1 AND nav_key = $2',
    [userId, navKey]
  );
  return r.rows?.[0] || null;
}

export async function markNavSeen(db, userId, navKey, meta = null) {
  const metaJson = meta != null ? JSON.stringify(meta) : null;
  await db.query(
    `INSERT INTO user_nav_seen (user_id, nav_key, seen_at, meta)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (user_id, nav_key) DO UPDATE SET
       seen_at = NOW(),
       meta = COALESCE(EXCLUDED.meta, user_nav_seen.meta)`,
    [userId, navKey, metaJson]
  );
}

export async function getNotificationStateForUser(userId) {
  const db = getDb();
  const empty = {
    badges: { referral: false, resources: false, scanner: false },
    priorityVideo: null,
  };
  if (!db) return empty;

  const [referralSeen, resourcesSeen, priorityDismiss, userRow] = await Promise.all([
    getNavSeenRow(db, userId, 'referral'),
    getNavSeenRow(db, userId, 'resources'),
    getNavSeenRow(db, userId, 'priority_video'),
    db.query('SELECT created_at FROM users WHERE id = $1', [userId]),
  ]);

  const userSince = userRow.rows?.[0]?.created_at || new Date();
  const referralSince = referralSeen?.seen_at || userSince;
  const resourcesSince = resourcesSeen?.seen_at || userSince;

  const [referralCount, resourcesCount, priorityRow] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS c FROM user_referrals
       WHERE referrer_user_id = $1 AND signed_up_at > $2`,
      [userId, referralSince]
    ),
    db.query(
      `SELECT COUNT(*)::int AS c FROM resources WHERE created_at > $1`,
      [resourcesSince]
    ),
    db.query(
      `SELECT id, type, title, url, created_at FROM resources
       WHERE is_priority = 1 AND type = 'video'
       ORDER BY created_at DESC LIMIT 1`
    ),
  ]);

  let priorityVideo = null;
  const pr = priorityRow.rows?.[0];
  if (pr) {
    const dismissed = parseMeta(priorityDismiss?.meta);
    if (dismissed?.resourceId !== pr.id) {
      priorityVideo = {
        id: pr.id,
        title: pr.title,
        url: pr.url,
        createdAt: pr.created_at,
      };
    }
  }

  return {
    badges: {
      referral: (referralCount.rows?.[0]?.c ?? 0) > 0,
      resources: (resourcesCount.rows?.[0]?.c ?? 0) > 0,
      scanner: false,
    },
    priorityVideo,
  };
}
