import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { logActivity } from './activity.js';

export const automationRoutes = Router();

automationRoutes.get('/senders', async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ senders: [] });
  const result = await db.query('SELECT id, email, max_per_minute, is_active, created_at FROM senders WHERE is_active = 1');
  const rows = result.rows;
  res.json({ senders: rows.map((r) => ({ id: r.id, email: r.email, maxPerMinute: r.max_per_minute, createdAt: r.created_at })) });
});

automationRoutes.post('/senders', async (req, res) => {
  try {
    const { email, config, maxPerMinute = 10 } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database required to save senders. Set DATABASE_URL in server/.env and restart.' });
    const id = uuidv4();
    await db.query(
      'INSERT INTO senders (id, email, config, max_per_minute) VALUES ($1, $2, $3, $4)',
      [id, email, JSON.stringify(config || {}), Math.max(1, Math.min(60, maxPerMinute))]
    );
    logActivity('sender_add', { id, email });
    res.json({ id, email, maxPerMinute: maxPerMinute });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

automationRoutes.delete('/senders/:id', async (req, res) => {
  const db = getDb();
  if (db) await db.query('UPDATE senders SET is_active = 0 WHERE id = $1', [req.params.id]);
  logActivity('sender_remove', { id: req.params.id });
  res.json({ ok: true });
});

automationRoutes.get('/presets', async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ presets: [] });
  const result = await db.query('SELECT id, name, senders, subjects, templates, delay_min, delay_max, created_at FROM campaign_presets ORDER BY created_at DESC');
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

automationRoutes.post('/presets', async (req, res) => {
  try {
    const { name, senders = [], subjects = [], templates = [], delayMin = 2, delayMax = 5 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Preset name required' });
    const id = uuidv4();
    const db = getDb();
    if (db) await db.query(
      'INSERT INTO campaign_presets (id, name, senders, subjects, templates, delay_min, delay_max) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, JSON.stringify(senders), JSON.stringify(subjects), JSON.stringify(templates), delayMin, delayMax]
    );
    logActivity('preset_save', { id, name });
    res.json({ id, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

automationRoutes.delete('/presets/:id', async (req, res) => {
  const db = getDb();
  if (db) await db.query('DELETE FROM campaign_presets WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});
