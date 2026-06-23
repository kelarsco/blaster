import { getDb } from '../db.js';

/** Active domain sender identity ids for a user (round-robin order). */
export async function getActiveDomainSenderIds(db, userId) {
  const r = await db.query(
    `SELECT id FROM domain_sender_identities
     WHERE user_id = $1 AND COALESCE(is_active, 1) = 1
     ORDER BY created_at ASC`,
    [userId]
  );
  return (r.rows || []).map((row) => row.id);
}

/** Resolve sender ids from request body or fall back to all domain senders. */
export async function resolveDomainSenderIds(db, userId, requestedIds) {
  if (Array.isArray(requestedIds) && requestedIds.length) {
    const r = await db.query(
      `SELECT id FROM domain_sender_identities
       WHERE user_id = $1 AND id = ANY($2::text[]) AND COALESCE(is_active, 1) = 1`,
      [userId, requestedIds]
    );
    if (r.rows.length !== requestedIds.length) {
      return { ok: false, error: 'Invalid sender selection' };
    }
    return { ok: true, senderIds: r.rows.map((x) => x.id) };
  }
  const senderIds = await getActiveDomainSenderIds(db, userId);
  if (!senderIds.length) {
    return {
      ok: false,
      error: 'Add at least one verified domain sender before starting a campaign.',
    };
  }
  return { ok: true, senderIds };
}

/** Build a sender row compatible with sendProcessor from domain_sender_identities. */
export async function buildSenderRowFromDomain(db, senderId, campaignId) {
  const r = await db.query(
    `SELECT s.id, s.user_id, s.from_email AS email
     FROM domain_sender_identities s
     JOIN campaigns c ON c.user_id = s.user_id AND c.id = $2
     WHERE s.id = $1 AND COALESCE(s.is_active, 1) = 1`,
    [senderId, campaignId]
  );
  const row = r.rows?.[0];
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    email: row.email,
    provider: 'domain',
    max_per_minute: 10,
    config: JSON.stringify({ domainSenderId: row.id }),
  };
}

export async function getSenderIdsForCampaignResume(db, campaignId) {
  const camp = await db.query('SELECT user_id FROM campaigns WHERE id = $1', [campaignId]);
  const userId = camp.rows?.[0]?.user_id;
  if (!userId) return [];
  return getActiveDomainSenderIds(db, userId);
}
