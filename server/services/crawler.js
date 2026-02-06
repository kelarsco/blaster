/**
 * Enterprise store crawler: priority-based scanning, Tier1 + Tier2 links,
 * user-agent rotation, configurable delays, optional stealth mode.
 */
import https from 'https';
import http from 'http';
import { load } from 'cheerio';

const REQUEST_TIMEOUT_MS = 6000;
const CRAWL_TOTAL_TIMEOUT_MS = 50000;
const DEFAULT_DELAY_MIN_MS = 100;
const DEFAULT_DELAY_MAX_MS = 350;
const STEALTH_DELAY_MIN_MS = 800;
const STEALTH_DELAY_MAX_MS = 2000;
const MAX_PAGES_PER_STORE = 10;
const MAX_TIER2_LINKS = 4;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const TIER1_PATHS = [
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/impressum',
  '/legal',
  '/privacy-policy',
  '/terms',
  '/policies/privacy-policy',
  '/policies/contact-information',
  '/pages/contact',
  '/pages/contact-us',
  '/pages/about',
  '/pages/about-us',
  '/help',
  '/support',
  '/',
];

const TIER2_KEYWORDS = /contact|support|help|legal|customer-service|impressum|about|privacy|terms/i;

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

/**
 * Extract internal same-origin links whose href or text matches Tier2 keywords.
 */
function extractTier2Links(html, baseOrigin) {
  if (!html || typeof html !== 'string') return [];
  const seen = new Set();
  const out = [];
  try {
    const maxLen = 600000;
    const toParse = html.length > maxLen ? html.slice(0, maxLen) : html;
    const $ = load(toParse, { decodeEntities: true });
    const origin = new URL(baseOrigin).origin;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const full = href.startsWith('http') ? href : new URL(href, baseOrigin).href;
      let sameOrigin = false;
      try {
        sameOrigin = new URL(full).origin === origin;
      } catch (_) {}
      if (!sameOrigin) return;
      const path = new URL(full).pathname || '/';
      if (seen.has(path)) return;
      if (!TIER2_KEYWORDS.test(href) && !TIER2_KEYWORDS.test(text)) return;
      seen.add(path);
      out.push({ url: full, path });
    });
  } catch (_) {}
  return out.slice(0, MAX_TIER2_LINKS);
}

/**
 * Crawl a store: Tier1 paths first, then Tier2 contextual links. Bounded by total timeout.
 * options: { stealthMode, delayMinMs, delayMaxMs, maxPages, userAgent }
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
  const maxPages = Math.min(options.maxPages ?? MAX_PAGES_PER_STORE, 20);
  const userAgent = options.userAgent || pickUserAgent();
  const fetchedPaths = new Set();
  const totalTimeout = options.totalTimeoutMs ?? CRAWL_TOTAL_TIMEOUT_MS;
  const deadline = Date.now() + totalTimeout;

  const addPage = (url, html, tier) => {
    try {
      const p = new URL(url).pathname || '/';
      if (fetchedPaths.has(p)) return;
      fetchedPaths.add(p);
      if (html && typeof html === 'string') results.push({ url, html, tier });
    } catch (_) {}
  };

  const timedOut = () => Date.now() >= deadline;

  for (const path of TIER1_PATHS) {
    if (results.length >= maxPages || timedOut()) break;
    await delay(randomBetween(delayMin, delayMax));
    if (timedOut()) break;
    const url = path === '/' ? baseOrigin + '/' : baseOrigin + path;
    const html = await fetchHtml(url, { userAgent, timeout: REQUEST_TIMEOUT_MS });
    addPage(url, html, 'tier1');
  }

  if (results.length < maxPages && !timedOut()) {
    const tier2Candidates = new Map();
    for (const { url, html } of results) {
      if (timedOut()) break;
      try {
        for (const { url: linkUrl, path } of extractTier2Links(html, baseOrigin)) {
          if (!fetchedPaths.has(path)) tier2Candidates.set(path, linkUrl);
        }
      } catch (_) {}
    }
    const tier2List = [...tier2Candidates.entries()].slice(0, MAX_TIER2_LINKS);
    for (const [, linkUrl] of tier2List) {
      if (results.length >= maxPages || timedOut()) break;
      await delay(randomBetween(delayMin, delayMax));
      if (timedOut()) break;
      const html = await fetchHtml(linkUrl, { userAgent, timeout: REQUEST_TIMEOUT_MS });
      addPage(linkUrl, html, 'tier2');
    }
  }

  return results;
}

export { TIER1_PATHS, TIER2_KEYWORDS, USER_AGENTS };
