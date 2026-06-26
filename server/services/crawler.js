/**
 * Store crawler — HTTP GET only, fail-soft (never throws).
 */
import https from 'https';
import http from 'http';
import { withCrawlSlot } from './crawlLimiter.js';

const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 6000;
const MAX_RESPONSE_BYTES = Number(process.env.CRAWL_MAX_RESPONSE_BYTES) || 2 * 1024 * 1024;
const USER_AGENT = 'StoreReach/1.0 (Contact extraction)';

const PATHS_TO_TRY = ['/policies/privacy-policy', '/', '/pages/contact'];
const PARALLEL_PAGES =
  process.env.CRAWL_PARALLEL_PAGES === '1' || process.env.CRAWL_PARALLEL_PAGES === 'true';

const URL_TOKEN_REGEX =
  /(https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`]*)?)/i;

const httpAgent = new http.Agent({ keepAlive: false, maxSockets: 4 });
const httpsAgent = new https.Agent({ keepAlive: false, maxSockets: 4 });

const EMPTY_RESPONSE = { ok: false, statusCode: 0, html: null };

export function fetchHtml(url, options = {}) {
  const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? 3;
  const signal = options.signal;

  if (signal?.aborted) {
    return Promise.resolve({ ...EMPTY_RESPONSE, aborted: true });
  }

  return withCrawlSlot(
    () =>
      new Promise((resolve) => {
        let req;
        let settled = false;

        const finish = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(result);
        };

        const onAbort = () => {
          if (req) req.destroy();
          finish({ ...EMPTY_RESPONSE, aborted: true });
        };

        signal?.addEventListener('abort', onAbort, { once: true });

        const timer = setTimeout(() => {
          if (req) req.destroy();
          finish(EMPTY_RESPONSE);
        }, timeout);

        try {
          const parsed = new URL(url);
          const isHttps = parsed.protocol === 'https:';
          const lib = isHttps ? https : http;
          const reqOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: (parsed.pathname || '/') + (parsed.search || ''),
            method: 'GET',
            agent: isHttps ? httpsAgent : httpAgent,
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              Connection: 'close',
            },
            rejectUnauthorized: false,
          };
          req = lib.get(reqOptions, (res) => {
            if (signal?.aborted) {
              req.destroy();
              finish({ ...EMPTY_RESPONSE, aborted: true });
              return;
            }

            const location = res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
            if (location && maxRedirects > 0) {
              clearTimeout(timer);
              signal?.removeEventListener('abort', onAbort);
              settled = true;
              fetchHtml(new URL(location, url).href, { timeout, maxRedirects: maxRedirects - 1, signal }).then(
                resolve
              );
              return;
            }
            if (res.statusCode !== 200) {
              finish({ ok: false, statusCode: res.statusCode || 0, html: null });
              return;
            }
            const chunks = [];
            let totalBytes = 0;
            res.on('data', (c) => {
              if (settled) return;
              totalBytes += c.length;
              if (totalBytes > MAX_RESPONSE_BYTES) {
                req.destroy();
                finish(EMPTY_RESPONSE);
                return;
              }
              chunks.push(c);
            });
            res.on('end', () => {
              if (settled) return;
              finish({ ok: true, statusCode: 200, html: Buffer.concat(chunks).toString('utf8') });
            });
            res.on('error', () => finish(EMPTY_RESPONSE));
          });
          req.on('error', () => finish(EMPTY_RESPONSE));
        } catch {
          finish(EMPTY_RESPONSE);
        }
      })
  );
}

export function normalizeStoreUrl(storeUrl) {
  const raw = (storeUrl || '').trim().replace(/^[\s"'`<>()\[\]]+|[\s"'`<>()\[\]]+$/g, '');
  if (!raw) return null;
  const token = raw.match(URL_TOKEN_REGEX)?.[0] || raw;
  const withScheme = /^https?:\/\//i.test(token) ? token : `https://${token}`;
  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host || !host.includes('.')) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

function pageUrl(origin, path) {
  return path === '/' ? `${origin}/` : `${origin}${path}`;
}

async function fetchPage(url, options = {}) {
  const response = await fetchHtml(url, { timeout: REQUEST_TIMEOUT_MS, signal: options.signal });
  if (response.aborted) return null;
  if (response.ok && response.html && response.html.trim().length > 0) {
    return { url, html: response.html };
  }
  return null;
}

/**
 * Fetch PATHS_TO_TRY for a store in parallel. Returns successful pages only.
 */
export async function crawlStore(storeUrl, options = {}) {
  const signal = options.signal;
  const origin = normalizeStoreUrl(storeUrl);
  if (!origin || signal?.aborted) {
    return { pages: [], privacyPageFound: false };
  }

  const pages = [];
  let privacyPageFound = false;

  if (PARALLEL_PAGES) {
    const fetched = await Promise.all(
      PATHS_TO_TRY.map(async (path) => {
        if (signal?.aborted) return null;
        const page = await fetchPage(pageUrl(origin, path), { signal });
        return page ? { path, page } : null;
      })
    );
    for (const entry of fetched) {
      if (!entry) continue;
      pages.push(entry.page);
      if (entry.path === '/policies/privacy-policy') privacyPageFound = true;
    }
  } else {
    for (const path of PATHS_TO_TRY) {
      if (signal?.aborted) break;
      const page = await fetchPage(pageUrl(origin, path), { signal });
      if (!page) continue;
      pages.push(page);
      if (path === '/policies/privacy-policy') privacyPageFound = true;
    }
  }

  if (process.env.SCAN_DEBUG === '1') {
    console.log(`[crawler] ${origin} — fetched ${pages.length} page(s)${signal?.aborted ? ' (aborted)' : ''}`);
  }

  return { pages, privacyPageFound };
}
