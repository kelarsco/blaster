/**
 * Discover ecommerce store URLs via SerpAPI Google Ads Transparency Center.
 * Surfaces personal/DTC storefronts from active Google Ads (Shopping + Search).
 *
 * Default: 15 searches/day, date-windowed (24h + 6-day) for fresh advertisers.
 */
import { normalizeStoreUrl } from './crawler.js';
import { isBlockedBrandDomain } from './brandBlocklist.js';
import { getSerpBudgetConfig, getSerpQuotaStatus, reserveSerpRequests } from './serpQuota.js';

/**
 * DTC store ad phrases — primary CTAs, offers, and trust copy small brands use in Google Ads.
 * Rotated daily (15 searches/day). Override via SERPAPI_ADS_QUERIES=comma-separated.
 */
export const ECOMMERCE_ADS_QUERY_DEFS = [
  // Primary CTAs
  { text: 'shop now', platform: 'SHOPPING', category: 'cta' },
  { text: 'shop the collection', platform: 'SHOPPING', category: 'cta' },
  { text: 'shop our store', platform: 'SHOPPING', category: 'cta' },
  { text: 'buy now', platform: 'SHOPPING', category: 'cta' },
  { text: 'order now', platform: 'SHOPPING', category: 'cta' },
  { text: 'get yours today', platform: 'SHOPPING', category: 'cta' },
  { text: 'grab yours', platform: 'SHOPPING', category: 'cta' },
  { text: 'add to cart', platform: 'SHOPPING', category: 'cta' },
  { text: 'check out our store', platform: 'SEARCH', category: 'cta' },
  { text: 'visit our store', platform: 'SEARCH', category: 'cta' },
  { text: 'explore our collection', platform: 'SEARCH', category: 'cta' },
  { text: 'browse the store', platform: 'SEARCH', category: 'cta' },
  // Discount / offer CTAs
  { text: 'get 10% off your first order', platform: 'SHOPPING', category: 'offer' },
  { text: 'first order discount', platform: 'SHOPPING', category: 'offer' },
  { text: 'welcome discount', platform: 'SHOPPING', category: 'offer' },
  { text: 'new customer offer', platform: 'SHOPPING', category: 'offer' },
  { text: 'use code for', platform: 'SEARCH', category: 'offer' },
  { text: 'flash sale', platform: 'SHOPPING', category: 'offer' },
  { text: 'weekend sale', platform: 'SHOPPING', category: 'offer' },
  { text: 'sitewide sale', platform: 'SHOPPING', category: 'offer' },
  { text: 'clearance sale', platform: 'SHOPPING', category: 'offer' },
  { text: 'free shipping', platform: 'SHOPPING', category: 'offer' },
  // Trust signals (Search — surfaces indie brand landing pages)
  { text: '5 star reviews', platform: 'SEARCH', category: 'trust' },
  { text: 'happy customers', platform: 'SEARCH', category: 'trust' },
  { text: 'as seen in', platform: 'SEARCH', category: 'trust' },
  { text: 'featured in', platform: 'SEARCH', category: 'trust' },
  { text: 'money back guarantee', platform: 'SEARCH', category: 'trust' },
  { text: '30 day returns', platform: 'SEARCH', category: 'trust' },
  { text: 'satisfaction guaranteed', platform: 'SEARCH', category: 'trust' },
  { text: 'authenticity guaranteed', platform: 'SEARCH', category: 'trust' },
  // Platform fingerprints (still useful for Shopify/Woo indie stores)
  { text: 'powered by shopify', platform: 'SEARCH', category: 'platform' },
  { text: 'built with woocommerce', platform: 'SEARCH', category: 'platform' },
];

/** @deprecated use ECOMMERCE_ADS_QUERY_DEFS */
export const ECOMMERCE_ADS_QUERIES = ECOMMERCE_ADS_QUERY_DEFS.map((q) => q.text);

const NON_STORE_TARGET_SUFFIXES = [
  'play.google.com',
  'apps.apple.com',
  'itunes.apple.com',
  'youtube.com',
  'youtu.be',
  'linktr.ee',
  'lnk.bio',
  'bit.ly',
  'goo.gl',
];

function getAdsQueryDefs() {
  const custom = (process.env.SERPAPI_ADS_QUERIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (custom.length) {
    return custom.map((text) => ({ text, platform: 'SHOPPING', category: 'custom' }));
  }
  return ECOMMERCE_ADS_QUERY_DEFS;
}

const RATE_LIMIT_MS = 1000;
const QUOTA_RETRY_MS = 60_000;
const RESULTS_PER_REQUEST = 100;

let apiKeyCursor = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeSerpApiKey(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return u.searchParams.get('api_key')?.trim() || '';
    } catch {
      return '';
    }
  }
  return v;
}

function getApiKeys() {
  const multi = (process.env.SERPAPI_KEYS || '')
    .split(',')
    .map((s) => normalizeSerpApiKey(s))
    .filter(Boolean);
  if (multi.length) return multi;
  const single = normalizeSerpApiKey(process.env.SERPAPI_KEY);
  return single ? [single] : [];
}

function nextApiKey(keys) {
  if (!keys.length) return null;
  const key = keys[apiKeyCursor % keys.length];
  apiKeyCursor += 1;
  return key;
}

function formatSerpDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function dateRangeForWindow(window) {
  const end = new Date();
  const start = new Date(end);
  if (window === '24h') {
    start.setDate(start.getDate() - 1);
  } else {
    start.setDate(start.getDate() - 6);
  }
  return {
    startDate: formatSerpDate(start),
    endDate: formatSerpDate(end),
    timeLabel: window === '24h' ? 'ads: past 24h' : 'ads: past 6 days',
  };
}

function dayRotationIndex(date = new Date()) {
  const queries = getAdsQueryDefs();
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / (1000 * 60 * 60 * 24));
  return dayOfYear % queries.length;
}

function isNonStoreTargetDomain(domain) {
  const host = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!host) return true;
  if (isBlockedBrandDomain(host)) return true;
  return NON_STORE_TARGET_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

function resolveAdStoreDomain(ad) {
  if (ad?.target_domain) return ad.target_domain;
  if (ad?.details_link) {
    try {
      const u = new URL(ad.details_link);
      const fromQuery = u.searchParams.get('domain');
      if (fromQuery) return fromQuery;
    } catch (_) {}
  }
  return null;
}

function platformHintFromDomain(domain) {
  const d = String(domain || '').toLowerCase();
  if (d.includes('myshopify.com')) return 'shopify';
  if (d.includes('bigcommerce')) return 'bigcommerce';
  if (d.includes('wixsite') || d.includes('wix.com')) return 'wix';
  if (d.includes('squarespace')) return 'squarespace';
  return 'ecommerce';
}

/**
 * Build daily plan: up to `dailyBudget` searches split across fresh (24h) and recent (6d) windows.
 */
export function buildDailyAdsSearchPlan({ dailyBudget, rotationOffset = 0 } = {}) {
  const queries = getAdsQueryDefs();
  const budget = Math.max(1, dailyBudget || getSerpBudgetConfig().dailyBudget);
  const freshCount = Math.ceil(budget / 2);
  const recentCount = budget - freshCount;
  const plan = [];

  for (let i = 0; i < freshCount; i += 1) {
    const def = queries[(rotationOffset + i) % queries.length];
    plan.push({
      text: def.text,
      platform: def.platform || null,
      category: def.category,
      ...dateRangeForWindow('24h'),
    });
  }
  for (let i = 0; i < recentCount; i += 1) {
    const def = queries[(rotationOffset + freshCount + i) % queries.length];
    plan.push({
      text: def.text,
      platform: def.platform || null,
      category: def.category,
      ...dateRangeForWindow('6d'),
    });
  }

  return plan;
}

function hitFromAdCreative(ad, query, timeLabel) {
  const domain = resolveAdStoreDomain(ad);
  if (!domain || isNonStoreTargetDomain(domain)) return null;
  const normalized = normalizeStoreUrl(domain.includes('://') ? domain : `https://${domain}`);
  if (!normalized || isNonStoreTargetDomain(normalized)) return null;

  const rawSignal = [
    ad.advertiser,
    ad.format,
    ad.target_domain,
    timeLabel,
  ]
    .filter(Boolean)
    .join(' — ')
    .slice(0, 280);

  return {
    url: normalized,
    platform_hint: platformHintFromDomain(domain),
    source: 'google_ads',
    raw_signal: rawSignal || query,
    advertiser: ad.advertiser || null,
    advertiserId: ad.advertiser_id || null,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { res, data, text };
}

async function withQuotaRetry(fetchOnce, onWaiting) {
  let result = await fetchOnce();
  if (result.res.ok) return result;
  const isQuota =
    result.res.status === 429 ||
    result.res.status === 402 ||
    /quota|rate.?limit|too many/i.test(result.text || '');
  if (!isQuota) return result;
  if (typeof onWaiting === 'function') await onWaiting();
  await sleep(QUOTA_RETRY_MS);
  return fetchOnce();
}

async function fetchGoogleAdsTransparencyPage({ text, startDate, endDate, apiKey, platform, onWaiting }) {
  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center',
    api_key: apiKey,
    num: String(RESULTS_PER_REQUEST),
    text,
  });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (platform) params.set('platform', platform);

  const url = `https://serpapi.com/search.json?${params}`;
  const { res, data, text: body } = await withQuotaRetry(() => fetchJson(url), onWaiting);
  if (!res.ok) {
    return {
      ok: false,
      error: data?.error || body?.slice(0, 200) || `HTTP ${res.status}`,
      creatives: [],
    };
  }
  const creatives = Array.isArray(data?.ad_creatives) ? data.ad_creatives : [];
  return { ok: true, creatives };
}

/**
 * Run Google Ads Transparency Center searches within daily quota.
 * @param {(patch: object) => Promise<void>|void} [onProgress]
 */
export async function runGoogleAdsScraper(onProgress) {
  const keys = getApiKeys();
  const { mode, dailyBudget, monthlyQuota } = getSerpBudgetConfig();
  const quotaBefore = await getSerpQuotaStatus();

  if (!keys.length) {
    return {
      hits: [],
      skipped: true,
      reason: 'No SERPAPI_KEY configured (use your SerpApi private key, not a URL)',
      stats: { queriesRun: 0, serpRequestsUsed: 0, rawLinks: 0, uniqueHits: 0 },
      quota: quotaBefore,
    };
  }

  if (quotaBefore.remainingToday <= 0 || quotaBefore.remainingMonth <= 0) {
    return {
      hits: [],
      skipped: true,
      reason: `SerpAPI daily/monthly budget exhausted (${quotaBefore.usedToday}/${dailyBudget} today, ${quotaBefore.usedMonth}/${monthlyQuota} this month)`,
      stats: { queriesRun: 0, serpRequestsUsed: 0, rawLinks: 0, uniqueHits: 0 },
      quota: quotaBefore,
    };
  }

  const report = async (patch) => {
    if (typeof onProgress === 'function') await onProgress(patch);
  };

  const rotationOffset = dayRotationIndex();
  const searchPlan =
    mode === 'full'
      ? getAdsQueryDefs().map((def) => ({
          text: def.text,
          platform: def.platform || 'SHOPPING',
          category: def.category,
          ...dateRangeForWindow('6d'),
        }))
      : buildDailyAdsSearchPlan({
          dailyBudget: Math.min(dailyBudget, quotaBefore.remainingToday, quotaBefore.remainingMonth),
          rotationOffset,
        });

  const seenDomains = new Set();
  const hits = [];
  let serpRequestsUsed = 0;
  let rawLinks = 0;
  const errors = [];
  const totalSteps = searchPlan.length;

  for (let i = 0; i < searchPlan.length; i += 1) {
    const item = searchPlan[i];
    const stepEta = Math.max(0, (totalSteps - i) * 18);

    await report({
      phase: 'google_ads',
      adsQuery: item.text,
      adsQueryIndex: i + 1,
      adsQueryTotal: searchPlan.length,
      linksFound: hits.length,
      progressPercent: 10 + Math.round((i / totalSteps) * 50),
      statusLabel: `Google Ads: ${i + 1}/${searchPlan.length} — querying SerpAPI ("${item.text}")…`,
      etaSeconds: stepEta,
    });

    const reserve = await reserveSerpRequests(1);
    if (reserve.reserved < 1) {
      errors.push({ text: item.text, error: 'Daily or monthly SerpAPI budget reached' });
      break;
    }
    serpRequestsUsed += 1;

    const apiKey = nextApiKey(keys);
    const pageResult = await fetchGoogleAdsTransparencyPage({
      text: item.text,
      startDate: item.startDate,
      endDate: item.endDate,
      apiKey,
      platform: item.platform,
      onWaiting: async () => {
        await report({
          phase: 'google_ads',
          adsQuery: item.text,
          adsQueryIndex: i + 1,
          adsQueryTotal: searchPlan.length,
          linksFound: hits.length,
          progressPercent: 10 + Math.round((i / totalSteps) * 50),
          statusLabel: `Google Ads: rate limited — retrying in 60s… (${i + 1}/${searchPlan.length})`,
          etaSeconds: stepEta + 60,
        });
      },
    });

    if (!pageResult.ok) {
      errors.push({ text: item.text, error: pageResult.error });
      await report({
        phase: 'google_ads',
        adsQuery: item.text,
        adsQueryIndex: i + 1,
        adsQueryTotal: searchPlan.length,
        progressPercent: 10 + Math.round(((i + 1) / totalSteps) * 50),
        statusLabel: `Google Ads: ${i + 1}/${searchPlan.length} (skipped — ${pageResult.error})`,
        etaSeconds: Math.max(0, (totalSteps - i - 1) * (RATE_LIMIT_MS / 1000)),
        serpQuota: reserve.state,
      });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    rawLinks += pageResult.creatives.length;
    for (const ad of pageResult.creatives) {
      const hit = hitFromAdCreative(ad, item.text, item.timeLabel);
      if (!hit || seenDomains.has(hit.url)) continue;
      seenDomains.add(hit.url);
      hits.push(hit);
    }

    await report({
      phase: 'google_ads',
      adsQuery: item.text,
      adsQueryIndex: i + 1,
      adsQueryTotal: searchPlan.length,
      linksFound: hits.length,
      progressPercent: 10 + Math.round(((i + 1) / totalSteps) * 50),
      statusLabel: `Google Ads: ${i + 1}/${searchPlan.length} · ${item.timeLabel}`,
      etaSeconds: Math.max(0, (totalSteps - i - 1) * (RATE_LIMIT_MS / 1000)),
      serpQuota: reserve.state,
    });

    await sleep(RATE_LIMIT_MS);
  }

  const quotaAfter = await getSerpQuotaStatus();

  return {
    hits,
    skipped: false,
    provider: 'serpapi',
    engine: 'google_ads_transparency_center',
    mode: mode === 'full' ? 'full' : 'daily',
    stats: {
      queriesRun: searchPlan.length,
      serpRequestsUsed,
      rawLinks,
      uniqueHits: hits.length,
      errors: errors.length,
      rotationOffset,
      timeWindows: ['24h', '6d'],
    },
    errors: errors.slice(0, 20),
    quota: quotaAfter,
  };
}
