/**
 * Keeps admin background scraping / lead-engine work from competing with
 * user-facing workloads (store scans, login, etc.).
 */
import { isPoolUnderPressure, getPoolPressure } from '../db.js';

const activeWorkloads = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function registerUserWorkload(kind = 'scan') {
  activeWorkloads.set(kind, (activeWorkloads.get(kind) || 0) + 1);
}

export function unregisterUserWorkload(kind = 'scan') {
  const next = (activeWorkloads.get(kind) || 0) - 1;
  if (next <= 0) activeWorkloads.delete(kind);
  else activeWorkloads.set(kind, next);
}

export function isUserWorkloadActive() {
  for (const count of activeWorkloads.values()) {
    if (count > 0) return true;
  }
  return false;
}

export function getUserWorkloadSummary() {
  return Object.fromEntries(activeWorkloads.entries());
}

export function getSystemLoadSummary() {
  return {
    workloads: getUserWorkloadSummary(),
    pool: getPoolPressure(),
    poolUnderPressure: isPoolUnderPressure(),
  };
}

/** True when background jobs should back off (user scans running or DB pool saturated). */
export function shouldBackgroundYield() {
  return isUserWorkloadActive() || isPoolUnderPressure();
}

/**
 * Pause background jobs while users are actively scanning or the DB pool is busy.
 * @param {{ pollMs?: number, maxWaitMs?: number }} [options]
 */
export async function waitForUserWorkloadIdle(options = {}) {
  const pollMs = options.pollMs ?? (Number(process.env.BACKGROUND_YIELD_POLL_MS) || 2000);
  const maxWaitMs = options.maxWaitMs ?? (Number(process.env.BACKGROUND_YIELD_MAX_MS) || 600_000);
  const start = Date.now();
  while (shouldBackgroundYield()) {
    if (Date.now() - start >= maxWaitMs) break;
    await sleep(pollMs);
  }
}

/** Yield one beat when user work or DB pressure is active (call between background HTTP requests). */
export async function yieldToUserWorkload() {
  if (!shouldBackgroundYield()) return;
  await waitForUserWorkloadIdle({ pollMs: 1500, maxWaitMs: 300_000 });
}
