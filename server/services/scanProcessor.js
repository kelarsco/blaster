/**
 * Scan processor: batch crawl stores and extract emails via regex.
 */
import { crawlStore, normalizeStoreUrl } from './crawler.js';
import { extractEmailsFromPages } from './emailExtractor.js';
import { extractContactsFromPages, storeHasExtractedData } from './contactExtractor.js';
import { normalizeExtractOptions } from './scanExtractOptions.js';
import { getDb, memoryStore } from '../db.js';
import { registerUserWorkload, unregisterUserWorkload } from './resourceCoordinator.js';

const DEFAULT_CONCURRENCY = Math.min(
  Number(process.env.SCAN_CONCURRENCY) || 4,
  10
);
const DELAY_BETWEEN_STORES_MS = Number(process.env.SCAN_BATCH_DELAY_MS) || 250;
const STORE_STAGGER_MS = Number(process.env.SCAN_STORE_STAGGER_MS) || 0;
const PER_STORE_TIMEOUT_MS = Number(process.env.SCAN_PER_STORE_TIMEOUT_MS) || 25000;
const MAX_URLS_PER_SCAN = 500;
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

async function insertScanResultsBatch(db, scanId, rows) {
  if (!rows.length) return;
  const params = [scanId];
  const valueClauses = [];
  let paramIndex = 2;
  for (const row of rows) {
    valueClauses.push(
      `($1, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
    );
    params.push(
      row.store_url,
      row.email,
      row.source_page,
      row.has_email,
      row.phone,
      row.whatsapp,
      row.instagram,
      row.tiktok
    );
    paramIndex += 8;
  }
  await runDbQueryWithRetry(
    db,
    `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email, phone, whatsapp, instagram, tiktok)
     VALUES ${valueClauses.join(', ')}`,
    params
  );
}

export async function processScan(payload) {
  registerUserWorkload('scan');
  try {
    await processScanWork(payload);
  } finally {
    unregisterUserWorkload('scan');
  }
}

async function processScanWork(payload) {
  const {
    scanId,
    rawInput,
    maxConcurrentCrawlers,
    maxUrlsPerScan,
    extractOptions: rawExtractOptions,
    emailFilters: rawEmailFilters,
  } = payload;
  const extractOptions = normalizeExtractOptions(rawExtractOptions);
  const emailFilters = rawEmailFilters && typeof rawEmailFilters === 'object' ? rawEmailFilters : {};

  const db = getDb();
  let urls = parseUrls(rawInput || '');
  const cap =
    typeof maxUrlsPerScan === 'number' && maxUrlsPerScan > 0
      ? Math.min(maxUrlsPerScan, MAX_URLS_PER_SCAN)
      : MAX_URLS_PER_SCAN;
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

  function processOneWithTimeout(storeUrl) {
    const timeoutPromise = new Promise((resolve) => {
      const t = setTimeout(() => {
        resolve({ storeUrl, results: [], timedOut: true });
      }, PER_STORE_TIMEOUT_MS);
      t.unref?.();
    });
    const workPromise = (async () => {
      try {
        const { pages, privacyPageFound } = await crawlStore(storeUrl);

        const results = extractOptions.email
          ? extractEmailsFromPages(storeUrl, pages, {
              onePerStore: false,
              privacyPageFound,
              emailFilters,
            })
          : [];

        const contacts = extractContactsFromPages(storeUrl, pages, extractOptions);

        const noEmailReason = privacyPageFound ? 'No Email Found' : 'Privacy Page Not Found';
        return { storeUrl, results, contacts, noEmailReason };
      } catch (err) {
        console.error('[scanProcessor] store error:', storeUrl, err?.message || err);
        return {
          storeUrl,
          results: [],
          contacts: { phone: null, whatsapp: null, instagram: null, tiktok: null, storeUrl },
          noEmailReason: 'No Email Found',
        };
      }
    })();
    return Promise.race([workPromise, timeoutPromise]).then((r) =>
      r.timedOut
        ? {
            storeUrl: r.storeUrl,
            results: [],
            contacts: { phone: null, whatsapp: null, instagram: null, tiktok: null, storeUrl: r.storeUrl },
            noEmailReason: 'Request timed out',
          }
        : r
    );
  }

  const concurrency =
    typeof maxConcurrentCrawlers === 'number' && maxConcurrentCrawlers >= 1 && maxConcurrentCrawlers <= 20
      ? maxConcurrentCrawlers
      : DEFAULT_CONCURRENCY;

  for (let i = 0; i < urls.length; i += concurrency) {
    if (i > 0) await sleep(DELAY_BETWEEN_STORES_MS);
    const batch = urls.slice(i, i + concurrency);
    if (process.env.SCAN_DEBUG === '1') {
      console.log(
        `[scanProcessor] ${scanId} batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)} (${batch.length} stores)`
      );
    }
    const settled = await Promise.allSettled(
      batch.map((storeUrl, batchIdx) =>
        STORE_STAGGER_MS > 0
          ? sleep(batchIdx * STORE_STAGGER_MS).then(() => processOneWithTimeout(storeUrl))
          : processOneWithTimeout(storeUrl)
      )
    );
    const outcomes = settled.map((s, idx) => {
      if (s.status === 'fulfilled') return s.value;
      console.error('[scanProcessor] store failed:', batch[idx], s.reason?.message || s.reason);
      return {
        storeUrl: batch[idx],
        results: [],
        contacts: { phone: null, whatsapp: null, instagram: null, tiktok: null, storeUrl: batch[idx] },
      };
    });

    const dbRows = [];

    for (const { storeUrl, results, contacts, noEmailReason } of outcomes) {
      try {
        const hasData = storeHasExtractedData(results, contacts, extractOptions);
        if (hasData) foundCount += 1;

        const contactFields = {
          phone: contacts?.phone || null,
          whatsapp: contacts?.whatsapp || null,
          instagram: contacts?.instagram || null,
          tiktok: contacts?.tiktok || null,
        };

        if (results.length > 0) {
          for (const r of results) {
            const row = {
              store_url: r.storeUrl,
              email: r.email,
              source_page: r.sourcePage || '',
              has_email: 1,
              ...contactFields,
            };
            if (db) dbRows.push(row);
            else memoryResults.push(row);
          }
        } else {
          const noEmailRow = {
            store_url: storeUrl,
            email: null,
            source_page: noEmailReason || 'No Email Found',
            has_email: 0,
            ...contactFields,
          };
          if (db) dbRows.push(noEmailRow);
          else memoryResults.push(noEmailRow);
        }
        if (!db) memoryStore.results.set(scanId, memoryResults);
      } catch (dbErr) {
        console.error('[scanProcessor] result assembly error:', storeUrl, dbErr?.message || dbErr);
      }
      processed++;
    }

    if (db && dbRows.length) {
      try {
        await insertScanResultsBatch(db, scanId, dbRows);
      } catch (dbInsertErr) {
        console.warn('[scanProcessor] batch insert failed, buffering rows:', dbInsertErr?.message || dbInsertErr);
        memoryResults.push(...dbRows);
        memoryStore.results.set(scanId, memoryResults);
      }
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
