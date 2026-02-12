import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, memoryStore } from '../db.js';
import { addScanJob } from '../services/queue.js';
import { logActivity } from './activity.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPlanLimitsForUser } from '../services/planLimits.js';
import { normalizeStoreUrl } from '../services/crawler.js';

export const scanRoutes = Router();

function parseUrls(text) {
  const raw = (text || '').replace(/,/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const urls = [];
  for (const s of raw) {
    const normalized = normalizeStoreUrl(s);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }
  return urls.slice(0, 1000);
}

scanRoutes.post('/start', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const rawUrls = body.rawUrls ?? body.raw_urls;
    const emailFilters = body.emailFilters ?? body.email_filters ?? {};
    const excludeStoreUrls = body.excludeStoreUrls ?? body.exclude_store_urls ?? [];
    const previousScanId = body.previousScanId ?? body.previous_scan_id ?? null;
    const allUrls = parseUrls(typeof rawUrls === 'string' ? rawUrls : (Array.isArray(rawUrls) ? rawUrls.join('\n') : ''));
    if (allUrls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
    }
    if (allUrls.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 URLs per scan' });
    }
    const excludeSet = new Set([...excludeStoreUrls].map((u) => (u || '').trim()).filter(Boolean));
    let previousRows = [];
    const db = getDb();
    const userId = req.user?.id;
    if (previousScanId) {
      if (db) {
        const r = await db.query(
          'SELECT store_url, email, source_page, has_email FROM scan_results sr JOIN scans s ON s.id = sr.scan_id WHERE sr.scan_id = $1 AND s.user_id = $2',
          [previousScanId, userId]
        );
        previousRows = r.rows || [];
      } else {
        previousRows = memoryStore.results.get(previousScanId) || [];
      }
      for (const row of previousRows) {
        const u = row.store_url || row.storeUrl;
        if (u) excludeSet.add(u);
      }
    }
    const urlsToScan = allUrls.filter((u) => !excludeSet.has(u));
    const totalStores = previousRows.length ? new Set(previousRows.map((r) => r.store_url || r.storeUrl)).size + urlsToScan.length : urlsToScan.length;
    if (db && userId) {
      const limits = await getPlanLimitsForUser(userId);
      const scansUsed = limits.scansUsed ?? 0;
      const scansLimit = limits.scansLimit ?? 1000;
      if (scansLimit < 999999 && scansUsed + totalStores > scansLimit) {
        if (limits.isFreePlan) {
          return res.status(403).json({
            error: "You've reached your free plan store scan limit. Upgrade to scan more stores.",
            upgradeRequired: true,
            limitType: 'scans',
          });
        }
        const overageEmails = Math.max(0, (limits.emailsUsed ?? 0) - (limits.emailsLimit ?? 500));
        const wouldBeOverageScans = scansUsed + totalStores - scansLimit;
        const wouldBeOwed = Math.floor(wouldBeOverageScans / 500) + Math.floor(overageEmails / 300);
        const nextThreshold = limits.extraCreditNextThreshold ?? 10;
        if (wouldBeOwed >= nextThreshold) {
          return res.status(403).json({
            error: `Extra credit limit reached ($${nextThreshold}). You've used more than your plan allows. Pay your extra credit balance to continue.`,
            extraCreditBlocked: true,
            nextThreshold,
          });
        }
      }
    }
    const scanId = uuidv4();
    if (db) {
      try {
        await db.query(
          `INSERT INTO scans (id, user_id, status, total_urls, processed, found_count) VALUES ($1, $2, 'pending', $3, 0, 0)`,
          [scanId, userId, totalStores]
        );
      } catch (dbErr) {
        console.warn('[scan/start] DB insert failed, continuing in memory:', dbErr?.message || dbErr);
      }
    }
    memoryStore.scans.set(scanId, {
      status: 'pending',
      total_urls: totalStores,
      processed: 0,
      found_count: 0,
      created_at: new Date(),
    });
    memoryStore.results.set(scanId, []);
    await addScanJob({
      scanId,
      userId: userId || undefined,
      rawInput: urlsToScan.join('\n'),
      emailFilters: emailFilters || {},
      forceRefresh: body.forceRefresh ?? body.force_refresh ?? true,
      useCache: body.useCache ?? body.use_cache ?? false,
      stealthMode: !!(body.stealthMode ?? body.stealth_mode),
      maxConcurrentCrawlers: body.maxConcurrentCrawlers ?? body.max_concurrent_crawlers,
      maxUrlsPerScan: body.maxUrlsPerScan ?? body.max_urls_per_scan,
      previousScanId: previousScanId || undefined,
      previousRows: previousRows.length ? previousRows : undefined,
    });
    logActivity('scan_start', { scanId, totalUrls: totalStores, newUrls: urlsToScan.length }, userId);
    res.json({ scanId, totalUrls: totalStores, skipped: allUrls.length - urlsToScan.length });
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[scan/start]', msg);
    if (e?.stack) console.error(e.stack);
    res.status(500).json({ error: msg });
  }
});

scanRoutes.get('/status/:scanId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      try {
        const result = await db.query('SELECT * FROM scans WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)', [req.params.scanId, req.user.id]);
        const row = result?.rows?.[0];
        if (row) {
          return res.json({
            scanId: row.id,
            status: row.status ?? 'unknown',
            totalUrls: row.total_urls ?? 0,
            processed: row.processed ?? 0,
            foundCount: row.found_count ?? 0,
            createdAt: row.created_at,
          });
        }
      } catch (dbErr) {
        console.warn('[scan status] DB read failed, falling back to memory:', dbErr?.message || dbErr);
      }
    }
    const row = memoryStore.scans.get(req.params.scanId);
    if (!row) return res.status(404).json({ error: 'Scan not found' });
    res.json({
      scanId: req.params.scanId,
      status: row.status ?? 'unknown',
      totalUrls: row.total_urls ?? 0,
      processed: row.processed ?? 0,
      foundCount: row.found_count ?? 0,
      createdAt: row.created_at,
    });
  } catch (e) {
    console.error('[scan status]', e?.message || e);
    if (e?.stack) console.error(e.stack);
    res.status(500).json({ error: 'Server error', message: e?.message || String(e) });
  }
});

function buildStoresFromRows(rows) {
  const stores = [];
  const byStore = new Map();
  for (const r of rows) {
    if (!byStore.has(r.store_url)) {
      byStore.set(r.store_url, { storeUrl: r.store_url, emails: [], sourcePages: new Set(), hasEmail: false, status: null });
    }
    const rec = byStore.get(r.store_url);
    if (r.email) {
      rec.emails.push({ email: r.email, sourcePage: r.source_page });
      rec.hasEmail = true;
      if (r.source_page) rec.sourcePages.add(r.source_page);
    } else if (!rec.status && r.source_page) {
      rec.status = r.source_page;
    }
  }
  for (const [url, rec] of byStore) {
    stores.push({
      storeUrl: url,
      emails: rec.emails,
      sourcePages: [...rec.sourcePages],
      hasEmail: rec.hasEmail,
      status: rec.status,
    });
  }
  return stores;
}

scanRoutes.get('/results/:scanId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      try {
        const result = await db.query(
          `SELECT sr.store_url, sr.email, sr.source_page, sr.has_email FROM scan_results sr
           JOIN scans s ON s.id = sr.scan_id WHERE sr.scan_id = $1 AND s.user_id = $2
           ORDER BY sr.has_email DESC, sr.store_url`,
          [req.params.scanId, req.user.id]
        );
        const rows = result?.rows ?? [];
        const buffered = memoryStore.results.get(req.params.scanId) || [];
        if (buffered.length) {
          const seen = new Set(rows.map((r) => `${r.store_url}|${r.email || ''}|${r.source_page || ''}|${r.has_email}`));
          for (const r of buffered) {
            const key = `${r.store_url}|${r.email || ''}|${r.source_page || ''}|${r.has_email}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push(r);
          }
        }
        return res.json({ results: buildStoresFromRows(rows) });
      } catch (dbErr) {
        console.warn('[scan results] DB read failed, falling back to memory:', dbErr?.message || dbErr);
      }
    }
    const rows = memoryStore.results.get(req.params.scanId) ?? [];
    res.json({ results: buildStoresFromRows(rows) });
  } catch (e) {
    console.error('[scan results]', e?.message || e);
    if (e?.stack) console.error(e.stack);
    res.status(500).json({ error: 'Server error', message: e?.message || String(e) });
  }
});
