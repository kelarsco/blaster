const PREFIX = 'wiblaster-cache';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const APP_ROUTE_CACHE_KEYS = {
  '/app/dashboard': 'dashboard',
  '/app/analytics': 'dashboard',
  '/app/stores': 'stores-list',
  '/app/campaigns': 'campaigns',
  '/app/templates': 'templates',
  '/app/senders': 'senders',
  '/app/resources': 'resources',
  '/app/referral': 'referral',
};

export function buildCacheStorageKey(userId, key) {
  return `${PREFIX}:${userId || 'anon'}:${key}`;
}

export function readPageCache(userId, key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(buildCacheStorageKey(userId, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(buildCacheStorageKey(userId, key));
      return null;
    }
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function writePageCache(userId, key, data, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return;
  try {
    localStorage.setItem(
      buildCacheStorageKey(userId, key),
      JSON.stringify({
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      })
    );
  } catch {
    /* quota or private mode */
  }
}

export function hasPageCache(userId, key) {
  return readPageCache(userId, key) != null;
}

export function routeCacheKey(pathname) {
  return APP_ROUTE_CACHE_KEYS[pathname] || null;
}

export function hasRouteCache(userId, pathname) {
  const key = routeCacheKey(pathname);
  if (!key || !userId) return false;
  return hasPageCache(userId, key);
}
