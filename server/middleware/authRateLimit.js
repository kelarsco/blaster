/**
 * In-memory rate limit for auth endpoints: max 30 requests per 15 minutes per IP.
 * Prevents brute force and abuse. Allow enough headroom for token refresh retries (multiple tabs or parallel 401s).
 * For production at scale, use Redis.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 30;

const store = new Map();

function getKey(ip) {
  return ip || 'unknown';
}

function cleanup() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (data.resetAt < now) store.delete(key);
  }
}

export function authRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || req.get?.('x-forwarded-for')?.split(',')[0]?.trim();
  const key = getKey(ip);
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

  if (data.count > MAX_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many attempts. Please try again in 15 minutes.',
    });
  }
  next();
}
