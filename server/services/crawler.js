/**
 * Simple store crawler for Shopify and similar stores.
 * Priority: privacy policy page first, then homepage, then contact-style pages.
 */
import https from 'https';
import http from 'http';

const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_PAGES_MS = 600;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Pages where Shopify/stores typically show contact/email (in priority order). */
const PAGES_TO_SCAN = [
  { path: '/policies/privacy-policy', name: 'privacy' },
  { path: '/', name: 'home' },
  { path: '/pages/contact', name: 'contact' },
  { path: '/pages/contact-us', name: 'contact-us' },
  { path: '/contact', name: 'contact-alt' },
];

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchHtml(url, options = {}) {
  const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? 3;
  return new Promise((resolve) => {
    let req;
    const timer = setTimeout(() => {
      if (req) req.destroy();
      resolve(null);
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
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          clearTimeout(timer);
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
        res.on('error', () => {
          clearTimeout(timer);
          resolve(null);
        });
      });
      req.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Crawl a store: fetch homepage, contact page, and privacy policy (where emails usually are).
 * Returns array of { url, html } for each page that returned content.
 */
export async function crawlStore(storeUrl) {
  const out = [];
  let base = (storeUrl || '').trim().replace(/\/$/, '') || storeUrl;
  if (!base.startsWith('http')) base = 'https://' + base;
  let origin;
  try {
    origin = new URL(base).origin;
  } catch {
    return out;
  }

  for (const { path } of PAGES_TO_SCAN) {
    const url = path === '/' ? origin + '/' : origin + path;
    const html = await fetchHtml(url, { timeout: REQUEST_TIMEOUT_MS });
    if (html && typeof html === 'string' && html.trim().length > 0) {
      out.push({ url, html });
    }
    await delay(DELAY_BETWEEN_PAGES_MS);
  }

  return out;
}
