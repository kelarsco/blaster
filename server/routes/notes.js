import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const notesRoutes = Router();

notesRoutes.get('/:storeUrl', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ note: '', updatedAt: null });
  const storeUrl = decodeURIComponent(req.params.storeUrl);
  const result = await db.query(
    'SELECT note, updated_at FROM store_notes WHERE store_url = $1 AND user_id = $2',
    [storeUrl, req.user.id]
  );
  const row = result.rows[0];
  res.json({ note: row?.note || '', updatedAt: row?.updated_at });
});

notesRoutes.put('/:storeUrl', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  const storeUrl = decodeURIComponent(req.params.storeUrl);
  const note = req.body?.note ?? '';
  await db.query(
    `INSERT INTO store_notes (user_id, store_url, note, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, store_url) DO UPDATE SET note = $3, updated_at = NOW()`,
    [req.user.id, storeUrl, note]
  );
  res.json({ ok: true });
});
