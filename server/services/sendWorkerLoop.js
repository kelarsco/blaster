import {
  claimNextJob,
  completeJob,
  failJob,
  getWorkerId,
  parseJobPayload,
} from './workerJobs.js';

const POLL_MS = Math.max(Number(process.env.SEND_WORKER_POLL_MS) || 1500, 250);
const workerId = getWorkerId();

export function startSendWorkerLoop() {
  console.log(`[send-worker] polling every ${POLL_MS}ms (${workerId})`);

  const tick = async () => {
    let job = null;
    try {
      job = await claimNextJob('send', workerId);
      if (!job) {
        setTimeout(tick, POLL_MS);
        return;
      }

      const payload = parseJobPayload(job);
      const { processSendEmail } = await import('./sendProcessor.js');
      await processSendEmail(payload);
      await completeJob(job.id);
      setTimeout(tick, 100);
    } catch (err) {
      console.error('[send-worker] job error:', job?.id, err?.message || err);
      if (job?.id) await failJob(job.id, err);
      setTimeout(tick, POLL_MS);
    }
  };

  tick();
}
