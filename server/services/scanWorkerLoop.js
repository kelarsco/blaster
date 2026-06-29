import {
  claimNextJob,
  completeJob,
  failJob,
  getWorkerId,
  parseJobPayload,
} from './workerJobs.js';
import { getDb, memoryStore } from '../db.js';

const POLL_MS = Math.max(Number(process.env.WORKER_POLL_MS) || 500, 250);
const workerId = getWorkerId();

async function markScanRunning(scanId) {
  if (!scanId) return;
  const prev = memoryStore.scans.get(scanId) || {};
  memoryStore.scans.set(scanId, { ...prev, status: 'running' });
  const db = getDb();
  if (!db) return;
  try {
    await db.query(
      `UPDATE scans SET status = 'running', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [scanId]
    );
  } catch (err) {
    console.warn('[scan-worker] mark running failed:', scanId, err?.message || err);
  }
}

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
      if (payload.scanId) {
        await markScanRunning(payload.scanId);
        console.log(`[scan-worker] claimed scan ${payload.scanId}`);
      }

      const { processScan } = await import('./scanProcessor.js');
      const result = await processScan(payload);
      await completeJob(job.id);

      if (result?.requeued) {
        console.log(`[scan-worker] scan ${payload.scanId} continuation re-queued (${result.requeued} stores)`);
      }

      setTimeout(tick, 100);
    } catch (err) {
      console.error('[scan-worker] job error:', job?.id, err?.message || err);
      if (job?.id) await failJob(job.id, err);
      setTimeout(tick, POLL_MS);
    }
  };

  tick();
}
