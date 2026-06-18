/**
 * Evidence-based store tag classification (dropshipping, POD, Shopify Plus, ads).
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const DROPSHIPPING_THRESHOLD = 71;
export const POD_THRESHOLD = 61;
export const SHOPIFY_PLUS_THRESHOLD = 70;

const CONFIDENCE_RANK = { none: 0, low: 1, medium: 2, high: 3, very_high: 4 };

function htmlLower(html) {
  return (html || '').toLowerCase();
}

function includesAny(html, patterns) {
  const lower = htmlLower(html);
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

function countPhraseMatches(html, phrases) {
  const lower = htmlLower(html);
  return phrases.filter((p) => lower.includes(p.toLowerCase())).length;
}

async function fetchPageText(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return await res.text();
  } catch {
    return '';
  }
}

async function buildTagCorpus(origin, homeHtml) {
  let corpus = homeHtml || '';
  const paths = ['/policies/shipping-policy', '/policies/refund-policy', '/pages/about'];
  const base = originsToTry(origin)[0];
  const chunks = await Promise.all(
    paths.map((path) => fetchPageText(`${base}${path}`, 6000))
  );
  for (const chunk of chunks) {
    if (chunk) corpus += chunk;
  }
  return corpus;
}

function originsToTry(origin) {
  const origins = [origin];
  try {
    const host = new URL(origin).hostname;
    if (!host.startsWith('www.')) origins.push(`https://www.${host}`);
  } catch (_) {}
  return [...new Set(origins)];
}

function rankConfidence(current, next) {
  return CONFIDENCE_RANK[next] > CONFIDENCE_RANK[current] ? next : current;
}

function platformAdConfidence({ pixel, init, track, purchase }) {
  if (purchase || track) return 'high';
  if (pixel || init) return 'medium';
  return 'none';
}

export function classifyAds(html) {
  const signals = [];
  const lower = htmlLower(html);

  const facebook = {
    pixel: includesAny(html, ['connect.facebook.net', 'fbevents.js']),
    init: includesAny(html, ['fbq(\'init\'', 'fbq("init"', 'fbq(`init`', "fbq('init", 'fbq("init']),
    track: includesAny(html, [
      'fbq(\'track\'', 'fbq("track\'', 'fbq(`track`', "fbq('track", 'fbq("track',
      'fbq(\'track', 'fbq("track',
    ]),
    purchase: includesAny(html, ['fbq(\'track\', \'purchase\'', 'fbq("track", "purchase"', 'fbq(\'track\', \'addtocart\'']),
  };
  const google = {
    gtm: includesAny(html, ['googletagmanager.com/gtm.js', 'googletagmanager.com']),
    adsConfig: /gtag\s*\(\s*['"]config['"]\s*,\s*['"]AW-/i.test(html) || includesAny(html, ['googlesyndication.com']),
    track: includesAny(html, ['gtag(\'event\'', 'gtag("event\'', 'gtag(`event`']),
    purchase: includesAny(html, ['gtag(\'event\', \'purchase\'', 'gtag("event", "purchase"']),
  };
  const tiktok = {
    pixel: includesAny(html, ['analytics.tiktok.com', 'tiktok.com/i18n/pixel']),
    init: includesAny(html, ['ttq.load(', 'ttq.load (']),
    track: includesAny(html, ['ttq.track(', 'ttq.track (']),
    identify: includesAny(html, ['ttq.identify(']),
  };
  const pinterest = {
    pixel: includesAny(html, ['ct.pinterest.com', 'pintrk(']),
    load: includesAny(html, ['pintrk(\'load\'', 'pintrk("load\'', "pintrk('load"]),
    track: includesAny(html, ['pintrk(\'track\'', 'pintrk("track\'', "pintrk('track"]),
    checkout: includesAny(html, ['pintrk(\'track\', \'checkout\'', 'pintrk("track", "checkout"']),
  };
  const snapchat = {
    pixel: includesAny(html, ['sc-static.net/scevent.min.js', 'snaptr(']),
    init: includesAny(html, ['snaptr(\'init\'', 'snaptr("init\'']),
    purchase: includesAny(html, ['snaptr(\'track\', \'purchase\'', 'snaptr("track", "purchase"']),
  };
  const microsoft = {
    pixel: includesAny(html, ['bat.bing.com/bat.js', 'bat.bing.com']),
    track: includesAny(html, ['uetq.push(']),
  };
  const twitter = {
    pixel: includesAny(html, ['static.ads-twitter.com/uwt.js', 'static.ads-twitter.com']),
    track: includesAny(html, ['twq(\'track\'', 'twq("track\'', "twq('track"]),
  };

  const platformMeta = {
    facebook: { ...facebook, confidence: platformAdConfidence({ pixel: facebook.pixel, init: facebook.init, track: facebook.track, purchase: facebook.purchase }) },
    google: {
      ...google,
      confidence: google.purchase || google.adsConfig
        ? 'high'
        : google.track && google.gtm
          ? 'high'
          : google.gtm || google.adsConfig
            ? google.track
              ? 'high'
              : 'medium'
            : 'none',
    },
    tiktok: { ...tiktok, confidence: platformAdConfidence({ pixel: tiktok.pixel, init: tiktok.init, track: tiktok.track, purchase: tiktok.track }) },
    pinterest: {
      ...pinterest,
      confidence: pinterest.checkout || pinterest.track ? 'high' : pinterest.pixel || pinterest.load ? 'medium' : 'none',
    },
    snapchat: { confidence: snapchat.purchase ? 'high' : snapchat.pixel ? 'medium' : 'none', ...snapchat },
    microsoft_bing: { confidence: microsoft.track ? 'high' : microsoft.pixel ? 'medium' : 'none', ...microsoft },
    twitter_x: { confidence: twitter.track ? 'high' : twitter.pixel ? 'medium' : 'none', ...twitter },
  };

  for (const [name, meta] of Object.entries(platformMeta)) {
    if (meta.confidence !== 'none') signals.push(`${name}_${meta.confidence}`);
    if (meta.purchase || meta.checkout) signals.push(`${name}_conversion_tracking`);
    if (meta.track) signals.push(`${name}_event_tracking`);
    if (meta.pixel || meta.gtm) signals.push(`${name}_pixel_installed`);
  }

  if (includesAny(html, ['utm_source=facebook', 'utm_medium=paid', 'utm_source=tiktok', 'utm_source=google'])) {
    signals.push('utm_campaign_params');
  }
  if (includesAny(html, ['fb10', 'tiktok15', 'insta20', '/pages/facebook', '/pages/tiktok'])) {
    signals.push('platform_campaign_evidence');
  }

  let overallConfidence = 'none';
  const activePlatforms = [];
  for (const [name, meta] of Object.entries(platformMeta)) {
    overallConfidence = rankConfidence(overallConfidence, meta.confidence);
    if (CONFIDENCE_RANK[meta.confidence] >= CONFIDENCE_RANK.medium) {
      activePlatforms.push(name);
    }
  }

  const gtmOnly =
    google.gtm &&
    !google.adsConfig &&
    !google.purchase &&
    !facebook.track &&
    !tiktok.track &&
    activePlatforms.length === 0;
  if (gtmOnly) {
    overallConfidence = 'low';
    signals.push('gtm_only_no_ad_tags');
  }

  const anyAdsRunning = CONFIDENCE_RANK[overallConfidence] >= CONFIDENCE_RANK.medium;

  return {
    facebookAds: CONFIDENCE_RANK[platformMeta.facebook.confidence] >= CONFIDENCE_RANK.medium,
    googleAds: CONFIDENCE_RANK[platformMeta.google.confidence] >= CONFIDENCE_RANK.medium,
    tiktokAds: CONFIDENCE_RANK[platformMeta.tiktok.confidence] >= CONFIDENCE_RANK.medium,
    pinterestAds: CONFIDENCE_RANK[platformMeta.pinterest.confidence] >= CONFIDENCE_RANK.medium,
    adsDetail: {
      platforms: {
        facebook: platformMeta.facebook.confidence !== 'none',
        google: platformMeta.google.confidence !== 'none',
        tiktok: platformMeta.tiktok.confidence !== 'none',
        pinterest: platformMeta.pinterest.confidence !== 'none',
        snapchat: platformMeta.snapchat.confidence !== 'none',
        microsoft_bing: platformMeta.microsoft_bing.confidence !== 'none',
        twitter_x: platformMeta.twitter_x.confidence !== 'none',
      },
      platform_confidence: Object.fromEntries(
        Object.entries(platformMeta).map(([k, v]) => [k, v.confidence])
      ),
      active_platforms: activePlatforms,
      confidence: overallConfidence,
      any_ads_running: anyAdsRunning,
      signals,
    },
  };
}

export function classifyShopifyPlus(html, { hostname = '', productCount = 0, platform = '' } = {}) {
  const signals = [];
  let confidence = 0;

  if (platform !== 'shopify') {
    return { shopifyPlus: false, confidence: 0, signals };
  }

  const hostBase = hostname.replace(/^www\./, '').split('.')[0];
  if (hostBase && includesAny(html, [`checkout.${hostBase}`, `checkout.${hostname}`])) {
    confidence = Math.max(confidence, 95);
    signals.push('custom_checkout_domain');
  }
  if (includesAny(html, ['shopify_plus', 'shopify.plus', 'shopify plus'])) {
    confidence = Math.max(confidence, 90);
    signals.push('shopify_plus_in_source');
  }
  if (includesAny(html, ['launchpad', 'shopify-flow', 'shopify flow', 'checkout extensibility'])) {
    confidence = Math.max(confidence, 85);
    signals.push('launchpad_or_flow');
  }
  if (includesAny(html, ['checkout.liquid', 'shopify scripts'])) {
    confidence = Math.max(confidence, 80);
    signals.push('plus_checkout_scripts');
  }
  if (includesAny(html, ['/b2b', 'wholesale.', 'wholesale/', 'expansion store'])) {
    confidence = Math.max(confidence, 70);
    signals.push('b2b_wholesale_signals');
  }

  const enterpriseApps = [
    'rechargeapps.com',
    'triplewhale.com',
    'gorgias.com',
    'loopreturns.com',
    'okendo.io',
    'avalara.com',
    'netsuite',
    'shipbob.com',
  ];
  let enterpriseCount = 0;
  for (const app of enterpriseApps) {
    if (htmlLower(html).includes(app)) {
      enterpriseCount++;
      signals.push(`enterprise_app_${app.split('.')[0]}`);
    }
  }
  if (enterpriseCount >= 3 && productCount >= 1000) {
    confidence = Math.max(confidence, 75);
    signals.push('enterprise_app_stack');
  }
  if (includesAny(html, ['plus.shopify'])) {
    confidence = Math.max(confidence, 72);
    signals.push('plus_shopify_reference');
  }

  confidence = Math.min(100, confidence);
  const shopifyPlus = confidence >= SHOPIFY_PLUS_THRESHOLD;

  return { shopifyPlus, confidence, signals };
}

function analyzeProductCatalog(products = []) {
  const insights = {
    genericTitleRatio: 0,
    uniformEndingPrices: false,
    shipsFromVariant: false,
    duplicateDescriptions: false,
    podProductHits: 0,
  };
  if (!products.length) return insights;

  const genericPatterns = [
    /^\d+\s*(mAh|mm|cm|inch|oz)/i,
    /portable|rechargeable|multifunction|magic cleaning|mini fan|led strip/i,
    /women\s+casual|men\s+casual|unisex/i,
  ];
  let genericCount = 0;
  const descriptions = [];
  const prices = [];

  for (const p of products) {
    const title = p.title || '';
    if (genericPatterns.some((re) => re.test(title))) genericCount++;

    const body = (p.body_html || '').replace(/<[^>]+>/g, ' ').trim();
    if (body.length > 40) descriptions.push(body.slice(0, 200));

    for (const opt of p.options || []) {
      if (/ships from/i.test(opt.name || '')) insights.shipsFromVariant = true;
    }
    for (const v of p.variants || []) {
      if (v.price) prices.push(String(v.price));
    }
  }

  insights.genericTitleRatio = genericCount / products.length;
  if (prices.length >= 5) {
    const endings = prices.map((pr) => {
      const n = parseFloat(pr);
      if (Number.isNaN(n)) return null;
      const cents = Math.round((n % 1) * 100);
      return cents;
    });
    const valid = endings.filter((e) => e !== null);
    if (valid.length >= 5 && valid.every((e) => e === 99 || e === 95)) {
      insights.uniformEndingPrices = true;
    }
  }

  if (descriptions.length >= 3) {
    const unique = new Set(descriptions);
    if (unique.size < descriptions.length * 0.7) insights.duplicateDescriptions = true;
  }

  const podKeywords = ['t-shirt', 'hoodie', 'sweatshirt', 'mug', 'tote bag', 'canvas print', 'phone case', 'poster', 'pillow', 'blanket', 'tank top', 'beanie'];
  const combined = products.map((p) => `${p.title} ${p.body_html || ''}`).join(' ').toLowerCase();
  insights.podProductHits = podKeywords.filter((k) => combined.includes(k)).length;

  return insights;
}

export function classifyDropshipping(html, products = []) {
  const signals = [];
  let score = 0;

  const supplierFingerprints = [
    ['dsers.com', 'dsers'],
    ['autods.com', 'autods'],
    ['zendrop.com', 'zendrop'],
    ['spocket.co', 'spocket'],
    ['cjdropshipping.com', 'cj dropshipping'],
    ['oberlo'],
    ['aliscraper'],
    ['dropified.com', 'dropified'],
  ];
  for (const patterns of supplierFingerprints) {
    if (includesAny(html, patterns)) {
      score += 40;
      signals.push(`supplier_app_${patterns[0]}`);
      break;
    }
  }

  const shippingPhrases = [
    'ships from china',
    'ships from overseas',
    'ships from overseas warehouse',
    '7-15 business days',
    '7–15 business days',
    '10-20 business days',
    '15-30 business days',
    '2-4 weeks',
    '2–4 weeks',
    'processing time: 3-7 days',
    'processing time: 3–7 days',
    'ship directly from our supplier',
    'shipping may take longer',
    'due to high demand, shipping may take longer',
    'estimated delivery: 2-4 weeks',
  ];
  const shippingHits = countPhraseMatches(html, shippingPhrases);
  if (shippingHits >= 2) {
    score += 25;
    signals.push('shipping_language_multiple');
  } else if (shippingHits === 1) {
    score += 12;
    signals.push('shipping_language');
  }

  if (includesAny(html, ['aliexpress', 'temu', 'alibaba', 'dhgate'])) {
    score += 10;
    signals.push('supplier_marketplace_reference');
  }

  const catalog = analyzeProductCatalog(products);
  if (catalog.shipsFromVariant) {
    score += 15;
    signals.push('ships_from_variant');
  }
  if (catalog.genericTitleRatio >= 0.3) {
    score += 15;
    signals.push('generic_product_titles');
  }
  if (catalog.duplicateDescriptions) {
    score += 10;
    signals.push('duplicate_supplier_descriptions');
  }
  if (catalog.uniformEndingPrices) {
    score += 10;
    signals.push('uniform_pricing_pattern');
  }

  if (includesAny(html, ['portable usb', 'magic cleaning', 'mini fan', 'led strip'])) {
    score += 10;
    signals.push('generic_niche_products');
  }
  if (includesAny(html, ['ships from', 'color', 'size', 'variant'])) {
    score += 5;
    signals.push('variant_structure');
  }

  const weakBrand =
    !includesAny(html, ['about us', 'our story', 'founded in', 'we started', '/pages/about']) ||
    includesAny(html, ['passionate about quality', 'we are passionate about']);
  if (weakBrand) {
    score += 10;
    signals.push('weak_brand_presence');
  }

  score = Math.min(100, score);
  const detected = score >= DROPSHIPPING_THRESHOLD;

  return { dropshippingScore: score, detected, signals };
}

export function classifyPod(html, products = []) {
  const signals = [];
  let score = 0;

  const providers = [
    ['printful.com', 'printful'],
    ['printify.com', 'printify'],
    ['gelato.com', 'gelato'],
    ['gooten.com', 'gooten'],
    ['spod.com', 'spod'],
    ['teelaunch.com', 'teelaunch'],
    ['customcat.com', 'customcat'],
    ['apliiq.com', 'apliiq'],
    ['prodigi.com', 'prodigi'],
    ['awkwardstyles.com'],
  ];
  for (const patterns of providers) {
    if (includesAny(html, patterns)) {
      score += 40;
      signals.push(`pod_provider_${patterns[0]}`);
      break;
    }
  }

  const fulfillmentPhrases = [
    'made to order',
    'printed on demand',
    'printed just for you',
    'each item is printed',
    'production time: 3-5 business days',
    'allow 5-7 days for production',
    'produced on demand',
    'unique and produced on demand',
    'color variations may occur',
    'slight color variations',
  ];
  const fulfillHits = countPhraseMatches(html, fulfillmentPhrases);
  if (fulfillHits >= 2) {
    score += 25;
    signals.push('pod_fulfillment_language');
  } else if (fulfillHits === 1) {
    score += 12;
    signals.push('pod_fulfillment_language_single');
  }

  const personalizePhrases = [
    'add your name',
    'add name',
    'customize this product',
    'upload your photo',
    'upload photo',
    'personalize it',
    'personalize',
    'choose your design',
    'custom text',
  ];
  if (includesAny(html, personalizePhrases)) {
    score += 20;
    signals.push('personalization_options');
  }

  const catalog = analyzeProductCatalog(products);
  if (catalog.podProductHits >= 3) {
    score += 15;
    signals.push('pod_product_categories');
  }

  const returnPhrases = [
    'cannot accept returns on personalized',
    'print-on-demand, we cannot accept returns',
    'due to the nature of print-on-demand',
    'color may vary slightly',
    'color may vary slightly from what is shown',
  ];
  if (includesAny(html, returnPhrases)) {
    score += 10;
    signals.push('pod_return_policy');
  }

  if (includesAny(html, ['dog lover', 'nurse life', 'perfect gift for', 'collection'])) {
    score += 8;
    signals.push('niche_design_collections');
  }

  score = Math.min(100, score);
  const detected = score >= POD_THRESHOLD;

  return { podScore: score, detected, signals };
}

export function buildTagOutputSchema(storeUrl, dropship, pod, plus, ads) {
  const tagSummary = [];
  if (dropship.detected) tagSummary.push('dropshipping');
  if (pod.detected) tagSummary.push('print_on_demand');
  if (plus.shopifyPlus) tagSummary.push('shopify_plus');
  if (ads.adsDetail.any_ads_running) tagSummary.push('has_ads');

  const schema = {
    store_url: storeUrl,
    tags: {
      dropshipping: {
        detected: dropship.detected,
        score: dropship.dropshippingScore,
        signals: dropship.signals,
      },
      print_on_demand: {
        detected: pod.detected,
        score: pod.podScore,
        signals: pod.signals,
      },
      shopify_plus: {
        detected: plus.shopifyPlus,
        confidence: plus.confidence,
        signals: plus.signals,
      },
      has_ads_running: {
        detected: ads.adsDetail.any_ads_running,
        platforms: ads.adsDetail.active_platforms,
        confidence: ads.adsDetail.confidence,
        signals: ads.adsDetail.signals,
      },
    },
    tag_summary: tagSummary,
  };

  return applyDefaultDropshippingTag(schema, dropship);
}

/** Stores with no detected tags are treated as dropshipping (default category). */
export function applyDefaultDropshippingTag(schema, dropship = {}) {
  if (!schema?.tag_summary?.length) {
    const score = Math.max(dropship.dropshippingScore ?? 0, DROPSHIPPING_THRESHOLD);
    schema.tag_summary = ['dropshipping'];
    schema.tags.dropshipping = {
      detected: true,
      score,
      signals: [...(dropship.signals || []), 'default_uncategorized_store'],
    };
  }
  return schema;
}

/**
 * Full tag classification using homepage + policy pages + product sample.
 */
export async function classifyStoreTags({
  origin,
  html,
  hostname,
  productCount = 0,
  platform = '',
  products = [],
}) {
  const corpus = await buildTagCorpus(origin, html);
  const ads = classifyAds(corpus);
  const plus = classifyShopifyPlus(corpus, { hostname, productCount, platform });
  const dropship = classifyDropshipping(corpus, products);
  const pod = classifyPod(corpus, products);
  const tagSchema = buildTagOutputSchema(origin, dropship, pod, plus, ads);

  return {
    facebookAds: ads.facebookAds,
    googleAds: ads.googleAds,
    tiktokAds: ads.tiktokAds,
    pinterestAds: ads.pinterestAds,
    shopifyPlus: plus.shopifyPlus,
    shopifyPlusConfidence: plus.confidence,
    dropshippingScore: tagSchema.tags.dropshipping.score,
    podScore: pod.podScore,
    phase6: { ...ads.adsDetail, facebookAds: ads.facebookAds, googleAds: ads.googleAds, tiktokAds: ads.tiktokAds, pinterestAds: ads.pinterestAds },
    phase7: plus,
    phase8: dropship,
    phase9: pod,
    tagSchema,
  };
}
