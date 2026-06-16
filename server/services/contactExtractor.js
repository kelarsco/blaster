/**
 * Extract phone numbers, WhatsApp, Instagram, and TikTok from crawled pages.
 */
import { load } from 'cheerio';

const INSTAGRAM_PATH_RE = /instagram\.com\/([A-Za-z0-9._]+)/gi;
const TIKTOK_PATH_RE = /tiktok\.com\/@([A-Za-z0-9._]+)/gi;
const WA_ME_RE = /wa\.me\/(\d{8,15})/gi;
const WA_API_RE = /api\.whatsapp\.com\/send\?[^"'\s]*/gi;
const PHONE_TEXT_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const IGNORE_IG = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'about', 'accounts', 'direct', 'login']);

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizePhoneDigits(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = decodeHtmlEntities(raw).trim();
  if (!s) return null;

  const telMatch = s.match(/^tel:([+\d\s().-]+)$/i);
  if (telMatch) s = telMatch[1];

  const hasPlus = s.includes('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;

  if (hasPlus || s.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function normalizeWhatsAppUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const decoded = decodeHtmlEntities(raw);
  const waMe = decoded.match(/wa\.me\/(\d{8,15})/i);
  if (waMe) return `https://wa.me/${waMe[1]}`;

  const apiMatch = decoded.match(/phone=(\d{8,15})/i);
  if (apiMatch) return `https://wa.me/${apiMatch[1]}`;

  return null;
}

function normalizeInstagram(usernameOrUrl) {
  if (!usernameOrUrl || typeof usernameOrUrl !== 'string') return null;
  let u = decodeHtmlEntities(usernameOrUrl).trim();
  const pathMatch = u.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (pathMatch) u = pathMatch[1];
  u = u.replace(/^@/, '').split('/')[0].split('?')[0].toLowerCase();
  if (!u || u.length < 2 || IGNORE_IG.has(u)) return null;
  if (!/^[a-z0-9._]+$/.test(u)) return null;
  return `https://instagram.com/${u}`;
}

function normalizeTiktok(usernameOrUrl) {
  if (!usernameOrUrl || typeof usernameOrUrl !== 'string') return null;
  let u = decodeHtmlEntities(usernameOrUrl).trim();
  const pathMatch = u.match(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
  if (pathMatch) u = pathMatch[1];
  u = u.replace(/^@/, '').split('/')[0].split('?')[0];
  if (!u || u.length < 2) return null;
  if (!/^[A-Za-z0-9._]+$/.test(u)) return null;
  return `https://tiktok.com/@${u}`;
}

function extractFromHtml(url, html, collectors) {
  if (!html || typeof html !== 'string') return;
  const slice = html.length > 700000 ? html.slice(0, 700000) : html;
  let $;
  try {
    $ = load(slice, { decodeEntities: true });
  } catch {
    return;
  }

  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const ig = normalizeInstagram(href);
    if (ig) collectors.instagram.add(ig);
  });

  $('a[href*="tiktok.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const tk = normalizeTiktok(href);
    if (tk) collectors.tiktok.add(tk);
  });

  $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
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

  const textParts = [
    $('body').text() || '',
    $('footer, .footer, #footer').text() || '',
    slice,
  ];

  for (const text of textParts) {
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
  }
}

function pickBest(set) {
  if (!set?.size) return null;
  return [...set][0];
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
    return { phone: null, whatsapp: null, instagram: null, tiktok: null };
  }

  const collectors = {
    phone: new Set(),
    whatsapp: new Set(),
    instagram: new Set(),
    tiktok: new Set(),
  };

  for (const { url, html } of pages || []) {
    extractFromHtml(url, html, collectors);
  }

  const whatsapp = wantWhatsapp ? pickBest(collectors.whatsapp) : null;
  let phone = wantPhone ? pickBest(collectors.phone) : null;

  if (!phone && whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length >= 8) phone = `+${digits}`;
  }

  return {
    phone: wantPhone ? phone : null,
    whatsapp: whatsapp,
    instagram: wantInstagram ? pickBest(collectors.instagram) : null,
    tiktok: wantTiktok ? pickBest(collectors.tiktok) : null,
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
