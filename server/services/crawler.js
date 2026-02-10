/**
 * Store crawler: priority-based pages (privacy, homepage, contact, about, footer/help links),
 * optional Playwright headless browser for JS-rendered content, with fetch fallback.
 * To use headless: npm install playwright && npx playwright install chromium (in server/).
 */
import https from 'https';
import http from 'http';
import { load } from 'cheerio';

const REQUEST_TIMEOUT_MS = 18000;
const PRIVACY_POLICY_TIMEOUT_MS = 25000;
const PAGE_LOAD_TIMEOUT_MS = 20000;
const CRAWL_TOTAL_TIMEOUT_MS = 120000;
const DEFAULT_DELAY_MIN_MS = 2000;
const DEFAULT_DELAY_MAX_MS = 4000;
const DELAY_BEFORE_FIRST_REQUEST_MS = 2000;
const STEALTH_DELAY_MIN_MS = 2500;
const STEALTH_DELAY_MAX_MS = 5000;
const MAX_PAGES_PER_STORE = 18;
const MAX_FOOTER_LINKS = 10;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/** First page to scan per store (Shopify and many stores put contact/email here). */
const PRIVACY_POLICY_PATH = '/policies/privacy-policy';

/** After privacy policy: homepage, then contact/about/support. */
const PRIORITY_PATHS = [
  PRIVACY_POLICY_PATH,
  '/',
  '/pages/contact',
  '/contact',
  '/contact-us',
  '/pages/about',
  '/about',
  '/support',
  '/help',
  '/help-center',
  '/customer-service',
  '/legal',
  '/impressum',
  '/terms',
  '/terms-of-service',
];

const CONTACT_KEYWORDS = /contact|support|help|legal|customer-service|impressum|about|privacy|terms|faq/i;

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(minMs, maxMs) {
  return minMs + Math.random() * (maxMs - minMs);
}

function fetchHtml(url, options = {}) {
  return new Promise((resolve) => {
    let req;
    const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
    const userAgent = options.userAgent || pickUserAgent();
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
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        rejectUnauthorized: false,
      };
      req = lib.get(reqOptions, (res) => {
        const redirect = res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
        if (redirect) {
          clearTimeout(timer);
          fetchHtml(new URL(redirect, url).href, { ...options, userAgent }).then(resolve);
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

/** Extract same-origin links from footer or any page whose href/text matches contact/support/help/about. */
function extractFooterAndContactLinks(html, baseOrigin) {
  if (!html || typeof html !== 'string') return [];
  const seen = new Set();
  const out = [];
  try {
    const maxLen = 600000;
    const toParse = html.length > maxLen ? html.slice(0, maxLen) : html;
    const $ = load(toParse, { decodeEntities: true });
    const origin = new URL(baseOrigin).origin;
    const $footer = $('footer, [role="contentinfo"], .footer, #footer, .site-footer');
    const $links = $footer.length ? $footer.find('a[href]').addBack().end().find('a[href]') : $('a[href]');
    $links.each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      let full;
      try {
        full = href.startsWith('http') ? href : new URL(href, baseOrigin).href;
      } catch (_) {
        return;
      }
      let sameOrigin = false;
      try {
        sameOrigin = new URL(full).origin === origin;
      } catch (_) {}
      if (!sameOrigin) return;
      const path = new URL(full).pathname || '/';
      if (seen.has(path)) return;
      if (!CONTACT_KEYWORDS.test(href) && !CONTACT_KEYWORDS.test(text)) return;
      seen.add(path);
      out.push({ url: full, path });
    });
  } catch (_) {}
  return out.slice(0, MAX_FOOTER_LINKS);
}

/** Crawl using Playwright (headless browser): wait for DOM/networkidle, then get HTML. Returns null on any failure. */
async function crawlWithPlaywright(baseOrigin, pathsToFetch, options) {
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      userAgent: options.userAgent || pickUserAgent(),
      ignoreHTTPSErrors: true,
    });
    const results = [];
    const deadline = Date.now() + (options.totalTimeoutMs ?? CRAWL_TOTAL_TIMEOUT_MS);
    const pageTimeout = options.pageTimeoutMs ?? PAGE_LOAD_TIMEOUT_MS;

    for (const { url, tier } of pathsToFetch) {
      if (Date.now() >= deadline) break;
      try {
        const page = await context.newPage();
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: pageTimeout,
        }).catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        const html = await page.content();
        await page.close();
        if (html && typeof html === 'string') results.push({ url, html, tier });
      } catch (_) {
        // skip this page
      }
    }
    await context.close();
    return results;
  } catch (_) {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Crawl a store: priority pages first (privacy, homepage, contact, about, support, help),
 * then footer/contact links. Tries Playwright when available for JS-rendered content; falls back to fetch.
 * options: { stealthMode, delayMinMs, delayMaxMs, maxPages, userAgent, useHeadless }
 */
export async function crawlStore(storeUrl, options = {}) {
  const results = [];
  const base = (storeUrl || '').replace(/\/$/, '') || storeUrl;
  const origin = base.startsWith('http') ? base : `https://${base}`;
  let baseOrigin;
  try {
    baseOrigin = new URL(origin).origin;
  } catch {
    return results;
  }

  const stealth = !!options.stealthMode;
  const delayMin = options.delayMinMs ?? (stealth ? STEALTH_DELAY_MIN_MS : DEFAULT_DELAY_MIN_MS);
  const delayMax = options.delayMaxMs ?? (stealth ? STEALTH_DELAY_MAX_MS : DEFAULT_DELAY_MAX_MS);
  const maxPages = Math.min(options.maxPages ?? MAX_PAGES_PER_STORE, 25);
  const userAgent = options.userAgent || pickUserAgent();
  const useHeadless = options.useHeadless === true;
  const fetchedPaths = new Set();
  const totalTimeout = options.totalTimeoutMs ?? CRAWL_TOTAL_TIMEOUT_MS;
  const deadline = Date.now() + totalTimeout;

  const addPage = (url, html, tier) => {
    try {
      const p = new URL(url).pathname || '/';
      if (fetchedPaths.has(p)) return;
      fetchedPaths.add(p);
      if (html && typeof html === 'string' && html.length > 100) results.push({ url, html, tier });
    } catch (_) {}
  };

  const timedOut = () => Date.now() >= deadline;

  // Give each store time: delay before first request so we don't hammer the server
  await delay(DELAY_BEFORE_FIRST_REQUEST_MS);
  if (timedOut()) return results;

  // 1) Always fetch /policies/privacy-policy first (main page to scan)
  const privacyUrl = baseOrigin + PRIVACY_POLICY_PATH;
  const privacyHtml = await fetchHtml(privacyUrl, { userAgent, timeout: PRIVACY_POLICY_TIMEOUT_MS });
  addPage(privacyUrl, privacyHtml, 'priority');
  await delay(randomBetween(delayMin, delayMax));
  if (timedOut()) return results;

  // 2) Then homepage
  const homeUrl = baseOrigin + '/';
  const homeHtml = await fetchHtml(homeUrl, { userAgent, timeout: REQUEST_TIMEOUT_MS });
  addPage(homeUrl, homeHtml, 'priority');
  await delay(randomBetween(delayMin, delayMax));
  if (timedOut()) return results;

  // 3) Optional: try Playwright for same pages if explicitly enabled (e.g. for JS-heavy sites)
  if (useHeadless && results.length < 2) {
    const headlessResults = await crawlWithPlaywright(baseOrigin, [
      { url: privacyUrl, tier: 'priority' },
      { url: homeUrl, tier: 'priority' },
    ], {
      userAgent,
      totalTimeoutMs: 30000,
      pageTimeoutMs: PAGE_LOAD_TIMEOUT_MS,
    });
    if (headlessResults && headlessResults.length > 0) {
      for (const r of headlessResults) addPage(r.url, r.html, r.tier);
    }
  }

  // 4) Additional priority pages (contact, about, etc.) with delays so each store has time
  const extraPaths = PRIORITY_PATHS.slice(2, 10);
  for (const path of extraPaths) {
    if (results.length >= maxPages || timedOut()) break;
    await delay(randomBetween(delayMin, delayMax));
    if (timedOut()) break;
    const url = path === '/' ? baseOrigin + '/' : baseOrigin + path;
    const html = await fetchHtml(url, { userAgent, timeout: REQUEST_TIMEOUT_MS });
    addPage(url, html, 'priority');
  }

  if (results.length < maxPages && !timedOut()) {
    const footerCandidates = new Map();
    for (const { url, html } of results) {
      if (timedOut()) break;
      for (const { url: linkUrl, path } of extractFooterAndContactLinks(html, baseOrigin)) {
        if (!fetchedPaths.has(path)) footerCandidates.set(path, linkUrl);
      }
    }
    const footerList = [...footerCandidates.entries()].slice(0, MAX_FOOTER_LINKS);
    for (const [, linkUrl] of footerList) {
      if (results.length >= maxPages || timedOut()) break;
      await delay(randomBetween(delayMin, delayMax));
      if (timedOut()) break;
      const html = await fetchHtml(linkUrl, { userAgent, timeout: REQUEST_TIMEOUT_MS });
      addPage(linkUrl, html, 'footer');
    }
  }

  return results;
}

export { PRIORITY_PATHS, PRIVACY_POLICY_PATH, CONTACT_KEYWORDS, USER_AGENTS };
