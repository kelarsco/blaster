/**
 * Fly scan worker process — consumes scan jobs from Postgres (no HTTP server).
 */
import 'dotenv/config';

process.env.PROCESS_ROLE = 'scan';

process.on('unhandledRejection', (reason) => {
  console.error('[scan-worker] Unhandled Rejection:', reason?.message || reason);
});

import { initDb } from './db.js';
import { getProcessRole } from './config/processRole.js';
import { scheduleBackgroundStartup } from './services/backgroundStartup.js';
import { startScanWorkerLoop } from './services/scanWorkerLoop.js';

async function main() {
  console.log(`[scan-worker] PROCESS_ROLE=${getProcessRole()}`);
  await initDb();
  scheduleBackgroundStartup();
  startScanWorkerLoop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
