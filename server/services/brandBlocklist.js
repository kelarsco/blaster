/**
 * Domains to skip during store URL discovery (big brands, marketplaces, platforms, social).
 * Subdomains of blocked roots are also blocked (e.g. amazon.co.uk).
 */
const BLOCKED_ROOTS = [
  'amazon.com',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.ca',
  'amazon.com.au',
  'amazon.in',
  'amazon.es',
  'amazon.it',
  'amazon.co.jp',
  'walmart.com',
  'target.com',
  'ebay.com',
  'etsy.com',
  'aliexpress.com',
  'alibaba.com',
  'wish.com',
  'temu.com',
  'shein.com',
  'nike.com',
  'adidas.com',
  'hm.com',
  'zara.com',
  'asos.com',
  'uniqlo.com',
  'gap.com',
  'apple.com',
  'microsoft.com',
  'google.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'youtube.com',
  'linkedin.com',
  'pinterest.com',
  'reddit.com',
  'shopify.com',
  'woocommerce.com',
  'wordpress.com',
  'wordpress.org',
  'bigcommerce.com',
  'squarespace.com',
  'wix.com',
  'prestashop.com',
  'opencart.com',
  'magento.com',
  'trustpilot.com',
  'yelp.com',
  'tripadvisor.com',
  'wikipedia.org',
  'github.com',
  'medium.com',
  'forbes.com',
  'bloomberg.com',
  'cnn.com',
  'bbc.com',
  'nytimes.com',
  'bestbuy.com',
  'costco.com',
  'homedepot.com',
  'lowes.com',
  'ikea.com',
  'sephora.com',
  'ulta.com',
  'macys.com',
  'nordstrom.com',
  'wayfair.com',
  'overstock.com',
  'chewy.com',
  'petco.com',
  'staples.com',
  'officedepot.com',
];

const BLOCKED_EXACT = new Set(BLOCKED_ROOTS);

function hostnameFromInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return raw.toLowerCase().replace(/^www\./, '');
  }
}

export function isBlockedBrandDomain(input) {
  const host = hostnameFromInput(input);
  if (!host) return true;
  if (BLOCKED_EXACT.has(host)) return true;
  for (const root of BLOCKED_ROOTS) {
    if (host === root || host.endsWith(`.${root}`)) return true;
  }
  return false;
}
