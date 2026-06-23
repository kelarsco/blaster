import { getDb } from '../db.js';
import { addSendJob } from './queue.js';
import { getSenderIdsForCampaignResume } from './campaignSenders.js';

const MIN_SEND_INTERVAL_SEC = 10;

/** Random delay in ms; min/max in seconds. Enforced minimum 10s between sends. */
function delayMs(min, max) {
  const minSec = Number(min) || 1;
  const maxSec = Number(max) != null && Number(max) >= minSec ? Number(max) : minSec;
  const sec = Math.random() * (maxSec - minSec) + minSec;
  return Math.round(sec * 1000);
}

export async function resumePendingCampaignsOnStartup() {
  const db = getDb();
  if (!db) return;
  try {
    const campaigns = await db.query(
      "SELECT id, delay_min, delay_max FROM campaigns WHERE status = 'running'"
    );
    let totalRequeued = 0;
    for (const c of campaigns.rows) {
      const delayMin = Math.max(MIN_SEND_INTERVAL_SEC, c.delay_min != null ? Number(c.delay_min) : MIN_SEND_INTERVAL_SEC);
      const delayMax = Math.max(delayMin, c.delay_max != null ? Number(c.delay_max) : delayMin);
      const senderIds = await getSenderIdsForCampaignResume(db, c.id);
      if (!senderIds.length) {
        console.warn(`[campaign resume] No domain senders for campaign ${c.id} — skipping re-queue`);
        continue;
      }
      const pending = await db.query(
        `SELECT p.store_url, p.email, p.subject, p.body
         FROM campaign_pending_sends p
         WHERE p.campaign_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM campaign_sends s
           WHERE s.campaign_id = p.campaign_id AND s.store_url = p.store_url AND s.email = p.email
         )
         ORDER BY p.id`,
        [c.id]
      );
      if (pending.rows.length > 0) {
        for (let i = 0; i < pending.rows.length; i++) {
          const row = pending.rows[i];
          const senderId = senderIds[i % senderIds.length];
          setTimeout(() => {
            addSendJob({
              campaignId: c.id,
              storeUrl: row.store_url,
              email: row.email,
              senderId,
              subject: row.subject || row.store_url,
              body: row.body || '',
            });
          }, i * delayMs(delayMin, delayMax));
        }
        totalRequeued += pending.rows.length;
        console.log(`[campaign resume] Re-queued ${pending.rows.length} pending sends for campaign ${c.id}`);
      }
    }
    if (totalRequeued > 0) {
      console.log(`[campaign resume] Total ${totalRequeued} pending sends re-queued on startup`);
    }
  } catch (err) {
    console.error('[campaign resume]', err?.message || err);
  }
}
