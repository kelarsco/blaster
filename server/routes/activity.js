import { Router } from 'express';
import { getDb } from '../db.js';

export const activityRoutes = Router();

export async function logActivity(type, payload = {}) {
  try {
    const db = getDb();
    if (db) await db.query('INSERT INTO activity_logs (type, payload) VALUES ($1, $2)', [type, JSON.stringify(payload)]);
  } catch (_) {}
}

activityRoutes.get('/logs', async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ logs: [] });
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const result = await db.query(
    'SELECT id, type, payload, created_at FROM activity_logs ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  const rows = result.rows;
  const logs = rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: r.payload ? JSON.parse(r.payload) : {},
    createdAt: r.created_at,
  }));
  res.json({ logs });
});
