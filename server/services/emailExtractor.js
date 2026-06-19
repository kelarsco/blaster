/**
 * Email extraction with provider-priority selection.
 */
import { load } from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;
const VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/i;
const IGNORE_LOCAL_PREFIXES = ['noreply', 'no-reply', 'donotreply'];
/** French store pages often prefix the local part with "adresse"/"addresse" (address label). */
const FRENCH_ADDRESS_LOCAL_PREFIX = /^(?:addresse|adresse)/i;
const CONTACT_LOCAL_PREFIXES = /^(info|contact|support|hello|sales|help|team|service|customerservice|enquiries|inquiry|mail|office|admin|shop|store|orders|order)/i;

const KNOWN_TLDS = [
  'co.uk', 'org.uk', 'com.au', 'co.nz', 'co.za', 'com.br', 'com.mx',
  'com', 'org', 'net', 'co', 'io', 'uk', 'eu', 'de', 'fr', 'es', 'it', 'nl', 'info', 'biz', 'me', 'us', 'ca', 'au', 'nz', 'store', 'shop', 'online', 'site', 'cloud', 'tech', 'app', 'dev',
];

const INVALID_EMAIL_TLDS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif',
  'css', 'js', 'mjs', 'json', 'map', 'xml', 'html', 'htm', 'php', 'asp', 'aspx',
  'woff', 'woff2', 'ttf', 'eot', 'otf', 'mp4', 'webm', 'mp3', 'wav', 'pdf',
]);

const FAKE_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'test.com', 'email.com', 'domain.com',
  'yourdomain.com', 'youremail.com', 'placeholder.com', 'sample.com', 'mailinator.com',
  'sentry.io', 'wixpress.com', 'schema.org', 'domain.com', 'email.com',
]);

const PROVIDER_PRIORITY = [
  ['gmail.com', 'googlemail.com'],
  ['yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de'],
  ['outlook.com', 'hotmail.com', 'live.com', 'live.co.uk', 'msn.com'],
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

function normalizeObfuscated(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*|\.at\./gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*|\.dot\./gi, '.')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s+dot\s+/gi, '.')
    .trim();
}

function stripFrenchAddressLocalPrefix(local) {
  if (!local) return local;
  let cleaned = local;
  for (let i = 0; i < 2; i += 1) {
    const next = cleaned.replace(FRENCH_ADDRESS_LOCAL_PREFIX, '').replace(/^[+:._\s-]+/, '');
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

/** Trim glued junk after a real TLD (e.g. mystore.comtelefon → mystore.com). */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;
  const d = domain.toLowerCase().trim();
  for (const tld of KNOWN_TLDS) {
    const suffix = `.${tld}`;
    const idx = d.indexOf(suffix);
    if (idx === -1) continue;
    const after = d.slice(idx + suffix.length);
    if (after.length === 0) return d;
    if (/^[a-z0-9.-]+$/.test(after)) return d.slice(0, idx + suffix.length);
  }
  const lastDot = d.lastIndexOf('.');
  if (lastDot > 0) {
    const tld = d.slice(lastDot + 1);
    if (/^[a-z]{2,10}$/.test(tld) && !/[0-9]/.test(tld) && !INVALID_EMAIL_TLDS.has(tld)) return d;
  }
  return null;
}

function isPlausibleEmail(local, domain) {
  if (!local || !domain) return false;
  if (local.length < 1 || local.length > 64 || domain.length > 253) return false;
  if (/[{}'"\\\/]/.test(local)) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (/\.(com|net|org)\.([a-z0-9.-]+)$/i.test(domain)) return false;
  const tld = domain.split('.').pop() || '';
  if (tld.length < 2 || INVALID_EMAIL_TLDS.has(tld)) return false;
  if (/^\d+$/.test(tld)) return false;
  if (FAKE_DOMAINS.has(domain)) return false;
  if (/^(localhost|example|invalid|test)$/i.test(domain.split('.')[0] || '')) return false;
  return true;
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
  let [local, domain] = trimmed.split('@');
  if (!local || !domain) return null;
  local = stripFrenchAddressLocalPrefix(local);
  if (!local) return null;
  domain = normalizeDomain(domain);
  if (!domain) return null;
  if (IGNORE_LOCAL_PREFIXES.some((prefix) => local.startsWith(prefix))) return null;
  if (!isPlausibleEmail(local, domain)) return null;
  return `${local}@${domain}`;
}

function extractFromText(text) {
  const normalized = normalizeObfuscated(decodeHtmlEntities(text || ''));
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

function extractSchemaEmails(html, url, add) {
  const scripts = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!scripts) return;
  for (const tag of scripts) {
    const raw = tag.replace(/<script[^>]*>([\s\S]*)<\/script>/i, '$1').replace(/<!--[\s\S]*?-->/g, '').trim();
    try {
      const obj = JSON.parse(raw);
      const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
      extractFromText(str).forEach((email) => add(email, 'schema'));
    } catch (_) {}
  }
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
    const mailto = href.replace(/^mailto:/i, '').split(/[?,;&]/)[0].trim();
    extractFromText(mailto).forEach((email) => add(email, 'mailto'));
  });

  $('[data-email], [data-contact], [data-e-mail]').each((_, el) => {
    const raw = $(el).attr('data-email') || $(el).attr('data-contact') || $(el).attr('data-e-mail') || '';
    extractFromText(raw).forEach((email) => add(email, 'data'));
  });

  const bodyText = $('body').text() || '';
  extractFromText(bodyText).forEach((email) => add(email, 'text'));

  const footerText = $('footer, .footer, #footer, .site-footer, [role="contentinfo"]').text() || '';
  extractFromText(footerText).forEach((email) => add(email, 'footer'));

  const htmlWithoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  extractFromText(htmlWithoutScripts).forEach((email) => add(email, 'html'));

  extractSchemaEmails(html, url, add);

  return found;
}

function getProviderRank(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!PROVIDER_DOMAIN_TO_RANK.has(domain)) return Number.MAX_SAFE_INTEGER;
  return PROVIDER_DOMAIN_TO_RANK.get(domain);
}

function emailMatchesStoreHost(email, storeHost) {
  if (!storeHost) return false;
  const domain = (email.split('@')[1] || '').toLowerCase();
  const host = storeHost.toLowerCase();
  return domain === host || domain.endsWith(`.${host}`);
}

function scoreEmailCandidate(item, storeHost) {
  const email = item.email || '';
  const local = email.split('@')[0] || '';
  let score = 0;

  if (item.sourceType === 'mailto') score += 100;
  else if (item.sourceType === 'schema') score += 70;
  else if (item.sourceType === 'data') score += 50;
  else if (item.sourceType === 'footer') score += 30;
  else if (item.sourceType === 'text') score += 20;

  if (emailMatchesStoreHost(email, storeHost)) score += 90;
  if (CONTACT_LOCAL_PREFIXES.test(local)) score += 40;

  const providerRank = getProviderRank(email);
  if (providerRank < Number.MAX_SAFE_INTEGER) {
    score += 25 - Math.min(providerRank, 20);
  }

  return score;
}

function pickBestEmail(candidates, storeHost) {
  return [...candidates].sort((a, b) => {
    const scoreDiff = scoreEmailCandidate(b, storeHost) - scoreEmailCandidate(a, storeHost);
    if (scoreDiff !== 0) return scoreDiff;
    return getProviderRank(a.email) - getProviderRank(b.email);
  })[0];
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
 * If multiple emails are found, picks the best business contact per store.
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const onePerStore = options.onePerStore !== false;
  const privacyPageFound = options.privacyPageFound !== false;
  const storeHost = getStoreHost(storeUrl);

  const byEmail = new Map();
  let platform = null;
  for (const { url, html } of (pages || [])) {
    if (!platform) platform = detectPlatform(html);
    const list = extractFromPage(url, html);
    for (const item of list) {
      if (!byEmail.has(item.email)) byEmail.set(item.email, { ...item, storeUrl });
    }
  }

  const candidates = [...byEmail.values()];
  if (!candidates.length) return [];

  if (!onePerStore) {
    return candidates
      .sort((a, b) => scoreEmailCandidate(b, storeHost) - scoreEmailCandidate(a, storeHost))
      .map((item) => ({
        email: item.email,
        storeUrl: item.storeUrl,
        sourcePage: item.sourcePage,
        sourceType: item.sourceType,
        platform,
      }));
  }

  const best = pickBestEmail(candidates, storeHost);
  const sourcePage = !privacyPageFound
    ? `Privacy Page Not Found | ${best.sourcePage}`
    : best.sourcePage;
  return [{
    email: best.email,
    storeUrl: best.storeUrl,
    sourcePage,
    sourceType: best.sourceType,
    platform,
    storeHost,
  }];
}
