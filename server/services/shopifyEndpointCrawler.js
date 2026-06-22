/**
 * MODULE: shopify_endpoint_crawler
 * Confirm suspected Shopify domains via public JSON endpoints and extract metadata.
 */
import { normalizeStoreUrl } from './crawler.js';
import { isBlockedBrandDomain } from './brandBlocklist.js';
import { yieldToUserWorkload, isUserWorkloadActive } from './resourceCoordinator.js';

const RATE_LIMIT_MS = Number(process.env.SHOPIFY_CRAWL_RATE_MS) || 3000;
const BIG_BRAND_THRESHOLD = Number(process.env.SHOPIFY_BIG_BRAND_PRODUCT_COUNT) || 5000;
const USER_AGENT = 'Mozilla/5.0 (compatible; StoreCrawler/1.0)';
const FETCH_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function originFromUrl(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

function myshopifyPriority(url) {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
    if (host.endsWith('.myshopify.com')) return 0;
    if (host.includes('shopify')) return 1;
    return 2;
  } catch {
    return 3;
  }
}

function isShopifyProductsPayload(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.products));
}

async function fetchShopifyJson(url) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  });
  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { res, data };
}

async function fetchSitemap(origin) {
  const res = await fetch(`${origin}/sitemap.xml`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml,text/xml,*/*' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return { ok: false, hasProductsPath: false, productUrls: 0 };
  const text = await res.text();
  const productLocs = (text.match(/<loc>[^<]*\/products\/[^<]+<\/loc>/gi) || []).length;
  return {
    ok: true,
    hasProductsPath: productLocs > 0 || /\/products\//i.test(text),
    productUrls: productLocs,
  };
}

async function estimateProductCount(origin) {
  let total = 0;
  const maxPages = Math.ceil(BIG_BRAND_THRESHOLD / 250) + 1;
  for (let page = 1; page <= maxPages; page += 1) {
    await yieldToUserWorkload();
    const { res, data } = await fetchShopifyJson(`${origin}/products.json?limit=250&page=${page}`);
    if (!res.ok || !data?.products?.length) break;
    total += data.products.length;
    if (total > BIG_BRAND_THRESHOLD) return total;
    if (data.products.length < 250) break;
  }
  return total;
}

/**
 * Confirm a single domain via Shopify public endpoints.
 * @param {string} url
 */
export async function confirmShopifyDomain(url) {
  const origin = originFromUrl(url);
  if (!origin || isBlockedBrandDomain(origin)) return null;

  await yieldToUserWorkload();

  const productsProbe = await fetchShopifyJson(`${origin}/products.json?limit=5`);
  let confirmed = productsProbe.res.ok && isShopifyProductsPayload(productsProbe.data);
  let productTitles = [];
  let firstImageDomain = null;
  let collectionsCount = 0;
  let productCount = 0;
  let confirmMethod = null;

  if (confirmed) {
    confirmMethod = 'products_json';
    productTitles = (productsProbe.data.products || []).map((p) => p.title).filter(Boolean).slice(0, 5);
    const img =
      productsProbe.data.products?.[0]?.images?.[0]?.src || productsProbe.data.products?.[0]?.image?.src;
    if (img) {
      try {
        firstImageDomain = new URL(img).hostname;
      } catch (_) {}
    }
    productCount = await estimateProductCount(origin);
  } else {
    await yieldToUserWorkload();
    const collectionsProbe = await fetchShopifyJson(`${origin}/collections.json`);
    if (collectionsProbe.res.ok && Array.isArray(collectionsProbe.data?.collections)) {
      collectionsCount = collectionsProbe.data.collections.length;
      if (collectionsCount > 0) {
        confirmed = true;
        confirmMethod = 'collections_json';
      }
    }

    if (!confirmed) {
      await yieldToUserWorkload();
      const sitemap = await fetchSitemap(origin);
      if (sitemap.hasProductsPath) {
        confirmed = true;
        confirmMethod = 'sitemap_xml';
        productCount = sitemap.productUrls || 0;
      }
    }
  }

  if (!confirmed) return null;

  if (productCount > BIG_BRAND_THRESHOLD) {
    return {
      skipped: true,
      reason: 'big_brand',
      productCount,
      url: normalizeStoreUrl(origin) || origin,
      platform_hint: 'shopify',
    };
  }

  const normalized = normalizeStoreUrl(origin) || origin;
  return {
    url: normalized,
    platform_hint: 'shopify',
    productCount,
    productTitles,
    collectionsCount,
    firstImageDomain,
    shopifyCdnConfirm: Boolean(firstImageDomain?.includes('cdn.shopify.com')),
    confirmMethod,
    source: 'shopify_endpoint_crawler',
    raw_signal:
      productTitles.slice(0, 3).join(' · ') ||
      (collectionsCount ? `${collectionsCount} collections` : 'Shopify store confirmed'),
  };
}

/**
 * @param {string[]} candidateUrls
 * @param {(patch: object) => Promise<void>|void} [onProgress]
 * @param {{ initialHits?: object[], skipUrls?: string[] }} [options]
 */
export async function runShopifyEndpointCrawler(candidateUrls, onProgress, options = {}) {
  const report = async (patch) => {
    if (typeof onProgress === 'function') await onProgress(patch);
  };

  const skipSet = new Set((options.skipUrls || []).map((u) => originFromUrl(u) || u));
  const hits = [...(options.initialHits || [])];
  const skipped = [];
  const candidates = [];
  const seenOrigins = new Set();
  for (const raw of candidateUrls || []) {
    const origin = originFromUrl(raw);
    if (!origin || seenOrigins.has(origin) || skipSet.has(origin)) continue;
    seenOrigins.add(origin);
    candidates.push({ url: raw, origin, priority: myshopifyPriority(raw) });
  }
  candidates.sort((a, b) => a.priority - b.priority || a.origin.localeCompare(b.origin));

  let rejected = 0;
  const total = candidates.length + hits.length;
  const alreadyDone = hits.length;

  await report({
    phase: 'shopify_endpoint_crawler',
    shopifyCheckIndex: alreadyDone,
    shopifyCheckTotal: total,
    progressPercent: 58,
    linksFound: hits.length,
    statusLabel: total
      ? `Confirming Shopify stores (${alreadyDone}/${total})…`
      : 'No candidates to confirm',
  });

  for (let i = 0; i < candidates.length; i += 1) {
    await yieldToUserWorkload();
    const item = candidates[i];
    const result = await confirmShopifyDomain(item.url);

    if (!result) {
      rejected += 1;
    } else if (result.skipped) {
      skipped.push(result);
    } else {
      hits.push(result);
    }

    const done = alreadyDone + i + 1;
    await report({
      phase: 'shopify_endpoint_crawler',
      shopifyCheckIndex: done,
      shopifyCheckTotal: total,
      linksFound: hits.length,
      progressPercent: 58 + Math.round((done / Math.max(total, 1)) * 22),
      statusLabel: `Confirming Shopify stores (${done}/${total})…`,
      userWorkloadPaused: isUserWorkloadActive(),
      checkpoint: {
        shopifyInProgress: true,
        confirmedHits: hits,
        confirmedUrls: hits.map((h) => h.url),
        shopifyCheckedCount: done,
        shopifyCheckTotal: total,
      },
    });

    if (i < candidates.length - 1) await sleep(RATE_LIMIT_MS);
  }

  return {
    hits,
    skipped,
    stats: {
      candidates: total,
      confirmed: hits.length,
      rejected,
      skippedBigBrand: skipped.length,
      myshopifyConfirmed: hits.filter((h) => myshopifyPriority(h.url) === 0).length,
      resumedFrom: alreadyDone,
    },
  };
}
