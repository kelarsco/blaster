import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, memoryStore } from '../db.js';
import { addScanJob } from '../services/queue.js';
import { logActivity } from './activity.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { scanRateLimit } from '../middleware/apiRateLimit.js';
import { getPlanLimitsForUser } from '../services/planLimits.js';
import { normalizeStoreUrl } from '../services/crawler.js';
import { normalizeExtractOptions } from '../services/scanExtractOptions.js';

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
  return urls.slice(0, 500);
}

scanRoutes.get('/recent', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not signed in' });
    const db = getDb();
    if (db) {
      const result = await db.query(
        `SELECT id, status, total_urls, processed, found_count, created_at
         FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );
      return res.json(
        (result.rows || []).map((row) => ({
          id: row.id,
          status: row.status,
          totalUrls: row.total_urls ?? 0,
          processed: row.processed ?? 0,
          foundCount: row.found_count ?? 0,
          createdAt: row.created_at,
        }))
      );
    }
    const scans = [];
    for (const [id, row] of memoryStore.scans.entries()) {
      if (row?.user_id !== userId) continue;
      scans.push({
        id,
        status: row.status,
        totalUrls: row.total_urls ?? 0,
        processed: row.processed ?? 0,
        foundCount: row.found_count ?? 0,
        createdAt: row.created_at,
      });
    }
    scans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(scans.slice(0, 20));
  } catch (e) {
    console.error('[scan recent]', e?.message || e);
    return res.status(500).json({ error: 'Server error' });
  }
});

scanRoutes.get('/analytics', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not signed in' });

    if (db) {
      const result = await db.query(
        `SELECT COALESCE(COUNT(DISTINCT sr.store_url), 0) AS extracted
         FROM scan_results sr
         JOIN scans s ON s.id = sr.scan_id
         WHERE s.user_id = $1 AND (
           sr.has_email = 1
           OR sr.phone IS NOT NULL
           OR sr.whatsapp IS NOT NULL
           OR sr.instagram IS NOT NULL
           OR sr.tiktok IS NOT NULL
         )`,
        [userId]
      );
      return res.json({ extracted: Number(result.rows?.[0]?.extracted || 0) });
    }

    let extracted = 0;
    for (const [scanId, scan] of memoryStore.scans.entries()) {
      if (scan?.user_id !== userId) continue;
      const rows = memoryStore.results.get(scanId) || [];
      extracted += rows.filter(
        (r) =>
          r.has_email === 1 ||
          r.email ||
          r.phone ||
          r.whatsapp ||
          r.instagram ||
          r.tiktok
      ).length;
    }
    return res.json({ extracted });
  } catch (e) {
    console.error('[scan analytics]', e?.message || e);
    return res.status(500).json({ extracted: 0 });
  }
});

scanRoutes.post('/start', requireAuth, scanRateLimit, async (req, res) => {
  try {
    const body = req.body || {};
    let rawUrls = body.rawUrls ?? body.raw_urls;
    if (rawUrls == null && body.urls != null) {
      rawUrls = Array.isArray(body.urls) ? body.urls.join('\n') : body.urls;
    }
    const emailFilters = body.emailFilters ?? body.email_filters ?? {};
    const extractOptions = normalizeExtractOptions(body.extractOptions ?? body.extract_options);
    const excludeStoreUrls = body.excludeStoreUrls ?? body.exclude_store_urls ?? [];
    const previousScanId = body.previousScanId ?? body.previous_scan_id ?? null;
    const allUrls = parseUrls(typeof rawUrls === 'string' ? rawUrls : (Array.isArray(rawUrls) ? rawUrls.join('\n') : ''));
    if (allUrls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
    }
    if (allUrls.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 URLs per scan' });
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
    
    let limitedUrls = urlsToScan;
    let limitReached = false;
    let storesToScan = urlsToScan.length;
    
    if (db && userId) {
      const limits = await getPlanLimitsForUser(userId);
      const scansUsed = limits.scansUsed ?? 0;
      const scansLimit = limits.scansLimit ?? 1000;
      
      if (scansLimit < 999999 && scansUsed + totalStores > scansLimit) {
        const remainingScans = Math.max(0, scansLimit - scansUsed);
        const effectivePreviousCount = previousRows.length ? new Set(previousRows.map((r) => r.store_url || r.storeUrl)).size : 0;
        const allowedNewScans = Math.max(0, remainingScans - effectivePreviousCount);
        
        if (allowedNewScans > 0) {
          limitedUrls = urlsToScan.slice(0, allowedNewScans);
          storesToScan = effectivePreviousCount + limitedUrls.length;
          limitReached = true;
        } else {
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
    }
    const scanId = uuidv4();
    if (db) {
      try {
        await db.query(
          `INSERT INTO scans (id, user_id, status, total_urls, processed, found_count, raw_input) VALUES ($1, $2, 'pending', $3, 0, 0, $4)`,
          [scanId, userId, storesToScan, limitedUrls.join('\n')]
        );
      } catch (dbErr) {
        console.warn('[scan/start] DB insert failed, continuing in memory:', dbErr?.message || dbErr);
      }
    }
    memoryStore.scans.set(scanId, {
      status: 'pending',
      total_urls: storesToScan,
      processed: 0,
      found_count: 0,
      user_id: userId,
      created_at: new Date(),
    });
    memoryStore.results.set(scanId, []);
    const actualUrlCount = limitedUrls.length;
    if (db) {
      try {
        await db.query(
          `UPDATE scans SET total_urls = $1, updated_at = NOW() WHERE id = $2`,
          [actualUrlCount, scanId]
        );
      } catch (_) {}
    }
    memoryStore.scans.set(scanId, {
      ...(memoryStore.scans.get(scanId) || {}),
      total_urls: actualUrlCount,
    });

    await addScanJob({
      scanId,
      userId: userId || undefined,
      rawInput: limitedUrls.join('\n'),
      emailFilters: emailFilters || {},
      extractOptions,
      forceRefresh: body.forceRefresh ?? body.force_refresh ?? true,
      useCache: body.useCache ?? body.use_cache ?? false,
      stealthMode: !!(body.stealthMode ?? body.stealth_mode),
      maxConcurrentCrawlers: body.maxConcurrentCrawlers,
      maxUrlsPerScan: body.maxUrlsPerScan,
    });

    // Return response with limit information
    const response = { scanId };
    if (limitReached) {
      response.limitReached = true;
      response.scannedUrls = limitedUrls.length;
      response.totalUrls = allUrls.length;
      response.message = `Scanned ${limitedUrls.length} of ${allUrls.length} URLs. You've reached your plan limit.`;
    }
    
    return res.json(response);
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[scan/start]', msg);
    if (e?.stack) console.error(e.stack);
    res.status(500).json({ error: msg });
  }
});

function mergeScanStatus(dbRow, memoryRow) {
  if (!dbRow && !memoryRow) return null;
  if (!dbRow) {
    return {
      scanId: memoryRow.scanId,
      status: memoryRow.status ?? 'unknown',
      totalUrls: memoryRow.total_urls ?? 0,
      processed: memoryRow.processed ?? 0,
      foundCount: memoryRow.found_count ?? 0,
      createdAt: memoryRow.created_at,
    };
  }
  if (!memoryRow) {
    return {
      scanId: dbRow.id,
      status: dbRow.status ?? 'unknown',
      totalUrls: dbRow.total_urls ?? 0,
      processed: dbRow.processed ?? 0,
      foundCount: dbRow.found_count ?? 0,
      createdAt: dbRow.created_at,
    };
  }
  const statusRank = { completed: 4, failed: 4, running: 3, pending: 2 };
  const dbRank = statusRank[dbRow.status] ?? 1;
  const memRank = statusRank[memoryRow.status] ?? 1;
  const status = memRank >= dbRank ? memoryRow.status : dbRow.status;
  return {
    scanId: dbRow.id,
    status: status ?? 'unknown',
    totalUrls: Math.max(dbRow.total_urls ?? 0, memoryRow.total_urls ?? 0),
    processed: Math.max(dbRow.processed ?? 0, memoryRow.processed ?? 0),
    foundCount: Math.max(dbRow.found_count ?? 0, memoryRow.found_count ?? 0),
    createdAt: dbRow.created_at ?? memoryRow.created_at,
  };
}

scanRoutes.get('/status/:scanId', requireAuth, async (req, res) => {
  try {
    const scanId = req.params.scanId;
    const memoryRow = memoryStore.scans.get(scanId);
    const db = getDb();
    if (db) {
      try {
        const result = await db.query('SELECT * FROM scans WHERE id = $1 AND user_id = $2', [scanId, req.user.id]);
        const row = result?.rows?.[0];
        if (row) {
          const merged = mergeScanStatus(row, memoryRow);
          return res.json(merged);
        }
      } catch (dbErr) {
        console.warn('[scan status] DB read failed, falling back to memory:', dbErr?.message || dbErr);
      }
    }
    if (!memoryRow || (memoryRow.user_id && memoryRow.user_id !== req.user.id)) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json({
      scanId,
      status: memoryRow.status ?? 'unknown',
      totalUrls: memoryRow.total_urls ?? 0,
      processed: memoryRow.processed ?? 0,
      foundCount: memoryRow.found_count ?? 0,
      createdAt: memoryRow.created_at,
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
      byStore.set(r.store_url, {
        storeUrl: r.store_url,
        emails: [],
        sourcePages: new Set(),
        hasEmail: false,
        status: null,
        phone: r.phone || null,
        whatsapp: r.whatsapp || null,
        instagram: r.instagram || null,
        tiktok: r.tiktok || null,
      });
    }
    const rec = byStore.get(r.store_url);
    if (r.phone && !rec.phone) rec.phone = r.phone;
    if (r.whatsapp && !rec.whatsapp) rec.whatsapp = r.whatsapp;
    if (r.instagram && !rec.instagram) rec.instagram = r.instagram;
    if (r.tiktok && !rec.tiktok) rec.tiktok = r.tiktok;
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
      phone: rec.phone,
      whatsapp: rec.whatsapp,
      instagram: rec.instagram,
      tiktok: rec.tiktok,
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
          `SELECT sr.store_url, sr.email, sr.source_page, sr.has_email, sr.phone, sr.whatsapp, sr.instagram, sr.tiktok
           FROM scan_results sr
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
    const memScan = memoryStore.scans.get(req.params.scanId);
    if (memScan?.user_id && memScan.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json({ results: buildStoresFromRows(rows) });
  } catch (e) {
    console.error('[scan results]', e?.message || e);
    if (e?.stack) console.error(e.stack);
    res.status(500).json({ error: 'Server error', message: e?.message || String(e) });
  }
});
