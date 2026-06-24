/**
 * Regex email extraction over raw HTML — no DOM parsing.
 */
const EMAIL_REGEX =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

const REAL_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'zoho.com',
]);

const FAKE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'email.com',
  'domain.com',
  'yourdomain.com',
  'youremail.com',
  'placeholder.com',
  'sample.com',
  'mailinator.com',
  'sentry.io',
  'wixpress.com',
  'schema.org',
]);

const NOREPLY_PREFIXES = ['example@', 'test@', 'you@', 'email@', 'user@', 'noreply@', 'no-reply@'];
const CONTACT_PREFIXES = ['support@', 'info@', 'contact@', 'hello@', 'sales@', 'help@'];

function decodeBasicEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#64;/g, '@')
    .replace(/&#x40;/gi, '@');
}

function getStoreHost(storeUrl) {
  try {
    const u = new URL((storeUrl || '').startsWith('http') ? storeUrl : `https://${storeUrl}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function getEmailType(email) {
  const lower = (email || '').toLowerCase();
  for (const p of NOREPLY_PREFIXES) {
    if (lower.startsWith(p)) return 'noreply';
  }
  for (const p of CONTACT_PREFIXES) {
    if (lower.startsWith(p)) return 'contact';
  }
  return 'other';
}

export function getEmailProvider(email, storeOriginHost = '') {
  const lower = (email || '').toLowerCase().trim();
  const at = lower.indexOf('@');
  if (at === -1) return 'other';
  const domain = lower.slice(at + 1);
  const storeHost = (storeOriginHost || '').toLowerCase();
  if (storeHost && (domain === storeHost || domain.endsWith(`.${storeHost}`))) return 'domain';
  if (REAL_MAIL_DOMAINS.has(domain)) return domain.split('.')[0];
  return 'other';
}

function isRealEmailDomain(domain, storeHost) {
  const d = (domain || '').toLowerCase().trim();
  if (!d || FAKE_DOMAINS.has(d)) return false;
  if (REAL_MAIL_DOMAINS.has(d)) return true;
  if (storeHost && (d === storeHost || d.endsWith(`.${storeHost}`))) return true;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(d)) return true;
  return false;
}

function normalizeMatch(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().replace(/^mailto:/i, '').split(/[?&,;<\s"']+/)[0].trim().toLowerCase();
  if (s.length < 4 || s.length > 120 || !s.includes('@')) return null;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(s)) return null;
  const at = s.indexOf('@');
  if (at <= 0 || at >= s.length - 1) return null;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!/^[a-z0-9._%+-]+$/.test(local)) return null;
  return `${local}@${domain}`;
}

function passesFilters(email, emailFilters = {}) {
  const type = getEmailType(email);
  if (type === 'noreply' && emailFilters.allowNoreply !== true) return false;
  if (emailFilters.types && Array.isArray(emailFilters.types) && emailFilters.types.length) {
    return emailFilters.types.includes(type);
  }
  if (emailFilters.type && emailFilters.type !== type) return false;
  return true;
}

function extractFromHtml(html, storeHost) {
  if (!html || typeof html !== 'string') return [];
  const text = decodeBasicEntities(html);
  const matches = text.match(EMAIL_REGEX) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const email = normalizeMatch(m);
    if (!email || seen.has(email)) continue;
    const domain = email.slice(email.indexOf('@') + 1);
    if (!isRealEmailDomain(domain, storeHost)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function scoreEmail(email, sourcePage, storeHost) {
  let score = 0;
  const type = getEmailType(email);
  const domain = email.slice(email.indexOf('@') + 1);
  const page = (sourcePage || '').toLowerCase();

  if (type === 'contact') score += 60;
  else if (type === 'other') score += 30;
  else score -= 100;

  if (/policies\/privacy-policy|privacy-policy/.test(page)) score += 80;
  else if (/pages\/contact|\/contact/.test(page)) score += 50;
  else if (page.endsWith('/') || page.match(/\/$/)) score += 20;

  if (domain === storeHost || domain.endsWith(`.${storeHost}`)) score += 40;
  if (REAL_MAIL_DOMAINS.has(domain)) score += 15;
  if (/^privacy@/.test(email) && /privacy/.test(page)) score += 70;

  return score;
}

/**
 * Extract the best contact email(s) from crawled pages.
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const onePerStore = options.onePerStore !== false;
  const maxEmails = Math.max(1, Number(options.maxEmails) || 8);
  const privacyPageFound = options.privacyPageFound === true;
  const emailFilters = options.emailFilters || options.email_filters || {};

  const storeHost = getStoreHost(storeUrl);
  const candidates = [];

  for (const { url, html } of pages || []) {
    for (const email of extractFromHtml(html, storeHost)) {
      if (!passesFilters(email, emailFilters)) continue;
      candidates.push({
        email,
        sourcePage: url,
        storeUrl,
        score: scoreEmail(email, url, storeHost),
      });
    }
  }

  if (candidates.length === 0) return [];

  const byEmail = new Map();
  for (const c of candidates) {
    const prev = byEmail.get(c.email);
    if (!prev || c.score > prev.score) byEmail.set(c.email, c);
  }

  const ranked = [...byEmail.values()].sort((a, b) => b.score - a.score);
  const selected = onePerStore ? ranked.slice(0, 1) : ranked.slice(0, maxEmails);

  return selected.map((row) => ({
    email: row.email,
    storeUrl: row.storeUrl,
    sourcePage: privacyPageFound ? row.sourcePage : `Privacy Page Not Found | ${row.sourcePage || ''}`,
    sourceType: getEmailType(row.email),
    storeHost,
  }));
}
