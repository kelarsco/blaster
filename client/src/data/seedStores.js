import seedUrls from './seedStoreUrls.json';
import { PLATFORMS, STORE_TAGS, PRODUCT_COUNT_RANGES } from '../utils/storeLeadFilters.js';

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function normalizeUrl(raw) {
  const trimmed = String(raw || '').trim().toLowerCase();
  if (!trimmed) return null;
  const host = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!host) return null;
  return `https://${host}`;
}

function inferCountry(hostname) {
  const h = hostname.toLowerCase();
  if (h.endsWith('.com.mx') || h.endsWith('.mx')) return 'MX';
  if (h.endsWith('.ca')) return 'CA';
  if (h.endsWith('.com.br') || h.endsWith('.br')) return 'BR';
  if (h.endsWith('.de')) return 'DE';
  if (h.endsWith('.ar')) return 'AR';
  if (h.endsWith('.cl')) return 'CL';
  if (h.endsWith('.pl')) return 'PL';
  if (h.endsWith('.ec')) return 'EC';
  if (h.endsWith('.gt')) return 'GT';
  if (h.endsWith('.com.ec')) return 'EC';
  if (h.endsWith('.pr')) return 'PR';
  if (h.endsWith('.co') && !h.includes('shop') && !h.includes('store')) return 'CO';
  if (h.endsWith('.uk') || h.endsWith('.co.uk')) return 'GB';
  if (h.endsWith('.fr')) return 'FR';
  if (h.endsWith('.au')) return 'AU';
  return 'US';
}

const COUNTRY_CURRENCY = {
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP',
  CO: 'COP', GT: 'GTQ', EC: 'USD', DE: 'EUR', PL: 'PLN', FR: 'EUR',
  GB: 'GBP', AU: 'AUD', PR: 'USD',
};

function inferCurrency(countryCode) {
  return COUNTRY_CURRENCY[countryCode] || 'USD';
}

function pickProductCount(h) {
  const bucket = PRODUCT_COUNT_RANGES[h % PRODUCT_COUNT_RANGES.length];
  const span = bucket.max - bucket.min + 1;
  return bucket.min + (h % span);
}

function pickTags(h) {
  const tags = [];
  STORE_TAGS.forEach((tag, i) => {
    if ((h >> i) & 1) tags.push(tag.id);
  });
  if (tags.length === 0 && h % 3 === 0) tags.push(STORE_TAGS[0].id);
  return tags;
}

export function buildSeedStores() {
  const seen = new Set();
  const stores = [];

  for (const raw of seedUrls) {
    const storeUrl = normalizeUrl(raw);
    if (!storeUrl || seen.has(storeUrl)) continue;
    seen.add(storeUrl);

    let hostname;
    try {
      hostname = new URL(storeUrl).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }

    const h = hashStr(hostname);
    const countryCode = inferCountry(hostname);
    const daysAgo = h % 380;
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    stores.push({
      id: hostname,
      storeUrl,
      platform: PLATFORMS[h % PLATFORMS.length],
      countryCode,
      currency: inferCurrency(countryCode),
      productCount: pickProductCount(h),
      tags: pickTags(h),
      createdAt: createdAt.toISOString(),
    });
  }

  return stores;
}

export const SEED_LEAD_STORES = buildSeedStores();
