/**
 * Simple email extraction: keep only (1) known providers (gmail, yahoo, outlook, hotmail, icloud)
 * or (2) domain emails (info@company.com, support@brand.io, team@startup.co, etc).
 */
import { load } from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

/** Allowed provider domains (gmail, yahoo, outlook, hotmail, icloud). */
const ALLOWED_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'hotmail.com', 'hotmail.co.uk',
  'icloud.com', 'me.com', 'mac.com',
]);

const FAKE_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'test.com', 'email.com', 'domain.com',
  'yourdomain.com', 'youremail.com', 'placeholder.com', 'sample.com', 'mailinator.com',
  'sentry.io', 'wixpress.com', 'schema.org',
]);

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

/** Reject code/CSS/URL fragments (e.g. }@media, /@vipeclub). */
function isBadLocalPart(local) {
  if (!local || local.length < 2) return true;
  if (/[{}'"\\\/]/.test(local)) return true;
  return false;
}

/** Domain must have a real TLD (e.g. company.com, brand.io). */
function hasValidTld(domain) {
  if (!domain || !domain.includes('.')) return false;
  const tld = domain.split('.').pop();
  return /^[a-zA-Z]{2,63}$/.test(tld);
}

/** Reject .com.xxx junk (e.g. gmail.com.uk). */
function hasCleanEnding(domain) {
  if (/\.(com|net|org)\.([a-z0-9.-]+)$/i.test(domain)) return false;
  return true;
}

/**
 * Keep only: (1) gmail/yahoo/outlook/hotmail/icloud, or (2) any domain email (info@company.com, support@brand.io, etc).
 */
function isAllowedEmail(email) {
  const lower = email.toLowerCase().trim();
  if (lower.length < 6 || lower.length > 254 || !lower.includes('@')) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(lower)) return false;
  const at = lower.indexOf('@');
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (isBadLocalPart(local)) return false;
  if (!hasValidTld(domain)) return false;
  if (!hasCleanEnding(domain)) return false;
  if (FAKE_DOMAINS.has(domain)) return false;
  if (ALLOWED_PROVIDERS.has(domain)) return true;
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) return true;
  return false;
}

function getStoreHost(storeUrl) {
  try {
    const u = new URL(storeUrl.startsWith('http') ? storeUrl : 'https://' + storeUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getEmailProvider(email, storeOriginHost = '') {
  const lower = (email || '').toLowerCase().trim();
  const at = lower.indexOf('@');
  if (at === -1) return 'other';
  const domain = lower.slice(at + 1);
  const storeHost = (storeOriginHost || '').toLowerCase();
  if (storeHost && (domain === storeHost || domain.endsWith('.' + storeHost))) return 'domain';
  if (ALLOWED_PROVIDERS.has(domain)) return domain.split('.')[0];
  return 'other';
}

export function getEmailType(email) {
  const lower = (email || '').toLowerCase();
  const contact = ['support@', 'info@', 'contact@', 'hello@', 'sales@', 'help@', 'team@'];
  for (const p of contact) if (lower.startsWith(p)) return 'contact';
  return 'other';
}

function detectPlatform(html) {
  if (!html || typeof html !== 'string') return null;
  if (/shopify|cdn\.shopify\.com|shopify\.com\/shop/i.test(html)) return 'Shopify';
  if (/woocommerce|wp-content\/plugins\/woocommerce/i.test(html)) return 'WooCommerce';
  if (/bigcommerce/i.test(html)) return 'BigCommerce';
  return null;
}

function extractFromText(text) {
  const normalized = normalizeObfuscated(decodeHtmlEntities(text));
  const matches = normalized.match(EMAIL_REGEX) || [];
  const out = [];
  for (const m of matches) {
    const e = m.toLowerCase().trim();
    if (isAllowedEmail(e)) out.push(e);
  }
  return out;
}

function extractFromPage(url, html) {
  const seen = new Set();
  const add = (email) => {
    if (!isAllowedEmail(email)) return;
    const key = email.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    return key;
  };

  if (!html || typeof html !== 'string') return [];

  let $;
  try {
    $ = load(html.length > 500000 ? html.slice(0, 500000) : html, { decodeEntities: true });
  } catch {
    return [];
  }

  const out = [];

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const mailto = href.replace(/^mailto:/i, '').split(/[?,;&]/)[0].trim();
    extractFromText(mailto).forEach((e) => { const k = add(e); if (k) out.push({ email: k, sourcePage: url, sourceType: 'mailto' }); });
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('mailto:')) return;
    extractFromText(href).forEach((e) => { const k = add(e); if (k) out.push({ email: k, sourcePage: url, sourceType: 'href' }); });
  });

  $('[data-email], [data-contact], [data-e-mail]').each((_, el) => {
    const val = $(el).attr('data-email') || $(el).attr('data-contact') || $(el).attr('data-e-mail') || '';
    extractFromText(val).forEach((e) => { const k = add(e); if (k) out.push({ email: k, sourcePage: url, sourceType: 'data' }); });
  });

  const bodyText = $('body').text();
  extractFromText(bodyText).forEach((e) => { const k = add(e); if (k) out.push({ email: k, sourcePage: url, sourceType: 'text' }); });

  const footerText = $('footer, .footer, #footer, .site-footer, [role="contentinfo"]').text();
  extractFromText(footerText).forEach((e) => { const k = add(e); if (k) out.push({ email: k, sourcePage: url, sourceType: 'footer' }); });

  const scripts = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (scripts) {
    for (const tag of scripts) {
      const raw = tag.replace(/<script[^>]*>([\s\S]*)<\/script>/i, '$1').replace(/<!--[\s\S]*?-->/g, '').trim();
      try {
        const obj = JSON.parse(raw);
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        extractFromText(str).forEach((e) => { const k = add(e); if (k) out.push({ email: k, sourcePage: url, sourceType: 'schema' }); });
      } catch (_) {}
    }
  }

  return out;
}

/**
 * Extract emails from crawled pages. Keeps: gmail, yahoo, outlook, hotmail, icloud, or any domain (info@company.com, support@brand.io, etc).
 * Returns one best email per store by default.
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const storeHost = getStoreHost(storeUrl);
  const onePerStore = options.onePerStore !== false;

  const byEmail = new Map();
  let platform = null;

  for (const { url, html } of pages) {
    try {
      if (!platform) platform = detectPlatform(html);
      const candidates = extractFromPage(url, html);
      for (const c of candidates) {
        const key = c.email;
        if (!byEmail.has(key)) byEmail.set(key, { ...c, storeUrl });
      }
    } catch (_) {}
  }

  const list = [...byEmail.values()];
  if (list.length === 0) return [];
  if (onePerStore) {
    const preferred = list.find((x) => x.sourceType === 'mailto') || list[0];
    return [{ email: preferred.email, storeUrl: preferred.storeUrl, sourcePage: preferred.sourcePage, sourceType: preferred.sourceType, platform }];
  }
  return list.map((c) => ({ email: c.email, storeUrl: c.storeUrl, sourcePage: c.sourcePage, sourceType: c.sourceType, platform }));
}
