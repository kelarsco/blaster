/**
 * Store crawler: privacy policy first, then contact + homepage in parallel.
 */
import https from 'https';
import http from 'http';

const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 12000;
const DELAY_BETWEEN_PAGES_MS = Number(process.env.CRAWL_PAGE_DELAY_MS) || 400;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PRIVACY_PATHS = [
  '/policies/privacy-policy',
  '/privacy-policy',
  '/privacy',
  '/pages/privacy-policy',
];

const SUPPORT_PATHS = [
  '/pages/contact',
  '/pages/contact-us',
  '/contact',
  '/',
];

const URL_TOKEN_REGEX = /(https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`]*)?)/i;

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

/**
 * Crawl a store:
 * 1) Try privacy-policy paths until one succeeds.
 * 2) Fetch contact + homepage paths in parallel (always — emails often live there).
 */
export async function crawlStore(storeUrl) {
  const pages = [];
  const seenPages = new Set();
  const addPage = (page) => {
    if (!page || seenPages.has(page.url)) return;
    seenPages.add(page.url);
    pages.push(page);
  };

  const normalized = normalizeStoreUrl(storeUrl);
  if (!normalized) {
    return { pages, privacyPageFound: false, privacyPageUrl: null, fallbackUsed: false };
  }

  let privacyPageFound = false;
  let privacyPageUrl = null;

  for (let i = 0; i < PRIVACY_PATHS.length; i += 1) {
    if (i > 0) await delay(DELAY_BETWEEN_PAGES_MS);
    const url = pageUrl(normalized, PRIVACY_PATHS[i]);
    const page = await fetchPage(url);
    if (page) {
      addPage(page);
      privacyPageFound = true;
      privacyPageUrl = url;
      break;
    }
  }

  const supportUrls = SUPPORT_PATHS.map((path) => pageUrl(normalized, path)).filter((url) => !seenPages.has(url));
  if (supportUrls.length > 0) {
    if (privacyPageFound) await delay(DELAY_BETWEEN_PAGES_MS);
    const supportPages = await Promise.all(supportUrls.map((url) => fetchPage(url)));
    supportPages.forEach(addPage);
  }

  const fallbackUsed = pages.some((p) => !p.url.includes('privacy') && !p.url.includes('policies'));

  return { pages, privacyPageFound, privacyPageUrl, fallbackUsed };
}
