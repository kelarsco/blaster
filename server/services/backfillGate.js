/** Background tag/country backfill is opt-in only — avoids Neon quota burn on server start. */
let enabled = process.env.ENABLE_BACKFILL_WORKERS === '1';

export function isBackfillEnabled() {
  return enabled;
}

export function enableBackfillWorkers() {
  enabled = true;
}

export function disableBackfillWorkers() {
  enabled = false;
}
