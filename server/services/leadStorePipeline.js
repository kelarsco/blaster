import { fetchHtml, normalizeStoreUrl } from './crawler.js';
import { classifyStoreTags } from './storeTagClassifier.js';
import { detectStoreCountry } from './storeCountryDetector.js';
import { yieldToUserWorkload } from './resourceCoordinator.js';
import { withCrawlSlot } from './crawlLimiter.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const UA_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
};

const ACTIVE_SCORE_THRESHOLD = 21;

async function fetchJson(url, timeout = 15000) {
  await yieldToUserWorkload();
  return withCrawlSlot(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { headers: UA_HEADERS, signal: controller.signal, redirect: 'follow' });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  });
}

async function fetchPageText(url, timeout = 15000) {
  await yieldToUserWorkload();
  return withCrawlSlot(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { headers: UA_HEADERS, signal: controller.signal, redirect: 'follow' });
      clearTimeout(timer);
      const html = await res.text();
      return { ok: res.ok, statusCode: res.status, html };
    } catch {
      return { ok: false, statusCode: 0, html: '' };
    }
  });
}

function originsToTry(origin) {
  const origins = [origin];
  try {
    const host = new URL(origin).hostname;
    if (!host.startsWith('www.')) origins.push(`https://www.${host}`);
    else origins.push(`https://${host.replace(/^www\./, '')}`);
  } catch (_) {}
  return [...new Set(origins)];
}

function isShopifyProductsPayload(data) {
  return Array.isArray(data?.products) && data.products.some((p) => p?.title || p?.variants);
}

function isShopifyCartPayload(data) {
  return Boolean(
    data &&
      (data.token !== undefined ||
        data.currency ||
        Array.isArray(data.items) ||
        data.item_count !== undefined)
  );
}

/** Try apex + www; merge best HTML response (fetch API tolerates more bot responses than raw http). */
async function fetchStoreHomepage(origin) {
  const urls = [];
  for (const base of originsToTry(origin)) {
    urls.push(`${base}/`);
  }

  let best = { ok: false, statusCode: 0, html: '' };
  for (const url of urls) {
    const [httpRes, fetchRes] = await Promise.all([fetchHtml(url, { timeout: 15000 }), fetchPageText(url)]);
    for (const res of [fetchRes, httpRes]) {
      const html = res.html || '';
      if (html.length > (best.html?.length || 0)) {
        best = {
          ok: res.ok || html.length > 1500,
          statusCode: res.statusCode,
          html,
        };
      }
    }
    if (best.html.length > 5000) break;
  }
  return best;
}

/** Shopify & ecommerce availability probes (work when homepage is blocked). */
async function probeLiveCatalogForOrigin(origin) {
  const [productsPage, collectionsPage, cart, meta, allProductsPage] = await Promise.all([
    fetchJson(`${origin}/products.json?limit=5`),
    fetchJson(`${origin}/collections.json?limit=5`),
    fetchJson(`${origin}/cart.js`),
    fetchJson(`${origin}/meta.json`),
    fetchJson(`${origin}/collections/all/products.json?limit=5`),
  ]);

  const productCount =
    (productsPage?.products?.length ?? 0) + (allProductsPage?.products?.length ?? 0);
  const collectionCount = collectionsPage?.collections?.length ?? 0;
  const hasProducts = isShopifyProductsPayload(productsPage) || isShopifyProductsPayload(allProductsPage);
  const hasCollections = collectionCount > 0;
  const liveCatalog = hasProducts || hasCollections;
  const cartAccessible = isShopifyCartPayload(cart);
  const isShopify =
    hasProducts ||
    hasCollections ||
    Boolean(meta?.id) ||
    cartAccessible ||
    Boolean(meta?.name);

  return {
    hasProducts,
    hasCollections,
    liveCatalog,
    cartAccessible,
    isShopify,
    productSampleCount: productCount,
    currency: cart?.currency || null,
    productsPage,
    collectionsPage,
    cart,
    origin,
  };
}

async function probeLiveCatalog(origin) {
  const probes = await Promise.all(originsToTry(origin).map((o) => probeLiveCatalogForOrigin(o)));
  const ranked = [...probes].sort((a, b) => {
    const score = (p) =>
      (p.liveCatalog ? 100 : 0) +
      (p.cartAccessible ? 50 : 0) +
      (p.isShopify ? 25 : 0) +
      p.productSampleCount;
    return score(b) - score(a);
  });
  return ranked[0] || {
    hasProducts: false,
    hasCollections: false,
    liveCatalog: false,
    cartAccessible: false,
    isShopify: false,
    productSampleCount: 0,
    currency: null,
  };
}

function htmlIncludes(html, patterns) {
  const lower = (html || '').toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

function detectProvider(html, map) {
  const lower = (html || '').toLowerCase();
  for (const [name, patterns] of Object.entries(map)) {
    if (patterns.some((p) => lower.includes(p))) return name;
  }
  return null;
}

function productCountRange(count) {
  if (count <= 50) return 'Small';
  if (count <= 200) return 'Medium';
  if (count <= 1000) return 'Large';
  return 'Enterprise';
}

async function countShopifyProducts(origin) {
  let page = 1;
  let total = 0;
  const bases = originsToTry(origin);
  for (const base of bases) {
    page = 1;
    total = 0;
    while (page <= 15) {
      const data = await fetchJson(`${base}/products.json?limit=250&page=${page}`);
      if (!data?.products?.length) break;
      total += data.products.length;
      if (data.products.length < 250) break;
      page += 1;
    }
    if (total > 0) return { count: total };
  }
  return { count: total };
}

/**
 * True password gate only — NOT Shopify JS bundle references to storefront_password.
 * Public Shopify stores embed storefront_password in scripts while selling normally.
 */
function isPasswordProtectedPage(html, catalogProbe = {}) {
  if (catalogProbe.liveCatalog) return false;
  const lower = (html || '').toLowerCase();
  const hasPasswordField =
    lower.includes('type="password"') || lower.includes("type='password'");
  const hasEnterStore =
    lower.includes('enter store password') ||
    lower.includes('enter using password') ||
    lower.includes('log in to enter the store');
  if (hasPasswordField && hasEnterStore) return true;
  if (lower.includes('this store is protected') && lower.includes('password') && !catalogProbe.hasProducts) {
    return true;
  }
  return false;
}

function isParkedDomainPage(html, catalogProbe = {}) {
  if (catalogProbe.liveCatalog) return false;
  if (!html || html.length < 200) return false;
  const lower = html.toLowerCase();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || '').toLowerCase().trim();
  if (title.includes('domain parked') || title.includes('parked domain')) return true;
  if (title === 'coming soon' && html.length < 4000) return true;
  if (lower.includes('this domain is for sale') || lower.includes('buy this domain')) return true;
  return false;
}

function phase1ActiveScore(html, statusOk, extras = {}) {
  let score = 0;
  const signals = {};

  if (extras.liveCatalog) {
    score += 30;
    signals.liveCatalog = true;
  }
  if (extras.hasProducts) {
    score += 25;
    signals.hasProducts = true;
  }
  if (extras.hasCollections) {
    score += 10;
    signals.hasCollections = true;
  }
  if (extras.cartAccessible) {
    score += 10;
    signals.cartAccessible = true;
  }
  if (extras.isShopify) {
    score += 15;
    signals.shopifyDetected = true;
  }
  if (extras.shrineTheme) {
    score += 15;
    signals.shrineTheme = true;
  }

  if (html && isPasswordProtectedPage(html, extras)) {
    return {
      score: 0,
      tier: 'Inactive',
      signals: { passwordProtected: true },
      rejected: true,
      errorMessage: 'Store is password protected',
    };
  }

  if (html && isParkedDomainPage(html, extras)) {
    return {
      score: 0,
      tier: 'Inactive',
      signals: { parked: true },
      rejected: true,
      errorMessage: 'Domain appears parked or not a live store',
    };
  }

  if (statusOk) {
    signals.urlOk = true;
    score += 10;
  } else if (!extras.liveCatalog && !(html && html.length > 2000)) {
    score += 0;
  } else {
    signals.urlFallback = true;
    score += 15;
  }

  // Contact & policies
  if (htmlIncludes(html, ['@', 'contact', 'contacto', 'mailto:', 'phone', 'tel:', 'whatsapp', 'customer service'])) {
    score += 5;
    signals.contactPresent = true;
  }
  if (htmlIncludes(html, ['privacy policy', 'politica de privacidad', 'refund policy', 'terms of service', 'términos'])) {
    score += 5;
    signals.policies = true;
  }

  // Product / cart signals (EN + ES + common Shopify / custom themes)
  if (htmlIncludes(html, [
    'add to cart', 'añadir al carrito', 'agregar al carrito', 'carrito',
    'check out', 'checkout', 'comprar', 'shop now', 'shop all', 'view cart',
    'buy it now', 'continue shopping', 'add to bag', 'view product',
    'featured products', 'featured collection', 'browse our latest',
    'precio de oferta', 'precio habitual', 'regular price', 'sale price',
    'unit price / per', 'unit price', '/products/', '/collections/', 'sold out', 'agotado',
    'item added to your cart', 'your cart is empty',
  ])) {
    score += 10;
    signals.commerceUi = true;
  }

  if (htmlIncludes(html, [
    'powered by shopify', 'cdn.shopify.com', 'cdn.shopifycdn.net', 'shopify.theme',
    'myshopify.com', 'shop.app', 'shopify-features', 'shopify-section',
    'data-shopify', 'shopifyanalytics', 'shopify.pay', 'shop-pay', 'shop pay',
    'shopify-payment', 'shopifycdn',
  ])) {
    score += 10;
    signals.shopifyMarker = true;
  }
  // Shrine is a popular Shopify theme (e.g. feranoinc.com shows "Powered by Shrine")
  if (htmlIncludes(html, ['powered by shrine', 'shrine-theme', 'shrine theme', 'shrine.shop'])) {
    score += 10;
    signals.shrineMarker = true;
  }
  if (htmlIncludes(html, ['debutify', 'judge.me', 'loox', 'yotpo', 'reconvert', 'vitals'])) {
    score += 5;
    signals.reviewApp = true;
  }

  if (htmlIncludes(html, ['black friday', 'summer collection', 'flash sale', 'limited time', 'solo por hoy', 'promocion', 'promoción', 'envío gratis', 'envios gratis'])) {
    score += 10;
    signals.campaign = true;
  }
  if (htmlIncludes(html, ['klaviyo', 'mailchimp', 'omnisend', 'privy', 'brevo'])) {
    score += 10;
    signals.emailMarketing = true;
  }
  if (htmlIncludes(html, ['get 10% off', 'newsletter', 'exit-intent', 'join our', 'exclusive deals', 'subscribe to our emails', 'sign up'])) {
    score += 5;
    signals.popup = true;
  }
  if (htmlIncludes(html, ['postscript', 'attentive', 'smsbump'])) {
    score += 5;
    signals.sms = true;
  }
  if (htmlIncludes(html, ['connect.facebook.net', 'fbq(', 'googletagmanager.com', 'gtag(', 'analytics.tiktok.com', 'ttq.track', 'ttq(', 'pintrk', 'paypal'])) {
    score += 15;
    signals.adsOrPayments = true;
  }
  if (htmlIncludes(html, [
    'american express', 'apple pay', 'google pay', 'shop pay', 'payment methods',
    'mastercard', 'visa', 'discover', 'afterpay', 'klarna',
  ])) {
    score += 10;
    signals.paymentMethods = true;
  }
  if (htmlIncludes(html, ['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'pinterest.com'])) {
    score += 5;
    signals.socialLinks = true;
  }
  if (htmlIncludes(html, ['/sitemap.xml', 'application/ld+json', 'robots.txt', 'schema.org'])) {
    score += 5;
    signals.seo = true;
  }
  if (htmlIncludes(html, ['tidio', 'zendesk', 'crisp', 'gorgias', 'intercom', 'live chat', 'servicio al cliente'])) {
    score += 5;
    signals.chat = true;
  }
  if (htmlIncludes(html, ['recharge', 'loop returns', 'triple whale', 'okendo'])) {
    score += 10;
    signals.premiumApps = true;
  }
  if (htmlIncludes(html, ['verified', 'total reviews', 'ha comprado', 'reviews', 'verified reviews'])) {
    score += 5;
    signals.socialProof = true;
  }

  const year = new Date().getFullYear();
  if (htmlIncludes(html, [`© ${year}`, `copyright ${year}`, `copyright © ${year}`])) {
    score += 5;
    signals.currentCopyright = true;
  }
  if (htmlIncludes(html, ['summer20', 'save15', 'flashsale', 'coupon', '% off', 'ahorra'])) {
    score += 10;
    signals.discountCampaign = true;
  }

  score = Math.min(100, score);

  // Live catalog API is definitive proof of an active store (Shopify products.json / collections.json)
  if (extras.liveCatalog) {
    score = Math.max(score, ACTIVE_SCORE_THRESHOLD);
    signals.catalogAutoPass = true;
  }

  // Accessible Shopify cart.js (currency/token) proves a live storefront
  if (extras.cartAccessible && extras.isShopify) {
    score = Math.max(score, ACTIVE_SCORE_THRESHOLD);
    signals.cartAutoPass = true;
  }

  // Rich Shopify storefront HTML (catalog API sometimes blocked for bots)
  if (
    (statusOk || (html && html.length > 3000)) &&
    html &&
    htmlIncludes(html, [
      'powered by shopify', 'cdn.shopify.com', 'cdn.shopifycdn.net', 'shopify.theme',
      'myshopify.com', 'shopify-section', 'data-shopify',
    ])
  ) {
    score = Math.max(score, ACTIVE_SCORE_THRESHOLD);
    signals.shopifyHtmlAutoPass = true;
  }

  // Shrine-themed Shopify stores (API may be blocked; HTML still proves active commerce)
  if (
    (statusOk || (html && html.length > 2500)) &&
    html &&
    htmlIncludes(html, ['powered by shrine', 'shrine-theme', 'shrine theme'])
  ) {
    score = Math.max(score, ACTIVE_SCORE_THRESHOLD);
    signals.shrineHtmlAutoPass = true;
  }

  // Custom Shopify / headless themes with strong commerce HTML but few CDN markers
  if (statusOk && html && html.length > 2500) {
    const hasCommerce = htmlIncludes(html, [
      'buy it now', 'shop now', 'add to cart', 'regular price', 'sale price',
      'featured products', 'featured collection', 'unit price', 'continue shopping',
      'free shipping', 'day returns', 'secure checkout',
    ]);
    const hasStoreTrust = htmlIncludes(html, [
      'privacy policy', 'terms of service', 'refund', 'shipping', 'contact', '@', 'subscribe',
    ]);
    if (hasCommerce && hasStoreTrust) {
      score = Math.max(score, ACTIVE_SCORE_THRESHOLD);
      signals.commerceAutoPass = true;
    }
  }

  const rejected = score < ACTIVE_SCORE_THRESHOLD;
  let tier = 'Inactive';
  if (score >= 81) tier = 'Highly Active';
  else if (score >= 61) tier = 'Active';
  else if (score >= ACTIVE_SCORE_THRESHOLD) tier = 'Moderately Active';

  return {
    score,
    tier,
    signals,
    rejected,
    errorMessage: rejected ? 'Active score below threshold (inactive store)' : null,
  };
}

function phase2Platform(html, catalogProbe = {}) {
  if (catalogProbe.isShopify || catalogProbe.liveCatalog) return 'shopify';
  if (htmlIncludes(html, ['cdn.shopify.com', 'cdn.shopifycdn.net', 'shopify', '/cart.js', 'x-shopify', 'myshopify.com'])) return 'shopify';
  if (htmlIncludes(html, ['powered by shrine', 'shrine-theme', 'shrine theme'])) return 'shopify';
  if (htmlIncludes(html, ['woocommerce', 'wc-cart-fragments', 'wc-ajax'])) return 'woocommerce';
  if (htmlIncludes(html, ['static.wixstatic.com', 'wix-code', 'wix-image'])) return 'wix';
  if (htmlIncludes(html, ['wp-content', 'wp-includes', 'wordpress'])) return 'wordpress';
  if ((html || '').toLowerCase().includes('shopify')) return 'shopify';
  return 'other';
}

function buildQualifiedResult(origin, phase1, phaseData, fields) {
  return {
    storeUrl: origin,
    status: 'qualified',
    currentPhase: 10,
    activeScore: phase1.score,
    activeTier: phase1.tier,
    phaseData,
    qualified: true,
    rejected: false,
    ...fields,
  };
}

/**
 * Run full qualification pipeline. Phases 2–9 only categorize; they never reject.
 * Only Phase 1 (active score < 21) can reject a store.
 */
export async function runLeadStorePipeline(storeUrl, { onPhase } = {}) {
  const notify = (phase) => {
    if (onPhase) onPhase(phase);
  };

  const normalized = normalizeStoreUrl(storeUrl);
  if (!normalized) {
    return {
      status: 'failed',
      errorMessage: 'Invalid store URL',
      qualified: false,
      rejected: false,
      currentPhase: 0,
    };
  }

  const origin = normalized;
  let hostname;
  try {
    hostname = new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return { status: 'failed', errorMessage: 'Invalid URL', qualified: false, rejected: false, currentPhase: 0 };
  }

  notify(1);

  const catalogProbe = await probeLiveCatalog(origin);
  const homeRes = await fetchStoreHomepage(origin);
  const html = homeRes.html || '';
  const statusOk = homeRes.ok || (homeRes.statusCode === 200) || html.length > 2000;
  const shrineTheme = htmlIncludes(html, ['powered by shrine', 'shrine-theme', 'shrine theme']);

  const phase1 = phase1ActiveScore(html, statusOk, {
    hasProducts: catalogProbe.hasProducts,
    hasCollections: catalogProbe.hasCollections,
    liveCatalog: catalogProbe.liveCatalog,
    cartAccessible: catalogProbe.cartAccessible,
    isShopify: catalogProbe.isShopify || shrineTheme,
    shrineTheme,
  });
  const phaseData = { phase1, catalogProbe: {
    hasProducts: catalogProbe.hasProducts,
    hasCollections: catalogProbe.hasCollections,
    liveCatalog: catalogProbe.liveCatalog,
  } };

  if (phase1.rejected) {
    return {
      storeUrl: origin,
      status: 'rejected',
      currentPhase: 1,
      activeScore: phase1.score,
      activeTier: phase1.tier,
      phaseData,
      errorMessage: phase1.errorMessage || 'Active score below threshold (inactive store)',
      qualified: false,
      rejected: true,
    };
  }

  notify(2);
  const platform = catalogProbe.isShopify || catalogProbe.liveCatalog || shrineTheme ? 'shopify' : phase2Platform(html, catalogProbe);
  phaseData.phase2 = { platform };

  notify(3);
  const countryResult = await detectStoreCountry({
    origin,
    hostname,
    html,
    currency: catalogProbe.currency,
  });
  const countryCode = countryResult.code || 'XX';
  phaseData.phase3 = countryResult;
  phaseData.countryClassifiedAt = new Date().toISOString();

  notify(4);
  let currency = catalogProbe.currency || null;
  if (!currency) {
    const currencyMatch = html.match(/priceCurrency["']\s*:\s*["']([A-Z]{3})["']/i);
    currency = currencyMatch?.[1]?.toUpperCase() || 'USD';
  }
  phaseData.phase4 = { currency };

  notify(5);
  let productCount = 0;
  let productsSample = catalogProbe.productsPage?.products || [];
  if (platform === 'shopify' || catalogProbe.liveCatalog) {
    const products = await countShopifyProducts(origin);
    productCount = products.count;
    if (productsSample.length < 30) {
      const samplePage = await fetchJson(`${origin}/products.json?limit=50`);
      if (samplePage?.products?.length) productsSample = samplePage.products;
    }
  }
  phaseData.phase5 = { productCount, productSampleSize: productsSample.length };

  notify(6);
  const tagResult = await classifyStoreTags({
    origin,
    html,
    hostname,
    productCount,
    platform,
    products: productsSample,
  });
  phaseData.phase6 = tagResult.phase6;
  phaseData.phase7 = tagResult.phase7;
  phaseData.phase8 = tagResult.phase8;
  phaseData.phase9 = tagResult.phase9;
  phaseData.tags = tagResult.tagSchema;
  phaseData.tagsClassifiedAt = new Date().toISOString();

  notify(7);
  notify(8);
  notify(9);

  const emailProvider = detectProvider(html, {
    klaviyo: ['klaviyo'],
    mailchimp: ['mailchimp'],
    omnisend: ['omnisend'],
    privy: ['privy'],
    brevo: ['brevo', 'sendinblue'],
  });
  const smsProvider = detectProvider(html, {
    postscript: ['postscript'],
    attentive: ['attentive'],
    smsbump: ['smsbump'],
  });
  const reviewApp = detectProvider(html, {
    'judge.me': ['judge.me'],
    loox: ['loox'],
    yotpo: ['yotpo'],
    okendo: ['okendo'],
  });
  const chatProvider = detectProvider(html, {
    tidio: ['tidio'],
    zendesk: ['zendesk'],
    crisp: ['crisp'],
    gorgias: ['gorgias'],
    intercom: ['intercom'],
  });

  notify(10);

  return buildQualifiedResult(origin, phase1, phaseData, {
    platform,
    countryCode,
    currency,
    productCount,
    productCountRange: productCountRange(productCount),
    shopifyPlus: tagResult.shopifyPlus,
    shopifyPlusConfidence: tagResult.shopifyPlusConfidence,
    facebookAds: tagResult.facebookAds,
    googleAds: tagResult.googleAds,
    tiktokAds: tagResult.tiktokAds,
    pinterestAds: tagResult.pinterestAds,
    dropshippingScore: tagResult.dropshippingScore,
    podScore: tagResult.podScore,
    emailProvider,
    smsProvider,
    reviewApp,
    chatProvider,
  });
}
