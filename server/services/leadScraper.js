import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeStoreUrl } from './crawler.js';
import { enqueueLeadStores } from './leadStoreRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL_REGEX = /https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s"'<>]*)?/gi;
const DOMAIN_REGEX = /(?:^|[\s"'(])([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;

function loadSeedUrls() {
  const candidates = [
    path.join(__dirname, '../../client/src/data/seedStoreUrls.json'),
    path.join(__dirname, '../data/seedStoreUrls.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data)) return data;
      }
    } catch (_) {}
  }
  return [];
}

function extractStoreUrlsFromHtml(html) {
  const found = new Set();
  const matches = html.match(URL_REGEX) || [];
  for (const m of matches) {
    const n = normalizeStoreUrl(m);
    if (n) found.add(n);
  }
  let dm;
  const text = html || '';
  while ((dm = DOMAIN_REGEX.exec(text)) !== null) {
    const n = normalizeStoreUrl(dm[1]);
    if (n && !n.includes('facebook.com') && !n.includes('google.com') && !n.includes('shopify.com')) {
      found.add(n);
    }
  }
  return [...found];
}

/**
 * Discover store URLs from seed list + optional crawl of discovery pages.
 */
export async function discoverLeadStoreUrls() {
  const seeds = loadSeedUrls();
  const envSeeds = (process.env.LEAD_SCRAPE_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allSeeds = [...new Set([...seeds, ...envSeeds])];
  const discovered = new Set();

  for (const raw of allSeeds) {
    const url = normalizeStoreUrl(raw);
    if (url) discovered.add(url);
  }

  const discoveryPages = (process.env.LEAD_DISCOVERY_PAGES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { fetchHtml } = await import('./crawler.js');
  for (const page of discoveryPages.slice(0, 5)) {
    const res = await fetchHtml(page, { timeout: 12000 });
    if (res.ok && res.html) {
      for (const u of extractStoreUrlsFromHtml(res.html)) discovered.add(u);
    }
  }

  return [...discovered];
}

export async function runScrapeDiscoveryJob() {
  const urls = await discoverLeadStoreUrls();
  const { added } = await enqueueLeadStores(urls, 'scraping');
  return { urlsFound: urls.length, storesAdded: added.length };
}
