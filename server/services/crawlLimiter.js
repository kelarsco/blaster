/**
 * Caps total in-flight store HTTP requests so worker pools cannot exhaust sockets.
 */
const MAX_IN_FLIGHT = Math.max(Number(process.env.CRAWL_MAX_IN_FLIGHT) || 10, 1);

let inFlight = 0;
const waitQueue = [];

function releaseSlot() {
  inFlight = Math.max(0, inFlight - 1);
  const next = waitQueue.shift();
  if (next) next();
}

export function withCrawlSlot(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      inFlight += 1;
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      } finally {
        releaseSlot();
      }
    };
    if (inFlight < MAX_IN_FLIGHT) {
      run();
    } else {
      waitQueue.push(run);
    }
  });
}

export function getCrawlLimiterStats() {
  return { inFlight, queued: waitQueue.length, maxInFlight: MAX_IN_FLIGHT };
}
