import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { logActivity } from './activity.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getSenderLimitForUser } from '../services/planLimits.js';

export const MAX_SENDERS_PER_GROUP = 10;
const GMAIL_SMTP_HOSTS = new Set(['smtp.gmail.com', 'smtp-relay.gmail.com']);

function normalizeSenderConfig(rawConfig = {}) {
  const host = String(rawConfig?.host || '').trim().toLowerCase();
  const isGmailHost = GMAIL_SMTP_HOSTS.has(host);
  const parsedPort = Number(rawConfig?.port);
  const port = Number.isFinite(parsedPort) && parsedPort > 0
    ? parsedPort
    : (isGmailHost ? 465 : 587);
  const secure = port === 465 ? true : !!rawConfig?.secure;
  const requireTLS = port === 587 ? true : !!rawConfig?.requireTLS;
  return {
    ...rawConfig,
    host,
    port,
    secure,
    requireTLS,
  };
}

export const automationRoutes = Router();

automationRoutes.get('/senders', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ senders: [] });
  const result = await db.query(
    `SELECT id, email, max_per_minute, is_active, created_at, provider
     FROM senders
     WHERE user_id = $1 AND is_active = 1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  const rows = result.rows;
  res.json({
    senders: rows.map((r) => ({
      id: r.id,
      email: r.email,
      maxPerMinute: r.max_per_minute,
      provider: r.provider || 'smtp',
      createdAt: r.created_at,
    })),
  });
});

/** Sender limit and current count for the current user (for UI). */
automationRoutes.get('/senders/limit', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ limit: 1, count: 0 });
    const [countResult, limitResult] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1', [req.user.id]),
      getSenderLimitForUser(req.user.id),
    ]);
    const count = parseInt(countResult.rows?.[0]?.c, 10) || 0;
    res.json({ limit: limitResult.limit, count });
  } catch (e) {
    console.error('[senders/limit]', e?.message || e);
    res.json({ limit: 1, count: 0 });
  }
});

automationRoutes.post('/senders', requireAuth, async (req, res) => {
  try {
    const { email, config, maxPerMinute = 10 } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required to save senders. Set DATABASE_URL in server/.env and restart.' });
    const userId = req.user.id;
    const countResult = await db.query('SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1', [userId]);
    const count = parseInt(countResult.rows?.[0]?.c, 10) || 0;
    const { limit } = await getSenderLimitForUser(userId);
    if (count >= limit) {
      return res.status(403).json({
        error: 'Sender limit reached for your plan.',
        code: 'SENDER_LIMIT_REACHED',
        limit,
        count,
      });
    }
    const id = uuidv4();
    const normalizedConfig = normalizeSenderConfig(config || {});
    await db.query(
      'INSERT INTO senders (id, user_id, email, config, max_per_minute) VALUES ($1, $2, $3, $4, $5)',
      [id, userId, email, JSON.stringify(normalizedConfig), Math.max(1, Math.min(60, maxPerMinute))]
    );
    logActivity('sender_add', { id, email }, userId);
    res.json({ id, email, maxPerMinute: maxPerMinute });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

automationRoutes.delete('/senders/:id', requireAuth, async (req, res) => {
  const db = getDb();
  if (db) await db.query('UPDATE senders SET is_active = 0 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  logActivity('sender_remove', { id: req.params.id }, req.user.id);
  res.json({ ok: true });
});

automationRoutes.get('/senders/groups/in-use', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ groupIds: [] });
  const result = await db.query(`
    SELECT DISTINCT sender_group_id AS id FROM campaigns
    WHERE sender_group_id IS NOT NULL AND user_id = $1 AND status IN ('running', 'paused')
  `, [req.user.id]);
  res.json({ groupIds: result.rows.map((r) => r.id).filter(Boolean) });
});

automationRoutes.get('/senders/groups', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ groups: [] });
  const result = await db.query(`
    SELECT sg.id, sg.name, sg.created_at,
      COALESCE(
        (SELECT json_agg(json_build_object('id', s.id, 'email', s.email, 'maxPerMinute', s.max_per_minute, 'provider', COALESCE(s.provider, 'smtp')))
         FROM senders s
         JOIN sender_group_members sgm ON sgm.sender_id = s.id
         WHERE sgm.group_id = sg.id AND s.is_active = 1),
        '[]'
      )::json AS senders
    FROM sender_groups sg
    WHERE sg.user_id = $1
    ORDER BY sg.name
  `, [req.user.id]);
  res.json({
    maxSendersPerGroup: MAX_SENDERS_PER_GROUP,
    groups: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      senders: r.senders || [],
    })),
  });
});

automationRoutes.post('/senders/groups', requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Group name required' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required.' });
    const id = uuidv4();
    await db.query('INSERT INTO sender_groups (id, user_id, name) VALUES ($1, $2, $3)', [id, req.user.id, String(name).trim()]);
    logActivity('sender_group_add', { id, name: String(name).trim() }, req.user.id);
    res.json({ id, name: String(name).trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

automationRoutes.put('/senders/groups/:id', requireAuth, async (req, res) => {
  try {
    const { name, senderIds = [] } = req.body || {};
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required.' });
    const groupId = req.params.id;
    const userId = req.user.id;
    const own = await db.query('SELECT 1 FROM sender_groups WHERE id = $1 AND user_id = $2', [groupId, userId]);
    if (!own.rows?.length) return res.status(404).json({ error: 'Group not found' });
    if (Array.isArray(senderIds) && senderIds.filter(Boolean).length > MAX_SENDERS_PER_GROUP) {
      return res.status(400).json({
        error: `Group limit reached. Maximum ${MAX_SENDERS_PER_GROUP} senders per group (recommended for Gmail stability).`,
      });
    }
    if (name != null) {
      await db.query('UPDATE sender_groups SET name = $1 WHERE id = $2 AND user_id = $3', [String(name).trim(), groupId, userId]);
    }
    if (Array.isArray(senderIds)) {
      await db.query('DELETE FROM sender_group_members WHERE group_id = $1', [groupId]);
      for (const sid of senderIds) {
        if (sid) {
          const senderOwn = await db.query('SELECT 1 FROM senders WHERE id = $1 AND user_id = $2', [sid, userId]);
          if (senderOwn.rows?.length) await db.query('INSERT INTO sender_group_members (group_id, sender_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, sid]);
        }
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

automationRoutes.delete('/senders/groups/:id', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  const groupId = req.params.id;
  const userId = req.user.id;
  const inUse = await db.query(
    'SELECT 1 FROM campaigns WHERE sender_group_id = $1 AND user_id = $2 AND status IN (\'running\', \'paused\') LIMIT 1',
    [groupId, userId]
  );
  if (inUse.rows.length > 0) {
    return res.status(400).json({ error: 'Cannot delete: this group is in use by a running campaign.' });
  }
  const result = await db.query('DELETE FROM sender_groups WHERE id = $1 AND user_id = $2 RETURNING id', [groupId, userId]);
  if (result.rowCount) logActivity('sender_group_remove', { id: groupId }, userId);
  res.json({ ok: true });
});

automationRoutes.get('/presets', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ presets: [] });
  const result = await db.query(
    'SELECT id, name, senders, subjects, templates, delay_min, delay_max, created_at FROM campaign_presets WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const rows = result.rows;
  res.json({
    presets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      senders: r.senders ? JSON.parse(r.senders) : [],
      subjects: r.subjects ? JSON.parse(r.subjects) : [],
      templates: r.templates ? JSON.parse(r.templates) : [],
      delayMin: r.delay_min,
      delayMax: r.delay_max,
      createdAt: r.created_at,
    })),
  });
});

automationRoutes.post('/presets', requireAuth, async (req, res) => {
  try {
    const { name, senders = [], subjects = [], templates = [], delayMin = 2, delayMax = 5 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Preset name required' });
    const id = uuidv4();
    const db = getDb();
    if (db) await db.query(
      'INSERT INTO campaign_presets (id, user_id, name, senders, subjects, templates, delay_min, delay_max) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, req.user.id, name, JSON.stringify(senders), JSON.stringify(subjects), JSON.stringify(templates), delayMin, delayMax]
    );
    logActivity('preset_save', { id, name }, req.user.id);
    res.json({ id, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

automationRoutes.delete('/presets/:id', requireAuth, async (req, res) => {
  const db = getDb();
  if (db) await db.query('DELETE FROM campaign_presets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});
