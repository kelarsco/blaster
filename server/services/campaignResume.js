import { getDb } from '../db.js';
import { addSendJob } from './queue.js';

const MIN_SEND_INTERVAL_SEC = 20;

/** Random delay in ms; min/max in seconds. Enforced minimum 20s between sends. */
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
      const pending = await db.query(
        `SELECT p.store_url, p.email, p.sender_id, p.subject, p.body
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
          setTimeout(() => {
            addSendJob({
              campaignId: c.id,
              storeUrl: row.store_url,
              email: row.email,
              senderId: row.sender_id,
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
