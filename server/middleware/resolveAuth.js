/**
 * Resolve req.user from JWT (Authorization: Bearer) or leave session (passport) as-is.
 * Must run after passport.session() so session-based req.user is already set when no Bearer.
 */
import { verifyAccessToken } from '../services/tokenAuth.js';

export async function resolveAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) return next();
    try {
      const payload = verifyAccessToken(token);
      if (payload?.sub) {
        req.user = {
          id: String(payload.sub),
          email: payload.email || '',
          name: payload.name || payload.email?.split('@')[0] || 'User',
          picture: payload.picture || null,
        };
      }
    } catch (_) {
      // Invalid or expired JWT; don't set req.user, let requireAuth return 401
    }
  }
  next();
}
