import { Router } from 'express';
import { getDb } from '../db.js';

export const notesRoutes = Router();

notesRoutes.get('/:storeUrl', async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ note: '', updatedAt: null });
  const result = await db.query('SELECT note, updated_at FROM store_notes WHERE store_url = $1', [decodeURIComponent(req.params.storeUrl)]);
  const row = result.rows[0];
  res.json({ note: row?.note || '', updatedAt: row?.updated_at });
});

notesRoutes.put('/:storeUrl', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database not ready' });
  const storeUrl = decodeURIComponent(req.params.storeUrl);
  const note = req.body?.note ?? '';
  await db.query(
    `INSERT INTO store_notes (store_url, note, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (store_url) DO UPDATE SET note = $2, updated_at = NOW()`,
    [storeUrl, note]
  );
  res.json({ ok: true });
});
