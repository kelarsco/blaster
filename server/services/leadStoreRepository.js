import { v4 as uuidv4 } from 'uuid';
import { getDb, memoryStore } from '../db.js';
import { normalizeStoreUrl } from './crawler.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    storeUrl: row.store_url,
    source: row.source,
    status: row.status,
    currentPhase: row.current_phase,
    platform: row.platform,
    countryCode: row.country_code,
    currency: row.currency,
    productCount: row.product_count,
    productCountRange: row.product_count_range,
    shopifyPlus: row.shopify_plus,
    shopifyPlusConfidence: row.shopify_plus_confidence,
    facebookAds: row.facebook_ads,
    googleAds: row.google_ads,
    tiktokAds: row.tiktok_ads,
    pinterestAds: row.pinterest_ads,
    dropshippingScore: row.dropshipping_score,
    podScore: row.pod_score,
    activeScore: row.active_score,
    activeTier: row.active_tier,
    emailProvider: row.email_provider,
    smsProvider: row.sms_provider,
    reviewApp: row.review_app,
    chatProvider: row.chat_provider,
    phaseData: row.phase_data || {},
    errorMessage: row.error_message,
    qualified: row.qualified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastScrapedAt: row.last_scraped_at,
    qualifiedAt: row.qualified_at,
  };
}

function memFindByUrl(url) {
  return memoryStore.leadStores.find((s) => s.store_url === url);
}

export async function getLeadStoreStats() {
  const db = getDb();
  if (!db) {
    const stores = memoryStore.leadStores;
    return {
      total: stores.length,
      qualified: stores.filter((s) => s.qualified).length,
      pending: stores.filter((s) => s.status === 'pending').length,
      processing: stores.filter((s) => s.status === 'processing').length,
      rejected: stores.filter((s) => s.status === 'rejected').length,
      failed: stores.filter((s) => s.status === 'failed').length,
    };
  }
  const res = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE qualified = true)::int AS qualified,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM lead_stores
  `);
  const r = res.rows[0];
  return {
    total: r.total || 0,
    qualified: r.qualified || 0,
    pending: r.pending || 0,
    processing: r.processing || 0,
    rejected: r.rejected || 0,
    failed: r.failed || 0,
  };
}

const LIST_COLUMNS = `
  id, store_url, source, status, current_phase, platform, country_code, currency,
  product_count, product_count_range, shopify_plus, shopify_plus_confidence,
  facebook_ads, google_ads, tiktok_ads, pinterest_ads,
  dropshipping_score, pod_score, active_score, active_tier,
  email_provider, sms_provider, review_app, chat_provider,
  error_message, qualified, created_at, updated_at, last_scraped_at, qualified_at
`;

export async function listLeadStores({ qualifiedOnly = false, limit = 500, includePhaseData = false } = {}) {
  const db = getDb();
  if (!db) {
    let list = [...memoryStore.leadStores];
    if (qualifiedOnly) list = list.filter((s) => s.qualified);
    list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return list.slice(0, limit).map(mapRow);
  }
  const where = qualifiedOnly ? 'WHERE qualified = true' : '';
  const cols = includePhaseData ? '*' : LIST_COLUMNS;
  const res = await db.query(
    `SELECT ${cols} FROM lead_stores ${where} ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map(mapRow);
}

/** Slim query for Store Leads page — avoids loading large phase_data JSON blobs. */
const QUALIFIED_STORE_SELECT = `
  SELECT id, store_url, platform, country_code, currency, product_count,
         qualified_at, created_at,
         facebook_ads, google_ads, tiktok_ads, pinterest_ads,
         dropshipping_score, pod_score, shopify_plus, shopify_plus_confidence,
         phase_data->'tags' AS tag_blob,
         phase_data->>'tagsClassifiedAt' AS tags_classified_at
`;

const PLATFORM_TO_DB = {
  Shopify: 'shopify',
  WooCommerce: 'woocommerce',
  Wix: 'wix',
  WordPress: 'wordpress',
};

const PRODUCT_COUNT_RANGES = [
  { id: '1-9', min: 1, max: 9 },
  { id: '10-39', min: 10, max: 39 },
  { id: '40-99', min: 40, max: 99 },
  { id: '100-149', min: 100, max: 149 },
  { id: '150-199', min: 150, max: 199 },
  { id: '200-249', min: 200, max: 249 },
  { id: '250-299', min: 250, max: 299 },
  { id: '300-399', min: 300, max: 399 },
  { id: '400-499', min: 400, max: 499 },
  { id: '500-999', min: 500, max: 999 },
  { id: '1000-1999', min: 1000, max: 1999 },
  { id: '2000-2999', min: 2000, max: 2999 },
];

function mapQualifiedStoreRow(row) {
  return leadStoreToClientFormat({
    id: row.id,
    storeUrl: row.store_url,
    platform: row.platform,
    countryCode: row.country_code,
    currency: row.currency,
    productCount: row.product_count,
    qualifiedAt: row.qualified_at,
    createdAt: row.created_at,
    facebookAds: row.facebook_ads,
    googleAds: row.google_ads,
    tiktokAds: row.tiktok_ads,
    pinterestAds: row.pinterest_ads,
    dropshippingScore: row.dropshipping_score,
    podScore: row.pod_score,
    shopifyPlus: row.shopify_plus,
    shopifyPlusConfidence: row.shopify_plus_confidence,
    phaseData: row.tag_blob
      ? { tags: row.tag_blob, tagsClassifiedAt: row.tags_classified_at }
      : {},
  });
}

function storeTagSql(tag) {
  switch (tag) {
    case 'dropshipping':
      return `(dropshipping_score >= 71
        OR COALESCE(phase_data->'tags'->'tag_summary', '[]'::jsonb) @> '["dropshipping"]'::jsonb
        OR ((phase_data->>'tagsClassifiedAt') IS NOT NULL
            AND jsonb_array_length(COALESCE(phase_data->'tags'->'tag_summary', '[]'::jsonb)) = 0))`;
    case 'print_on_demand':
      return `(pod_score >= 61
        OR COALESCE(phase_data->'tags'->'tag_summary', '[]'::jsonb) @> '["print_on_demand"]'::jsonb)`;
    case 'shopify_plus':
      return `(shopify_plus = true OR shopify_plus_confidence >= 70
        OR COALESCE(phase_data->'tags'->'tag_summary', '[]'::jsonb) @> '["shopify_plus"]'::jsonb)`;
    case 'has_ads':
      return `(facebook_ads = true OR google_ads = true OR tiktok_ads = true OR pinterest_ads = true
        OR (phase_data->'tags'->'has_ads_running'->>'detected') = 'true'
        OR COALESCE(phase_data->'tags'->'tag_summary', '[]'::jsonb) @> '["has_ads"]'::jsonb)`;
    default:
      return 'TRUE';
  }
}

export function parseQualifiedStoreFilters(query = {}) {
  const split = (v) => (typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  return {
    platforms: split(query.platforms),
    countries: split(query.countries),
    currencies: split(query.currencies),
    storeTags: split(query.storeTags),
    productRanges: split(query.productRanges),
    dateFrom: query.dateFrom || null,
    dateTo: query.dateTo || null,
  };
}

function buildQualifiedStoresWhere(filters = {}) {
  const clauses = ['qualified = true'];
  const params = [];
  let i = 1;

  if (filters.platforms?.length) {
    const dbPlatforms = filters.platforms.map((p) => PLATFORM_TO_DB[p] || String(p).toLowerCase());
    clauses.push(`LOWER(platform) = ANY($${i++}::text[])`);
    params.push(dbPlatforms);
  }

  if (filters.countries?.length) {
    clauses.push(`country_code = ANY($${i++}::text[])`);
    params.push(filters.countries);
  }

  if (filters.currencies?.length) {
    clauses.push(`currency = ANY($${i++}::text[])`);
    params.push(filters.currencies);
  }

  if (filters.storeTags?.length) {
    const tagParts = filters.storeTags.map((tag) => storeTagSql(tag));
    clauses.push(`(${tagParts.join(' OR ')})`);
  }

  if (filters.productRanges?.length) {
    const rangeParts = [];
    for (const id of filters.productRanges) {
      const range = PRODUCT_COUNT_RANGES.find((r) => r.id === id);
      if (range) {
        rangeParts.push(`(product_count >= $${i} AND product_count <= $${i + 1})`);
        params.push(range.min, range.max);
        i += 2;
      }
    }
    if (rangeParts.length) clauses.push(`(${rangeParts.join(' OR ')})`);
  }

  if (filters.dateFrom) {
    clauses.push(`COALESCE(qualified_at, created_at) >= $${i++}::timestamptz`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push(`COALESCE(qualified_at, created_at) <= $${i++}::timestamptz`);
    params.push(filters.dateTo);
  }

  return { where: clauses.join(' AND '), params };
}

export async function queryQualifiedStoresForClient({
  filters = {},
  page = 1,
  limit = 50,
} = {}) {
  const db = getDb();
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  if (!db) {
    const all = (await listLeadStores({ qualifiedOnly: true, limit: 50000 })).map(leadStoreToClientFormat);
    const total = all.length;
    return { stores: all.slice(offset, offset + safeLimit), total, page: safePage, limit: safeLimit };
  }

  const { where, params } = buildQualifiedStoresWhere(filters);
  const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM lead_stores WHERE ${where}`, params);
  const total = countRes.rows[0]?.total || 0;

  const listParams = [...params, safeLimit, offset];
  const res = await db.query(
    `${QUALIFIED_STORE_SELECT}
     FROM lead_stores WHERE ${where}
     ORDER BY updated_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );

  return {
    stores: res.rows.map(mapQualifiedStoreRow),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/** @deprecated Use queryQualifiedStoresForClient for paginated loads. */
export async function listQualifiedStoresForClient(limit = 50000) {
  const db = getDb();
  if (!db) {
    return listLeadStores({ qualifiedOnly: true, limit }).map(leadStoreToClientFormat);
  }
  const res = await db.query(
    `${QUALIFIED_STORE_SELECT}
     FROM lead_stores WHERE qualified = true
     ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map(mapQualifiedStoreRow);
}

export async function getLeadStoreByUrl(storeUrl) {
  const db = getDb();
  if (!db) return mapRow(memFindByUrl(storeUrl));
  const res = await db.query('SELECT * FROM lead_stores WHERE store_url = $1', [storeUrl]);
  return mapRow(res.rows[0]);
}

export async function enqueueLeadStores(urls, source = 'manual') {
  const added = [];
  const skipped = [];
  for (const raw of urls) {
    const normalized = normalizeStoreUrl(raw);
    if (!normalized) continue;
    const exists = await getLeadStoreByUrl(normalized);
    if (exists) {
      skipped.push(normalized);
      continue;
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDb();
    if (!db) {
      memoryStore.leadStores.push({
        id,
        store_url: normalized,
        source,
        status: 'pending',
        current_phase: 0,
        qualified: false,
        phase_data: {},
        created_at: now,
        updated_at: now,
      });
    } else {
      await db.query(
        `INSERT INTO lead_stores (id, store_url, source, status, current_phase, qualified, phase_data)
         VALUES ($1, $2, $3, 'pending', 0, false, '{}')`,
        [id, normalized, source]
      );
    }
    added.push(normalized);
  }
  return { added, skipped };
}

/** Reset rejected stores to pending so the pipeline re-runs qualification. */
export async function requeueRejectedLeadStores() {
  const db = getDb();
  if (!db) {
    let requeued = 0;
    for (const s of memoryStore.leadStores) {
      if (s.status === 'rejected') {
        s.status = 'pending';
        s.current_phase = 0;
        s.qualified = false;
        s.error_message = null;
        s.phase_data = {};
        s.updated_at = new Date().toISOString();
        requeued++;
      }
    }
    return { requeued };
  }
  const res = await db.query(`
    UPDATE lead_stores SET
      status = 'pending',
      current_phase = 0,
      qualified = false,
      error_message = NULL,
      phase_data = '{}',
      updated_at = NOW()
    WHERE status = 'rejected'
  `);
  return { requeued: res.rowCount || 0 };
}

export async function getNextPendingLeadStore() {
  const db = getDb();
  if (!db) {
    const store = memoryStore.leadStores.find((s) => s.status === 'pending');
    return mapRow(store);
  }
  const res = await db.query(
    `SELECT * FROM lead_stores WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  );
  return mapRow(res.rows[0]);
}

export async function updateLeadStorePhase(id, phase) {
  const db = getDb();
  if (!db) {
    const s = memoryStore.leadStores.find((x) => x.id === id);
    if (s) {
      s.status = 'processing';
      s.current_phase = phase;
      s.updated_at = new Date().toISOString();
    }
    return;
  }
  await db.query(
    `UPDATE lead_stores SET status = 'processing', current_phase = $2, updated_at = NOW() WHERE id = $1`,
    [id, phase]
  );
}

export async function saveLeadStoreResult(id, data) {
  const db = getDb();
  const now = new Date().toISOString();
  if (!db) {
    const s = memoryStore.leadStores.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, {
      store_url: data.storeUrl || s.store_url,
      status: data.status,
      current_phase: data.currentPhase ?? 10,
      platform: data.platform,
      country_code: data.countryCode,
      currency: data.currency,
      product_count: data.productCount,
      product_count_range: data.productCountRange,
      shopify_plus: data.shopifyPlus,
      shopify_plus_confidence: data.shopifyPlusConfidence,
      facebook_ads: data.facebookAds,
      google_ads: data.googleAds,
      tiktok_ads: data.tiktokAds,
      pinterest_ads: data.pinterestAds,
      dropshipping_score: data.dropshippingScore,
      pod_score: data.podScore,
      active_score: data.activeScore,
      active_tier: data.activeTier,
      email_provider: data.emailProvider,
      sms_provider: data.smsProvider,
      review_app: data.reviewApp,
      chat_provider: data.chatProvider,
      phase_data: data.phaseData || {},
      error_message: data.errorMessage,
      qualified: data.qualified,
      last_scraped_at: now,
      qualified_at: data.qualified ? now : null,
      updated_at: now,
    });
    return;
  }
  await db.query(
    `UPDATE lead_stores SET
      status = $2, current_phase = $3, platform = $4, country_code = $5, currency = $6,
      product_count = $7, product_count_range = $8, shopify_plus = $9, shopify_plus_confidence = $10,
      facebook_ads = $11, google_ads = $12, tiktok_ads = $13, pinterest_ads = $14,
      dropshipping_score = $15, pod_score = $16, active_score = $17, active_tier = $18,
      email_provider = $19, sms_provider = $20, review_app = $21, chat_provider = $22,
      phase_data = $23, error_message = $24, qualified = $25,
      last_scraped_at = NOW(), qualified_at = CASE WHEN $25 THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = $1`,
    [
      id,
      data.status,
      data.currentPhase ?? 10,
      data.platform,
      data.countryCode,
      data.currency,
      data.productCount,
      data.productCountRange,
      data.shopifyPlus ?? false,
      data.shopifyPlusConfidence,
      data.facebookAds ?? false,
      data.googleAds ?? false,
      data.tiktokAds ?? false,
      data.pinterestAds ?? false,
      data.dropshippingScore,
      data.podScore,
      data.activeScore,
      data.activeTier,
      data.emailProvider,
      data.smsProvider,
      data.reviewApp,
      data.chatProvider,
      JSON.stringify(data.phaseData || {}),
      data.errorMessage,
      data.qualified ?? false,
    ]
  );
}

export async function createScrapeJob() {
  const id = uuidv4();
  const db = getDb();
  if (!db) {
    memoryStore.leadScrapeJobs.unshift({
      id,
      status: 'running',
      urls_found: 0,
      stores_added: 0,
      session_json: null,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    return id;
  }
  await db.query(
    `INSERT INTO lead_scrape_jobs (id, status) VALUES ($1, 'running')`,
    [id]
  );
  return id;
}

export async function completeScrapeJob(id, { urlsFound, storesAdded, errorMessage, status = 'completed', session = null }) {
  const db = getDb();
  const sessionJson = session ? JSON.stringify(session) : null;
  if (!db) {
    const job = memoryStore.leadScrapeJobs.find((j) => j.id === id);
    if (job) {
      job.status = status;
      job.urls_found = urlsFound;
      job.stores_added = storesAdded;
      job.error_message = errorMessage;
      job.session_json = sessionJson;
      job.completed_at = new Date().toISOString();
    }
    return;
  }
  await db.query(
    `UPDATE lead_scrape_jobs SET status = $2, urls_found = $3, stores_added = $4,
     error_message = $5, completed_at = NOW(), session_json = COALESCE($6, session_json) WHERE id = $1`,
    [id, status, urlsFound, storesAdded, errorMessage, sessionJson]
  );
}

export async function updateScrapeJobSession(id, session, status = 'running') {
  const db = getDb();
  const sessionJson = JSON.stringify(session);
  if (!db) {
    const job = memoryStore.leadScrapeJobs.find((j) => j.id === id);
    if (job) {
      job.status = status;
      job.session_json = sessionJson;
      if (session.totalGenerated != null) job.urls_found = session.totalGenerated;
    }
    return;
  }
  await db.query(
    `UPDATE lead_scrape_jobs SET status = $2, session_json = $3,
     urls_found = COALESCE($4, urls_found) WHERE id = $1`,
    [id, status, sessionJson, session.totalGenerated ?? null]
  );
}

function mapScrapeJobRow(row) {
  if (!row) return null;
  let session = null;
  try {
    session = row.session_json ? JSON.parse(row.session_json) : null;
  } catch (_) {}
  return {
    id: row.id,
    status: row.status,
    urlsFound: row.urls_found,
    storesAdded: row.stores_added,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    session,
  };
}

export async function getScrapeJobById(id) {
  const db = getDb();
  if (!db) {
    const job = memoryStore.leadScrapeJobs.find((j) => j.id === id);
    if (!job) return null;
    return mapScrapeJobRow(job);
  }
  const res = await db.query(`SELECT * FROM lead_scrape_jobs WHERE id = $1`, [id]);
  return mapScrapeJobRow(res.rows[0]);
}

/** URLs that exist in lead_stores (any age). */
export async function findUrlsExistingInDb(urls) {
  const list = [...new Set((urls || []).filter(Boolean))];
  if (!list.length) return new Set();
  const db = getDb();
  if (!db) {
    const set = new Set();
    for (const u of list) {
      if (memoryStore.leadStores.some((s) => s.store_url === u)) set.add(u);
    }
    return set;
  }
  const res = await db.query(`SELECT store_url FROM lead_stores WHERE store_url = ANY($1::text[])`, [list]);
  return new Set((res.rows || []).map((r) => r.store_url));
}

/** URLs added to lead_stores within the last N days. */
export async function findUrlsInDbSince(urls, days = 7) {
  const list = [...new Set((urls || []).filter(Boolean))];
  if (!list.length) return new Set();
  const db = getDb();
  if (!db) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const set = new Set();
    for (const u of list) {
      const row = memoryStore.leadStores.find((s) => s.store_url === u);
      if (row && new Date(row.created_at).getTime() >= cutoff) set.add(u);
    }
    return set;
  }
  const res = await db.query(
    `SELECT store_url FROM lead_stores
     WHERE store_url = ANY($1::text[])
       AND created_at >= NOW() - ($2::int || ' days')::interval`,
    [list, days]
  );
  return new Set((res.rows || []).map((r) => r.store_url));
}

export async function getLatestScrapeJob() {
  const db = getDb();
  if (!db) {
    const job = memoryStore.leadScrapeJobs[0];
    return mapScrapeJobRow(job);
  }
  const res = await db.query(
    `SELECT * FROM lead_scrape_jobs ORDER BY created_at DESC LIMIT 1`
  );
  return mapScrapeJobRow(res.rows[0]);
}

function mapScrapeSettingsRow(row) {
  if (!row) {
    return {
      enabled: false,
      intervalMinutes: 0,
      lastRunAt: null,
      nextRunAt: null,
    };
  }
  return {
    enabled: Boolean(row.enabled),
    intervalMinutes: Number(row.interval_minutes) || 0,
    lastRunAt: row.last_run_at || null,
    nextRunAt: row.next_run_at || null,
  };
}

export async function getScrapeSettings() {
  const db = getDb();
  if (!db) {
    const s = memoryStore.leadScrapeSettings || {};
    return mapScrapeSettingsRow(s);
  }
  const res = await db.query(`SELECT * FROM lead_scrape_settings WHERE id = 'default' LIMIT 1`);
  return mapScrapeSettingsRow(res.rows[0]);
}

export async function saveScrapeSettings({ enabled, intervalMinutes, lastRunAt, nextRunAt }) {
  const db = getDb();
  const payload = {
    enabled: Boolean(enabled),
    interval_minutes: Math.max(0, Number(intervalMinutes) || 0),
    last_run_at: lastRunAt || null,
    next_run_at: nextRunAt || null,
    updated_at: new Date().toISOString(),
  };
  if (!db) {
    memoryStore.leadScrapeSettings = { id: 'default', ...payload };
    return mapScrapeSettingsRow(memoryStore.leadScrapeSettings);
  }
  await db.query(
    `INSERT INTO lead_scrape_settings (id, enabled, interval_minutes, last_run_at, next_run_at, updated_at)
     VALUES ('default', $1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interval_minutes = EXCLUDED.interval_minutes,
       last_run_at = COALESCE(EXCLUDED.last_run_at, lead_scrape_settings.last_run_at),
       next_run_at = EXCLUDED.next_run_at,
       updated_at = NOW()`,
    [payload.enabled, payload.interval_minutes, payload.last_run_at, payload.next_run_at]
  );
  return getScrapeSettings();
}

export async function updateLeadStoreTags(id, data) {
  const db = getDb();
  const now = new Date().toISOString();
  if (!db) {
    const s = memoryStore.leadStores.find((x) => x.id === id);
    if (!s) return;
    s.shopify_plus = data.shopifyPlus ?? s.shopify_plus;
    s.shopify_plus_confidence = data.shopifyPlusConfidence ?? s.shopify_plus_confidence;
    s.facebook_ads = data.facebookAds ?? s.facebook_ads;
    s.google_ads = data.googleAds ?? s.google_ads;
    s.tiktok_ads = data.tiktokAds ?? s.tiktok_ads;
    s.pinterest_ads = data.pinterestAds ?? s.pinterest_ads;
    s.dropshipping_score = data.dropshippingScore ?? s.dropshipping_score;
    s.pod_score = data.podScore ?? s.pod_score;
    s.phase_data = data.phaseData || s.phase_data || {};
    s.updated_at = now;
    return;
  }
  await db.query(
    `UPDATE lead_stores SET
      shopify_plus = $2, shopify_plus_confidence = $3,
      facebook_ads = $4, google_ads = $5, tiktok_ads = $6, pinterest_ads = $7,
      dropshipping_score = $8, pod_score = $9, phase_data = $10, updated_at = NOW()
    WHERE id = $1`,
    [
      id,
      data.shopifyPlus ?? false,
      data.shopifyPlusConfidence,
      data.facebookAds ?? false,
      data.googleAds ?? false,
      data.tiktokAds ?? false,
      data.pinterestAds ?? false,
      data.dropshippingScore,
      data.podScore,
      JSON.stringify(data.phaseData || {}),
    ]
  );
}

export async function updateLeadStoreCountry(id, { countryCode, phaseData }) {
  const db = getDb();
  if (!db) {
    const s = memoryStore.leadStores.find((x) => x.id === id);
    if (s) {
      s.country_code = countryCode;
      s.phase_data = phaseData || {};
      s.updated_at = new Date().toISOString();
    }
    return;
  }
  await db.query(
    `UPDATE lead_stores SET country_code = $2, phase_data = $3, updated_at = NOW() WHERE id = $1`,
    [id, countryCode, JSON.stringify(phaseData || {})]
  );
}

export async function getNextQualifiedStoreForCountryRefresh({ force = false } = {}) {
  const db = getDb();
  if (!db) {
    const store = memoryStore.leadStores.find((s) => {
      if (!s.qualified) return false;
      const pd = s.phase_data || {};
      if (force) return true;
      return !pd.countryClassifiedAt || s.country_code === 'XX';
    });
    return mapRow(store);
  }
  const where = force
    ? 'WHERE qualified = true'
    : `WHERE qualified = true AND (
        phase_data->>'countryClassifiedAt' IS NULL
        OR country_code = 'XX'
      )`;
  const res = await db.query(
    `SELECT * FROM lead_stores ${where} ORDER BY updated_at ASC LIMIT 1`
  );
  return mapRow(res.rows[0]);
}

export async function countQualifiedStoresNeedingCountryRefresh() {
  const db = getDb();
  if (!db) {
    return memoryStore.leadStores.filter(
      (s) => s.qualified && (!s.phase_data?.countryClassifiedAt || s.country_code === 'XX')
    ).length;
  }
  const res = await db.query(
    `SELECT COUNT(*)::int AS c FROM lead_stores WHERE qualified = true AND (
      phase_data->>'countryClassifiedAt' IS NULL OR country_code = 'XX'
    )`
  );
  return res.rows[0]?.c || 0;
}

export async function clearCountryClassificationForAllQualified() {
  const db = getDb();
  if (!db) {
    for (const s of memoryStore.leadStores) {
      if (!s.qualified || !s.phase_data) continue;
      delete s.phase_data.countryClassifiedAt;
    }
    return;
  }
  await db.query(`
    UPDATE lead_stores
    SET phase_data = phase_data - 'countryClassifiedAt', updated_at = NOW()
    WHERE qualified = true AND phase_data ? 'countryClassifiedAt'
  `);
}

export async function markCountryRefreshFailed(id, existingPhaseData, errorMessage) {
  const phaseData = {
    ...(existingPhaseData || {}),
    countryClassifiedAt: new Date().toISOString(),
    countryRefreshError: errorMessage,
  };
  const db = getDb();
  if (!db) {
    const s = memoryStore.leadStores.find((x) => x.id === id);
    if (s) s.phase_data = phaseData;
    return;
  }
  await db.query(
    `UPDATE lead_stores SET phase_data = $2, updated_at = NOW() WHERE id = $1`,
    [id, JSON.stringify(phaseData)]
  );
}

export async function getNextQualifiedStoreForTagRefresh({ force = false } = {}) {
  const db = getDb();
  if (!db) {
    const store = memoryStore.leadStores.find((s) => {
      if (!s.qualified) return false;
      const pd = s.phase_data || {};
      if (force) return true;
      return !pd.tagsClassifiedAt;
    });
    return mapRow(store);
  }
  const where = force
    ? 'WHERE qualified = true'
    : `WHERE qualified = true AND (phase_data->>'tagsClassifiedAt' IS NULL)`;
  const res = await db.query(
    `SELECT * FROM lead_stores ${where} ORDER BY updated_at ASC LIMIT 1`
  );
  return mapRow(res.rows[0]);
}

export async function countQualifiedStoresNeedingTagRefresh() {
  const db = getDb();
  if (!db) {
    return memoryStore.leadStores.filter((s) => s.qualified && !(s.phase_data || {}).tagsClassifiedAt).length;
  }
  const res = await db.query(
    `SELECT COUNT(*)::int AS c FROM lead_stores WHERE qualified = true AND (phase_data->>'tagsClassifiedAt' IS NULL)`
  );
  return res.rows[0]?.c || 0;
}

export async function clearTagClassificationForAllQualified() {
  const db = getDb();
  if (!db) {
    for (const s of memoryStore.leadStores) {
      if (!s.qualified || !s.phase_data) continue;
      delete s.phase_data.tagsClassifiedAt;
    }
    return;
  }
  await db.query(`
    UPDATE lead_stores
    SET phase_data = phase_data - 'tagsClassifiedAt', updated_at = NOW()
    WHERE qualified = true AND phase_data ? 'tagsClassifiedAt'
  `);
}

export async function markTagRefreshFailed(id, existingPhaseData, errorMessage) {
  const phaseData = {
    ...(existingPhaseData || {}),
    tagsClassifiedAt: new Date().toISOString(),
    tagsRefreshError: errorMessage,
  };
  const db = getDb();
  if (!db) {
    const s = memoryStore.leadStores.find((x) => x.id === id);
    if (s) s.phase_data = phaseData;
    return;
  }
  await db.query(
    `UPDATE lead_stores SET phase_data = $2, updated_at = NOW() WHERE id = $1`,
    [id, JSON.stringify(phaseData)]
  );
}

export function computeLeadStoreTags(store) {
  const summary = store.phaseData?.tags?.tag_summary;
  if (store.phaseData?.tagsClassifiedAt && Array.isArray(summary)) {
    const tags = [...new Set(summary)];
    if (tags.length === 0) tags.push('dropshipping');
    return tags;
  }
  const tags = [];
  if ((store.dropshippingScore ?? 0) >= 71) tags.push('dropshipping');
  if ((store.podScore ?? 0) >= 61) tags.push('print_on_demand');
  if (store.shopifyPlus || (store.shopifyPlusConfidence ?? 0) >= 70) tags.push('shopify_plus');
  const hasAds =
    store.facebookAds ||
    store.googleAds ||
    store.tiktokAds ||
    store.pinterestAds ||
    store.phaseData?.tags?.has_ads_running?.detected === true;
  if (hasAds) tags.push('has_ads');
  if (tags.length === 0) tags.push('dropshipping');
  return tags;
}

export function leadStoreToClientFormat(store) {
  const tags = computeLeadStoreTags(store);
  const platformMap = {
    shopify: 'Shopify',
    woocommerce: 'WooCommerce',
    wix: 'Wix',
    wordpress: 'WordPress',
  };
  return {
    id: store.id,
    storeUrl: store.storeUrl,
    platform: platformMap[store.platform?.toLowerCase()] || store.platform || 'Shopify',
    countryCode: store.countryCode || 'XX',
    currency: store.currency || 'USD',
    productCount: store.productCount ?? 0,
    tags,
    createdAt: store.qualifiedAt || store.createdAt,
  };
}
