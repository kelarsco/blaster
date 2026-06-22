/**
 * Read store HTML and pick one legitimate contact email per store when available.
 * Crawls multiple pages, collects every visible address, then ranks to the best contact.
 */
import { load } from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

const ALLOWED_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'hotmail.com', 'hotmail.co.uk',
  'icloud.com', 'me.com', 'mac.com',
]);

const KNOWN_TLDS = [
  'co.uk', 'org.uk', 'com.au', 'co.nz', 'co.za', 'com.br', 'com.mx',
  'com', 'org', 'net', 'co', 'io', 'uk', 'eu', 'de', 'fr', 'es', 'it', 'nl', 'info', 'biz', 'me', 'us', 'ca', 'au', 'nz', 'store', 'shop', 'online', 'site', 'cloud', 'tech', 'app', 'dev',
];

const FAKE_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'test.com', 'email.com', 'domain.com',
  'yourdomain.com', 'youremail.com', 'placeholder.com', 'sample.com', 'mailinator.com',
  'sentry.io', 'wixpress.com', 'schema.org',
]);

/** French store pages often prefix the local part with "adresse"/"addresse" (address label). */
const FRENCH_ADDRESS_LOCAL_PREFIX = /^(?:addresse|adresse)/i;

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

function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;
  const d = domain.toLowerCase().trim();
  for (const tld of KNOWN_TLDS) {
    const suffix = `.${tld}`;
    const idx = d.indexOf(suffix);
    if (idx === -1) continue;
    const after = d.slice(idx + suffix.length);
    if (after.length === 0) return d;
    if (/^[a-zA-Z0-9.-]+$/.test(after)) return d.slice(0, idx + suffix.length);
  }
  const lastDot = d.lastIndexOf('.');
  if (lastDot > 0) {
    const tld = d.slice(lastDot + 1);
    if (/^[a-zA-Z]{2,6}$/.test(tld) && !/[0-9]/.test(tld)) return d;
  }
  return null;
}

function stripPlusAlias(local) {
  if (!local || !local.includes('+')) return local;
  const plusIdx = local.indexOf('+');
  const before = local.slice(0, plusIdx);
  const after = local.slice(plusIdx + 1);
  if (FRENCH_ADDRESS_LOCAL_PREFIX.test(before) || /^(?:addresse|adresse|tag|alias|email)$/i.test(before)) {
    return (after || before).replace(/^\+/, '');
  }
  return before;
}

function normalizeEmail(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().replace(/^mailto:/i, '').split(/[?&,;]+/)[0].trim();
  const at = s.indexOf('@');
  if (at <= 0 || at >= s.length - 1) return null;
  let local = stripFrenchAddressLocalPrefix(s.slice(0, at).trim().toLowerCase());
  local = stripPlusAlias(local);
  const domain = normalizeDomain(s.slice(at + 1).trim());
  if (!local || !domain) return null;
  return `${local}@${domain}`;
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

function isBadLocalPart(local) {
  if (!local || local.length < 2) return true;
  if (/[{}'"\\\/]/.test(local)) return true;
  return false;
}

function hasValidTld(domain) {
  if (!domain || !domain.includes('.')) return false;
  const tld = domain.split('.').pop();
  return /^[a-zA-Z]{2,63}$/.test(tld);
}

function hasCleanEnding(domain) {
  if (/\.(com|net|org)\.([a-z0-9.-]+)$/i.test(domain)) return false;
  return true;
}

function isAllowedEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (lower.length < 6 || lower.length > 254) return false;
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

function toCanonicalEmail(email) {
  const n = normalizeEmail(email);
  return n && isAllowedEmail(n) ? n.toLowerCase().trim() : null;
}

function getStoreHost(storeUrl) {
  try {
    const u = new URL((storeUrl || '').startsWith('http') ? storeUrl : `https://${storeUrl}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
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
  if (storeHost && (domain === storeHost || domain.endsWith(`.${storeHost}`))) return 'domain';
  if (ALLOWED_PROVIDERS.has(domain)) return domain.split('.')[0];
  return 'other';
}

export function getEmailType(email) {
  const lower = (email || '').toLowerCase();
  const contact = ['support@', 'info@', 'contact@', 'hello@', 'sales@', 'help@', 'team@'];
  for (const p of contact) if (lower.startsWith(p)) return 'contact';
  return 'other';
}

function walkJsonLdEmails(node, sink) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLdEmails(item, sink);
    return;
  }
  if (typeof node !== 'object') return;
  if (typeof node.email === 'string') sink(node.email);
  if (Array.isArray(node.email)) node.email.forEach((e) => typeof e === 'string' && sink(e));
  if (node.contactPoint) walkJsonLdEmails(node.contactPoint, sink);
  if (node['@graph']) walkJsonLdEmails(node['@graph'], sink);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') walkJsonLdEmails(value, sink);
  }
}

const NON_CONTACT_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|bounce|newsletter|marketing|promo|unsubscribe|privacy|abuse|postmaster|webmaster|admin|test|demo|example)@/i;

function contactPageBoost(url) {
  const u = (url || '').toLowerCase();
  if (/contact|get-in-touch/.test(u)) return 55;
  if (/privacy|policies/.test(u)) return 45;
  if (/about|faq|terms|refund/.test(u)) return 25;
  return 0;
}

function scoreEmailCandidate(candidate, storeHost) {
  let score = 0;
  const email = candidate.email || '';
  const domain = email.split('@')[1] || '';
  const local = email.split('@')[0] || '';

  if (NON_CONTACT_LOCAL.test(email)) score -= 150;

  if (candidate.sourceType === 'mailto') score += 120;
  else if (candidate.sourceType === 'schema') score += 70;
  else if (candidate.sourceType === 'footer') score += 50;
  else if (candidate.sourceType === 'contact') score += 45;
  else if (candidate.sourceType === 'data') score += 40;

  score += contactPageBoost(candidate.sourcePage);

  const onStoreDomain = storeHost && (domain === storeHost || domain.endsWith(`.${storeHost}`));
  if (onStoreDomain) score += 90;
  if (/^(support|info|contact|hello|sales|help|team|customerservice|customer|enquiries|inquiry|service)@/i.test(email)) {
    score += 55;
  }
  if (ALLOWED_PROVIDERS.has(domain)) score += onStoreDomain ? 10 : 25;
  if (local.length > 40) score -= 20;
  return score;
}

function rankEmailCandidates(list, storeHost) {
  return [...list].sort((a, b) => scoreEmailCandidate(b, storeHost) - scoreEmailCandidate(a, storeHost));
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
    const canonical = toCanonicalEmail(m);
    if (canonical) out.push(canonical);
  }
  return out;
}

function extractFromPage(url, html) {
  const seen = new Set();
  const add = (email, sourceType) => {
    const key = toCanonicalEmail(email);
    if (!key || seen.has(key)) return;
    seen.add(key);
    return { email: key, sourcePage: url, sourceType };
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
    extractFromText(mailto).forEach((e) => {
      const row = add(e, 'mailto');
      if (row) out.push(row);
    });
  });

  $('[data-email], [data-contact], [data-e-mail]').each((_, el) => {
    const val = $(el).attr('data-email') || $(el).attr('data-contact') || $(el).attr('data-e-mail') || '';
    extractFromText(val).forEach((e) => {
      const row = add(e, 'data');
      if (row) out.push(row);
    });
  });

  $('input[type="email"][value], input[name*="email" i][value]').each((_, el) => {
    const val = $(el).attr('value') || '';
    extractFromText(val).forEach((e) => {
      const row = add(e, 'data');
      if (row) out.push(row);
    });
  });

  $('meta[name="contact"], meta[property="business:contact_data:email"], meta[name="email"]').each((_, el) => {
    const val = $(el).attr('content') || '';
    extractFromText(val).forEach((e) => {
      const row = add(e, 'data');
      if (row) out.push(row);
    });
  });

  const contactText = $('footer, .footer, #footer, .site-footer, [role="contentinfo"], .contact, #contact, [class*="contact"], [id*="contact"]').text();
  extractFromText(contactText).forEach((e) => {
    const row = add(e, 'contact');
    if (row) out.push(row);
  });

  const mailtoInHtml = html.match(/mailto:([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[^\s"'<>]+)/gi) || [];
  for (const token of mailtoInHtml) {
    extractFromText(token.replace(/^mailto:/i, '')).forEach((e) => {
      const row = add(e, 'mailto');
      if (row) out.push(row);
    });
  }

  const bodyText = $('body').text();
  extractFromText(bodyText).forEach((e) => {
    const row = add(e, 'text');
    if (row) out.push(row);
  });

  const footerText = $('footer, .footer, #footer, .site-footer, [role="contentinfo"]').text();
  extractFromText(footerText).forEach((e) => {
    const row = add(e, 'footer');
    if (row) out.push(row);
  });

  const scripts = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (scripts) {
    for (const tag of scripts) {
      const raw = tag.replace(/<script[^>]*>([\s\S]*)<\/script>/i, '$1').replace(/<!--[\s\S]*?-->/g, '').trim();
      try {
        const obj = JSON.parse(raw);
        walkJsonLdEmails(obj, (email) => {
          extractFromText(email).forEach((e) => {
            const row = add(e, 'schema');
            if (row) out.push(row);
          });
        });
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        extractFromText(str).forEach((e) => {
          const row = add(e, 'schema');
          if (row) out.push(row);
        });
      } catch (_) {}
    }
  }

  return out;
}

/** Return unique canonical emails found in a single HTML page. */
export function collectEmailsFromHtml(url, html) {
  const candidates = extractFromPage(url, html);
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (!c?.email || seen.has(c.email)) continue;
    seen.add(c.email);
    out.push(c.email);
  }
  return out;
}

/**
 * Extract the single best contact email from crawled HTML pages (one per store).
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const onePerStore = options.onePerStore !== false;
  const maxEmails = Math.max(1, Number(options.maxEmails) || 8);
  const privacyPageFound = options.privacyPageFound !== false;

  const byEmail = new Map();
  let platform = null;

  for (const { url, html } of (pages || [])) {
    try {
      if (!platform) platform = detectPlatform(html);
      const candidates = extractFromPage(url, html);
      for (const c of candidates) {
        if (!byEmail.has(c.email)) byEmail.set(c.email, { ...c, storeUrl });
      }
    } catch (_) {}
  }

  const storeHost = getStoreHost(storeUrl);
  const list = rankEmailCandidates([...byEmail.values()], storeHost);
  if (list.length === 0) return [];

  const selected = onePerStore ? list.slice(0, 1) : list.slice(0, maxEmails);

  return selected.map((row) => ({
    email: row.email,
    storeUrl: row.storeUrl,
    sourcePage: !privacyPageFound
      ? `Privacy Page Not Found | ${row.sourcePage || ''}`
      : row.sourcePage,
    sourceType: row.sourceType,
    platform,
    storeHost,
  }));
}
