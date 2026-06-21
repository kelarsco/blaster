/**
 * Require an authenticated user with an active (non-suspended) account.
 */
import { getDb } from '../db.js';

export async function requireAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  const db = getDb();
  if (db) {
    try {
      const r = await db.query(
        'SELECT deactivated_at, suspended_at FROM users WHERE id = $1',
        [req.user.id]
      );
      const row = r.rows?.[0];
      if (!row) return res.status(401).json({ error: 'Not signed in' });
      if (row.deactivated_at) {
        return res.status(403).json({ error: 'Account deactivated' });
      }
      if (row.suspended_at) {
        return res.status(403).json({ error: 'Account suspended', code: 'SUSPENDED' });
      }
    } catch (e) {
      console.warn('[requireAuth] status check failed:', e?.message || e);
    }
  }

  next();
}
