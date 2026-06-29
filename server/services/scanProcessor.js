/**
 * Scan processor: one store at a time by default, with retry on failed crawls.
 */
import { crawlStore, normalizeStoreUrl } from './crawler.js';
import { extractEmailsFromPages } from './emailExtractor.js';
import { extractContactsFromPages, storeHasExtractedData } from './contactExtractor.js';
import { normalizeExtractOptions } from './scanExtractOptions.js';
import { getDb, memoryStore, isPoolUnderPressure } from '../db.js';
import { registerUserWorkload, unregisterUserWorkload } from './resourceCoordinator.js';
import { addScanJob } from './queue.js';

const DEFAULT_CONCURRENCY = Math.min(
  Number(process.env.SCAN_CONCURRENCY) || 1,
  3
);
const STORE_GAP_MS = Math.max(Number(process.env.SCAN_STORE_GAP_MS) || 400, 0);
const STORE_STAGGER_MS = Number(process.env.SCAN_STORE_STAGGER_MS) || 0;
const PER_STORE_TIMEOUT_MS = Number(process.env.SCAN_PER_STORE_TIMEOUT_MS) || 30000;
const STORE_RETRY_ATTEMPTS = Math.max(Number(process.env.SCAN_STORE_RETRY_ATTEMPTS) || 2, 1);
const RETRY_GAP_MS = Math.max(Number(process.env.SCAN_RETRY_GAP_MS) || 1500, 0);
const ABORT_SETTLE_MS = Math.max(Number(process.env.SCAN_ABORT_SETTLE_MS) || 1500, 0);
const MAX_URLS_PER_SCAN = Math.max(Number(process.env.MAX_URLS_PER_SCAN) || 1000, 1);
const DB_WRITE_RETRIES = Number(process.env.DB_WRITE_RETRIES) || 3;
const POOL_YIELD_MS = Math.max(Number(process.env.SCAN_POOL_YIELD_MS) || 2000, 0);

const EMPTY_CONTACTS = (storeUrl) => ({
  phone: null,
  whatsapp: null,
  instagram: null,
  tiktok: null,
  storeUrl,
});

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

function buildStoreRows(storeUrl, results, contacts, noEmailReason) {
  const contactFields = {
    phone: contacts?.phone || null,
    whatsapp: contacts?.whatsapp || null,
    instagram: contacts?.instagram || null,
    tiktok: contacts?.tiktok || null,
  };

  if (results.length > 0) {
    return results.map((r) => ({
      store_url: r.storeUrl,
      email: r.email,
      source_page: r.sourcePage || '',
      has_email: 1,
      ...contactFields,
    }));
  }

  return [
    {
      store_url: storeUrl,
      email: null,
      source_page: noEmailReason || 'No Email Found',
      has_email: 0,
      ...contactFields,
    },
  ];
}

async function runStoreWorkerPool(urls, concurrency, workerFn) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, urls.length);

  async function worker(workerId) {
    if (STORE_STAGGER_MS > 0 && workerId > 0) {
      await sleep(workerId * STORE_STAGGER_MS);
    }
    while (true) {
      const index = nextIndex;
      if (index >= urls.length) break;
      nextIndex += 1;
      await workerFn(urls[index], index);
      if (STORE_GAP_MS > 0 && nextIndex < urls.length) {
        await sleep(STORE_GAP_MS);
      }
      if (isPoolUnderPressure() && POOL_YIELD_MS > 0 && nextIndex < urls.length) {
        await sleep(POOL_YIELD_MS);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, (_, workerId) => worker(workerId)));
}

export async function processScan(payload) {
  registerUserWorkload('scan');
  try {
    return await processScanWork(payload);
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
    return { complete: true, requeued: 0 };
  }

  const memoryResults = memoryStore.results.get(scanId) || [];
  memoryStore.results.set(scanId, memoryResults);

  let progressChain = Promise.resolve();

  async function recordStoreProgress(hasData) {
    progressChain = progressChain
      .then(async () => {
        processed += 1;
        if (hasData) foundCount += 1;
        upsertMemoryScan(scanId, { processed, found_count: foundCount });
        if (db) {
          await runDbQueryWithRetry(
            db,
            `UPDATE scans SET processed = processed + 1, found_count = found_count + $1, updated_at = NOW() WHERE id = $2`,
            [hasData ? 1 : 0, scanId]
          );
        }
      })
      .catch((err) => {
        console.error('[scanProcessor] progress update error:', err?.message || err);
      });
    await progressChain;
  }

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

  async function crawlAndExtract(storeUrl, signal) {
    const { pages, privacyPageFound } = await crawlStore(storeUrl, { signal });
    if (signal.aborted) {
      return {
        storeUrl,
        results: [],
        contacts: EMPTY_CONTACTS(storeUrl),
        noEmailReason: 'Request timed out',
        pagesFetched: pages.length,
      };
    }

    const results = extractOptions.email
      ? extractEmailsFromPages(storeUrl, pages, {
          onePerStore: false,
          privacyPageFound,
          emailFilters,
        })
      : [];

    const needsContacts =
      extractOptions.phone ||
      extractOptions.whatsapp ||
      extractOptions.instagram ||
      extractOptions.tiktok;
    const contacts = needsContacts
      ? extractContactsFromPages(storeUrl, pages, extractOptions)
      : EMPTY_CONTACTS(storeUrl);
    const noEmailReason = privacyPageFound ? 'No Email Found' : 'Privacy Page Not Found';

    return { storeUrl, results, contacts, noEmailReason, pagesFetched: pages.length };
  }

  async function processOneAttempt(storeUrl, timeoutMs) {
    const ac = new AbortController();
    let timer;
    let outcome = null;
    let timedOut = false;

    const workPromise = crawlAndExtract(storeUrl, ac.signal)
      .then((result) => {
        outcome = result;
        return result;
      })
      .catch((err) => {
        console.error('[scanProcessor] store error:', storeUrl, err?.message || err);
        outcome = {
          storeUrl,
          results: [],
          contacts: EMPTY_CONTACTS(storeUrl),
          noEmailReason: 'No Email Found',
          pagesFetched: 0,
        };
        return outcome;
      });

    await new Promise((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        ac.abort();
        resolve();
      }, timeoutMs);
      timer.unref?.();
      workPromise.finally(resolve);
    });
    clearTimeout(timer);

    if (timedOut && !outcome) {
      await Promise.race([workPromise.catch(() => {}), sleep(ABORT_SETTLE_MS)]);
      return {
        storeUrl,
        results: [],
        contacts: EMPTY_CONTACTS(storeUrl),
        noEmailReason: 'Request timed out',
        pagesFetched: 0,
      };
    }

    if (timedOut && outcome) {
      return outcome;
    }

    return (
      outcome ?? {
        storeUrl,
        results: [],
        contacts: EMPTY_CONTACTS(storeUrl),
        noEmailReason: 'No Email Found',
        pagesFetched: 0,
      }
    );
  }

  function shouldRetryStore(outcome) {
    if (outcome.results.length > 0) return false;
    if (outcome.noEmailReason === 'Request timed out') return true;
    if ((outcome.pagesFetched ?? 0) === 0 && outcome.noEmailReason !== 'No Email Found') return true;
    return false;
  }

  async function processStore(storeUrl) {
    let lastOutcome = null;
    for (let attempt = 1; attempt <= STORE_RETRY_ATTEMPTS; attempt += 1) {
      const timeoutMs =
        attempt === 1 ? PER_STORE_TIMEOUT_MS : Math.round(PER_STORE_TIMEOUT_MS * 1.25);
      lastOutcome = await processOneAttempt(storeUrl, timeoutMs);

      if (!shouldRetryStore(lastOutcome) || attempt === STORE_RETRY_ATTEMPTS) {
        return lastOutcome;
      }

      if (process.env.SCAN_DEBUG === '1') {
        console.log(`[scanProcessor] retry ${storeUrl} (${attempt + 1}/${STORE_RETRY_ATTEMPTS})`);
      }
      if (RETRY_GAP_MS > 0) await sleep(RETRY_GAP_MS);
    }
    return lastOutcome;
  }

  const concurrency =
    typeof maxConcurrentCrawlers === 'number' && maxConcurrentCrawlers >= 1 && maxConcurrentCrawlers <= 3
      ? maxConcurrentCrawlers
      : DEFAULT_CONCURRENCY;

  if (process.env.SCAN_DEBUG === '1') {
    console.log(
      `[scanProcessor] ${scanId} starting (${urls.length} stores, concurrency ${concurrency}, gap ${STORE_GAP_MS}ms)`
    );
  }

  const unpersistedStores = [];

  await runStoreWorkerPool(urls, concurrency, async (storeUrl, index) => {
    const outcome = await processStore(storeUrl);
    const { results, contacts, noEmailReason } = outcome;
    const dbRows = buildStoreRows(storeUrl, results, contacts, noEmailReason);
    const hasData = storeHasExtractedData(results, contacts, extractOptions);

    let rowPersisted = false;
    try {
      if (db) {
        try {
          await insertScanResultsBatch(db, scanId, dbRows);
          rowPersisted = true;
        } catch (dbInsertErr) {
          console.warn('[scanProcessor] store insert failed, buffering rows:', dbInsertErr?.message || dbInsertErr);
          memoryResults.push(...dbRows);
          memoryStore.results.set(scanId, memoryResults);
          rowPersisted = true;
        }
      } else {
        memoryResults.push(...dbRows);
        memoryStore.results.set(scanId, memoryResults);
        rowPersisted = true;
      }
    } catch (dbErr) {
      console.error('[scanProcessor] result assembly error:', storeUrl, dbErr?.message || dbErr);
    }

    if (rowPersisted) {
      await recordStoreProgress(hasData);
    } else {
      unpersistedStores.push(storeUrl);
      console.error('[scanProcessor] store result not persisted, will re-queue:', storeUrl);
    }

    if (process.env.SCAN_DEBUG === '1') {
      console.log(
        `[scanProcessor] ${scanId} store ${index + 1}/${urls.length} — ${results.length} email(s), pages=${outcome.pagesFetched ?? 0}, reason=${noEmailReason}`
      );
    }
  });

  await progressChain;

  const expectedFinal = (payload.initialProcessed ?? 0) + urls.length;
  let requeued = 0;

  if (unpersistedStores.length > 0) {
    try {
      await addScanJob({
        scanId,
        userId: payload.userId,
        rawInput: unpersistedStores.join('\n'),
        initialProcessed: processed,
        initialFoundCount: foundCount,
        totalUrlCount,
        extractOptions: rawExtractOptions,
        emailFilters: rawEmailFilters,
        maxConcurrentCrawlers: maxConcurrentCrawlers,
        maxUrlsPerScan: maxUrlsPerScan,
        forceRefresh: true,
        useCache: false,
      });
      requeued = unpersistedStores.length;
      console.log(`[scanProcessor] ${scanId} re-queued ${requeued} store(s) after persist failure`);
    } catch (requeueErr) {
      console.error('[scanProcessor] re-queue failed:', scanId, requeueErr?.message || requeueErr);
    }
  }

  const finalStatus =
    processed >= expectedFinal && requeued === 0 ? 'completed' : 'running';
  if (finalStatus !== 'completed') {
    console.warn(
      `[scanProcessor] ${scanId} at ${processed}/${expectedFinal} stores` +
        (requeued ? ` (${requeued} re-queued)` : ' — leaving scan resumable')
    );
  }

  upsertMemoryScan(scanId, { status: finalStatus, processed, found_count: foundCount });
  if (db) {
    try {
      await runDbQueryWithRetry(
        db,
        `UPDATE scans SET status = $1, processed = $2, found_count = $3, updated_at = NOW() WHERE id = $4`,
        [finalStatus, processed, foundCount, scanId]
      );
    } catch (e) {
      console.warn('[scanProcessor] final status update failed:', e?.message || e);
    }
  }

  return { complete: finalStatus === 'completed', requeued };
}
