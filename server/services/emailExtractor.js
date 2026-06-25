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

/** Words glued to the local part when labels sit flush against the address (common on FR pages). */
const LOCAL_PART_LABEL_PREFIXES = [
  'adresseelectronique',
  'adressee',
  'direccion',
  'dirección',
  'courrier',
  'courriel',
  'adresse',
  'address',
  'correo',
  'contact',
  'email',
  'e-mail',
  'mail',
  'adres',
].sort((a, b) => b.length - a.length);

const GLUED_LABEL_BEFORE_EMAIL_RE = new RegExp(
  `(?:${LOCAL_PART_LABEL_PREFIXES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=[a-z0-9][a-z0-9._%+-]*@)`,
  'gi'
);

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

function isValidLocalPart(local) {
  return local && local.length >= 1 && local.length <= 64 && /^[a-z0-9._%+-]+$/.test(local);
}

/** Strip label words accidentally concatenated onto the local part (e.g. adresse + accompagnement). */
export function stripGluedLabelsFromLocal(local) {
  if (!local || typeof local !== 'string') return local;
  let current = local.toLowerCase();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of LOCAL_PART_LABEL_PREFIXES) {
      if (current.startsWith(prefix) && current.length > prefix.length + 1) {
        const rest = current.slice(prefix.length);
        if (/^[a-z0-9]/.test(rest) && isValidLocalPart(rest)) {
          current = rest;
          changed = true;
          break;
        }
      }
    }
  }
  return current;
}

function preprocessHtmlForEmails(text) {
  let out = text;
  let prev;
  do {
    prev = out;
    out = out.replace(GLUED_LABEL_BEFORE_EMAIL_RE, '');
  } while (out !== prev);
  return out;
}
function isAcceptableDomain(domain) {
  const d = (domain || '').toLowerCase().trim();
  if (!d || !d.includes('.')) return false;
  if (FAKE_DOMAINS.has(d)) return false;
  const tld = d.split('.').pop();
  if (!tld || tld.length < 2 || !/^[a-z]{2,63}$/i.test(tld)) return false;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z0-9.-]+$/i.test(d);
}

function normalizeMatch(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().replace(/^mailto:/i, '').split(/[?&,;<\s"']+/)[0].trim().toLowerCase();
  if (s.length < 4 || s.length > 120 || !s.includes('@')) return null;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(s)) return null;
  const at = s.indexOf('@');
  if (at <= 0 || at >= s.length - 1) return null;
  let local = s.slice(0, at);
  const domain = s.slice(at + 1);
  local = stripGluedLabelsFromLocal(local);
  if (!isValidLocalPart(local)) return null;
  return `${local}@${domain}`;
}

function passesFilters(email, emailFilters = {}) {
  const hasTypeFilter =
    (emailFilters.types && Array.isArray(emailFilters.types) && emailFilters.types.length > 0) ||
    emailFilters.type;
  if (!hasTypeFilter && emailFilters.allowNoreply !== false) return true;
  const type = getEmailType(email);
  if (type === 'noreply' && emailFilters.allowNoreply === false) return false;
  if (emailFilters.types && Array.isArray(emailFilters.types) && emailFilters.types.length) {
    return emailFilters.types.includes(type);
  }
  if (emailFilters.type && emailFilters.type !== type) return false;
  return true;
}

function extractFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  const text = preprocessHtmlForEmails(decodeBasicEntities(html));
  const matches = text.match(EMAIL_REGEX) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const email = normalizeMatch(m);
    if (!email || seen.has(email)) continue;
    const domain = email.slice(email.indexOf('@') + 1);
    if (!isAcceptableDomain(domain)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function scoreEmail(email, sourcePage) {
  let score = 0;
  const page = (sourcePage || '').toLowerCase();

  if (/policies\/privacy-policy|privacy-policy/.test(page)) score += 80;
  else if (/pages\/contact|\/contact/.test(page)) score += 50;
  else if (page.endsWith('/') || page.match(/\/$/)) score += 20;

  if (/^privacy@/.test(email) && /privacy/.test(page)) score += 70;

  return score;
}

/**
 * Extract all valid emails from crawled pages (Gmail, store domain, third-party — no type bias).
 */
export function extractEmailsFromPages(storeUrl, pages, options = {}) {
  const onePerStore = options.onePerStore === true;
  const maxEmails = Math.max(1, Number(options.maxEmails) || 50);
  const privacyPageFound = options.privacyPageFound === true;
  const emailFilters = options.emailFilters || options.email_filters || {};

  const storeHost = getStoreHost(storeUrl);
  const candidates = [];

  for (const { url, html } of pages || []) {
    for (const email of extractFromHtml(html)) {
      if (!passesFilters(email, emailFilters)) continue;
      candidates.push({
        email,
        sourcePage: url,
        storeUrl,
        score: scoreEmail(email, url),
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
