/**
 * Shopify-specific email discovery (policy JSON, contact-information, Shopify.shop).
 * Mirrors high-hit-rate sources used by tools like EcomScout.
 */
import { fetchHtml, normalizeStoreUrl } from './crawler.js';

const PROBE_TIMEOUT_MS = Number(process.env.SHOPIFY_EMAIL_PROBE_TIMEOUT_MS) || 10000;

const UA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Policy handles where merchants list contact / privacy emails */
const POLICY_HANDLES = [
  'contact-information',
  'privacy-policy',
  'refund-policy',
  'terms-of-service',
  'shipping-policy',
  'legal-notice',
];

const HTML_POLICY_PATHS = [
  '/pages/contact',
  '/pages/contact-us',
  '/pages/contact-information',
  '/pages/about-us',
  '/pages/shipping-policy',
  '/pages/refund-policy',
  '/pages/privacy-policy',
  '/policies/contact-information',
  '/policies/privacy-policy',
];

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: UA_HEADERS,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchHtmlFetch(url) {
  try {
    const res = await fetch(url, {
      headers: UA_HEADERS,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html?.trim() ? html : null;
  } catch {
    return null;
  }
}

function pageFromPolicyJson(origin, handle, data) {
  const body = data?.policy?.body;
  if (!body || typeof body !== 'string') return null;
  return {
    url: `${origin}/policies/${handle}`,
    html: `<article class="shopify-policy-body">${body}</article>`,
    probeSource: 'shopify_policy_json',
  };
}

/**
 * @param {string} html
 * @returns {{ email: string, sourcePage: string } | null}
 */
export function extractShopifyShopObjectEmail(html, sourcePage = '') {
  if (!html || typeof html !== 'string') return null;
  const blockMatch = html.match(/Shopify\.shop\s*=\s*(\{[\s\S]*?\});/i);
  if (blockMatch) {
    try {
      const shop = JSON.parse(blockMatch[1]);
      const email = shop?.email || shop?.customer_email || shop?.contact_email;
      if (email && typeof email === 'string' && email.includes('@')) {
        return { email: email.trim(), sourcePage, probeSource: 'shopify_shop_object' };
      }
    } catch (_) {}
  }
  const inline = html.match(/"email"\s*:\s*"([^"\\]+@[^"\\]+)"/i);
  if (inline?.[1]) {
    return { email: inline[1].trim(), sourcePage, probeSource: 'shopify_inline_json' };
  }
  return null;
}

/**
 * Fetch Shopify JSON + policy HTML pages for email extraction.
 * @param {string} storeUrl
 * @returns {Promise<{ pages: { url: string, html: string, probeSource?: string }[], hints: object[] }>}
 */
export async function probeShopifyEmails(storeUrl) {
  const origin = normalizeStoreUrl(storeUrl);
  if (!origin) return { pages: [], hints: [] };

  const pages = [];
  const hints = [];
  const seenUrls = new Set();

  const addPage = (page) => {
    if (!page?.url || !page?.html || seenUrls.has(page.url)) return;
    seenUrls.add(page.url);
    pages.push(page);
  };

  const policyJsonFetches = POLICY_HANDLES.map(async (handle) => {
    const data = await fetchJson(`${origin}/policies/${handle}.json`);
    const page = pageFromPolicyJson(origin, handle, data);
    if (page) addPage(page);
  });

  const htmlFetches = HTML_POLICY_PATHS.map(async (path) => {
    const url = path === '/' ? `${origin}/` : `${origin}${path}`;
    if (seenUrls.has(url)) return;
    let html = (await fetchHtml(url, { timeout: PROBE_TIMEOUT_MS })).html;
    if (!html || html.length < 200) {
      html = await fetchHtmlFetch(url);
    }
    if (html) addPage({ url, html, probeSource: 'shopify_policy_html' });
  });

  const metaFetch = (async () => {
    const meta = await fetchJson(`${origin}/meta.json`);
    if (meta && typeof meta === 'object') {
      addPage({
        url: `${origin}/meta.json`,
        html: `<pre>${JSON.stringify(meta)}</pre>`,
        probeSource: 'shopify_meta_json',
      });
    }
  })();

  const homeFetch = (async () => {
    const url = `${origin}/`;
    let html = (await fetchHtml(url, { timeout: PROBE_TIMEOUT_MS })).html;
    if (!html || html.length < 500) {
      html = await fetchHtmlFetch(url);
    }
    if (html) {
      addPage({ url, html, probeSource: 'shopify_home' });
      const shopHint = extractShopifyShopObjectEmail(html, url);
      if (shopHint) hints.push(shopHint);
    }
  })();

  await Promise.all([...policyJsonFetches, ...htmlFetches, metaFetch, homeFetch]);

  return { pages, hints };
}
