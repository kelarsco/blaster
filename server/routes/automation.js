import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { logActivity } from './activity.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const automationRoutes = Router();

automationRoutes.get('/presets', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ presets: [] });
  const result = await db.query(
    'SELECT id, name, subjects, templates, delay_min, delay_max, created_at FROM campaign_presets WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const rows = result.rows;
  res.json({
    presets: rows.map((r) => ({
      id: r.id,
      name: r.name,
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
    const { name, subjects = [], templates = [], delayMin = 2, delayMax = 5 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Preset name required' });
    const id = uuidv4();
    const db = getDb();
    if (db) {
      await db.query(
        'INSERT INTO campaign_presets (id, user_id, name, subjects, templates, delay_min, delay_max) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, req.user.id, name, JSON.stringify(subjects), JSON.stringify(templates), delayMin, delayMax]
      );
    }
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
