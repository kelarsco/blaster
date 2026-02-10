/**
 * Scan processor: cache check, priority crawler, one-email-per-store, enrichment.
 */
import { crawlStore } from './crawler.js';
import { extractEmailsFromPages } from './emailExtractor.js';
import { getDb, memoryStore } from '../db.js';

const DEFAULT_CONCURRENCY = Math.min(Number(process.env.SCAN_CONCURRENCY) || 2, 8);
const DELAY_BETWEEN_STORES_MS = 600;
const CACHE_TTL_DAYS = Number(process.env.SCAN_CACHE_TTL_DAYS) || 7;
const PER_STORE_TIMEOUT_MS = Number(process.env.SCAN_PER_STORE_TIMEOUT_MS) || 60000;

function parseUrls(text) {
  const raw = (text || '').replace(/,/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const urls = [];
  const seen = new Set();
  for (const s of raw) {
    let u = s;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      const parsed = new URL(u);
      const origin = parsed.origin;
      if (!seen.has(origin)) {
        seen.add(origin);
        urls.push(origin);
      }
    } catch (_) {}
  }
  return urls;
}

export async function processScan(payload) {
  const {
    scanId,
    rawInput,
    userId,
    emailFilters: rawEmailFilters = {},
    maxConcurrentCrawlers,
    maxUrlsPerScan,
    forceRefresh = false,
    stealthMode = false,
  } = payload;

  const emailFilters = {
    includeProviders: Array.isArray(rawEmailFilters.includeProviders)
      ? rawEmailFilters.includeProviders
      : Array.isArray(rawEmailFilters.include_providers)
        ? rawEmailFilters.include_providers
        : [],
    onePerStore: rawEmailFilters.onePerStore !== false,
  };

  const db = getDb();
  let urls = parseUrls(rawInput || '');
  const cap = typeof maxUrlsPerScan === 'number' && maxUrlsPerScan > 0 ? Math.min(maxUrlsPerScan, 5000) : 1000;
  urls = urls.slice(0, cap);

  if (urls.length === 0) {
    if (db) await db.query(`UPDATE scans SET status = 'completed', processed = 0, found_count = 0, updated_at = NOW() WHERE id = $1`, [scanId]);
    else {
      const rec = memoryStore.scans.get(scanId);
      if (rec) { rec.status = 'completed'; rec.processed = 0; rec.found_count = 0; memoryStore.scans.set(scanId, rec); }
    }
    return;
  }

  let processed = 0;
  let foundCount = 0;
  const memoryResults = db ? null : (memoryStore.results.get(scanId) || []);

  if (db) {
    await db.query(
      `UPDATE scans SET total_urls = $1, status = 'running', updated_at = NOW() WHERE id = $2`,
      [urls.length, scanId]
    );
  } else {
    const rec = memoryStore.scans.get(scanId);
    if (rec) {
      rec.status = 'running';
      rec.total_urls = urls.length;
      memoryStore.scans.set(scanId, rec);
    }
  }

  const cacheUserId = userId || null;
  const cacheCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  async function getCachedResult(storeUrl) {
    if (!db || !cacheUserId || forceRefresh) return null;
    try {
      const r = await db.query(
        `SELECT email, source_page, source_type, platform FROM scan_cache
         WHERE store_url = $1 AND user_id = $2 AND cached_at > $3`,
        [storeUrl, cacheUserId, cacheCutoff]
      );
      const row = r.rows?.[0];
      return row ? { email: row.email, source_page: row.source_page, source_type: row.source_type, platform: row.platform } : null;
    } catch (_) {
      return null;
    }
  }

  async function setCachedResult(storeUrl, email, sourcePage, sourceType, platform) {
    if (!db || !cacheUserId) return;
    try {
      await db.query(
        `INSERT INTO scan_cache (store_url, user_id, email, source_page, source_type, platform, cached_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (store_url, user_id) DO UPDATE SET
           email = EXCLUDED.email, source_page = EXCLUDED.source_page,
           source_type = EXCLUDED.source_type, platform = EXCLUDED.platform, cached_at = NOW()`,
        [storeUrl, cacheUserId, email || null, sourcePage || null, sourceType || null, platform || null]
      );
    } catch (_) {}
  }

  function processOneWithTimeout(storeUrl) {
    const timeoutPromise = new Promise((resolve) => {
      const t = setTimeout(() => {
        resolve({ storeUrl, results: [], timedOut: true });
      }, PER_STORE_TIMEOUT_MS);
      t.unref?.();
    });
    const workPromise = (async () => {
      try {
        const wantAllEmails = emailFilters.onePerStore === false;
        if (!wantAllEmails) {
          const cached = await getCachedResult(storeUrl);
          if (cached) {
            const results = cached.email
              ? [{ email: cached.email, storeUrl, sourcePage: cached.source_page || '', sourceType: cached.source_type, platform: cached.platform }]
              : [];
            return { storeUrl, results };
          }
        }

        const pages = await crawlStore(storeUrl, {
          stealthMode,
          maxPages: 10,
        });
        const results = await extractEmailsFromPages(storeUrl, pages, emailFilters);
        const best = results[0];
        if (best) {
          await setCachedResult(storeUrl, best.email, best.sourcePage, best.sourceType || null, best.platform || null);
        } else {
          await setCachedResult(storeUrl, null, null, null, null);
        }
        return { storeUrl, results };
      } catch (err) {
        console.error('[scanProcessor] store error:', storeUrl, err?.message || err);
        return { storeUrl, results: [] };
      }
    })();
    return Promise.race([workPromise, timeoutPromise]).then((r) => (r.timedOut ? { storeUrl: r.storeUrl, results: [] } : r));
  }

  const concurrency =
    typeof maxConcurrentCrawlers === 'number' && maxConcurrentCrawlers >= 1 && maxConcurrentCrawlers <= 20
      ? maxConcurrentCrawlers
      : DEFAULT_CONCURRENCY;

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < urls.length; i += concurrency) {
    if (i > 0) await delay(DELAY_BETWEEN_STORES_MS);
    const batch = urls.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((storeUrl) => processOneWithTimeout(storeUrl)));
    const outcomes = settled.map((s, idx) => {
      if (s.status === 'fulfilled') return s.value;
      console.error('[scanProcessor] store failed:', batch[idx], s.reason?.message || s.reason);
      return { storeUrl: batch[idx], results: [] };
    });

    for (const { storeUrl, results } of outcomes) {
      try {
        if (db) {
          for (const r of results) {
            await db.query(
              `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email) VALUES ($1, $2, $3, $4, 1)`,
              [scanId, r.storeUrl, r.email, r.sourcePage || '']
            );
            foundCount++;
          }
          if (results.length === 0) {
            await db.query(
              `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email) VALUES ($1, $2, NULL, NULL, 0)`,
              [scanId, storeUrl]
            );
            /* Store saved as "No public email detected" (has_email=0, email=NULL) */
          }
        } else {
          for (const r of results) {
            memoryResults.push({ store_url: r.storeUrl, email: r.email, source_page: r.sourcePage || '', has_email: 1 });
            foundCount++;
          }
          if (results.length === 0) {
            memoryResults.push({ store_url: storeUrl, email: null, source_page: null, has_email: 0 }); /* No public email detected */
          }
          memoryStore.results.set(scanId, memoryResults);
        }
      } catch (dbErr) {
        console.error('[scanProcessor] DB write error:', storeUrl, dbErr?.message || dbErr);
      }
      processed++;
    }

    try {
      if (db) {
        await db.query(
          `UPDATE scans SET processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
          [processed, foundCount, scanId]
        );
      } else {
        const rec = memoryStore.scans.get(scanId);
        if (rec) {
          rec.processed = processed;
          rec.found_count = foundCount;
          memoryStore.scans.set(scanId, rec);
        }
      }
    } catch (dbErr) {
      console.error('[scanProcessor] progress update error:', dbErr?.message || dbErr);
    }
  }

  if (db) {
    await db.query(
      `UPDATE scans SET status = 'completed', processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
      [processed, foundCount, scanId]
    );
  } else {
    const rec = memoryStore.scans.get(scanId);
    if (rec) {
      rec.status = 'completed';
      rec.processed = processed;
      rec.found_count = foundCount;
      memoryStore.scans.set(scanId, rec);
    }
  }
}
