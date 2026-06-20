/**
 * Scan processor: cache check, priority crawler, one-email-per-store, enrichment.
 */
import { crawlStore, normalizeStoreUrl } from './crawler.js';
import { extractEmailsFromPages } from './emailExtractor.js';
import { extractContactsFromPages, hasAnyContactData } from './contactExtractor.js';
import { getDb, memoryStore } from '../db.js';

const DEFAULT_CONCURRENCY = Math.min(Number(process.env.SCAN_CONCURRENCY) || 10, 16);
const DELAY_BETWEEN_STORES_MS = Number(process.env.SCAN_BATCH_DELAY_MS) || 100;
const CACHE_TTL_DAYS = Number(process.env.SCAN_CACHE_TTL_DAYS) || 7;
const PER_STORE_TIMEOUT_MS = Number(process.env.SCAN_PER_STORE_TIMEOUT_MS) || 70000;
const DB_WRITE_RETRIES = Number(process.env.DB_WRITE_RETRIES) || 3;

function parseUrls(text) {
  const raw = (text || '').replace(/,/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const urls = [];
  const seen = new Set();
  for (const s of raw) {
    const normalized = normalizeStoreUrl(s);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }
  return urls;
}

function upsertMemoryScan(scanId, patch = {}) {
  const prev = memoryStore.scans.get(scanId) || {
    status: 'pending',
    total_urls: 0,
    processed: 0,
    found_count: 0,
    created_at: new Date(),
  };
  const next = { ...prev, ...patch };
  memoryStore.scans.set(scanId, next);
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDbError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('enotfound') ||
    msg.includes('econnreset') ||
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('could not connect') ||
    msg.includes('timeout') ||
    msg.includes('terminating connection')
  );
}

async function runDbQueryWithRetry(db, query, params, retries = DB_WRITE_RETRIES) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await db.query(query, params);
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === retries) break;
      await sleep(Math.min(250 * attempt, 1000));
    }
  }
  throw lastErr;
}

function normalizeExtractOptions(raw = {}) {
  return {
    email: raw.email !== false,
    phone: Boolean(raw.phone || raw.whatsapp),
    whatsapp: Boolean(raw.whatsapp),
    instagram: Boolean(raw.instagram),
    tiktok: Boolean(raw.tiktok),
  };
}

function storeHasExtractedData(row, extractOptions) {
  if (extractOptions.email && row.email) return true;
  if (extractOptions.phone && row.phone) return true;
  if (extractOptions.whatsapp && row.whatsapp) return true;
  if (extractOptions.instagram && row.instagram) return true;
  if (extractOptions.tiktok && row.tiktok) return true;
  return false;
}

export async function processScan(payload) {
  const {
    scanId,
    rawInput,
    userId,
    emailFilters: rawEmailFilters = {},
    extractOptions: rawExtractOptions = {},
    maxConcurrentCrawlers,
    maxUrlsPerScan,
    forceRefresh = true,
    useCache = false,
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

  const extractOptions = normalizeExtractOptions(rawExtractOptions);

  const db = getDb();
  let urls = parseUrls(rawInput || '');
  const cap = typeof maxUrlsPerScan === 'number' && maxUrlsPerScan > 0 ? Math.min(maxUrlsPerScan, 5000) : 1000;
  urls = urls.slice(0, cap);
  let processed = payload.initialProcessed ?? 0;
  let foundCount = payload.initialFoundCount ?? 0;
  const totalUrlCount = payload.totalUrlCount ?? urls.length;
  upsertMemoryScan(scanId, { total_urls: totalUrlCount, status: 'pending', processed, found_count: foundCount });

  if (urls.length === 0) {
    upsertMemoryScan(scanId, { status: 'completed', processed, found_count: foundCount });
    if (db) {
      try {
        await runDbQueryWithRetry(
          db,
          `UPDATE scans SET status = 'completed', processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
          [processed, foundCount, scanId]
        );
      } catch (e) {
        console.warn('[scanProcessor] finalize-empty update failed:', e?.message || e);
      }
    }
    return;
  }

  const memoryResults = db ? [] : (memoryStore.results.get(scanId) || []);
  memoryStore.results.set(scanId, memoryResults);

  upsertMemoryScan(scanId, { status: 'running', total_urls: totalUrlCount, processed, found_count: foundCount });
  if (db) {
    try {
      await runDbQueryWithRetry(
        db,
        `UPDATE scans SET total_urls = $1, status = 'running', processed = $2, found_count = $3, updated_at = NOW() WHERE id = $4`,
        [totalUrlCount, processed, foundCount, scanId]
      );
    } catch (e) {
      console.warn('[scanProcessor] start status update failed:', e?.message || e);
    }
  }

  const cacheUserId = userId || null;
  const cacheCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  async function getCachedResult(storeUrl) {
    if (!db || !cacheUserId || forceRefresh || !useCache) return null;
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
        const needCrawl = extractOptions.email || extractOptions.phone || extractOptions.whatsapp || extractOptions.instagram || extractOptions.tiktok;

        if (!needCrawl) {
          return { storeUrl, results: [], noEmailReason: 'No extraction options selected' };
        }

        if (!wantAllEmails && extractOptions.email && !extractOptions.phone && !extractOptions.whatsapp && !extractOptions.instagram && !extractOptions.tiktok) {
          const cached = await getCachedResult(storeUrl);
          if (cached) {
            const results = cached.email
              ? [{ email: cached.email, storeUrl, sourcePage: cached.source_page || '', sourceType: cached.source_type, platform: cached.platform }]
              : [];
            return { storeUrl, results };
          }
        }

        const crawl = await crawlStore(storeUrl);
        const contacts = extractContactsFromPages(storeUrl, crawl.pages, {
          phone: extractOptions.phone,
          whatsapp: extractOptions.whatsapp,
          instagram: extractOptions.instagram,
          tiktok: extractOptions.tiktok,
        });

        let emailResults = [];
        if (extractOptions.email) {
          emailResults = await extractEmailsFromPages(storeUrl, crawl.pages, {
            ...emailFilters,
            privacyPageFound: crawl.privacyPageFound,
            fallbackUsed: crawl.fallbackUsed,
          });
        }

        const contactPatch = {
          phone: contacts.phone || null,
          whatsapp: contacts.whatsapp || null,
          instagram: contacts.instagram || null,
          tiktok: contacts.tiktok || null,
        };

        if (emailResults.length > 0) {
          emailResults[0] = { ...emailResults[0], ...contactPatch };
          const best = emailResults[0];
          if (extractOptions.email && best.email) {
            await setCachedResult(storeUrl, best.email, best.sourcePage, best.sourceType || null, best.platform || null);
          }
          return { storeUrl, results: emailResults };
        }

        if (hasAnyContactData(contacts, extractOptions)) {
          const noEmailReason = crawl.privacyPageFound ? 'No Email Found' : 'Privacy Page Not Found';
          return {
            storeUrl,
            results: [{
              email: null,
              storeUrl,
              sourcePage: noEmailReason,
              sourceType: 'contact',
              ...contactPatch,
            }],
            noEmailReason,
          };
        }

        const noEmailReason = crawl.privacyPageFound ? 'No Email Found' : 'Privacy Page Not Found';
        if (extractOptions.email) {
          await setCachedResult(storeUrl, null, null, null, null);
        }
        return { storeUrl, results: [], noEmailReason };
      } catch (err) {
        console.error('[scanProcessor] store error:', storeUrl, err?.message || err);
        return { storeUrl, results: [], noEmailReason: 'No Email Found' };
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
    if (process.env.SCAN_DEBUG === '1') {
      console.log(`[scanProcessor] ${scanId} batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)} (${batch.length} stores)`);
    }
    const settled = await Promise.allSettled(batch.map((storeUrl) => processOneWithTimeout(storeUrl)));
    const outcomes = settled.map((s, idx) => {
      if (s.status === 'fulfilled') return s.value;
      console.error('[scanProcessor] store failed:', batch[idx], s.reason?.message || s.reason);
      return { storeUrl: batch[idx], results: [] };
    });

    for (const { storeUrl, results, noEmailReason } of outcomes) {
      try {
        const rowsToWrite = results.length > 0 ? results : [];

        if (db) {
          if (rowsToWrite.length > 0) {
            const storeHasData = rowsToWrite.some((r) =>
              storeHasExtractedData(
                {
                  email: r.email,
                  phone: r.phone,
                  whatsapp: r.whatsapp,
                  instagram: r.instagram,
                  tiktok: r.tiktok,
                },
                extractOptions
              )
            );
            if (storeHasData) foundCount += 1;
            for (const r of rowsToWrite) {
              const row = {
                store_url: r.storeUrl,
                email: r.email || null,
                source_page: r.sourcePage || '',
                phone: r.phone || null,
                whatsapp: r.whatsapp || null,
                instagram: r.instagram || null,
                tiktok: r.tiktok || null,
                has_email: storeHasExtractedData(
                  {
                    email: r.email,
                    phone: r.phone,
                    whatsapp: r.whatsapp,
                    instagram: r.instagram,
                    tiktok: r.tiktok,
                  },
                  extractOptions
                )
                  ? 1
                  : 0,
              };
              try {
                await runDbQueryWithRetry(
                  db,
                  `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email, phone, whatsapp, instagram, tiktok)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                  [
                    scanId,
                    row.store_url,
                    row.email,
                    row.source_page,
                    row.has_email,
                    row.phone,
                    row.whatsapp,
                    row.instagram,
                    row.tiktok,
                  ]
                );
              } catch (dbInsertErr) {
                console.warn('[scanProcessor] buffered result after DB insert failure:', row.store_url, dbInsertErr?.message || dbInsertErr);
                memoryResults.push(row);
                memoryStore.results.set(scanId, memoryResults);
              }
            }
          } else {
            const noEmailRow = {
              store_url: storeUrl,
              email: null,
              source_page: noEmailReason || 'No Email Found',
              phone: null,
              whatsapp: null,
              instagram: null,
              tiktok: null,
              has_email: 0,
            };
            try {
              await runDbQueryWithRetry(
                db,
                `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email, phone, whatsapp, instagram, tiktok)
                 VALUES ($1, $2, NULL, $3, 0, NULL, NULL, NULL, NULL)`,
                [scanId, noEmailRow.store_url, noEmailRow.source_page]
              );
            } catch (dbInsertErr) {
              console.warn('[scanProcessor] buffered no-email row after DB insert failure:', storeUrl, dbInsertErr?.message || dbInsertErr);
              memoryResults.push(noEmailRow);
              memoryStore.results.set(scanId, memoryResults);
            }
          }
        } else {
          if (rowsToWrite.length > 0) {
            const storeHasData = rowsToWrite.some((r) =>
              storeHasExtractedData(
                {
                  email: r.email,
                  phone: r.phone,
                  whatsapp: r.whatsapp,
                  instagram: r.instagram,
                  tiktok: r.tiktok,
                },
                extractOptions
              )
            );
            if (storeHasData) foundCount += 1;
            for (const r of rowsToWrite) {
              const row = {
                store_url: r.storeUrl,
                email: r.email || null,
                source_page: r.sourcePage || '',
                phone: r.phone || null,
                whatsapp: r.whatsapp || null,
                instagram: r.instagram || null,
                tiktok: r.tiktok || null,
                has_email: storeHasExtractedData(
                  {
                    email: r.email,
                    phone: r.phone,
                    whatsapp: r.whatsapp,
                    instagram: r.instagram,
                    tiktok: r.tiktok,
                  },
                  extractOptions
                )
                  ? 1
                  : 0,
              };
              memoryResults.push(row);
            }
          } else {
            memoryResults.push({
              store_url: storeUrl,
              email: null,
              source_page: noEmailReason || 'No Email Found',
              has_email: 0,
              phone: null,
              whatsapp: null,
              instagram: null,
              tiktok: null,
            });
          }
          memoryStore.results.set(scanId, memoryResults);
        }
      } catch (dbErr) {
        console.error('[scanProcessor] DB write error:', storeUrl, dbErr?.message || dbErr);
      }
      processed++;
    }

    try {
      upsertMemoryScan(scanId, { processed, found_count: foundCount });
      if (db) {
        await runDbQueryWithRetry(
          db,
          `UPDATE scans SET processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
          [processed, foundCount, scanId]
        );
      }
    } catch (dbErr) {
      console.error('[scanProcessor] progress update error:', dbErr?.message || dbErr);
    }
  }

  upsertMemoryScan(scanId, { status: 'completed', processed, found_count: foundCount });
  if (db) {
    try {
      await runDbQueryWithRetry(
        db,
        `UPDATE scans SET status = 'completed', processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
        [processed, foundCount, scanId]
      );
    } catch (e) {
      console.warn('[scanProcessor] final status update failed:', e?.message || e);
    }
  }
}
