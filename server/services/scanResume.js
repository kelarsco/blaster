import { getDb, memoryStore } from '../db.js';
import { addScanJob } from './queue.js';
import { normalizeStoreUrl } from './crawler.js';

function parseUrls(text) {
  const raw = (text || '').replace(/,/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const urls = [];
  const seen = new Set();
  for (const s of raw) {
    const normalized = normalizeStoreUrl(s);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

export async function resumePendingScansOnStartup() {
  const db = getDb();
  if (!db) return;

  try {
    const scans = await db.query(
      `SELECT id, user_id, raw_input, processed, found_count, total_urls
       FROM scans
       WHERE status IN ('running', 'pending')
         AND raw_input IS NOT NULL
         AND TRIM(raw_input) <> ''`
    );

    let resumed = 0;
    for (const row of scans.rows || []) {
      const processedRows = await db.query(
        'SELECT DISTINCT store_url FROM scan_results WHERE scan_id = $1',
        [row.id]
      );
      const doneUrls = new Set((processedRows.rows || []).map((r) => r.store_url));
      const allUrls = parseUrls(row.raw_input);
      const remaining = allUrls.filter((url) => !doneUrls.has(url));

      if (remaining.length === 0) {
        await db.query(
          `UPDATE scans SET status = 'completed', processed = $1, found_count = $2, updated_at = NOW() WHERE id = $3`,
          [allUrls.length, row.found_count ?? 0, row.id]
        );
        memoryStore.scans.set(row.id, {
          status: 'completed',
          total_urls: allUrls.length,
          processed: allUrls.length,
          found_count: row.found_count ?? 0,
          user_id: row.user_id,
        });
        continue;
      }

      memoryStore.scans.set(row.id, {
        status: 'running',
        total_urls: allUrls.length,
        processed: doneUrls.size,
        found_count: row.found_count ?? 0,
        user_id: row.user_id,
        created_at: new Date(),
      });
      memoryStore.results.set(row.id, []);

      await addScanJob({
        scanId: row.id,
        userId: row.user_id,
        rawInput: remaining.join('\n'),
        initialProcessed: doneUrls.size,
        initialFoundCount: row.found_count ?? 0,
        totalUrlCount: allUrls.length,
        forceRefresh: true,
        useCache: false,
      });

      resumed += 1;
      console.log(`[scan resume] Re-queued scan ${row.id} (${remaining.length} URLs remaining)`);
    }

    if (resumed > 0) {
      console.log(`[scan resume] Resumed ${resumed} interrupted scan(s) on startup`);
    }

    const stale = await db.query(
      `UPDATE scans SET status = 'failed', updated_at = NOW()
       WHERE status IN ('running', 'pending')
         AND (raw_input IS NULL OR TRIM(raw_input) = '')
       RETURNING id`
    );
    if (stale.rows?.length) {
      console.log(`[scan resume] Marked ${stale.rows.length} stale scan(s) as failed (no saved URLs)`);
    }
  } catch (err) {
    console.error('[scan resume]', err?.message || err);
  }
}
