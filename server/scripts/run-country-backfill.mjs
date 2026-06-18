import 'dotenv/config';
import { initDb, isDbQuotaError } from '../db.js';
import { enableBackfillWorkers } from '../services/backfillGate.js';
import { countQualifiedStoresNeedingCountryRefresh } from '../services/leadStoreRepository.js';
import { kickCountryBackfillWorker, isCountryBackfillRunning } from '../services/leadCountryBackfillWorker.js';

enableBackfillWorkers();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

await initDb();
let pending = await countQualifiedStoresNeedingCountryRefresh();
console.info(`[country backfill] starting: ${pending} store(s) pending`);
if (pending === 0) process.exit(0);

kickCountryBackfillWorker();

while (true) {
  await sleep(5000);
  try {
    pending = await countQualifiedStoresNeedingCountryRefresh();
  } catch (e) {
    if (isDbQuotaError(e)) {
      console.error('[country backfill] Neon data transfer quota exceeded — stopping. Upgrade Neon or wait for reset.');
      process.exit(1);
    }
    throw e;
  }
  const running = isCountryBackfillRunning();
  console.info(`[country backfill] pending=${pending} running=${running}`);
  if (pending === 0 && !running) break;
}

console.info('[country backfill] complete');
process.exit(0);
