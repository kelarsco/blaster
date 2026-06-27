import {
  claimNextJob,
  completeJob,
  failJob,
  getWorkerId,
  parseJobPayload,
} from './workerJobs.js';

const POLL_MS = Math.max(Number(process.env.WORKER_POLL_MS) || 2000, 250);
const workerId = getWorkerId();

export function startScanWorkerLoop() {
  console.log(`[scan-worker] polling every ${POLL_MS}ms (${workerId})`);

  const tick = async () => {
    let job = null;
    try {
      job = await claimNextJob('scan', workerId);
      if (!job) {
        setTimeout(tick, POLL_MS);
        return;
      }

      const payload = parseJobPayload(job);
      const { processScan } = await import('./scanProcessor.js');
      await processScan(payload);
      await completeJob(job.id);
      setTimeout(tick, 200);
    } catch (err) {
      console.error('[scan-worker] job error:', job?.id, err?.message || err);
      if (job?.id) await failJob(job.id, err);
      setTimeout(tick, POLL_MS);
    }
  };

  tick();
}
