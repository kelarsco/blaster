/**
 * Resolve admin audience segments into user recipient lists.
 */
import { v4 as uuidv4 } from 'uuid';

const ACTIVE_SUB = `(
  SELECT s.plan_id FROM subscriptions s
  WHERE s.user_id = u.id AND s.status IN ('active','trialing')
  ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1
)`;

function parseFilter(filter) {
  if (!filter || typeof filter !== 'object') return {};
  return filter;
}

export function mapSegmentRow(row) {
  const filter = typeof row.filter_json === 'string' ? JSON.parse(row.filter_json) : row.filter_json || {};
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    filter,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildRecipientQuery(filter, { countOnly = false, limit = null, offset = 0 } = {}) {
  const f = parseFilter(filter);
  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (f.excludeDeactivated !== false) {
    conditions.push('u.deactivated_at IS NULL');
  }
  if (f.excludeSuspended !== false) {
    conditions.push('u.suspended_at IS NULL');
  }
  if (f.emailVerifiedOnly) {
    conditions.push('u.email_verified = true');
  }

  if (Array.isArray(f.manualUserIds) && f.manualUserIds.length) {
    conditions.push(`u.id = ANY($${idx}::text[])`);
    params.push(f.manualUserIds);
    idx += 1;
  }

  if (Array.isArray(f.planIds) && f.planIds.length) {
    const hasFree = f.planIds.includes('free');
    const paidIds = f.planIds.filter((p) => p !== 'free');
    const parts = [];
    if (hasFree) {
      parts.push(`${ACTIVE_SUB} IS NULL`);
    }
    if (paidIds.length) {
      parts.push(`${ACTIVE_SUB} = ANY($${idx}::text[])`);
      params.push(paidIds);
      idx += 1;
    }
    if (parts.length) conditions.push(`(${parts.join(' OR ')})`);
  }

  if (typeof f.joinedWithinDays === 'number' && f.joinedWithinDays > 0) {
    conditions.push(`u.created_at >= NOW() - ($${idx}::int * INTERVAL '1 day')`);
    params.push(f.joinedWithinDays);
    idx += 1;
  }

  if (typeof f.joinedOlderThanDays === 'number' && f.joinedOlderThanDays >= 0) {
    conditions.push(`u.created_at < NOW() - ($${idx}::int * INTERVAL '1 day')`);
    params.push(f.joinedOlderThanDays);
    idx += 1;
  }

  const where = conditions.join(' AND ');
  const select = countOnly
    ? `SELECT COUNT(*)::int AS c FROM users u WHERE ${where}`
    : `SELECT u.id, u.email, u.name, u.created_at,
         COALESCE((SELECT p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id
           WHERE s.user_id = u.id AND s.status IN ('active','trialing')
           ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1), 'Free') AS plan_name
       FROM users u WHERE ${where}
       ORDER BY u.created_at DESC`;

  let sql = select;
  if (!countOnly && limit != null) {
    sql += ` LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);
  }

  return { sql, params };
}

export async function countSegmentRecipients(db, filter) {
  const { sql, params } = buildRecipientQuery(filter, { countOnly: true });
  const r = await db.query(sql, params);
  return r.rows?.[0]?.c ?? 0;
}

export async function listSegmentRecipients(db, filter, { limit = 500, offset = 0 } = {}) {
  const { sql, params } = buildRecipientQuery(filter, { limit, offset });
  const r = await db.query(sql, params);
  return (r.rows || []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    planName: row.plan_name || 'Free',
  }));
}

export const DEFAULT_SEGMENTS = [
  {
    id: 'seg-all-users',
    name: 'All users',
    description: 'Every active account (not disabled or suspended)',
    filter: { excludeDeactivated: true, excludeSuspended: true },
    isSystem: true,
  },
  {
    id: 'seg-new-7d',
    name: 'New — last 7 days',
    description: 'Users who joined in the past week',
    filter: { joinedWithinDays: 7, excludeDeactivated: true, excludeSuspended: true },
    isSystem: true,
  },
  {
    id: 'seg-new-30d',
    name: 'New — last 30 days',
    description: 'Users who joined in the past month',
    filter: { joinedWithinDays: 30, excludeDeactivated: true, excludeSuspended: true },
    isSystem: true,
  },
  {
    id: 'seg-free',
    name: 'Free plan',
    description: 'Users without an active paid subscription',
    filter: { planIds: ['free'], excludeDeactivated: true, excludeSuspended: true },
    isSystem: true,
  },
  {
    id: 'seg-paid',
    name: 'Paid plans',
    description: 'Users on any active paid subscription',
    filter: {
      planIds: [
        'trial_7day',
        'essentials_monthly',
        'essentials_annual',
        'standard_monthly',
        'standard_annual',
        'premium_monthly',
        'premium_annual',
      ],
      excludeDeactivated: true,
      excludeSuspended: true,
    },
    isSystem: true,
  },
];

export async function seedDefaultSegments(db) {
  for (const seg of DEFAULT_SEGMENTS) {
    await db.query(
      `INSERT INTO admin_segments (id, name, description, filter_json, is_system)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (id) DO NOTHING`,
      [seg.id, seg.name, seg.description, JSON.stringify(seg.filter)]
    );
  }
}

export function newSegmentId() {
  return uuidv4();
}
