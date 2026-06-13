import { v4 as uuidv4 } from 'uuid';
import { memoryStore } from '../db.js';

const inMemoryJobs = new Map();

function markScanFailed(scanId) {
  const prev = memoryStore.scans.get(scanId) || {};
  memoryStore.scans.set(scanId, { ...prev, status: 'failed' });
}

export async function addScanJob(data) {
  const id = data.scanId || uuidv4();
  inMemoryJobs.set(id, { type: 'scan', data, status: 'waiting' });
  setImmediate(() => {
    runInMemoryScan(id).catch((err) => {
      console.error('[queue] scan job error:', id, err?.message || err);
    });
  });
  return id;
}

export async function addSendJob(data) {
  const id = uuidv4();
  inMemoryJobs.set(id, { type: 'send', data, status: 'waiting' });
  setImmediate(() => runInMemorySend(id));
  return id;
}

async function runInMemoryScan(scanId) {
  const rec = inMemoryJobs.get(scanId);
  if (!rec || rec.type !== 'scan') return;
  rec.status = 'active';
  try {
    const { processScan } = await import('./scanProcessor.js');
    await processScan(rec.data);
    rec.status = 'completed';
  } catch (err) {
    rec.status = 'failed';
    markScanFailed(scanId);
    console.error('[scan job failed]', scanId, err?.message || err);
    if (err?.stack) console.error(err.stack);
    try {
      const { getDb } = await import('../db.js');
      const db = getDb();
      if (db) await db.query("UPDATE scans SET status = 'failed', updated_at = NOW() WHERE id = $1", [scanId]);
    } catch (_) {}
  }
}

async function runInMemorySend(jobId) {
  const rec = inMemoryJobs.get(jobId);
  if (!rec || rec.type !== 'send') return;
  rec.status = 'active';
  try {
    const { processSendEmail } = await import('./sendProcessor.js');
    await processSendEmail(rec.data);
    rec.status = 'completed';
  } catch (err) {
    rec.status = 'failed';
    console.error('[send job failed]', jobId, err?.message || err);
    if (err?.stack) console.error(err.stack);
  }
}
