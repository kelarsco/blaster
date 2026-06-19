/**
 * Store crawler: privacy + contact/about pages (always fetch both for better email coverage).
 */
import https from 'https';
import http from 'http';

const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 10000;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PRIVACY_PATHS = [
  '/policies/privacy-policy',
  '/policies/contact-information',
  '/privacy-policy',
  '/privacy',
  '/pages/privacy-policy',
  '/pages/privacy',
  '/legal/privacy',
];

const CONTACT_PATHS = [
  '/pages/contact',
  '/contact',
  '/contact-us',
  '/pages/contact-us',
  '/pages/about',
  '/pages/about-us',
  '/about',
  '/about-us',
  '/support',
  '/help',
  '/customer-service',
  '/impressum',
  '/',
];

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

/** Normalize one store URL line — use the full line, not a substring token. */
export function normalizeStoreUrl(storeUrl) {
  const raw = (storeUrl || '').trim().replace(/^[\s"'`<>()\[\]]+|[\s"'`<>()\[\]]+$/g, '');
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host || !host.includes('.')) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

function pathToUrl(origin, path) {
  return path === '/' ? `${origin}/` : `${origin}${path}`;
}

async function fetchPaths(origin, paths) {
  const urls = [...new Set(paths.map((path) => pathToUrl(origin, path)))];
  const responses = await Promise.all(
    urls.map(async (url) => {
      const response = await fetchHtml(url, { timeout: REQUEST_TIMEOUT_MS });
      return { url, response };
    })
  );
  return responses;
}

/**
 * Crawl one store: privacy-policy paths plus contact/about/home (always both).
 */
export async function crawlStore(storeUrl) {
  const pages = [];
  const seenPages = new Set();
  const addPage = (url, html) => {
    if (!url || !html || seenPages.has(url)) return;
    seenPages.add(url);
    pages.push({ url, html });
  };

  const normalized = normalizeStoreUrl(storeUrl);
  if (!normalized) {
    return { pages, privacyPageFound: false, privacyPageUrl: null, fallbackUsed: false };
  }

  const origin = normalized;
  let privacyPageFound = false;
  let privacyPageUrl = null;

  const privacyResponses = await fetchPaths(origin, PRIVACY_PATHS);
  for (const { url, response } of privacyResponses) {
    if (response.ok && response.html && response.html.trim().length > 0) {
      addPage(url, response.html);
      if (!privacyPageFound) {
        privacyPageFound = true;
        privacyPageUrl = url;
      }
    }
  }

  const contactResponses = await fetchPaths(origin, CONTACT_PATHS);
  let fallbackUsed = false;
  for (const { url, response } of contactResponses) {
    if (response.ok && response.html && response.html.trim().length > 0) {
      addPage(url, response.html);
      fallbackUsed = true;
    }
  }

  if (!privacyPageFound && !fallbackUsed) {
    fallbackUsed = false;
  }

  return { pages, privacyPageFound, privacyPageUrl, fallbackUsed };
}
