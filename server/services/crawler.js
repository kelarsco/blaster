/**
 * Store crawler: fetches common contact/policy paths, then Shopify fallbacks.
 * Visits every configured path (not just the first that loads) for fuller coverage.
 */
import https from 'https';
import http from 'http';

const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 10000;
const DELAY_BETWEEN_PAGES_MS = Number(process.env.CRAWL_PAGE_DELAY_MS) || 0;
const PARALLEL_PAGES = Math.min(
  Math.max(
    Number(process.env.CRAWL_PARALLEL_PAGES) || (process.env.NODE_ENV === 'production' ? 4 : 6),
    1
  ),
  12
);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Common store paths checked on every scan (contact + policy pages).
 * Ordered by typical email/contact yield.
 */
export const COMMON_STORE_PATHS = [
  '/contact',
  '/pages/contact',
  '/pages/contact-us',
  '/pages/contact-information',
  '/pages/about-us',
  '/pages/shipping-policy',
  '/pages/refund-policy',
  '/pages/privacy-policy',
  '/home',
];

/** Shopify policy mirrors and homepage when /pages/* variants are missing */
const FALLBACK_PATHS = [
  '/',
  '/policies/contact-information',
  '/policies/privacy-policy',
  '/policies/refund-policy',
  '/policies/shipping-policy',
];

const PRIVACY_URL_HINTS = /privacy|policies\/privacy|pages\/privacy/i;

const URL_TOKEN_REGEX =
  /(https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`]*)?)/i;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function fetchHtml(url, options = {}) {
  const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? 3;
  return new Promise((resolve) => {
    let req;
    const timer = setTimeout(() => {
      if (req) req.destroy();
      resolve({ ok: false, statusCode: 0, html: null });
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
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        rejectUnauthorized: false,
      };
      req = lib.get(reqOptions, (res) => {
        const location = res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
        if (location && maxRedirects > 0) {
          clearTimeout(timer);
          fetchHtml(new URL(location, url).href, { timeout, maxRedirects: maxRedirects - 1 }).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          resolve({ ok: false, statusCode: res.statusCode || 0, html: null });
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          clearTimeout(timer);
          resolve({ ok: true, statusCode: 200, html: Buffer.concat(chunks).toString('utf8') });
        });
        res.on('error', () => {
          clearTimeout(timer);
          resolve({ ok: false, statusCode: 0, html: null });
        });
      });
      req.on('error', () => {
        clearTimeout(timer);
        resolve({ ok: false, statusCode: 0, html: null });
      });
    } catch {
      clearTimeout(timer);
      resolve({ ok: false, statusCode: 0, html: null });
    }
  });
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

async function fetchPage(url) {
  const response = await fetchHtml(url, { timeout: REQUEST_TIMEOUT_MS });
  if (response.ok && response.html && response.html.trim().length > 0) {
    return { url, html: response.html };
  }
  return null;
}

async function fetchPathsWave(origin, paths, seen) {
  const queue = [];
  for (const path of paths) {
    const url = pageUrl(origin, path);
    if (seen.has(url)) continue;
    seen.add(url);
    queue.push(url);
  }
  if (!queue.length) return [];

  const pages = [];
  for (let i = 0; i < queue.length; i += PARALLEL_PAGES) {
    if (i > 0 && DELAY_BETWEEN_PAGES_MS > 0) await delay(DELAY_BETWEEN_PAGES_MS);
    const chunk = queue.slice(i, i + PARALLEL_PAGES);
    const fetched = await Promise.all(chunk.map((url) => fetchPage(url)));
    for (const page of fetched) {
      if (page) pages.push(page);
    }
  }
  return pages;
}

/**
 * Crawl common contact/policy paths first, then Shopify policy fallbacks + homepage.
 */
export async function crawlStore(storeUrl) {
  const seen = new Set();
  const normalized = normalizeStoreUrl(storeUrl);

  if (!normalized) {
    return { pages: [], privacyPageFound: false, fallbackUsed: false };
  }

  const pages = [];
  for (const paths of [COMMON_STORE_PATHS, FALLBACK_PATHS]) {
    const wavePages = await fetchPathsWave(normalized, paths, seen);
    pages.push(...wavePages);
  }

  const privacyPageFound = pages.some((p) => PRIVACY_URL_HINTS.test(p.url));
  const fallbackUsed = pages.some((p) => !PRIVACY_URL_HINTS.test(p.url));

  if (process.env.SCAN_DEBUG === '1') {
    console.log(`[crawler] ${normalized} — fetched ${pages.length} page(s)`);
  }

  return { pages, privacyPageFound, fallbackUsed };
}
