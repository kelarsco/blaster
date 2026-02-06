/**
 * Resolve req.user from JWT (Authorization: Bearer) or leave session (passport) as-is.
 * Must run after passport.session() so session-based req.user is already set when no Bearer.
 */
import { verifyAccessToken } from '../services/tokenAuth.js';
import { getDb } from '../db.js';

export async function resolveAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) return next();
    try {
      const payload = verifyAccessToken(token);
      if (payload?.sub) {
        const db = getDb();
        if (db) {
          const r = await db.query(
            'SELECT id, email, name, picture_url FROM users WHERE id = $1',
            [payload.sub]
          );
          const row = r?.rows?.[0];
          if (row) {
            req.user = {
              id: row.id,
              email: row.email,
              name: row.name || row.email?.split('@')[0] || 'User',
              picture: row.picture_url || null,
            };
          }
        }
        if (!req.user) {
          req.user = {
            id: payload.sub,
            email: payload.email || '',
            name: payload.name || payload.email?.split('@')[0] || 'User',
            picture: null,
          };
        }
      }
    } catch (_) {
      // Invalid or expired JWT; don't set req.user, let requireAuth return 401
    }
  }
  next();
}
