/**
 * Discover store URLs from Google Ads Transparency Center and configured discovery pages.
 * Returns a session payload for the admin scraping dashboard (no auto-enqueue).
 */
import { normalizeStoreUrl, fetchHtml } from './crawler.js';
import { findUrlsExistingInDb, findUrlsInDbSince } from './leadStoreRepository.js';
import { runGoogleAdsScraper } from './googleAdsScraper.js';
import { isBlockedBrandDomain } from './brandBlocklist.js';
const URL_REGEX = /https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s"'<>]*)?/gi;
const DOMAIN_REGEX = /(?:^|[\s"'(])([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;

const SOURCE_COLORS = {
  Reddit: 'bg-orange-100 text-orange-800 border-orange-200',
  Facebook: 'bg-blue-100 text-blue-800 border-blue-200',
  TikTok: 'bg-gray-900 text-white border-gray-700',
  LinkedIn: 'bg-sky-100 text-sky-800 border-sky-200',
  Twitter: 'bg-slate-100 text-slate-800 border-slate-200',
  'Google Ads': 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function sourceLabelFromPageUrl(pageUrl) {
  try {
    const host = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`).hostname.toLowerCase();
    if (host.includes('reddit')) return 'Reddit';
    if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('twitter') || host === 'x.com' || host.endsWith('.x.com')) return 'Twitter';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('youtube')) return 'YouTube';
    return host.replace(/^www\./, '');
  } catch {
    return 'Web';
  }
}

export function sourceCardColor(name) {
  return SOURCE_COLORS[name] || 'bg-blaster-sidebar text-blaster-fg border-blaster-border';
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
  DOMAIN_REGEX.lastIndex = 0;
  while ((dm = DOMAIN_REGEX.exec(text)) !== null) {
    const n = normalizeStoreUrl(dm[1]);
    if (
      n &&
      !isBlockedBrandDomain(n)
    ) {
      found.add(n);
    }
  }
  return [...found];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {(patch: object) => Promise<void>|void} [onProgress]
 */
export async function runScrapeDiscoverySession(onProgress) {
  const startedAt = Date.now();
  const report = async (patch) => {
    if (typeof onProgress === 'function') await onProgress(patch);
  };

  await report({ phase: 'google_ads', progressPercent: 8, statusLabel: 'Scraping Google Ads for ecommerce stores…', etaSeconds: 15 * 18, linksFound: 0 });

  const sourceBuckets = [];

  const adsResult = await runGoogleAdsScraper(async (patch) => {
    await report(patch);
  });

  if (adsResult.hits.length > 0) {
    const adsUrls = adsResult.hits.map((h) => h.url);
    sourceBuckets.push({
      id: 'google-ads',
      name: 'Google Ads',
      urls: adsUrls,
      leads: adsResult.hits.map((h) => ({
        storeUrl: h.url,
        source: 'Google Ads',
        platformHint: h.platform_hint,
        rawSignal: h.raw_signal,
        advertiser: h.advertiser,
      })),
    });
  }

  const discoveryPages = (process.env.LEAD_DISCOVERY_PAGES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await report({ phase: 'scraping', progressPercent: 62, statusLabel: 'Scraping discovery sources…', etaSeconds: 45 });

  const pageCount = Math.min(discoveryPages.length, 8);
  for (let i = 0; i < pageCount; i += 1) {
    const page = discoveryPages[i];
    const name = sourceLabelFromPageUrl(page);
    const res = await fetchHtml(page, { timeout: 12000 });
    const urls = res.ok && res.html ? extractStoreUrlsFromHtml(res.html) : [];
    sourceBuckets.push({
      id: `discovery-${i}`,
      name,
      pageUrl: page,
      urls,
      leads: urls.map((storeUrl) => ({ storeUrl, source: name })),
    });
    const progress = 62 + Math.round(((i + 1) / Math.max(pageCount, 1)) * 18);
    await report({
      phase: 'scraping',
      progressPercent: progress,
      statusLabel: `Scraping ${name}…`,
    });
    await sleep(400);
  }

  await report({ phase: 'validating', progressPercent: 82, statusLabel: 'Running validation pipeline…', etaSeconds: 10 });

  const allLeads = [];
  for (const bucket of sourceBuckets) {
    for (const lead of bucket.leads) allLeads.push(lead);
  }

  const rawTotal = allLeads.length;
  const seen = new Set();
  const duplicates = [];
  const uniqueLeads = [];
  for (const lead of allLeads) {
    if (seen.has(lead.storeUrl)) {
      duplicates.push(lead);
      continue;
    }
    seen.add(lead.storeUrl);
    uniqueLeads.push(lead);
  }

  const uniqueUrls = uniqueLeads.map((l) => l.storeUrl);
  const [dbRecentSet, dbAllSet] = await Promise.all([
    findUrlsInDbSince(uniqueUrls, 7),
    findUrlsExistingInDb(uniqueUrls),
  ]);

  const dbRecentLeads = uniqueLeads.filter((l) => dbRecentSet.has(l.storeUrl));
  const verifiedLeads = uniqueLeads.filter((l) => !dbAllSet.has(l.storeUrl));

  const scrapedBuckets = sourceBuckets.filter((b) => b.urls.length > 0);
  const totalGenerated = scrapedBuckets.reduce((sum, b) => sum + b.urls.length, 0);
  const sources = scrapedBuckets.map((b) => ({
    id: b.id,
    name: b.name,
    count: b.urls.length,
    percent: totalGenerated > 0 ? Math.round((b.urls.length / totalGenerated) * 100) : 0,
    pageUrl: b.pageUrl || null,
    links: b.leads.slice(0, 500),
  }));

  const session = {
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date().toISOString(),
    phase: 'ready',
    progressPercent: 100,
    statusLabel: 'Ready for review',
    totalGenerated,
    sources,
    validation: {
      duplicatesInBatch: duplicates.length,
      duplicatesRemoved: duplicates.length,
      dbRecentDuplicates: dbRecentLeads.length,
      verifiedCount: verifiedLeads.length,
    },
    verifiedLeads,
    duplicateLeads: duplicates.slice(0, 500),
    dbRecentLeads: dbRecentLeads.slice(0, 500),
    modules: {
      googleAds: adsResult.skipped
        ? { skipped: true, reason: adsResult.reason, quota: adsResult.quota }
        : {
            skipped: false,
            provider: adsResult.provider,
            engine: adsResult.engine,
            mode: adsResult.mode,
            stats: adsResult.stats,
            errors: adsResult.errors,
            quota: adsResult.quota,
          },
    },
    acceptedAt: null,
    addedCount: 0,
  };

  await report({ ...session });
  return session;
}

/** @deprecated Use runScrapeDiscoverySession + accept endpoint */
export async function runScrapeDiscoveryJob() {
  const session = await runScrapeDiscoverySession();
  const { enqueueLeadStores } = await import('./leadStoreRepository.js');
  const { added } = await enqueueLeadStores(
    session.verifiedLeads.map((l) => l.storeUrl),
    'scraping'
  );
  return { urlsFound: session.totalGenerated, storesAdded: added.length };
}

export async function discoverLeadStoreUrls() {
  const session = await runScrapeDiscoverySession();
  return session.verifiedLeads.map((l) => l.storeUrl);
}
