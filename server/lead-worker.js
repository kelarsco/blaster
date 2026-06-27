/**
 * Fly lead worker process — lead engine, scrape scheduler, campaign sends (no HTTP server).
 */
import 'dotenv/config';

process.env.PROCESS_ROLE = 'lead';

process.on('unhandledRejection', (reason) => {
  console.error('[lead-worker] Unhandled Rejection:', reason?.message || reason);
});

import { initDb } from './db.js';
import { getProcessRole } from './config/processRole.js';
import { scheduleBackgroundStartup } from './services/backgroundStartup.js';
import { startSendWorkerLoop } from './services/sendWorkerLoop.js';

async function main() {
  console.log(`[lead-worker] PROCESS_ROLE=${getProcessRole()}`);
  await initDb();
  scheduleBackgroundStartup();
  startSendWorkerLoop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
