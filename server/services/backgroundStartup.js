import { resumePendingCampaignsOnStartup } from './campaignResume.js';
import { resumePendingScansOnStartup } from './scanResume.js';
import { resumeLeadEngineOnStartup } from './leadEngineWorker.js';
import { resumeScrapeSchedulerOnStartup, recoverInterruptedScrapeJobs } from './scrapeScheduler.js';
import { syncPaystackPlans } from './paystackSync.js';

/**
 * Heavy startup work (scan resume, lead engine, scrape scheduler) runs after the HTTP
 * server is listening so login/auth are not blocked during deploys or restarts.
 */
export function scheduleBackgroundStartup() {
  const configured = Number(process.env.STARTUP_JOBS_DELAY_MS);
  const delayMs = Number.isFinite(configured) && configured >= 0 ? configured : 5000;

  setTimeout(() => {
    void runBackgroundStartup().catch((e) => {
      console.error('[startup] background jobs failed:', e?.message || e);
    });
  }, delayMs);

  if (delayMs > 0) {
    console.log(`[startup] Background jobs deferred ${delayMs}ms (login/API available immediately)`);
  }
}

async function runBackgroundStartup() {
  console.log('[startup] Running deferred background jobs…');
  await resumePendingCampaignsOnStartup();
  await resumePendingScansOnStartup();
  await resumeLeadEngineOnStartup();
  await recoverInterruptedScrapeJobs();
  await resumeScrapeSchedulerOnStartup();
  syncPaystackPlans().catch((e) => console.warn('[Paystack sync]', e?.message || e));
  console.log('[startup] Background jobs complete');
}
