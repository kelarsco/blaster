/**
 * Simple in-memory rate limit for expensive API routes.
 */
const WINDOW_MS = 60 * 1000;
const store = new Map();

export function createRateLimit({ max = 60, windowMs = WINDOW_MS, keyPrefix = 'api' } = {}) {
  return (req, res, next) => {
    const userId = req.user?.id;
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${userId || ip}`;
    const now = Date.now();
    let bucket = store.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

export const scanRateLimit = createRateLimit({ max: 20, windowMs: 60 * 60 * 1000, keyPrefix: 'scan' });
export const campaignRateLimit = createRateLimit({ max: 10, windowMs: 60 * 60 * 1000, keyPrefix: 'campaign' });
