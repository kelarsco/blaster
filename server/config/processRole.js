/**
 * Fly / production process roles:
 *   api  — HTTP + auth only (machine 1)
 *   scan — store scan worker (machine 2+, horizontal scale)
 *   lead — lead engine + campaign sends + scrape scheduler (machine 3)
 *   all  — local dev: everything in one process (default)
 */
export const PROCESS_ROLES = ['api', 'scan', 'lead', 'all'];

export function getProcessRole() {
  const role = String(process.env.PROCESS_ROLE || 'all').toLowerCase();
  return PROCESS_ROLES.includes(role) ? role : 'all';
}

export function runsHttpServer() {
  const role = getProcessRole();
  return role === 'api' || role === 'all';
}

export function runsScanWorker() {
  const role = getProcessRole();
  return role === 'scan' || role === 'all';
}

export function runsLeadWorker() {
  const role = getProcessRole();
  return role === 'lead' || role === 'all';
}

/** API / scan / lead machines use Postgres queue. Local `all` role keeps in-memory queue. */
export function usesDistributedQueue() {
  const role = getProcessRole();
  return role === 'api' || role === 'scan' || role === 'lead';
}
