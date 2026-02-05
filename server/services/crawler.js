/**
 * Simple crawler: Node https/http only (no cheerio, no undici).
 * Fetches /policies/privacy-policy and homepage, then extracts emails via regex.
 */
import https from 'https';
import http from 'http';

const USER_AGENT = 'StoreReach/1.0 (Contact extraction)';
const REQUEST_TIMEOUT = 5000;

// Multiple likely contact/about/privacy pages per store
const PATHS_TO_TRY = [
  '/policies/privacy-policy',
  '/policies/contact-information',
  '/pages/contact',
  '/pages/contact-us',
  '/pages/about-us',
  '/pages/about',
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/help',
  '/support',
  '/impressum',
  '/legal',
  '/',
];

const MAX_PAGES_PER_STORE = 6;

function fetchHtml(url) {
  return new Promise((resolve) => {
    let req;
    const timer = setTimeout(() => {
      if (req) req.destroy();
      resolve(null);
    }, REQUEST_TIMEOUT);
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: (parsed.pathname || '/') + (parsed.search || ''),
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT },
        rejectUnauthorized: false,
      };
      req = lib.get(options, (res) => {
        const redirect = res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
        if (redirect) {
          clearTimeout(timer);
          fetchHtml(new URL(redirect, url).href).then(resolve);
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
 * Crawl a store: fetch privacy policy page and homepage, return { url, html } array.
 */
export async function crawlStore(storeUrl, _onProgress) {
  const results = [];
  const base = storeUrl.replace(/\/$/, '') || storeUrl;
  const origin = base.startsWith('http') ? base : `https://${base}`;
  let baseOrigin;
  try {
    baseOrigin = new URL(origin).origin;
  } catch {
    return results;
  }

  for (const path of PATHS_TO_TRY) {
    if (results.length >= MAX_PAGES_PER_STORE) break;
    const url = path === '/' ? baseOrigin + '/' : baseOrigin + path;
    const html = await fetchHtml(url);
    if (html && typeof html === 'string') results.push({ url, html });
  }

  return results;
}
