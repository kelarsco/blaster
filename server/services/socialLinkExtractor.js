/**
 * Fast social link extraction from anchor hrefs only — no DOM parsing or broad HTML regex.
 */
import {
  sanitizeExtractedContacts,
  validateInstagramUrl,
  validateTiktokUrl,
  validateWhatsAppUrl,
} from './contactValidation.js';

const SOCIAL_PATTERNS = {
  instagram: /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/i,
  tiktok: /tiktok\.com\/@?([a-zA-Z0-9_.]+)/i,
};

const SKIP_INSTAGRAM_PATH = /instagram\.com\/(?:p|reel|reels|stories|explore|tv|about|accounts|legal)\//i;
const SKIP_TIKTOK_PATH = /tiktok\.com\/(?:video|discover|tag|music|live)\//i;

function extractAnchorHrefs(html) {
  if (!html || typeof html !== 'string') return [];
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
}

function resolveHref(href, pageUrl) {
  const raw = (href || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return null;
  try {
    return new URL(raw, pageUrl || undefined).href;
  } catch {
    return raw;
  }
}

function matchWhatsAppHref(href) {
  if (!href) return null;
  if (/wa\.me\/\d{8,15}/i.test(href) || /api\.whatsapp\.com\/send/i.test(href)) {
    return validateWhatsAppUrl(href) || href;
  }
  return null;
}

/**
 * @param {string} html
 * @param {string} [sourcePage]
 * @returns {{ whatsapp?: string, instagram?: string, tiktok?: string }}
 */
export function extractSocialLinks(html, sourcePage = '') {
  if (!html) return {};

  const hrefs = extractAnchorHrefs(html);
  const found = {};

  for (const rawHref of hrefs) {
    const href = resolveHref(rawHref, sourcePage);
    if (!href) continue;

    if (!found.whatsapp) {
      const wa = matchWhatsAppHref(href);
      if (wa) found.whatsapp = wa;
    }

    if (!found.instagram && !SKIP_INSTAGRAM_PATH.test(href)) {
      const match = href.match(SOCIAL_PATTERNS.instagram);
      if (match) {
        const ig = validateInstagramUrl(href);
        if (ig) found.instagram = ig;
      }
    }

    if (!found.tiktok && !SKIP_TIKTOK_PATH.test(href)) {
      const match = href.match(SOCIAL_PATTERNS.tiktok);
      if (match) {
        const tt = validateTiktokUrl(href);
        if (tt) found.tiktok = tt;
      }
    }
  }

  return found;
}

/**
 * @param {Array<{ url?: string, html: string }>} pages
 * @param {{ whatsapp?: boolean, instagram?: boolean, tiktok?: boolean }} options
 */
export function extractSocialsFromPages(pages, options = {}) {
  const wantWhatsapp = !!options.whatsapp;
  const wantInstagram = !!options.instagram;
  const wantTiktok = !!options.tiktok;

  if (!wantWhatsapp && !wantInstagram && !wantTiktok) {
    return { whatsapp: null, instagram: null, tiktok: null };
  }

  let whatsapp = null;
  let instagram = null;
  let tiktok = null;

  for (const page of pages || []) {
    const html = page?.html;
    if (!html) continue;
    const sourcePage = page.url || '';
    const links = extractSocialLinks(html, sourcePage);

    if (wantWhatsapp && !whatsapp && links.whatsapp) whatsapp = links.whatsapp;
    if (wantInstagram && !instagram && links.instagram) instagram = links.instagram;
    if (wantTiktok && !tiktok && links.tiktok) tiktok = links.tiktok;

    if (
      (!wantWhatsapp || whatsapp) &&
      (!wantInstagram || instagram) &&
      (!wantTiktok || tiktok)
    ) {
      break;
    }
  }

  return sanitizeExtractedContacts({ whatsapp, instagram, tiktok, phone: null });
}
