/**
 * Extract phone numbers, WhatsApp, Instagram, and TikTok from crawled pages.
 * Uses the same page set as email extraction (HTML + Shopify policy JSON).
 */
import { load } from 'cheerio';
import {
  sanitizeExtractedContacts,
  validateInstagramUrl,
  validatePhoneNumber,
  validateTiktokUrl,
  validateWhatsAppUrl,
} from './contactValidation.js';

const INSTAGRAM_PATH_RE = /instagram\.com\/([A-Za-z0-9._]+)/gi;
const TIKTOK_PATH_RE = /tiktok\.com\/@?([A-Za-z0-9._]+)/gi;
const WA_ME_RE = /wa\.me\/(\d{8,15})/gi;
const WA_API_RE = /api\.whatsapp\.com\/send\?[^"'\s]*/gi;
const PHONE_TEXT_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const IG_HANDLE_TEXT_RE = /(?:^|[\s(])(@)([A-Za-z0-9._]{2,30})\b/g;

const SOCIAL_SELECTORS =
  'footer, .footer, #footer, .site-footer, [role="contentinfo"], [class*="footer"], [id*="footer"], #shopify-section-footer, .social, [class*="social"], header, [class*="header-icons"]';

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function storeBrandHint(storeHost) {
  if (!storeHost) return '';
  return storeHost.replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizePhoneDigits(raw) {
  return validatePhoneNumber(raw);
}

function normalizeWhatsAppUrl(raw) {
  return validateWhatsAppUrl(raw);
}

function normalizeInstagram(usernameOrUrl) {
  return validateInstagramUrl(usernameOrUrl);
}

function normalizeTiktok(usernameOrUrl) {
  return validateTiktokUrl(usernameOrUrl);
}

function walkJsonLdContacts(node, collectors) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLdContacts(item, collectors);
    return;
  }
  if (typeof node !== 'object') return;

  if (typeof node.telephone === 'string') {
    const phone = normalizePhoneDigits(node.telephone);
    if (phone) collectors.phone.add(phone);
  }
  if (Array.isArray(node.telephone)) {
    for (const t of node.telephone) {
      const phone = normalizePhoneDigits(String(t));
      if (phone) collectors.phone.add(phone);
    }
  }

  const sameAs = node.sameAs;
  const links = Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : [];
  for (const link of links) {
    if (typeof link !== 'string') continue;
    const ig = normalizeInstagram(link);
    if (ig) collectors.instagram.add(ig);
    const tk = normalizeTiktok(link);
    if (tk) collectors.tiktok.add(tk);
  }

  if (node.contactPoint) walkJsonLdContacts(node.contactPoint, collectors);
  if (node['@graph']) walkJsonLdContacts(node['@graph'], collectors);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') walkJsonLdContacts(value, collectors);
  }
}

function scanTextForContacts(text, collectors) {
  const decoded = decodeHtmlEntities(text);

  let m;
  INSTAGRAM_PATH_RE.lastIndex = 0;
  while ((m = INSTAGRAM_PATH_RE.exec(decoded)) !== null) {
    const ig = normalizeInstagram(m[1]);
    if (ig) collectors.instagram.add(ig);
  }

  TIKTOK_PATH_RE.lastIndex = 0;
  while ((m = TIKTOK_PATH_RE.exec(decoded)) !== null) {
    const tk = normalizeTiktok(m[1]);
    if (tk) collectors.tiktok.add(tk);
  }

  WA_ME_RE.lastIndex = 0;
  while ((m = WA_ME_RE.exec(decoded)) !== null) {
    collectors.whatsapp.add(`https://wa.me/${m[1]}`);
    collectors.phone.add(`+${m[1]}`);
  }

  WA_API_RE.lastIndex = 0;
  while ((m = WA_API_RE.exec(decoded)) !== null) {
    const wa = normalizeWhatsAppUrl(m[0]);
    if (wa) collectors.whatsapp.add(wa);
  }

  PHONE_TEXT_RE.lastIndex = 0;
  while ((m = PHONE_TEXT_RE.exec(decoded)) !== null) {
    const phone = normalizePhoneDigits(m[0]);
    if (phone) collectors.phone.add(phone);
  }

  IG_HANDLE_TEXT_RE.lastIndex = 0;
  while ((m = IG_HANDLE_TEXT_RE.exec(decoded)) !== null) {
    const ig = normalizeInstagram(m[2]);
    if (ig) collectors.instagram.add(ig);
  }
}

function extractFromHtml(url, html, collectors) {
  if (!html || typeof html !== 'string') return;
  const slice = html.length > 700000 ? html.slice(0, 700000) : html;
  let $;
  try {
    $ = load(slice, { decodeEntities: true });
  } catch {
    scanTextForContacts(slice, collectors);
    return;
  }

  $('a[href*="instagram.com"], a[href*="instagr.am"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const ig = normalizeInstagram(href);
    if (ig) collectors.instagram.add(ig);
  });

  $('a[href*="tiktok.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const tk = normalizeTiktok(href);
    if (tk) collectors.tiktok.add(tk);
  });

  $('a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="api.whatsapp.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const wa = normalizeWhatsAppUrl(href);
    if (wa) collectors.whatsapp.add(wa);
    const phone = normalizePhoneDigits(href);
    if (phone) collectors.phone.add(phone);
  });

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const phone = normalizePhoneDigits(href);
    if (phone) collectors.phone.add(phone);
  });

  const socialText = $(SOCIAL_SELECTORS).text();
  scanTextForContacts(socialText, collectors);

  const scripts = slice.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (scripts) {
    for (const tag of scripts) {
      const raw = tag.replace(/<script[^>]*>([\s\S]*)<\/script>/i, '$1').replace(/<!--[\s\S]*?-->/g, '').trim();
      try {
        walkJsonLdContacts(JSON.parse(raw), collectors);
      } catch (_) {}
    }
  }

  $('script:not([src])').each((_, el) => {
    const text = $(el).html() || '';
    if (/instagram|tiktok|whatsapp|wa\.me|telephone/i.test(text)) {
      scanTextForContacts(text, collectors);
    }
  });
}

function rankSocialUrl(url, brand) {
  if (!url || !brand) return 0;
  const lower = url.toLowerCase();
  if (lower.includes(brand)) return 100;
  return 10;
}

function pickBestSocial(set, brand) {
  if (!set?.size) return null;
  const list = [...set];
  list.sort((a, b) => rankSocialUrl(b, brand) - rankSocialUrl(a, brand) || a.length - b.length);
  return list[0];
}

function pickBestPhone(set) {
  if (!set?.size) return null;
  const list = [...set];
  list.sort((a, b) => b.length - a.length);
  return list[0];
}

/**
 * @param {string} storeUrl
 * @param {Array<{url: string, html: string}>} pages
 * @param {{ phone?: boolean, whatsapp?: boolean, instagram?: boolean, tiktok?: boolean }} options
 */
export function extractContactsFromPages(storeUrl, pages, options = {}) {
  const wantPhone = options.phone || options.whatsapp;
  const wantWhatsapp = options.whatsapp;
  const wantInstagram = options.instagram;
  const wantTiktok = options.tiktok;

  if (!wantPhone && !wantWhatsapp && !wantInstagram && !wantTiktok) {
    return { phone: null, whatsapp: null, instagram: null, tiktok: null, storeUrl };
  }

  const collectors = {
    phone: new Set(),
    whatsapp: new Set(),
    instagram: new Set(),
    tiktok: new Set(),
  };

  let storeHost = '';
  try {
    storeHost = new URL(storeUrl.startsWith('http') ? storeUrl : `https://${storeUrl}`).hostname;
  } catch (_) {}
  const brand = storeBrandHint(storeHost);

  for (const { html } of pages || []) {
    extractFromHtml('', html, collectors);
  }

  const whatsapp = wantWhatsapp ? pickBestSocial(collectors.whatsapp, brand) || pickBestSocial(collectors.whatsapp, '') : null;
  let phone = wantPhone ? pickBestPhone(collectors.phone) : null;

  if (!phone && whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length >= 8) phone = `+${digits}`;
  }

  const sanitized = sanitizeExtractedContacts({
    phone: wantPhone ? phone : null,
    whatsapp,
    instagram: wantInstagram ? pickBestSocial(collectors.instagram, brand) : null,
    tiktok: wantTiktok ? pickBestSocial(collectors.tiktok, brand) : null,
  });

  return {
    ...sanitized,
    storeUrl,
  };
}

export function hasAnyContactData(contacts, extractOptions) {
  if (!contacts || !extractOptions) return false;
  if (extractOptions.phone && contacts.phone) return true;
  if (extractOptions.whatsapp && contacts.whatsapp) return true;
  if (extractOptions.instagram && contacts.instagram) return true;
  if (extractOptions.tiktok && contacts.tiktok) return true;
  return false;
}

export function storeHasExtractedData(emailResults, contacts, extractOptions) {
  if (extractOptions?.email && emailResults?.length > 0) return true;
  return hasAnyContactData(contacts, extractOptions);
}
