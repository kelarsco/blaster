/**
 * Rate-limited admin broadcast sending via Resend.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { sendAdminBroadcastEmail, isTransactionalEmailConfigured } from './transactionalEmail.js';
import { buildRecipientQuery, countSegmentRecipients, listSegmentRecipients } from './adminSegments.js';

const DEFAULT_DELAY_MS = 600;
const activeCampaigns = new Set();

export function mapCampaignRow(row) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    htmlBody: row.html_body,
    segmentId: row.segment_id,
    manualUserIds: row.manual_user_ids || [],
    status: row.status,
    totalRecipients: row.total_recipients ?? 0,
    sentCount: row.sent_count ?? 0,
    failedCount: row.failed_count ?? 0,
    sendDelayMs: row.send_delay_ms ?? DEFAULT_DELAY_MS,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCampaignFilter(db, campaign) {
  if (Array.isArray(campaign.manual_user_ids) && campaign.manual_user_ids.length) {
    return {
      manualUserIds: campaign.manual_user_ids,
      excludeDeactivated: true,
      excludeSuspended: true,
    };
  }
  if (!campaign.segment_id) return null;
  const seg = await db.query('SELECT filter_json FROM admin_segments WHERE id = $1', [campaign.segment_id]);
  const filter = seg.rows?.[0]?.filter_json;
  if (!filter) return null;
  return typeof filter === 'string' ? JSON.parse(filter) : filter;
}

export async function previewCampaignRecipients(db, { segmentId, manualUserIds, filterOverride }) {
  let filter = filterOverride;
  if (!filter) {
    if (Array.isArray(manualUserIds) && manualUserIds.length) {
      filter = { manualUserIds, excludeDeactivated: true, excludeSuspended: true };
    } else if (segmentId) {
      const seg = await db.query('SELECT filter_json FROM admin_segments WHERE id = $1', [segmentId]);
      const raw = seg.rows?.[0]?.filter_json;
      if (!raw) return { count: 0, sample: [] };
      filter = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
  }
  if (!filter) return { count: 0, sample: [] };
  const count = await countSegmentRecipients(db, filter);
  const sample = await listSegmentRecipients(db, filter, { limit: 5 });
  return { count, sample };
}

export async function startCampaignSend(campaignId) {
  const db = getDb();
  if (!db) throw new Error('Database unavailable');
  if (!isTransactionalEmailConfigured()) {
    throw new Error('Resend is not configured (RESEND_API_KEY missing)');
  }
  if (activeCampaigns.has(campaignId)) {
    throw new Error('Campaign is already sending');
  }

  const campRes = await db.query('SELECT * FROM admin_email_campaigns WHERE id = $1', [campaignId]);
  const campaign = campRes.rows?.[0];
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sending') throw new Error('Campaign is already sending');
  if (campaign.status === 'sent') throw new Error('Campaign was already sent');

  const filter = await getCampaignFilter(db, campaign);
  if (!filter) throw new Error('No audience selected');

  const { sql, params } = buildRecipientQuery(filter);
  const recipientsRes = await db.query(sql, params);
  const recipients = recipientsRes.rows || [];
  if (!recipients.length) throw new Error('No recipients match this segment');

  await db.query(
    `UPDATE admin_email_campaigns SET
       status = 'sending', started_at = NOW(), total_recipients = $2,
       sent_count = 0, failed_count = 0, updated_at = NOW()
     WHERE id = $1`,
    [campaignId, recipients.length]
  );

  const existing = await db.query(
    'SELECT user_id FROM admin_email_sends WHERE campaign_id = $1',
    [campaignId]
  );
  const existingIds = new Set((existing.rows || []).map((r) => r.user_id));

  for (const user of recipients) {
    if (existingIds.has(user.id)) continue;
    await db.query(
      `INSERT INTO admin_email_sends (id, campaign_id, user_id, email, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [uuidv4(), campaignId, user.id, user.email]
    );
  }

  activeCampaigns.add(campaignId);
  setImmediate(() => {
    processCampaignQueue(campaignId).catch((e) => {
      console.error('[adminCampaignSend]', campaignId, e?.message || e);
    });
  });

  return { ok: true, totalRecipients: recipients.length };
}

async function processCampaignQueue(campaignId) {
  const db = getDb();
  if (!db) return;

  try {
    const campRes = await db.query('SELECT * FROM admin_email_campaigns WHERE id = $1', [campaignId]);
    const campaign = campRes.rows?.[0];
    if (!campaign) return;

    const delayMs = Math.max(400, Math.min(campaign.send_delay_ms || DEFAULT_DELAY_MS, 5000));

    while (true) {
      const pending = await db.query(
        `SELECT s.id, s.email, s.user_id FROM admin_email_sends s
         WHERE s.campaign_id = $1 AND s.status = 'pending'
         ORDER BY s.created_at ASC LIMIT 1`,
        [campaignId]
      );
      const row = pending.rows?.[0];
      if (!row) break;

      try {
        const result = await sendAdminBroadcastEmail({
          to: row.email,
          subject: campaign.subject,
          html: campaign.html_body,
          campaignId,
        });
        await db.query(
          `UPDATE admin_email_sends SET status = 'sent', resend_id = $2, sent_at = NOW() WHERE id = $1`,
          [row.id, result.id || null]
        );
        await db.query(
          `UPDATE admin_email_campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
          [campaignId]
        );
      } catch (e) {
        await db.query(
          `UPDATE admin_email_sends SET status = 'failed', error = $2 WHERE id = $1`,
          [row.id, String(e?.message || e).slice(0, 500)]
        );
        await db.query(
          `UPDATE admin_email_campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
          [campaignId]
        );
      }

      await sleep(delayMs);
    }

    const stats = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM admin_email_sends WHERE campaign_id = $1`,
      [campaignId]
    );
    const s = stats.rows?.[0] || {};
    const finalStatus = Number(s.pending) > 0 ? 'failed' : Number(s.failed) > 0 && Number(s.sent) === 0 ? 'failed' : 'sent';

    await db.query(
      `UPDATE admin_email_campaigns SET
         status = $2, completed_at = NOW(), updated_at = NOW(),
         sent_count = $3, failed_count = $4
       WHERE id = $1`,
      [campaignId, finalStatus, s.sent ?? 0, s.failed ?? 0]
    );
  } finally {
    activeCampaigns.delete(campaignId);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCampaignStatus(db, campaignId) {
  const r = await db.query('SELECT * FROM admin_email_campaigns WHERE id = $1', [campaignId]);
  if (!r.rows?.[0]) return null;
  return mapCampaignRow(r.rows[0]);
}
