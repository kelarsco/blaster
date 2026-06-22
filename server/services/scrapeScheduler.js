/**
 * Scheduled + on-demand lead scrape sessions for the admin dashboard.
 */
import {
  createScrapeJob,
  updateScrapeJobSession,
  completeScrapeJob,
  getLatestScrapeJob,
  getScrapeJobById,
  getScrapeSettings,
  saveScrapeSettings,
} from './leadStoreRepository.js';
import { runScrapeDiscoverySession } from './leadScraper.js';

let schedulerTimer = null;
let schedulerBootstrapped = false;

function clearSchedulerTimer() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

function computeNextRunAt(intervalMinutes, from = new Date()) {
  if (!intervalMinutes || intervalMinutes <= 0) return null;
  return new Date(from.getTime() + intervalMinutes * 60_000).toISOString();
}

async function armSchedulerTimer() {
  clearSchedulerTimer();
  const settings = await getScrapeSettings();
  if (!settings.enabled || !settings.intervalMinutes) return;

  const targetMs = settings.nextRunAt
    ? new Date(settings.nextRunAt).getTime()
    : Date.now() + settings.intervalMinutes * 60_000;
  const delay = Math.max(1000, targetMs - Date.now());

  schedulerTimer = setTimeout(async () => {
    try {
      await startLeadScrapeSession({ trigger: 'schedule' });
    } catch (e) {
      console.error('[scrapeScheduler]', e?.message || e);
      const latest = await getScrapeSettings();
      if (latest.enabled && latest.intervalMinutes > 0) {
        const nextRunAt = computeNextRunAt(latest.intervalMinutes);
        await saveScrapeSettings({ ...latest, nextRunAt });
        await armSchedulerTimer();
      }
    }
  }, delay);
}

async function markScrapeRunComplete() {
  const settings = await getScrapeSettings();
  const nextRunAt = settings.enabled ? computeNextRunAt(settings.intervalMinutes) : null;
  await saveScrapeSettings({
    enabled: settings.enabled,
    intervalMinutes: settings.intervalMinutes,
    lastRunAt: new Date().toISOString(),
    nextRunAt,
  });
  if (settings.enabled && settings.intervalMinutes > 0) {
    await armSchedulerTimer();
  }
}

const MAX_RUNNING_MS = 25 * 60 * 1000;

export async function ensureScrapeJobFresh(job) {
  if (!job || job.status !== 'running') return job;
  const startedMs = new Date(job.startedAt || job.session?.startedAt || 0).getTime();
  if (!Number.isFinite(startedMs) || Date.now() - startedMs < MAX_RUNNING_MS) return job;

  await completeScrapeJob(job.id, {
    urlsFound: job.session?.totalGenerated ?? job.urlsFound ?? 0,
    storesAdded: 0,
    status: 'failed',
    errorMessage: 'Scrape timed out after 25 minutes. Run again or check SerpAPI key/quota.',
    session: job.session,
  });
  return getScrapeJobById(job.id);
}

/** Fail jobs left in `running` after server restart (in-process work is lost). */
export async function recoverInterruptedScrapeJobs() {
  const { getDb, memoryStore } = await import('../db.js');
  const db = getDb();
  if (!db) {
    for (const job of memoryStore.leadScrapeJobs.filter((j) => j.status === 'running')) {
      const full = await getScrapeJobById(job.id);
      await completeScrapeJob(job.id, {
        urlsFound: full?.session?.totalGenerated ?? 0,
        storesAdded: 0,
        status: 'failed',
        errorMessage: 'Scrape interrupted — server restarted. Run again.',
        session: full?.session,
      });
    }
    return;
  }
  const res = await db.query(`SELECT id FROM lead_scrape_jobs WHERE status = 'running'`);
  for (const row of res.rows || []) {
    const job = await getScrapeJobById(row.id);
    await completeScrapeJob(row.id, {
      urlsFound: job?.session?.totalGenerated ?? job?.urlsFound ?? 0,
      storesAdded: 0,
      status: 'failed',
      errorMessage: 'Scrape interrupted — server restarted. Click Run scrape now to try again.',
      session: job?.session,
    });
  }
}

export async function startLeadScrapeSession({ trigger = 'manual' } = {}) {
  const latest = await getLatestScrapeJob();
  if (latest && latest.status === 'running') {
    const stale = await ensureScrapeJobFresh(latest);
    if (stale?.status === 'running') {
      return { ok: true, jobId: stale.id, scrapeJob: stale, message: 'Scrape already in progress' };
    }
  }

  const jobId = await createScrapeJob();
  await updateScrapeJobSession(
    jobId,
    {
      phase: 'starting',
      progressPercent: 2,
      statusLabel: 'Starting scrape session…',
      etaSeconds: 15 * 18,
      linksFound: 0,
      startedAt: new Date().toISOString(),
    },
    'running'
  );

  runScrapeDiscoverySession(async (patch) => {
    await updateScrapeJobSession(jobId, { ...patch, trigger }, 'running');
  })
    .then(async (session) => {
      await completeScrapeJob(jobId, {
        urlsFound: session.totalGenerated,
        storesAdded: 0,
        status: 'ready',
        session: { ...session, trigger },
      });
      await markScrapeRunComplete();
    })
    .catch(async (e) => {
      await completeScrapeJob(jobId, {
        urlsFound: 0,
        storesAdded: 0,
        errorMessage: e?.message || 'Scrape failed',
        status: 'failed',
      });
      await markScrapeRunComplete();
    });

  return { ok: true, jobId, message: 'Scrape session started' };
}

export async function applyScrapeScheduleSettings({ enabled, intervalMinutes }) {
  const minutes = Math.max(0, Math.min(10_080, Number(intervalMinutes) || 0));
  const isEnabled = Boolean(enabled) && minutes > 0;
  const current = await getScrapeSettings();
  const nextRunAt = isEnabled
    ? current.nextRunAt && new Date(current.nextRunAt) > new Date()
      ? current.nextRunAt
      : computeNextRunAt(minutes)
    : null;

  const saved = await saveScrapeSettings({
    enabled: isEnabled,
    intervalMinutes: minutes,
    lastRunAt: current.lastRunAt,
    nextRunAt,
  });

  clearSchedulerTimer();
  if (isEnabled) {
    await armSchedulerTimer();
  }

  return saved;
}

export async function resumeScrapeSchedulerOnStartup() {
  if (schedulerBootstrapped) return;
  schedulerBootstrapped = true;
  try {
    const settings = await getScrapeSettings();
    if (!settings.enabled || !settings.intervalMinutes) return;
    await armSchedulerTimer();
    console.log(
      `[scrapeScheduler] Automation enabled — every ${settings.intervalMinutes}m` +
        (settings.nextRunAt ? `, next run ${settings.nextRunAt}` : '')
    );
  } catch (e) {
    console.warn('[scrapeScheduler] resume failed:', e?.message || e);
  }
}
