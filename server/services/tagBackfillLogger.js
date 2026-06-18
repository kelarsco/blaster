/**
 * Scoped logger for tag backfill — keeps production terminal output minimal.
 *
 * Levels: debug | info | warn | error (default: info in production, debug in dev)
 * Env: TAG_BACKFILL_LOG_LEVEL or LOG_LEVEL
 */

const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

function resolveLevel() {
  const raw = (
    process.env.TAG_BACKFILL_LOG_LEVEL ||
    process.env.LOG_LEVEL ||
    'info'
  ).toLowerCase();
  return LEVEL_RANK[raw] ?? LEVEL_RANK.info;
}

let activeLevel = resolveLevel();

export function setTagBackfillLogLevel(level) {
  if (LEVEL_RANK[level] !== undefined) activeLevel = LEVEL_RANK[level];
}

function shouldLog(level) {
  return LEVEL_RANK[level] >= activeLevel;
}

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

export const tagBackfillLog = {
  debug(message, meta) {
    if (!shouldLog('debug')) return;
    console.log(`[tag backfill:debug] ${message}${formatMeta(meta)}`);
  },
  info(message, meta) {
    if (!shouldLog('info')) return;
    console.log(`[tag backfill] ${message}${formatMeta(meta)}`);
  },
  warn(message, meta) {
    if (!shouldLog('warn')) return;
    console.warn(`[tag backfill:warn] ${message}${formatMeta(meta)}`);
  },
  error(message, meta) {
    if (!shouldLog('error')) return;
    console.error(`[tag backfill:error] ${message}${formatMeta(meta)}`);
  },
};

const BATCH_REPORT_SIZE = Number(process.env.TAG_BACKFILL_BATCH_REPORT_SIZE) || 25;
const MAX_FAILURE_SAMPLES = 5;

export class TagBackfillBatchStats {
  constructor() {
    this.startedAt = Date.now();
    this.processed = 0;
    this.tagged = 0;
    this.noTags = 0;
    this.failed = 0;
    this.failureSamples = [];
  }

  recordSuccess(tagSummary) {
    this.processed += 1;
    if (Array.isArray(tagSummary) && tagSummary.length > 0) {
      this.tagged += 1;
    } else {
      this.noTags += 1;
    }
  }

  recordFailure(storeUrl, errorMessage) {
    this.processed += 1;
    this.failed += 1;
    if (this.failureSamples.length < MAX_FAILURE_SAMPLES) {
      this.failureSamples.push({ url: storeUrl, error: errorMessage });
    }
  }

  snapshot() {
    const durationMs = Date.now() - this.startedAt;
    return {
      processed: this.processed,
      tagged: this.tagged,
      noTags: this.noTags,
      failed: this.failed,
      durationMs,
      durationSec: Number((durationMs / 1000).toFixed(1)),
    };
  }

  shouldReportBatch() {
    return this.processed > 0 && this.processed % BATCH_REPORT_SIZE === 0;
  }
}

export function logBatchProgress(stats, { final = false } = {}) {
  const summary = stats.snapshot();
  const label = final ? 'Tag backfill finished' : 'Tag backfill batch progress';
  tagBackfillLog.info(label, summary);
  if (stats.failed > 0 && stats.failureSamples.length > 0) {
    tagBackfillLog.warn('Tag backfill failure samples', {
      failed: stats.failed,
      samples: stats.failureSamples,
    });
  }
}
