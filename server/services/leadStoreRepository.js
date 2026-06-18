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
export async function listQualifiedStoresForClient(limit = 5000) {
  const db = getDb();
  if (!db) {
    return listLeadStores({ qualifiedOnly: true, limit }).map(leadStoreToClientFormat);
  }
  const res = await db.query(
    `SELECT id, store_url, platform, country_code, currency, product_count,
            qualified_at, created_at,
            facebook_ads, google_ads, tiktok_ads, pinterest_ads,
            dropshipping_score, pod_score, shopify_plus, shopify_plus_confidence,
            phase_data->'tags' AS tag_blob,
            phase_data->>'tagsClassifiedAt' AS tags_classified_at
     FROM lead_stores WHERE qualified = true
     ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map((row) =>
    leadStoreToClientFormat({
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
    })
  );
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

export async function completeScrapeJob(id, { urlsFound, storesAdded, errorMessage, status = 'completed' }) {
  const db = getDb();
  if (!db) {
    const job = memoryStore.leadScrapeJobs.find((j) => j.id === id);
    if (job) {
      job.status = status;
      job.urls_found = urlsFound;
      job.stores_added = storesAdded;
      job.error_message = errorMessage;
      job.completed_at = new Date().toISOString();
    }
    return;
  }
  await db.query(
    `UPDATE lead_scrape_jobs SET status = $2, urls_found = $3, stores_added = $4,
     error_message = $5, completed_at = NOW() WHERE id = $1`,
    [id, status, urlsFound, storesAdded, errorMessage]
  );
}

export async function getLatestScrapeJob() {
  const db = getDb();
  if (!db) {
    const job = memoryStore.leadScrapeJobs[0];
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      urlsFound: job.urls_found,
      storesAdded: job.stores_added,
      errorMessage: job.error_message,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    };
  }
  const res = await db.query(
    `SELECT * FROM lead_scrape_jobs ORDER BY created_at DESC LIMIT 1`
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    urlsFound: row.urls_found,
    storesAdded: row.stores_added,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
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
