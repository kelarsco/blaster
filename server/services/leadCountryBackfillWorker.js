import {
  getNextQualifiedStoreForCountryRefresh,
  markCountryRefreshFailed,
} from './leadStoreRepository.js';
import { reclassifyCountryForLeadStore } from './leadCountryReclassify.js';
import { isDbQuotaError } from '../db.js';
import { isBackfillEnabled } from './backfillGate.js';

let processing = false;
let scheduled = false;
let pausedForQuota = false;
let stopRequested = false;
let batchStats = { processed: 0, updated: 0, failed: 0, startedAt: null };

function logBatch(final = false) {
  const elapsed = batchStats.startedAt ? Math.round((Date.now() - batchStats.startedAt) / 1000) : 0;
  console.info(
    `[country backfill] ${final ? 'batch complete' : 'progress'}: processed=${batchStats.processed} updated=${batchStats.updated} failed=${batchStats.failed} elapsed=${elapsed}s`
  );
}

async function processOne() {
  if (stopRequested || !isBackfillEnabled() || pausedForQuota) {
    processing = false;
    return;
  }

  let store;
  try {
    store = await getNextQualifiedStoreForCountryRefresh();
  } catch (e) {
    if (isDbQuotaError(e)) {
      pausedForQuota = true;
      processing = false;
      console.warn('[country backfill] paused — Neon data transfer quota exceeded. Upgrade Neon or wait for reset, then restart server.');
      return;
    }
    throw e;
  }

  if (!store) {
    if (batchStats.processed > 0) logBatch(true);
    batchStats = { processed: 0, updated: 0, failed: 0, startedAt: null };
    processing = false;
    return;
  }

  if (!batchStats.startedAt) {
    batchStats.startedAt = Date.now();
    console.info('[country backfill] worker started');
  }

  processing = true;
  batchStats.processed += 1;

  try {
    const result = await reclassifyCountryForLeadStore(store);
    batchStats.updated += 1;
    if (batchStats.processed % 10 === 0) {
      logBatch(false);
    }
    if (batchStats.processed <= 3 || batchStats.processed % 25 === 0) {
      console.info(
        `[country backfill] ${store.storeUrl} -> ${result.countryCode} (${result.confidence}% ${result.method})`
      );
    }
  } catch (e) {
    const message = e?.message || 'Country refresh failed';
    if (isDbQuotaError(e)) {
      pausedForQuota = true;
      processing = false;
      console.warn('[country backfill] paused — Neon data transfer quota exceeded.');
      return;
    }
    batchStats.failed += 1;
    console.warn(`[country backfill] failed ${store.storeUrl}: ${message}`);
    await markCountryRefreshFailed(store.id, store.phaseData, message);
  }

  setTimeout(processOne, 2000);
}

export function kickCountryBackfillWorker() {
  if (!isBackfillEnabled() || pausedForQuota || stopRequested) return;
  if (processing || scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    if (!processing) processOne();
  }, 100);
}

export function stopCountryBackfillWorker() {
  stopRequested = true;
  processing = false;
  scheduled = false;
}

export async function resumeCountryBackfillOnStartup() {
  // No-op — use scripts/run-country-backfill.mjs with ENABLE_BACKFILL_WORKERS=1
}

export function isCountryBackfillRunning() {
  return processing;
}

export function getCountryBackfillSnapshot() {
  if (!batchStats.startedAt) return null;
  return { ...batchStats, running: processing };
}
