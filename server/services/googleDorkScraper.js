/**
 * google_dork_scraper — discover Shopify store URLs via global Google search (SerpAPI / ValueSERP).
 *
 * Default mode (SERPAPI_MODE=daily): one budget-conscious daily run (~15 requests for 250/mo plan).
 * Shopify-only queries; *.myshopify.com domains are prioritized in results.
 */
import { normalizeStoreUrl } from './crawler.js';
import { isBlockedBrandDomain } from './brandBlocklist.js';
import { getSerpBudgetConfig, getSerpQuotaStatus, reserveSerpRequests } from './serpQuota.js';
import { yieldToUserWorkload } from './resourceCoordinator.js';

/** Shopify-only dork queries — override via SERPAPI_DORK_QUERIES (comma-separated). */
export const SHOPIFY_DORK_QUERIES = [
  'site:myshopify.com -inurl:admin -inurl:password',
  'inurl:myshopify.com -inurl:admin',
  '"powered by shopify" -site:shopify.com -site:help.shopify.com',
  '"cdn.shopify.com" -site:shopify.com -site:cdn.shopify.com',
  'inurl:"/collections/" inurl:"/products/" "shopify" -site:shopify.com',
  '"shop now" "powered by shopify" -site:shopify.com',
  'site:myshopify.com collections products -inurl:admin',
  '"myshopify.com" store -inurl:admin -inurl:login',
  'inurl:myshopify.com "add to cart"',
  '"shopify theme" inurl:products -site:shopify.com',
];

/** @deprecated use SHOPIFY_DORK_QUERIES */
export const DORK_QUERIES = SHOPIFY_DORK_QUERIES;

const TRACKING_PARAM_PREFIXES = ['utm_', 'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'ref', '_ga'];
const RATE_LIMIT_MS = 1000;
const FULL_MODE_MAX_PAGES = 10;
const RESULTS_PER_PAGE = 100;
const QUOTA_RETRY_MS = 60_000;

/** Past 24 hours — freshest indexed stores */
const TBS_LAST_24H = 'qdr:d';
/** Past week (~168h) — covers 24–144h window on Google */
const TBS_LAST_WEEK = 'qdr:w';

let apiKeyCursor = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getApiKeys() {
  const multi = (process.env.SERPAPI_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (multi.length) return multi;
  const single = (process.env.SERPAPI_KEY || '').trim();
  return single ? [single] : [];
}

function getValueSerpKey() {
  return (process.env.VALUESERP_KEY || '').trim();
}

function nextApiKey(keys) {
  if (!keys.length) return null;
  const key = keys[apiKeyCursor % keys.length];
  apiKeyCursor += 1;
  return key;
}

function getDorkQueries() {
  const custom = (process.env.SERPAPI_DORK_QUERIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return custom.length ? custom : SHOPIFY_DORK_QUERIES;
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

function platformHintFromQuery() {
  return 'shopify';
}

/** Day-of-year rotation so all Shopify dorks get coverage across the month. */
function dayRotationIndex(date = new Date()) {
  const queries = getDorkQueries();
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % queries.length;
}

/**
 * Build the daily search plan: split budget between 24h and week filters.
 * @returns {{ query: string, tbs: string, timeLabel: string, platformHint: string|null }[]}
 */
export function buildDailySearchPlan({ dailyBudget, rotationOffset = 0 } = {}) {
  const queries = getDorkQueries();
  const budget = Math.max(1, dailyBudget || getSerpBudgetConfig().dailyBudget);
  const freshCount = Math.ceil(budget / 2);
  const weekCount = budget - freshCount;
  const plan = [];

  for (let i = 0; i < freshCount; i += 1) {
    const query = queries[(rotationOffset + i) % queries.length];
    plan.push({
      query,
      tbs: TBS_LAST_24H,
      timeLabel: 'past 24 hours',
      platformHint: platformHintFromQuery(query),
    });
  }
  for (let i = 0; i < weekCount; i += 1) {
    const query = queries[(rotationOffset + freshCount + i) % queries.length];
    plan.push({
      query,
      tbs: TBS_LAST_WEEK,
      timeLabel: 'past week (24–144h)',
      platformHint: platformHintFromQuery(query),
    });
  }

  return plan;
}

export function stripTrackingParams(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAM_PREFIXES.some((p) => lower === p || lower.startsWith(p))) {
        parsed.searchParams.delete(key);
      }
    }
    let out = parsed.toString();
    if (out.endsWith('?')) out = out.slice(0, -1);
    return out;
  } catch {
    return url;
  }
}

function shouldSkipRawUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.endsWith('.pdf') || path.endsWith('.xml') || path.endsWith('.json')) return true;
    if (u.hostname.includes('google.') && path.includes('/search')) return true;
    if (isBlockedBrandDomain(u.hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

function hitFromResult(result, query, platformHint, timeLabel) {
  const link = stripTrackingParams(result?.link || '');
  if (!link || shouldSkipRawUrl(link)) return null;
  const normalized = normalizeStoreUrl(link);
  if (!normalized || isBlockedBrandDomain(normalized)) return null;

  const snippet = [result?.snippet, result?.title].filter(Boolean).join(' ').toLowerCase();
  const host = (() => {
    try {
      return new URL(normalized).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const isMyshopify = host.endsWith('.myshopify.com');
  const looksShopify =
    isMyshopify ||
    snippet.includes('shopify') ||
    snippet.includes('myshopify') ||
    snippet.includes('cdn.shopify.com') ||
    /\/collections\/|\/products\//i.test(normalized);
  if (!looksShopify) return null;

  const rawSignal = [result?.snippet, result?.title, timeLabel ? `indexed: ${timeLabel}` : '']
    .filter(Boolean)
    .join(' — ')
    .slice(0, 280);
  return {
    url: normalized,
    platform_hint: platformHint || 'shopify',
    source: 'google_dork',
    raw_signal: rawSignal || query,
    myshopify: isMyshopify,
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { res, data, text };
}

async function withQuotaRetry(fetchOnce) {
  let result = await fetchOnce();
  if (result.res.ok) return result;
  const isQuota =
    result.res.status === 429 ||
    result.res.status === 402 ||
    /quota|rate.?limit|too many/i.test(result.text || '');
  if (!isQuota) return result;
  await sleep(QUOTA_RETRY_MS);
  return fetchOnce();
}

async function fetchSerpApiPage(query, start, apiKey, tbs) {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    num: String(RESULTS_PER_PAGE),
    start: String(start),
    api_key: apiKey,
  });
  if (tbs) params.set('tbs', tbs);
  const url = `https://serpapi.com/search.json?${params}`;
  const { res, data, text } = await withQuotaRetry(() => fetchJson(url));
  if (!res.ok) {
    return { ok: false, error: data?.error || text?.slice(0, 200) || `HTTP ${res.status}`, results: [] };
  }
  const results = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return { ok: true, results };
}

async function fetchValueSerpPage(query, page, apiKey, tbs) {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    num: String(RESULTS_PER_PAGE),
    page: String(page),
  });
  if (tbs) params.set('tbs', tbs);
  const url = `https://api.valueserp.com/search?${params}`;
  const { res, data, text } = await withQuotaRetry(() => fetchJson(url));
  if (!res.ok) {
    return { ok: false, error: data?.error || text?.slice(0, 200) || `HTTP ${res.status}`, results: [] };
  }
  const results = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return { ok: true, results };
}

/**
 * Run dork queries within quota budget and return deduplicated hits.
 * @param {(patch: object) => Promise<void>|void} [onProgress]
 */
export async function runGoogleDorkScraper(onProgress) {
  const serpKeys = getApiKeys();
  const valueSerpKey = getValueSerpKey();
  const provider = (process.env.SERP_PROVIDER || '').trim().toLowerCase();
  const useValueSerp = provider === 'valueserp' || (!serpKeys.length && valueSerpKey);
  const keys = useValueSerp ? (valueSerpKey ? [valueSerpKey] : []) : serpKeys;
  const { mode, dailyBudget, monthlyQuota } = getSerpBudgetConfig();
  const quotaBefore = await getSerpQuotaStatus();

  if (!keys.length) {
    return {
      hits: [],
      skipped: true,
      reason: 'No SERPAPI_KEY or VALUESERP_KEY configured',
      stats: { queriesRun: 0, pagesFetched: 0, rawLinks: 0, uniqueHits: 0 },
      quota: quotaBefore,
    };
  }

  if (quotaBefore.remainingToday <= 0 || quotaBefore.remainingMonth <= 0) {
    return {
      hits: [],
      skipped: true,
      reason: `SerpAPI daily/monthly budget exhausted (${quotaBefore.usedToday}/${dailyBudget} today, ${quotaBefore.usedMonth}/${monthlyQuota} this month)`,
      stats: { queriesRun: 0, pagesFetched: 0, rawLinks: 0, uniqueHits: 0 },
      quota: quotaBefore,
    };
  }

  const report = async (patch) => {
    if (typeof onProgress === 'function') await onProgress(patch);
  };

  const isDailyMode = mode !== 'full';
  const rotationOffset = dayRotationIndex();
  const dorkQueries = getDorkQueries();
  const searchPlan = isDailyMode
    ? buildDailySearchPlan({
        dailyBudget: Math.min(dailyBudget, quotaBefore.remainingToday, quotaBefore.remainingMonth),
        rotationOffset,
      })
    : dorkQueries.flatMap((query) =>
        Array.from({ length: FULL_MODE_MAX_PAGES }, (_, page) => ({
          query,
          tbs: null,
          timeLabel: null,
          platformHint: platformHintFromQuery(query),
          page,
        }))
      );

  const seenDomains = new Set();
  const hits = [];
  let pagesFetched = 0;
  let serpRequestsUsed = 0;
  let rawLinks = 0;
  const errors = [];
  const totalSteps = searchPlan.length;
  let step = 0;

  for (let i = 0; i < searchPlan.length; i += 1) {
    await yieldToUserWorkload();
    const item = searchPlan[i];
    const { query, tbs, timeLabel, platformHint } = item;

    const reserve = await reserveSerpRequests(1);
    if (reserve.reserved < 1) {
      errors.push({ query, error: 'Daily or monthly SerpAPI budget reached' });
      break;
    }
    serpRequestsUsed += 1;

    const apiKey = nextApiKey(keys);
    let pageResult;

    if (useValueSerp) {
      pageResult = await fetchValueSerpPage(query, (item.page ?? 0) + 1, apiKey, tbs);
    } else {
      pageResult = await fetchSerpApiPage(query, (item.page ?? 0) * RESULTS_PER_PAGE, apiKey, tbs);
    }

    step += 1;
    pagesFetched += 1;

    if (!pageResult.ok) {
      errors.push({ query, tbs, error: pageResult.error });
      await report({
        phase: 'google_dork',
        dorkQuery: query,
        dorkQueryIndex: i + 1,
        dorkQueryTotal: searchPlan.length,
        progressPercent: 10 + Math.round((step / totalSteps) * 50),
        statusLabel: `Google dork: ${i + 1}/${searchPlan.length} (skipped — ${pageResult.error})`,
        etaSeconds: Math.max(0, (totalSteps - step) * (RATE_LIMIT_MS / 1000)),
        serpQuota: reserve.state,
      });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    rawLinks += pageResult.results.length;
    for (const result of pageResult.results) {
      const hit = hitFromResult(result, query, platformHint, timeLabel);
      if (!hit || seenDomains.has(hit.url)) continue;
      seenDomains.add(hit.url);
      hits.push(hit);
    }

    const timeHint = timeLabel ? ` · ${timeLabel}` : '';
    await report({
      phase: 'google_dork',
      dorkQuery: query,
      dorkQueryIndex: i + 1,
      dorkQueryTotal: searchPlan.length,
      linksFound: hits.length,
      progressPercent: 10 + Math.round((step / totalSteps) * 50),
      statusLabel: `Google dork: ${i + 1}/${searchPlan.length}${timeHint}`,
      etaSeconds: Math.max(0, (totalSteps - step) * (RATE_LIMIT_MS / 1000)),
      serpQuota: reserve.state,
    });

    if (!isDailyMode && pageResult.results.length === 0) break;
    await sleep(RATE_LIMIT_MS);
  }

  hits.sort((a, b) => {
    const pa = myshopifyPriority(a.url);
    const pb = myshopifyPriority(b.url);
    if (pa !== pb) return pa - pb;
    return a.url.localeCompare(b.url);
  });

  const quotaAfter = await getSerpQuotaStatus();

  return {
    hits,
    skipped: false,
    provider: useValueSerp ? 'valueserp' : 'serpapi',
    engine: 'google',
    mode: isDailyMode ? 'daily' : 'full',
    focus: 'shopify',
    stats: {
      queriesRun: searchPlan.length,
      pagesFetched,
      serpRequestsUsed,
      rawLinks,
      uniqueHits: hits.length,
      errors: errors.length,
      rotationOffset,
      timeFilters: isDailyMode ? [TBS_LAST_24H, TBS_LAST_WEEK] : [],
    },
    errors: errors.slice(0, 20),
    quota: quotaAfter,
  };
}

/** Serialize hits as NDJSON lines (for logging or export). */
export function hitsToNdjson(hits) {
  return hits.map((h) => JSON.stringify(h)).join('\n');
}
