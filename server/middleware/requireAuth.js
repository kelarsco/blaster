/**
 * Require an authenticated user. Use on routes that must see only the current user's data.
 */
export function requireAuth(req, res, next) {
  if (req.user?.id) return next();
  return res.status(401).json({ error: 'Not signed in' });
}
