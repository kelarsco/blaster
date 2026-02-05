import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { addSendJob } from '../services/queue.js';
import { logActivity } from './activity.js';

export const campaignRoutes = Router();

function getDomain(email) {
  const i = email.indexOf('@');
  return i >= 0 ? email.slice(i + 1).toLowerCase() : '';
}

const THROTTLE_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'live.com', 'icloud.com'];

function delayMs(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

campaignRoutes.get('/', async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ campaigns: [] });
  const result = await db.query(
    'SELECT id, status, total_queued, sent, failed, created_at, updated_at FROM campaigns ORDER BY created_at DESC LIMIT 100'
  );
  res.json({
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
});

campaignRoutes.post('/start', async (req, res) => {
  try {
    const {
      scanId,
      recipients,
      senders,
      subjects,
      templates,
      delayMin = 2,
      delayMax = 5,
      onePerStore = true,
    } = req.body || {};
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required for campaigns. Set DATABASE_URL in server/.env' });
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients required' });
    }
    const senderList = (await db.query('SELECT id, email FROM senders WHERE is_active = 1')).rows;
    const senderIds = (senders && senders.length) ? senders : senderList.map((s) => s.id);
    if (senderIds.length === 0) {
      return res.status(400).json({ error: 'Add at least one sender in Automation Setup (with SMTP details).' });
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
    const campaignId = uuidv4();
    if (db) await db.query(
      'INSERT INTO campaigns (id, status, total_queued, sent, failed) VALUES ($1, $2, $3, 0, 0)',
      [campaignId, 'running', list.length]
    );
    logActivity('campaign_start', { campaignId, totalQueued: list.length });
    res.json({ campaignId, totalQueued: list.length });
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
      }, i * (delayMs(delayMin, delayMax) * throttle));
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

campaignRoutes.get('/:campaignId', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  const result = await db.query('SELECT * FROM campaigns WHERE id = $1', [req.params.campaignId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: 'Campaign not found' });
  const errResult = await db.query(
    "SELECT error FROM campaign_sends WHERE campaign_id = $1 AND status = 'failed' AND error IS NOT NULL ORDER BY id DESC LIMIT 1",
    [req.params.campaignId]
  );
  res.json({
    campaignId: row.id,
    status: row.status,
    totalQueued: row.total_queued,
    sent: row.sent,
    failed: row.failed,
    lastError: errResult.rows[0]?.error || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
});

campaignRoutes.post('/:campaignId/pause', async (req, res) => {
  const db = getDb();
  if (db) await db.query("UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1", [req.params.campaignId]);
  res.json({ ok: true });
});

campaignRoutes.post('/:campaignId/resume', async (req, res) => {
  const db = getDb();
  if (db) await db.query("UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE id = $1", [req.params.campaignId]);
  res.json({ ok: true });
});

campaignRoutes.post('/:campaignId/stop', async (req, res) => {
  const db = getDb();
  if (db) await db.query("UPDATE campaigns SET status = 'stopped', updated_at = NOW() WHERE id = $1", [req.params.campaignId]);
  res.json({ ok: true });
});
