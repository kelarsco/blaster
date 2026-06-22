/**
 * Discover Shopify store URLs via Google search + Shopify endpoint confirmation.
 * Returns a session payload for the admin scraping dashboard (no auto-enqueue).
 */
import { normalizeStoreUrl, fetchHtml } from './crawler.js';
import { findUrlsExistingInDb, findUrlsInDbSince } from './leadStoreRepository.js';
import { runGoogleDorkScraper } from './googleDorkScraper.js';
import { runShopifyEndpointCrawler } from './shopifyEndpointCrawler.js';
import { isBlockedBrandDomain } from './brandBlocklist.js';
import { waitForUserWorkloadIdle } from './resourceCoordinator.js';

const URL_REGEX = /https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(?:\/[^\s"'<>]*)?/gi;
const DOMAIN_REGEX = /(?:^|[\s"'(])([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;

const SOURCE_COLORS = {
  Reddit: 'bg-orange-100 text-orange-800 border-orange-200',
  Facebook: 'bg-blue-100 text-blue-800 border-blue-200',
  TikTok: 'bg-gray-900 text-white border-gray-700',
  LinkedIn: 'bg-sky-100 text-sky-800 border-sky-200',
  Twitter: 'bg-slate-100 text-slate-800 border-slate-200',
  'Google Dork': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Shopify API': 'bg-violet-100 text-violet-800 border-violet-200',
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
    if (n && !isBlockedBrandDomain(n)) {
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
 * @param {{ resumeFrom?: object }} [options]
 */
export async function runScrapeDiscoverySession(onProgress, options = {}) {
  const startedAt = Date.now();
  const resumeCheckpoint = options.resumeFrom?.checkpoint || {};
  const report = async (patch) => {
    if (typeof onProgress === 'function') await onProgress(patch);
  };

  await waitForUserWorkloadIdle();

  const sourceBuckets = [];
  const candidateUrls = [];
  let dorkResult = null;

  if (resumeCheckpoint.dorkComplete && resumeCheckpoint.candidateUrls?.length) {
    candidateUrls.push(...resumeCheckpoint.candidateUrls);
    if (resumeCheckpoint.sourceBuckets?.length) {
      sourceBuckets.push(...resumeCheckpoint.sourceBuckets);
    }
    dorkResult = resumeCheckpoint.dorkResult || { hits: [], skipped: false, stats: {} };
    await report({
      phase: 'shopify_endpoint_crawler',
      progressPercent: 55,
      statusLabel: 'Resuming — Google search already completed, continuing Shopify confirmation…',
      linksFound: resumeCheckpoint.confirmedHits?.length ?? 0,
    });
  } else {
    await report({
      phase: 'google_dork',
      progressPercent: 8,
      statusLabel: 'Searching Google for Shopify stores…',
      etaSeconds: 15 * 12,
      linksFound: 0,
    });

    dorkResult = await runGoogleDorkScraper(async (patch) => {
      await report(patch);
    });

    if (dorkResult.hits.length > 0) {
      const dorkUrls = dorkResult.hits.map((h) => h.url);
      candidateUrls.push(...dorkUrls);
      sourceBuckets.push({
        id: 'google-dork',
        name: 'Google Dork',
        urls: dorkUrls,
        leads: dorkResult.hits.map((h) => ({
          storeUrl: h.url,
          source: 'Google Dork',
          platformHint: h.platform_hint,
          rawSignal: h.raw_signal,
          myshopify: h.myshopify,
        })),
      });
    }

    const discoveryPages = (process.env.LEAD_DISCOVERY_PAGES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const pageCount = Math.min(discoveryPages.length, 8);
    if (pageCount > 0) {
      await report({
        phase: 'scraping',
        progressPercent: 52,
        statusLabel: 'Scraping discovery sources…',
        etaSeconds: 45,
      });
    }

    for (let i = 0; i < pageCount; i += 1) {
      await waitForUserWorkloadIdle();
      const page = discoveryPages[i];
      const name = sourceLabelFromPageUrl(page);
      const res = await fetchHtml(page, { timeout: 12000 });
      const urls = res.ok && res.html ? extractStoreUrlsFromHtml(res.html) : [];
      candidateUrls.push(...urls);
      sourceBuckets.push({
        id: `discovery-${i}`,
        name,
        pageUrl: page,
        urls,
        leads: urls.map((storeUrl) => ({ storeUrl, source: name })),
      });
      const progress = 52 + Math.round(((i + 1) / Math.max(pageCount, 1)) * 6);
      await report({
        phase: 'scraping',
        progressPercent: progress,
        statusLabel: `Scraping ${name}…`,
      });
      await sleep(400);
    }

    await report({
      checkpoint: {
        dorkComplete: true,
        candidateUrls: [...candidateUrls],
        sourceBuckets: sourceBuckets.map((b) => ({ ...b })),
        dorkResult: {
          hits: dorkResult.hits,
          skipped: dorkResult.skipped,
          reason: dorkResult.reason,
          provider: dorkResult.provider,
          engine: dorkResult.engine,
          mode: dorkResult.mode,
          focus: dorkResult.focus,
          stats: dorkResult.stats,
          errors: dorkResult.errors,
          quota: dorkResult.quota,
        },
      },
      statusLabel: 'Google search complete — starting Shopify API confirmation…',
    });
  }

  await report({
    phase: 'shopify_endpoint_crawler',
    progressPercent: 58,
    statusLabel: 'Confirming Shopify stores via public API…',
    etaSeconds: Math.max(30, candidateUrls.length * 3),
  });

  const priorHits = resumeCheckpoint.confirmedHits || [];
  const skipUrls = priorHits.map((h) => h.url);

  const shopifyResult = await runShopifyEndpointCrawler(
    candidateUrls,
    async (patch) => {
      await report(patch);
    },
    { initialHits: priorHits, skipUrls }
  );

  const confirmedBucket = {
    id: 'shopify-api',
    name: 'Shopify API',
    urls: shopifyResult.hits.map((h) => h.url),
    leads: shopifyResult.hits.map((h) => ({
      storeUrl: h.url,
      source: 'Shopify API',
      platformHint: h.platform_hint,
      rawSignal: h.raw_signal,
      productCount: h.productCount,
      confirmMethod: h.confirmMethod,
    })),
  };
  sourceBuckets.push(confirmedBucket);

  await report({ phase: 'validating', progressPercent: 84, statusLabel: 'Running validation pipeline…', etaSeconds: 10 });

  const allLeads = confirmedBucket.leads;

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
  const confirmedCount = shopifyResult.hits.length;
  const totalGenerated = confirmedCount;
  const sources = scrapedBuckets.map((b) => ({
    id: b.id,
    name: b.name,
    count: b.urls.length,
    percent: totalGenerated > 0 ? Math.round((b.urls.length / totalGenerated) * 100) : 0,
    pageUrl: b.pageUrl || null,
    links: b.leads.slice(0, 500),
  }));

  const session = {
    startedAt: options.resumeFrom?.startedAt || new Date(startedAt).toISOString(),
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
      shopifyCandidates: shopifyResult.stats?.candidates ?? candidateUrls.length,
      shopifyConfirmed: shopifyResult.stats?.confirmed ?? 0,
      shopifyRejected: shopifyResult.stats?.rejected ?? 0,
      shopifySkippedBigBrand: shopifyResult.stats?.skippedBigBrand ?? 0,
      dorkCandidates: dorkResult.hits?.length ?? 0,
    },
    verifiedLeads,
    duplicateLeads: duplicates.slice(0, 500),
    dbRecentLeads: dbRecentLeads.slice(0, 500),
    modules: {
      googleDork: dorkResult.skipped
        ? { skipped: true, reason: dorkResult.reason, quota: dorkResult.quota }
        : {
            skipped: false,
            provider: dorkResult.provider,
            engine: dorkResult.engine,
            mode: dorkResult.mode,
            focus: dorkResult.focus,
            stats: dorkResult.stats,
            errors: dorkResult.errors,
            quota: dorkResult.quota,
          },
      shopifyEndpointCrawler: {
        stats: shopifyResult.stats,
        skippedBigBrand: (shopifyResult.skipped || []).slice(0, 50),
      },
    },
    acceptedAt: null,
    addedCount: 0,
    checkpoint: null,
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
