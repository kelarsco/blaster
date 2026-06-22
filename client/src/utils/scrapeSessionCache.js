const CACHE_KEY = 'wiblaster:bl-admin:scrape-session';
const JOB_ID_KEY = 'wiblaster:bl-admin:scrape-job-id';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readScrapeJobId() {
  try {
    return sessionStorage.getItem(JOB_ID_KEY) || localStorage.getItem(JOB_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function writeScrapeJobId(jobId) {
  if (!jobId) return;
  try {
    sessionStorage.setItem(JOB_ID_KEY, jobId);
    localStorage.setItem(JOB_ID_KEY, jobId);
  } catch {
    /* private mode */
  }
}

export function readScrapeSessionCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function writeScrapeSessionCache(data) {
  if (!data?.job) return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + TTL_MS,
      })
    );
  } catch {
    /* quota */
  }
}

export function clearScrapeSessionCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(JOB_ID_KEY);
    localStorage.removeItem(JOB_ID_KEY);
  } catch {
    /* ignore */
  }
}
