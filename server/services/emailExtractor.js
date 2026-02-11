/**
 * Email extraction with provider-priority selection.
 */
import { load } from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g;
const VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const IGNORE_LOCAL_PREFIXES = ['noreply', 'no-reply', 'donotreply'];

const PROVIDER_PRIORITY = [
  ['gmail.com'],
  ['yahoo.com', 'yahoo.co.uk', 'yahoo.co.in'],
  ['outlook.com', 'hotmail.com', 'live.com'],
  ['aol.com'],
  ['protonmail.com'],
  ['zoho.com'],
  ['gmx.com'],
  ['mail.com'],
  ['icloud.com', 'me.com', 'mac.com'],
];

const PROVIDER_DOMAIN_TO_RANK = new Map();
for (let rank = 0; rank < PROVIDER_PRIORITY.length; rank += 1) {
  for (const domain of PROVIDER_PRIORITY[rank]) {
    PROVIDER_DOMAIN_TO_RANK.set(domain, rank);
  }
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw
    .trim()
    .replace(/^mailto:/i, '')
    .split(/[?&,;]+/)[0]
    .replace(/^[<("'[\s]+/, '')
    .replace(/[>)'"\].,:;!?]+$/, '')
    .toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;
  if (!VALID_EMAIL_REGEX.test(trimmed)) return null;
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return null;
  if (IGNORE_LOCAL_PREFIXES.some((prefix) => local.startsWith(prefix))) return null;
  if (domain.startsWith('.') || domain.endsWith('.')) return null;
  return `${local}@${domain}`;
}

function extractFromText(text) {
  const normalized = decodeHtmlEntities(text || '');
  const matches = normalized.match(EMAIL_REGEX) || [];
  const out = [];
  for (const match of matches) {
    const email = normalizeEmail(match);
    if (email) out.push(email);
  }
  return out;
}

function detectPlatform(html) {
  if (!html || typeof html !== 'string') return null;
  if (/shopify|cdn\.shopify\.com|shopify\.com\/shop/i.test(html)) return 'Shopify';
  if (/woocommerce|wp-content\/plugins\/woocommerce/i.test(html)) return 'WooCommerce';
  if (/bigcommerce/i.test(html)) return 'BigCommerce';
  return null;
}

function extractFromPage(url, html) {
  if (!html || typeof html !== 'string') return [];
  let $;
  try {
    $ = load(html.length > 700000 ? html.slice(0, 700000) : html, { decodeEntities: true });
  } catch {
    return [];
  }

  const found = [];
  const seen = new Set();
  const add = (email, sourceType) => {
    const normalized = normalizeEmail(email);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    found.push({ email: normalized, sourcePage: url, sourceType });
  };

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    extractFromText(href).forEach((email) => add(email, 'mailto'));
  });

  $('[data-email], [data-contact], [data-e-mail]').each((_, el) => {
    const raw = $(el).attr('data-email') || $(el).attr('data-contact') || $(el).attr('data-e-mail') || '';
    extractFromText(raw).forEach((email) => add(email, 'data'));
  });

  const bodyText = $('body').text() || '';
  extractFromText(bodyText).forEach((email) => add(email, 'text'));

  const footerText = $('footer, .footer, #footer, .site-footer, [role="contentinfo"]').text() || '';
  extractFromText(footerText).forEach((email) => add(email, 'footer'));

  // Final broad pass over full HTML for cases where email isn't in visible text nodes.
  extractFromText(html).forEach((email) => add(email, 'html'));

  return found;
}

function getProviderRank(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!PROVIDER_DOMAIN_TO_RANK.has(domain)) return Number.MAX_SAFE_INTEGER;
  return PROVIDER_DOMAIN_TO_RANK.get(domain);
}

function compareByPriority(a, b) {
  const rankA = getProviderRank(a.email);
  const rankB = getProviderRank(b.email);
  if (rankA !== rankB) return rankA - rankB;
  return 0;
}

function getStoreHost(storeUrl) {
  try {
    const url = new URL((storeUrl || '').startsWith('http') ? storeUrl : `https://${storeUrl}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function getEmailProvider(email, storeOriginHost = '') {
  const normalized = normalizeEmail(email) || '';
  if (!normalized) return 'other';
  const domain = normalized.split('@')[1] || '';
  const storeHost = (storeOriginHost || '').toLowerCase();
  if (storeHost && (domain === storeHost || domain.endsWith(`.${storeHost}`))) return 'domain';
  if (PROVIDER_DOMAIN_TO_RANK.has(domain)) return domain.split('.')[0];
  return 'other';
}

export function getEmailType(email) {
  const lower = (email || '').toLowerCase();
  const contactPrefixes = ['support@', 'info@', 'contact@', 'hello@', 'sales@', 'help@', 'team@'];
  return contactPrefixes.some((prefix) => lower.startsWith(prefix)) ? 'contact' : 'other';
}

/**
 * Extract emails from crawled pages.
 * If multiple emails are found, applies provider priority and picks one by default.
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const onePerStore = options.onePerStore !== false;
  const privacyPageFound = options.privacyPageFound !== false;

  const byEmail = new Map();
  let platform = null;
  for (const { url, html } of (pages || [])) {
    if (!platform) platform = detectPlatform(html);
    const list = extractFromPage(url, html);
    for (const item of list) {
      if (!byEmail.has(item.email)) byEmail.set(item.email, { ...item, storeUrl });
    }
  }

  const sorted = [...byEmail.values()].sort(compareByPriority);
  if (!sorted.length) return [];

  if (!onePerStore) {
    return sorted.map((item) => ({
      email: item.email,
      storeUrl: item.storeUrl,
      sourcePage: item.sourcePage,
      sourceType: item.sourceType,
      platform,
    }));
  }

  const best = sorted[0];
  const sourcePage = !privacyPageFound
    ? `Privacy Page Not Found | ${best.sourcePage}`
    : best.sourcePage;
  return [{
    email: best.email,
    storeUrl: best.storeUrl,
    sourcePage,
    sourceType: best.sourceType,
    platform,
    storeHost: getStoreHost(storeUrl),
  }];
}
