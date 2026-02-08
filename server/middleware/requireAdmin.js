import jwt from 'jsonwebtoken';

const ADMIN_JWT_SECRET = process.env.BL_ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'bl-admin-dev-secret';
const COOKIE_NAME = 'bl_admin';

/**
 * Verify admin JWT from cookie. Use after admin login (TOTP).
 */
export function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers?.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    if (decoded?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired admin session' });
  }
}

export { COOKIE_NAME, ADMIN_JWT_SECRET };
