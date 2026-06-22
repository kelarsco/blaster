/**
 * Simple store crawler: privacy policy → contact → homepage (sequential).
 * Stops as soon as emails are found on any page.
 */
import https from 'https';
import http from 'http';
import { collectEmailsFromHtml } from './emailExtractor.js';

const REQUEST_TIMEOUT_MS = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 12000;
const DELAY_BETWEEN_PAGES_MS = Number(process.env.CRAWL_PAGE_DELAY_MS) || 450;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PRIVACY_PATHS = [
  '/policies/privacy-policy',
  '/privacy-policy',
  '/policies/privacy',
  '/policies',
  '/pages/privacy-policy',
  '/privacy',
];

const CONTACT_PATHS = ['/contact', '/contact-us', '/pages/contact', '/pages/contact-us'];

const HOME_PATHS = ['/', '/home'];

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

/**
 * Crawl a store in order: privacy policy paths → contact → homepage.
 * Stops as soon as any page yields at least one valid email.
 */
export async function crawlStore(storeUrl) {
  const pages = [];
  const seen = new Set();
  const normalized = normalizeStoreUrl(storeUrl);

  if (!normalized) {
    return { pages, privacyPageFound: false, fallbackUsed: false };
  }

  let privacyPageFound = false;
  let requestCount = 0;

  async function visit(path) {
    const url = pageUrl(normalized, path);
    if (seen.has(url)) return null;
    seen.add(url);
    if (requestCount > 0) await delay(DELAY_BETWEEN_PAGES_MS);
    requestCount += 1;
    const page = await fetchPage(url);
    if (page) pages.push(page);
    return page;
  }

  function pageHasEmails(page) {
    if (!page) return false;
    const emails = collectEmailsFromHtml(page.url, page.html);
    if (emails.length > 0 && process.env.SCAN_DEBUG === '1') {
      console.log(`[crawler] ${normalized} — found ${emails.length} email(s) on ${page.url}`);
    }
    return emails.length > 0;
  }

  for (const path of PRIVACY_PATHS) {
    const page = await visit(path);
    if (!page) continue;
    privacyPageFound = true;
    if (pageHasEmails(page)) {
      return { pages, privacyPageFound, fallbackUsed: false };
    }
    break;
  }

  for (const path of CONTACT_PATHS) {
    const page = await visit(path);
    if (!page) continue;
    if (pageHasEmails(page)) {
      return { pages, privacyPageFound, fallbackUsed: true };
    }
    break;
  }

  for (const path of HOME_PATHS) {
    const page = await visit(path);
    if (page && pageHasEmails(page)) {
      return { pages, privacyPageFound, fallbackUsed: true };
    }
  }

  return {
    pages,
    privacyPageFound,
    fallbackUsed: pages.some((p) => !p.url.includes('privacy') && !p.url.includes('policies')),
  };
}
