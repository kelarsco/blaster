import { classifyStoreTags } from './storeTagClassifier.js';
import { updateLeadStoreTags, getLeadStoreByUrl } from './leadStoreRepository.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchText(url, timeout = 12000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return await res.text();
  } catch {
    return '';
  }
}

async function fetchProductsJson(origin) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${origin}/products.json?limit=50`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.products || [];
  } catch {
    return [];
  }
}

/**
 * Re-run tag classifier for one qualified store (no full pipeline / no re-reject).
 */
export async function reclassifyTagsForLeadStore(store) {
  const origin = store.storeUrl;
  let hostname = '';
  try {
    hostname = new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    throw new Error('Invalid store URL');
  }

  const homeHtml = await fetchText(`${origin}/`);
  const products = await fetchProductsJson(origin);

  const tagResult = await classifyStoreTags({
    origin,
    html: homeHtml,
    hostname,
    productCount: store.productCount ?? 0,
    platform: store.platform || 'shopify',
    products,
  });

  const phaseData = {
    ...(store.phaseData || {}),
    phase6: tagResult.phase6,
    phase7: tagResult.phase7,
    phase8: tagResult.phase8,
    phase9: tagResult.phase9,
    tags: tagResult.tagSchema,
    tagsClassifiedAt: new Date().toISOString(),
  };

  await updateLeadStoreTags(store.id, {
    facebookAds: tagResult.facebookAds,
    googleAds: tagResult.googleAds,
    tiktokAds: tagResult.tiktokAds,
    pinterestAds: tagResult.pinterestAds,
    shopifyPlus: tagResult.shopifyPlus,
    shopifyPlusConfidence: tagResult.shopifyPlusConfidence,
    dropshippingScore: tagResult.dropshippingScore,
    podScore: tagResult.podScore,
    phaseData,
  });

  return tagResult.tagSchema?.tag_summary || [];
}

export async function reclassifyTagsByUrl(storeUrl) {
  const store = await getLeadStoreByUrl(storeUrl);
  if (!store) throw new Error('Store not found');
  if (!store.qualified) throw new Error('Store is not qualified');
  return reclassifyTagsForLeadStore(store);
}
