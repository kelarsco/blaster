/**
 * Postgres-backed job queue for Fly worker machines (FOR UPDATE SKIP LOCKED).
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';

const STALE_CLAIM_MINUTES = Math.max(Number(process.env.WORKER_STALE_CLAIM_MIN) || 45, 10);

export function getWorkerId() {
  return (
    process.env.FLY_MACHINE_ID ||
    process.env.FLY_ALLOC_ID ||
    process.env.HOSTNAME ||
    `worker-${process.pid}`
  );
}

export async function enqueueWorkerJob(jobType, payload, { jobId } = {}) {
  const db = getDb();
  if (!db) return null;

  const id = jobId || uuidv4();
  const body = JSON.stringify(payload ?? {});

  await db.query(
    `INSERT INTO worker_jobs (id, job_type, payload, status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       status = CASE
         WHEN worker_jobs.status IN ('completed', 'processing') THEN worker_jobs.status
         ELSE 'pending'
       END,
       updated_at = NOW()
     WHERE worker_jobs.status IN ('pending', 'failed')`,
    [id, jobType, body]
  );

  return id;
}

async function releaseStaleClaims() {
  const db = getDb();
  if (!db) return;
  await db.query(
    `UPDATE worker_jobs
     SET status = 'pending', claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
     WHERE status = 'processing'
       AND claimed_at < NOW() - ($1::text || ' minutes')::interval`,
    [String(STALE_CLAIM_MINUTES)]
  );
}

export async function claimNextJob(jobType, workerId) {
  const db = getDb();
  if (!db) return null;

  await releaseStaleClaims();

  const r = await db.query(
    `UPDATE worker_jobs
     SET status = 'processing',
         claimed_by = $2,
         claimed_at = NOW(),
         attempts = attempts + 1,
         updated_at = NOW()
     WHERE id = (
       SELECT id FROM worker_jobs
       WHERE job_type = $1
         AND status = 'pending'
         AND attempts < max_attempts
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [jobType, workerId]
  );

  return r.rows?.[0] || null;
}

export async function completeJob(jobId) {
  const db = getDb();
  if (!db) return;
  await db.query(
    `UPDATE worker_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`,
    [jobId]
  );
}

export async function failJob(jobId, err) {
  const db = getDb();
  if (!db) return;
  const message = err?.message || String(err || 'unknown error');
  await db.query(
    `UPDATE worker_jobs SET
       status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
       claimed_by = NULL,
       claimed_at = NULL,
       last_error = $2,
       updated_at = NOW()
     WHERE id = $1`,
    [jobId, message.slice(0, 2000)]
  );
}

export function parseJobPayload(row) {
  if (!row?.payload) return {};
  if (typeof row.payload === 'object') return row.payload;
  try {
    return JSON.parse(row.payload);
  } catch {
    return {};
  }
}
