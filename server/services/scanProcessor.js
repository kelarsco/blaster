import { crawlStore } from './crawler.js';
import { extractEmailsFromPages } from './emailExtractor.js';
import { getDb, memoryStore } from '../db.js';

const CONCURRENCY = Number(process.env.SCAN_CONCURRENCY) || 10;

function parseUrls(text) {
  const raw = text.replace(/,/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
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
  const { scanId, rawInput, emailFilters = {}, previousRows } = payload;
  const db = getDb();
  const urls = parseUrls(rawInput || '');
  const total = Math.min(Math.max(urls.length, 0), 1000);

  let processed = 0;
  let foundCount = 0;
  const memoryResults = db ? null : (memoryStore.results.get(scanId) || []);

  if (previousRows && previousRows.length > 0) {
    const byStore = new Map();
    for (const r of previousRows) {
      const storeUrl = r.store_url || r.storeUrl;
      if (!byStore.has(storeUrl)) byStore.set(storeUrl, []);
      byStore.get(storeUrl).push(r);
    }
    for (const [storeUrl, rows] of byStore) {
      let hasAny = false;
      if (db) {
        for (const r of rows) {
          if (r.email) {
            await db.query(
              `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email) VALUES ($1, $2, $3, $4, 1)`,
              [scanId, storeUrl, r.email || '', r.source_page || r.sourcePage || '', 1]
            );
            foundCount++;
            hasAny = true;
          }
        }
        if (!hasAny) {
          await db.query(
            `INSERT INTO scan_results (scan_id, store_url, email, source_page, has_email) VALUES ($1, $2, NULL, NULL, 0)`,
            [scanId, storeUrl]
          );
        }
      } else {
        for (const r of rows) {
          memoryResults.push({
            store_url: storeUrl,
            email: r.email || null,
            source_page: (r.source_page || r.sourcePage) || null,
            has_email: r.email ? 1 : 0,
          });
          if (r.email) foundCount++;
        }
        memoryStore.results.set(scanId, memoryResults);
      }
      processed++;
    }
    if (db) {
      await db.query(
        `UPDATE scans SET status = 'running', processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
        [processed, foundCount, scanId]
      );
    } else {
      const rec = memoryStore.scans.get(scanId);
      if (rec) {
        rec.status = 'running';
        rec.processed = processed;
        rec.found_count = foundCount;
        memoryStore.scans.set(scanId, rec);
      }
    }
  } else {
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
  }

  async function processOne(storeUrl) {
    try {
      const pages = await crawlStore(storeUrl);
      const results = extractEmailsFromPages(storeUrl, pages, emailFilters);
      return { storeUrl, results };
    } catch {
      return { storeUrl, results: [] };
    }
  }

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(batch.map((storeUrl) => processOne(storeUrl)));

    for (const { storeUrl, results } of outcomes) {
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
        }
      } else {
        for (const r of results) {
          memoryResults.push({ store_url: r.storeUrl, email: r.email, source_page: r.sourcePage || '', has_email: 1 });
          foundCount++;
        }
        if (results.length === 0) {
          memoryResults.push({ store_url: storeUrl, email: null, source_page: null, has_email: 0 });
        }
        memoryStore.results.set(scanId, memoryResults);
      }
      processed++;
    }

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
