/**
 * In-memory rate limit for auth endpoints.
 * - Interactive auth routes (login/register/etc): max 30 requests per 15 minutes per IP.
 * - Silent token refresh route: separate bucket with a higher ceiling so it doesn't block login.
 * For production at scale, use Redis.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const REFRESH_MAX_PER_WINDOW = 300;

const store = new Map();

function getKey(ip, bucket) {
  return `${ip || 'unknown'}:${bucket}`;
}

function cleanup() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (data.resetAt < now) store.delete(key);
  }
}

export function authRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || req.get?.('x-forwarded-for')?.split(',')[0]?.trim();
  const isRefreshRoute = req.path === '/refresh';
  const bucket = isRefreshRoute ? 'refresh' : 'interactive';
  const maxPerWindow = isRefreshRoute ? REFRESH_MAX_PER_WINDOW : MAX_PER_WINDOW;
  const key = getKey(ip, bucket);
  const now = Date.now();

  if (store.size > 10000) cleanup();

  let data = store.get(key);
  if (!data) {
    data = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, data);
  }
  if (now >= data.resetAt) {
    data.count = 0;
    data.resetAt = now + WINDOW_MS;
  }
  data.count += 1;

  if (data.count > maxPerWindow) {
    return res.status(429).json({
      error: isRefreshRoute
        ? 'Too many refresh attempts. Please try again shortly.'
        : 'Too many attempts. Please try again in 15 minutes.',
    });
  }
  next();
}
