/**
 * Short-lived in-memory cache for refresh-session validity checks.
 * Cuts DB load during scan polling and other high-frequency API traffic.
 */
const TTL_MS = Math.max(Number(process.env.AUTH_SESSION_CACHE_TTL_MS) || 60_000, 5_000);

/** @type {Map<string, { active: boolean, expiresAt: number }>} */
const cache = new Map();

export function getCachedSessionActive(sessionId) {
  if (!sessionId) return null;
  const entry = cache.get(sessionId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(sessionId);
    return null;
  }
  return entry.active;
}

export function setCachedSessionActive(sessionId, active) {
  if (!sessionId) return;
  cache.set(sessionId, { active: Boolean(active), expiresAt: Date.now() + TTL_MS });
}

export function invalidateSessionCache(sessionId) {
  if (sessionId) cache.delete(sessionId);
}

export function clearSessionCache() {
  cache.clear();
}
