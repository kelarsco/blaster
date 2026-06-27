import { resumePendingCampaignsOnStartup } from './campaignResume.js';
import { resumePendingScansOnStartup } from './scanResume.js';
import { resumeLeadEngineOnStartup } from './leadEngineWorker.js';
import { resumeScrapeSchedulerOnStartup, recoverInterruptedScrapeJobs } from './scrapeScheduler.js';
import { syncPaystackPlans } from './paystackSync.js';
import {
  getProcessRole,
  runsScanWorker,
  runsLeadWorker,
  runsHttpServer,
} from '../config/processRole.js';

/**
 * Role-aware deferred startup — API machine stays lightweight.
 */
export function scheduleBackgroundStartup() {
  const configured = Number(process.env.STARTUP_JOBS_DELAY_MS);
  const delayMs = Number.isFinite(configured) && configured >= 0 ? configured : 5000;

  setTimeout(() => {
    void runBackgroundStartup().catch((e) => {
      console.error('[startup] background jobs failed:', e?.message || e);
    });
  }, delayMs);

  const role = getProcessRole();
  console.log(`[startup] PROCESS_ROLE=${role}, background jobs in ${delayMs}ms`);
}

async function runBackgroundStartup() {
  const role = getProcessRole();
  console.log(`[startup] Running background jobs for role=${role}…`);

  if (role === 'api') {
    syncPaystackPlans().catch((e) => console.warn('[Paystack sync]', e?.message || e));
    console.log('[startup] API-only startup complete');
    return;
  }

  if (role === 'all' || runsScanWorker()) {
    await resumePendingScansOnStartup();
  }

  if (role === 'all' || runsLeadWorker()) {
    await resumePendingCampaignsOnStartup();
    await resumeLeadEngineOnStartup();
    await recoverInterruptedScrapeJobs();
    await resumeScrapeSchedulerOnStartup();
  }

  if (runsHttpServer() && role === 'all') {
    syncPaystackPlans().catch((e) => console.warn('[Paystack sync]', e?.message || e));
  } else if (role === 'scan' || role === 'lead') {
    syncPaystackPlans().catch(() => {});
  }

  console.log('[startup] Background jobs complete');
}
