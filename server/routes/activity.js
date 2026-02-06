import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const activityRoutes = Router();

/**
 * Log activity for a user. Pass userId (e.g. req.user.id) when available.
 */
export async function logActivity(type, payload = {}, userId = null) {
  try {
    const db = getDb();
    if (db) {
      await db.query(
        'INSERT INTO activity_logs (user_id, type, payload) VALUES ($1, $2, $3)',
        [userId || null, type, JSON.stringify(payload)]
      );
    }
  } catch (_) {}
}

activityRoutes.get('/logs', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ logs: [] });
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const result = await db.query(
      'SELECT id, type, payload, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.id, limit]
    );
    const rows = result.rows;
    const logs = rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: r.payload ? JSON.parse(r.payload) : {},
      createdAt: r.created_at,
    }));
    return res.json({ logs });
  } catch (err) {
    console.error('[activity/logs]', err.message);
    return res.status(503).json({ logs: [] });
  }
});
