// Match email-like strings (we validate domain separately)
const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

/** Allowed mail domains – real providers and common business TLDs for store domains. */
const REAL_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'live.co.uk', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me', 'aol.com', 'zoho.com',
  'mail.com', 'gmx.com', 'gmx.de', 'yandex.com', 'yandex.ru', 'fastmail.com', 'tutanota.com',
  'att.net', 'comcast.net', 'verizon.net', 'btinternet.com', 'virginmedia.com', 'sky.com',
]);

/** Domains that are clearly placeholders / fake – never allow. */
const FAKE_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'test.com', 'email.com', 'domain.com',
  'yourdomain.com', 'youremail.com', 'placeholder.com', 'sample.com', 'mailinator.com',
]);

const SKIP_PREFIXES = ['example@', 'test@', 'you@', 'email@', 'user@', 'noreply@', 'no-reply@'];
const CONTACT_PREFIXES = ['support@', 'info@', 'contact@', 'hello@', 'sales@', 'help@'];

/**
 * Return true only if the email domain is a known real provider or the store's own domain.
 * Allows: @gmail.com, @outlook.com, etc. and *@store-domain (e.g. support@store.com).
 */
function isRealEmailDomain(email, storeOriginHost = '') {
  const lower = email.toLowerCase().trim();
  const at = lower.indexOf('@');
  if (at === -1) return false;
  const domain = lower.slice(at + 1);
  if (FAKE_DOMAINS.has(domain)) return false;
  if (REAL_MAIL_DOMAINS.has(domain)) return true;
  // Allow *@store's own domain (e.g. support@myshop.com when store is myshop.com)
  if (storeOriginHost && (domain === storeOriginHost || domain.endsWith('.' + storeOriginHost))) return true;
  return false;
}

/**
 * Extract unique email addresses from HTML text; only returns real-looking emails.
 */
function extractEmailsFromText(text, storeOriginHost = '') {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(EMAIL_REGEX) || [];
  const normalized = matches
    .map((e) => e.toLowerCase().trim())
    .filter((e) => {
      if (e.length < 6 || e.length > 120 || !e.includes('@')) return false;
      if (e.endsWith('.png') || e.endsWith('.jpg') || e.endsWith('.gif') || e.endsWith('.svg')) return false;
      return isRealEmailDomain(e, storeOriginHost);
    });
  return [...new Set(normalized)];
}

/**
 * Classify email by prefix (support, info, contact, noreply, etc.).
 */
export function getEmailType(email) {
  const lower = email.toLowerCase();
  for (const p of SKIP_PREFIXES) if (lower.startsWith(p)) return 'noreply';
  for (const p of CONTACT_PREFIXES) if (lower.startsWith(p)) return 'contact';
  return 'other';
}

/**
 * Filter emails by include/exclude types.
 * includeTypes: ['contact','other'] => include support, info, contact, other
 * excludeTypes: ['noreply'] => exclude noreply
 */
export function filterEmailsByType(emails, options = {}) {
  const { includeTypes = ['contact', 'other'], excludeTypes = ['noreply'] } = options;
  return emails.filter((email) => {
    const type = getEmailType(email);
    if (excludeTypes.includes(type)) return false;
    if (includeTypes.length && !includeTypes.includes(type)) return false;
    return true;
  });
}

/**
 * Get host from store URL for allowing *@storeDomain.
 */
function getStoreHost(storeUrl) {
  try {
    const u = new URL(storeUrl.startsWith('http') ? storeUrl : 'https://' + storeUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Extract emails from crawled pages; only real domains (gmail, outlook, store domain, etc.).
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const storeHost = getStoreHost(storeUrl);
  const byEmail = new Map();
  for (const { url, html } of pages) {
    const emails = extractEmailsFromText(html, storeHost);
    for (const email of emails) {
      if (!byEmail.has(email)) {
        byEmail.set(email, { storeUrl, sourcePage: url, type: getEmailType(email) });
      }
    }
  }
  let list = [...byEmail.entries()].map(([email, meta]) => ({ email, ...meta }));
  list = filterEmailsByType(list.map((r) => r.email), options).map((email) => {
    const meta = byEmail.get(email);
    return { email, storeUrl: meta.storeUrl, sourcePage: meta.sourcePage, type: meta.type };
  });
  return list;
}
