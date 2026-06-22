import { useState, useEffect, useCallback, useRef } from 'react';
import { readPageCache, writePageCache } from '../utils/pageCache.js';

const MAX_SKELETON_MS = 3000;

/**
 * Stale-while-revalidate: show cached data instantly, refresh in background.
 */
export function useStaleWhileRevalidate(cacheKey, fetcher, { userId, enabled = true } = {}) {
  const initialCache = enabled && userId && cacheKey ? readPageCache(userId, cacheKey) : null;
  const hadCacheRef = useRef(Boolean(initialCache));

  const [data, setData] = useState(initialCache);
  const [loading, setLoading] = useState(!initialCache);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const revalidate = useCallback(async () => {
    if (!enabled || !fetcher) return;
    const hadCache = hadCacheRef.current;

    if (hadCache) setIsRevalidating(true);
    else setLoading(true);

    try {
      const fresh = await fetcher();
      if (userId && cacheKey) writePageCache(userId, cacheKey, fresh);
      if (userId && cacheKey?.startsWith('resources:')) {
        writePageCache(userId, 'resources', { updatedAt: Date.now() });
      }
      setData(fresh);
      hadCacheRef.current = true;
    } catch (error) {
      console.error('[useStaleWhileRevalidate]', cacheKey, error);
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, [cacheKey, enabled, fetcher, userId]);

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => setLoading(false), MAX_SKELETON_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return {
    data,
    setData,
    loading,
    isRevalidating,
    refetch: revalidate,
    hasCache: hadCacheRef.current,
  };
}
