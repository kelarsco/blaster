import {
  getNextQualifiedStoreForTagRefresh,
  markTagRefreshFailed,
} from './leadStoreRepository.js';
import { reclassifyTagsForLeadStore } from './leadTagReclassify.js';
import {
  tagBackfillLog,
  TagBackfillBatchStats,
  logBatchProgress,
} from './tagBackfillLogger.js';
import { isDbQuotaError } from '../db.js';
import { isBackfillEnabled } from './backfillGate.js';

let processing = false;
let scheduled = false;
let pausedForQuota = false;
let stopRequested = false;
let batchStats = null;

function ensureBatch() {
  if (!batchStats) {
    batchStats = new TagBackfillBatchStats();
    tagBackfillLog.info('Tag backfill worker started');
  }
}

function finishBatch() {
  if (!batchStats || batchStats.processed === 0) {
    batchStats = null;
    return;
  }
  logBatchProgress(batchStats, { final: true });
  batchStats = null;
}

async function processOne() {
  if (stopRequested || !isBackfillEnabled() || pausedForQuota) {
    processing = false;
    return;
  }

  let store;
  try {
    store = await getNextQualifiedStoreForTagRefresh();
  } catch (e) {
    if (isDbQuotaError(e)) {
      pausedForQuota = true;
      processing = false;
      tagBackfillLog.warn('Paused — Neon data transfer quota exceeded');
      return;
    }
    throw e;
  }

  if (!store) {
    finishBatch();
    processing = false;
    return;
  }

  ensureBatch();
  processing = true;

  try {
    const tags = await reclassifyTagsForLeadStore(store);
    batchStats.recordSuccess(tags);
  } catch (e) {
    const message = e?.message || 'Tag refresh failed';
    if (isDbQuotaError(e)) {
      pausedForQuota = true;
      processing = false;
      tagBackfillLog.warn('Paused — Neon data transfer quota exceeded');
      return;
    }
    batchStats.recordFailure(store.storeUrl, message);
    tagBackfillLog.warn('Store tag refresh failed', { url: store.storeUrl, error: message });
    await markTagRefreshFailed(store.id, store.phaseData, message);
  }

  if (batchStats.shouldReportBatch()) {
    logBatchProgress(batchStats);
  }

  setTimeout(processOne, 1200);
}

export function kickTagBackfillWorker() {
  if (!isBackfillEnabled() || pausedForQuota || stopRequested) return;
  if (processing || scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    if (!processing) processOne();
  }, 100);
}

export function stopTagBackfillWorker() {
  stopRequested = true;
  processing = false;
  scheduled = false;
}

export async function resumeTagBackfillOnStartup() {
  // No-op — tag backfill runs only when admin triggers reclassify-tags with ENABLE_BACKFILL_WORKERS=1
}

export function isTagBackfillRunning() {
  return processing;
}

export function getTagBackfillBatchSnapshot() {
  return batchStats?.snapshot() ?? null;
}
