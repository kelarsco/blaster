/**
 * Email extraction: visible text, mailto:, href, data-*, JSON-LD and script tags.
 * Accepts all email types (Gmail, Outlook, Yahoo, Proton, Zoho, custom domains).
 * Filter by domain only when user explicitly requests it (includeProviders).
 */
import { load } from 'cheerio';

/** Matches valid emails; local part may contain dots. */
const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

/** Only reject obvious placeholders and test domains. Do NOT filter by provider. */
const FAKE_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'test.com', 'email.com', 'domain.com',
  'yourdomain.com', 'youremail.com', 'placeholder.com', 'sample.com', 'mailinator.com',
  'sentry.io', 'wixpress.com', 'schema.org',
]);

const CONFIDENCE = { mailto: 100, schema: 90, footer: 70, nav: 65, plain: 50 };

export function getEmailProvider(email, storeOriginHost = '') {
  const lower = (email || '').toLowerCase().trim();
  const at = lower.indexOf('@');
  if (at === -1) return 'other';
  const domain = lower.slice(at + 1);
  const storeHost = (storeOriginHost || '').toLowerCase();
  if (storeHost && (domain === storeHost || domain.endsWith('.' + storeHost))) return 'domain';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail';
  if (domain === 'hotmail.com' || domain === 'hotmail.co.uk') return 'hotmail';
  if (['outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com'].includes(domain)) return 'outlook';
  if (domain.startsWith('yahoo.')) return 'yahoo';
  if (domain === 'protonmail.com' || domain === 'proton.me' || domain === 'protonmail.me') return 'protonmail';
  return 'other';
}

export function getEmailType(email) {
  const lower = (email || '').toLowerCase();
  const skip = ['example@', 'test@', 'you@', 'email@', 'user@', 'noreply@', 'no-reply@'];
  const contact = ['support@', 'info@', 'contact@', 'hello@', 'sales@', 'help@'];
  for (const p of skip) if (lower.startsWith(p)) return 'noreply';
  for (const p of contact) if (lower.startsWith(p)) return 'contact';
  return 'other';
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
    .replace(/\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*|\s*@\s*at\s*@\s*|\.at\./gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*|\s*\.\s*dot\s*\.\s*|\.dot\./gi, '.')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s*\(\s*\)\s*/g, '')
    .trim();
}

function trimTrailingJunkFromDomain(match) {
  const atIdx = match.indexOf('@');
  if (atIdx === -1) return match;
  const domain = match.slice(atIdx + 1);
  const junkPattern = /^(.+?)(\.(com|net|org))([a-z]{7,})$/i;
  const m = domain.match(junkPattern);
  if (m && m[4].length >= 7 && !m[4].includes('.')) {
    return match.slice(0, atIdx + 1) + m[1] + m[2];
  }
  return match;
}

/** Reject domains with extra junk after TLD, e.g. gmail.com.uk */
function hasCleanDomainEnding(domain) {
  const d = domain.toLowerCase().trim();
  if (/\.(com|net|org)\.([a-z0-9.-]+)$/i.test(d)) return false;
  return true;
}

/** Accept all valid-looking emails. Only reject FAKE_DOMAINS, file extensions, and .com.xxx junk. */
function isValidEmail(email, storeOriginHost = '') {
  const lower = email.toLowerCase().trim();
  if (lower.length < 6 || lower.length > 254 || !lower.includes('@')) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(lower)) return false;
  const at = lower.indexOf('@');
  const domain = lower.slice(at + 1);
  if (!hasCleanDomainEnding(domain)) return false;
  if (FAKE_DOMAINS.has(domain)) return false;
  if (storeOriginHost && (domain === storeOriginHost || domain.endsWith('.' + storeOriginHost))) return true;
  if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) return true;
  return true;
}

function getStoreHost(storeUrl) {
  try {
    const u = new URL(storeUrl.startsWith('http') ? storeUrl : 'https://' + storeUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function allowedByProviders(email, includeProviders, storeHost) {
  if (!Array.isArray(includeProviders) || includeProviders.length === 0) return true;
  const provider = getEmailProvider(email, storeHost);
  return includeProviders.includes(provider);
}

function detectPlatform(html) {
  if (!html || typeof html !== 'string') return null;
  if (/shopify|cdn\.shopify\.com|shopify\.com\/shop/i.test(html)) return 'Shopify';
  if (/woocommerce|wp-content\/plugins\/woocommerce/i.test(html)) return 'WooCommerce';
  if (/bigcommerce/i.test(html)) return 'BigCommerce';
  if (/magento|mage\/|Magento/i.test(html)) return 'Magento';
  return null;
}

function extractFromText(text, storeHost) {
  const normalized = normalizeObfuscated(decodeHtmlEntities(text));
  const matches = normalized.match(EMAIL_REGEX) || [];
  return matches
    .map((e) => trimTrailingJunkFromDomain(e.toLowerCase().trim()))
    .filter((e) => isValidEmail(e, storeHost));
}

function extractJsonLdAndScriptEmails(html) {
  const out = [];
  const scriptMatch = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptMatch.exec(html)) !== null) {
    try {
      const raw = m[1].replace(/<!--[\s\S]*?-->/g, '').trim();
      if (/application\/ld\+json/i.test(html.slice(m.index, m.index + 150))) {
        const obj = JSON.parse(raw);
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        const emails = str.match(EMAIL_REGEX) || [];
        for (const e of emails) {
          const norm = trimTrailingJunkFromDomain(e.toLowerCase().trim());
          if (norm.includes('@') && !/\.(png|jpg|js|css)$/i.test(norm)) out.push(norm);
        }
      } else {
        const emails = raw.match(EMAIL_REGEX) || [];
        for (const e of emails) {
          const norm = trimTrailingJunkFromDomain(e.toLowerCase().trim());
          if (norm.includes('@') && !/\.(png|jpg|js|css)$/i.test(norm)) out.push(norm);
        }
      }
    } catch (_) {}
  }
  return out;
}

/**
 * Extract from one page: visible text (body), mailto:, href, data-*, footer, header, JSON-LD and script tags.
 */
function extractFromPage(pageUrl, html, storeHost, includeProviders = []) {
  const byEmail = new Map();
  const add = (email, sourceType, confidence) => {
    if (!isValidEmail(email, storeHost)) return;
    if (!allowedByProviders(email, includeProviders, storeHost)) return;
    const key = email.toLowerCase().trim();
    const existing = byEmail.get(key);
    if (!existing || confidence > existing.confidence) {
      byEmail.set(key, { email: key, sourcePage: pageUrl, sourceType, confidence });
    }
  };

  if (!html || typeof html !== 'string') return [...byEmail.values()];

  let $;
  try {
    const maxLen = 500000;
    $ = load(html.length > maxLen ? html.slice(0, maxLen) : html, { decodeEntities: true });
  } catch (_) {
    return [...byEmail.values()];
  }

  try {
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const mailto = href.replace(/^mailto:/i, '').split(/[?,;&]/)[0].trim();
      extractFromText(mailto, storeHost).forEach((e) => add(e, 'mailto', CONFIDENCE.mailto));
    });

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('mailto:')) return;
      extractFromText(href, storeHost).forEach((e) => add(e, 'nav', CONFIDENCE.nav));
    });

    $('[data-email], [data-contact], [data-e-mail]').each((_, el) => {
      const val = $(el).attr('data-email') || $(el).attr('data-contact') || $(el).attr('data-e-mail') || '';
      extractFromText(val, storeHost).forEach((e) => add(e, 'plain', CONFIDENCE.plain));
    });

    $('footer, [role="contentinfo"], .footer, #footer, .site-footer').each((_, el) => {
      extractFromText($(el).text(), storeHost).forEach((e) => add(e, 'footer', CONFIDENCE.footer));
    });

    $('header, [role="banner"], .header, .nav, nav').each((_, el) => {
      extractFromText($(el).text(), storeHost).forEach((e) => add(e, 'nav', CONFIDENCE.nav));
    });

    extractFromText($('body').text(), storeHost).forEach((e) => add(e, 'plain', CONFIDENCE.plain));

    extractJsonLdAndScriptEmails(html).forEach((e) => {
      if (isValidEmail(e, storeHost) && allowedByProviders(e, includeProviders, storeHost)) {
        add(e, 'schema', CONFIDENCE.schema);
      }
    });
  } catch (_) {}

  return [...byEmail.values()];
}

/**
 * Extract from multiple pages. Returns one best email per store by default (options.onePerStore = false for all).
 * When no email is found, caller should store the store as "No public email detected" (has_email=0).
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const storeHost = getStoreHost(storeUrl);
  const includeProviders = Array.isArray(options.includeProviders)
    ? options.includeProviders
    : Array.isArray(options.include_providers)
      ? options.include_providers
      : [];
  const onePerStore = options.onePerStore !== false;

  const byEmail = new Map();
  let platform = null;

  for (const { url, html } of pages) {
    try {
      if (!platform) platform = detectPlatform(html);
      const candidates = extractFromPage(url, html, storeHost, includeProviders);
      for (const c of candidates) {
        const key = c.email;
        const existing = byEmail.get(key);
        if (!existing || c.confidence > existing.confidence) {
          byEmail.set(key, { ...c, storeUrl });
        }
      }
    } catch (_) {}
  }

  const list = [...byEmail.values()];
  if (list.length === 0) return [];
  if (onePerStore) {
    const best = list.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
    return [{ email: best.email, storeUrl: best.storeUrl, sourcePage: best.sourcePage, sourceType: best.sourceType, platform }];
  }
  return list.map((c) => ({ email: c.email, storeUrl: c.storeUrl, sourcePage: c.sourcePage, sourceType: c.sourceType, platform }));
}
