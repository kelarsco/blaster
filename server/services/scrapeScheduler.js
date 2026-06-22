/**
 * Scheduled + on-demand lead scrape sessions for the admin dashboard.
 */
import {
  createScrapeJob,
  updateScrapeJobSession,
  completeScrapeJob,
  getLatestScrapeJob,
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

export async function startLeadScrapeSession({ trigger = 'manual' } = {}) {
  const latest = await getLatestScrapeJob();
  if (latest && latest.status === 'running') {
    return { ok: true, jobId: latest.id, scrapeJob: latest, message: 'Scrape already in progress' };
  }

  const jobId = await createScrapeJob();
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
