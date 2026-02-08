import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { addSendJob } from '../services/queue.js';
import { logActivity } from './activity.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPlanLimitsForUser } from '../services/planLimits.js';

export const campaignRoutes = Router();

function getDomain(email) {
  const i = email.indexOf('@');
  return i >= 0 ? email.slice(i + 1).toLowerCase() : '';
}

const THROTTLE_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'live.com', 'icloud.com'];

/** Random delay in ms; min/max can be fractional seconds (e.g. 0.5, 2). */
function delayMs(min, max) {
  const minSec = Number(min) || 1;
  const maxSec = Number(max) != null && Number(max) >= minSec ? Number(max) : minSec;
  const sec = Math.random() * (maxSec - minSec) + minSec;
  return Math.round(sec * 1000);
}

campaignRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ campaigns: [] });
    const result = await db.query(
      'SELECT id, status, total_queued, sent, failed, created_at, updated_at FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    return res.json({
      campaigns: result.rows.map((r) => ({
        id: r.id,
        status: r.status,
        totalQueued: r.total_queued,
        sent: r.sent,
        failed: r.failed,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    console.error('[campaigns GET]', err.message);
    return res.status(503).json({ campaigns: [] });
  }
});

campaignRoutes.post('/start', requireAuth, async (req, res) => {
  try {
    const {
      scanId,
      recipients,
      senders,
      senderGroupId,
      subjects,
      templates,
      delayMin = 2,
      delayMax = 5,
      onePerStore = true,
    } = req.body || {};
    const db = getDb();
    const userId = req.user.id;
    if (!db) return res.status(503).json({ error: 'Database required for campaigns. Set DATABASE_URL in server/.env' });
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients required' });
    }
    let senderIds = [];
    if (senderGroupId) {
      const inUse = await db.query(
        'SELECT 1 FROM campaigns WHERE sender_group_id = $1 AND user_id = $2 AND status IN (\'running\', \'paused\') LIMIT 1',
        [senderGroupId, userId]
      );
      if (inUse.rows.length > 0) {
        return res.status(400).json({ error: 'This sender group is already in use by another running campaign.' });
      }
      const groupSenders = await db.query(
        'SELECT sgm.sender_id FROM sender_group_members sgm JOIN sender_groups sg ON sg.id = sgm.group_id WHERE sgm.group_id = $1 AND sg.user_id = $2',
        [senderGroupId, userId]
      );
      senderIds = groupSenders.rows.map((r) => r.sender_id);
    }
    if (senderIds.length === 0 && (!senders || !senders.length)) {
      const senderList = (await db.query('SELECT id, email FROM senders WHERE user_id = $1 AND is_active = 1', [userId])).rows;
      senderIds = senderList.map((s) => s.id);
    } else if (senders && senders.length) {
      senderIds = senders;
    }
    if (senderIds.length === 0) {
      return res.status(400).json({ error: 'Add at least one sender to a group in Senders, then select a group.' });
    }
    let list = recipients;
    if (onePerStore) {
      const byStore = new Map();
      for (const r of recipients) {
        const url = r.storeUrl || r.store_url;
        if (!byStore.has(url)) byStore.set(url, r);
      }
      list = [...byStore.values()];
    }
    const limits = await getPlanLimitsForUser(userId);
    if (limits.emailsLimit < 999999 && limits.emailsUsed + list.length > limits.emailsLimit) {
      const overageScans = Math.max(0, (limits.scansUsed ?? 0) - (limits.scansLimit ?? 1000));
      const wouldBeOverageEmails = limits.emailsUsed + list.length - limits.emailsLimit;
      const wouldBeOwed = Math.floor(overageScans / 500) + Math.floor(wouldBeOverageEmails / 300);
      const nextThreshold = limits.extraCreditNextThreshold ?? 10;
      if (wouldBeOwed >= nextThreshold) {
        return res.status(403).json({
          error: `Extra credit limit reached ($${nextThreshold}). You've used more than your plan allows. Pay your extra credit balance to continue.`,
          extraCreditBlocked: true,
          nextThreshold,
        });
      }
    }
    const campaignId = uuidv4();
    const delayMinSec = Math.max(0.5, Number(delayMin) || 2);
    const delayMaxSec = Math.max(delayMinSec, Number(delayMax) || 5);
    await db.query(
      'INSERT INTO campaigns (id, user_id, sender_group_id, status, total_queued, sent, failed, delay_min, delay_max) VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)',
      [campaignId, userId, senderGroupId || null, 'running', list.length, delayMinSec, delayMaxSec]
    );
    logActivity('campaign_start', { campaignId, totalQueued: list.length }, userId);
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const storeUrl = r.storeUrl || r.store_url;
      const email = r.email;
      const senderId = senderIds[i % senderIds.length];
      const subject = Array.isArray(subjects) && subjects.length
        ? subjects[Math.floor(Math.random() * subjects.length)]
        : storeUrl;
      const template = Array.isArray(templates) && templates.length
        ? templates[Math.floor(Math.random() * templates.length)]
        : { body: `Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards` };
      const body = typeof template === 'string' ? template : (template.body || template.text || '');
      await db.query(
        'INSERT INTO campaign_pending_sends (campaign_id, store_url, email, sender_id, subject, body) VALUES ($1, $2, $3, $4, $5, $6)',
        [campaignId, storeUrl, email, senderId, subject, body]
      );
      const domain = getDomain(email);
      const throttle = THROTTLE_DOMAINS.includes(domain) ? 2 : 1;
      setTimeout(async () => {
        await addSendJob({
          campaignId,
          storeUrl,
          email,
          senderId,
          subject,
          body,
        });
      }, i * (delayMs(delayMinSec, delayMaxSec) * throttle));
    }
    res.json({ campaignId, totalQueued: list.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

campaignRoutes.post('/delete', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.json({ ok: true, deleted: 0 });
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const params = [...ids, req.user.id];
  await db.query(`DELETE FROM campaign_sends WHERE campaign_id IN (${placeholders}) AND campaign_id IN (SELECT id FROM campaigns WHERE user_id = $${ids.length + 1})`, params);
  await db.query(`DELETE FROM campaign_pending_sends WHERE campaign_id IN (${placeholders}) AND campaign_id IN (SELECT id FROM campaigns WHERE user_id = $${ids.length + 1})`, params);
  const result = await db.query(`DELETE FROM campaigns WHERE id IN (${placeholders}) AND user_id = $${ids.length + 1} RETURNING id`, params);
  res.json({ ok: true, deleted: result.rowCount });
});

campaignRoutes.get('/:campaignId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not ready' });
    const result = await db.query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [req.params.campaignId, req.user.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Campaign not found' });
    const errResult = await db.query(
      "SELECT error FROM campaign_sends WHERE campaign_id = $1 AND status = 'failed' AND error IS NOT NULL ORDER BY id DESC LIMIT 1",
      [req.params.campaignId]
    );
    return res.json({
      campaignId: row.id,
      status: row.status,
      totalQueued: row.total_queued,
      sent: row.sent,
      failed: row.failed,
      lastError: errResult.rows[0]?.error || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('[campaigns GET :id]', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable' });
  }
});

campaignRoutes.post('/:campaignId/pause', requireAuth, async (req, res) => {
  const db = getDb();
  if (db) await db.query("UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND user_id = $2", [req.params.campaignId, req.user.id]);
  res.json({ ok: true });
});

campaignRoutes.post('/:campaignId/resume', requireAuth, async (req, res) => {
  const db = getDb();
  const campaignId = req.params.campaignId;
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  const campaignRow = (await db.query('SELECT id, delay_min, delay_max FROM campaigns WHERE id = $1 AND user_id = $2', [campaignId, req.user.id])).rows[0];
  if (!campaignRow) return res.status(404).json({ error: 'Campaign not found' });
  await db.query("UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE id = $1 AND user_id = $2", [campaignId, req.user.id]);
  const pending = await db.query(
    `SELECT p.store_url, p.email, p.sender_id, p.subject, p.body
     FROM campaign_pending_sends p
     WHERE p.campaign_id = $1
     AND NOT EXISTS (
       SELECT 1 FROM campaign_sends s
       WHERE s.campaign_id = p.campaign_id AND s.store_url = p.store_url AND s.email = p.email
     )`,
    [campaignId]
  );
  const delayMin = campaignRow.delay_min != null ? Number(campaignRow.delay_min) : 2;
  const delayMax = campaignRow.delay_max != null ? Number(campaignRow.delay_max) : 5;
  for (let i = 0; i < pending.rows.length; i++) {
    const row = pending.rows[i];
    const throttle = THROTTLE_DOMAINS.includes(getDomain(row.email)) ? 2 : 1;
    setTimeout(async () => {
      await addSendJob({
        campaignId,
        storeUrl: row.store_url,
        email: row.email,
        senderId: row.sender_id,
        subject: row.subject || row.store_url,
        body: row.body || '',
      });
    }, i * (delayMs(delayMin, delayMax) * throttle));
  }
  res.json({ ok: true, reQueued: pending.rows.length });
});

campaignRoutes.post('/:campaignId/stop', requireAuth, async (req, res) => {
  const db = getDb();
  if (db) await db.query("UPDATE campaigns SET status = 'stopped', updated_at = NOW() WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)", [req.params.campaignId, req.user.id]);
  res.json({ ok: true });
});

campaignRoutes.post('/:campaignId/clear-error', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database not ready' });
    const campaignId = req.params.campaignId;
    await db.query(
      `UPDATE campaign_sends SET error = NULL WHERE campaign_id = $1 AND status = 'failed' AND error IS NOT NULL
       AND EXISTS (SELECT 1 FROM campaigns WHERE id = $1 AND user_id = $2)`,
      [campaignId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[campaigns clear-error]', err.message);
    res.status(500).json({ error: err.message });
  }
});
