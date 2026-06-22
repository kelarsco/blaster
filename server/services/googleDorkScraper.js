/**
 * google_dork_scraper — discover store URLs via search engine dork queries (SerpAPI / ValueSERP).
 *
 * Default mode (SERPAPI_MODE=daily): one budget-conscious daily run (~8 requests for 250/mo plan).
 * Uses Google time filters (past 24h + past week) to surface stores indexed in the last 24–144h window.
 */
import { normalizeStoreUrl } from './crawler.js';
import { isBlockedBrandDomain } from './brandBlocklist.js';
import { getSerpBudgetConfig, getSerpQuotaStatus, reserveSerpRequests } from './serpQuota.js';

export const DORK_QUERIES = [
  '"powered by shopify" -site:shopify.com',
  'site:myshopify.com -inurl:admin',
  '"built with woocommerce"',
  'inurl:"/collections/" inurl:"/products/" -site:shopify.com',
  '"cdn.shopify.com" -site:shopify.com',
  '"woocommerce" inurl:shop',
  '"bigcommerce" inurl:store -site:bigcommerce.com',
  '"prestashop" inurl:products',
  '"opencart" inurl:route=product',
];

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

function platformHintFromQuery(query) {
  const q = query.toLowerCase();
  if (q.includes('shopify') || q.includes('myshopify')) return 'shopify';
  if (q.includes('woocommerce')) return 'woocommerce';
  if (q.includes('bigcommerce')) return 'bigcommerce';
  if (q.includes('prestashop')) return 'prestashop';
  if (q.includes('opencart')) return 'opencart';
  return null;
}

/** Day-of-year rotation so all 9 dorks get coverage across the month. */
function dayRotationIndex(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % DORK_QUERIES.length;
}

/**
 * Build the daily search plan: split budget between 24h and week filters.
 * @returns {{ query: string, tbs: string, timeLabel: string, platformHint: string|null }[]}
 */
export function buildDailySearchPlan({ dailyBudget, rotationOffset = 0 } = {}) {
  const budget = Math.max(1, dailyBudget || getSerpBudgetConfig().dailyBudget);
  const freshCount = Math.ceil(budget / 2);
  const weekCount = budget - freshCount;
  const plan = [];

  for (let i = 0; i < freshCount; i += 1) {
    const query = DORK_QUERIES[(rotationOffset + i) % DORK_QUERIES.length];
    plan.push({
      query,
      tbs: TBS_LAST_24H,
      timeLabel: 'past 24 hours',
      platformHint: platformHintFromQuery(query),
    });
  }
  for (let i = 0; i < weekCount; i += 1) {
    const query = DORK_QUERIES[(rotationOffset + freshCount + i) % DORK_QUERIES.length];
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
  const rawSignal = [result?.snippet, result?.title, timeLabel ? `indexed: ${timeLabel}` : '']
    .filter(Boolean)
    .join(' — ')
    .slice(0, 280);
  return {
    url: normalized,
    platform_hint: platformHint,
    source: 'google_dork',
    raw_signal: rawSignal || query,
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
  const searchPlan = isDailyMode
    ? buildDailySearchPlan({
        dailyBudget: Math.min(dailyBudget, quotaBefore.remainingToday, quotaBefore.remainingMonth),
        rotationOffset,
      })
    : DORK_QUERIES.flatMap((query) =>
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

  const quotaAfter = await getSerpQuotaStatus();

  return {
    hits,
    skipped: false,
    provider: useValueSerp ? 'valueserp' : 'serpapi',
    mode: isDailyMode ? 'daily' : 'full',
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
