/**
 * Extract phone, WhatsApp, Instagram, and TikTok from crawled pages.
 * Social links use anchor href parsing only (see socialLinkExtractor.js).
 */
import { validatePhoneNumber } from './contactValidation.js';
import { extractSocialsFromPages } from './socialLinkExtractor.js';

function extractPhoneFromAnchors(html) {
  if (!html || typeof html !== 'string') return null;
  const hrefs = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    const telMatch = href.match(/^tel:([+\d\s().-]+)$/i);
    if (telMatch) {
      const phone = validatePhoneNumber(telMatch[1]);
      if (phone) return phone;
    }
  }
  return null;
}

/**
 * @param {string} storeUrl
 * @param {Array<{url: string, html: string}>} pages
 * @param {{ phone?: boolean, whatsapp?: boolean, instagram?: boolean, tiktok?: boolean }} options
 */
export function extractContactsFromPages(storeUrl, pages, options = {}) {
  const wantPhone = !!options.phone;
  const wantWhatsapp = !!options.whatsapp;
  const wantInstagram = !!options.instagram;
  const wantTiktok = !!options.tiktok;

  if (!wantPhone && !wantWhatsapp && !wantInstagram && !wantTiktok) {
    return { phone: null, whatsapp: null, instagram: null, tiktok: null, storeUrl };
  }

  const socials = extractSocialsFromPages(pages, {
    whatsapp: wantWhatsapp,
    instagram: wantInstagram,
    tiktok: wantTiktok,
  });

  let phone = null;
  if (wantPhone) {
    for (const { html } of pages || []) {
      phone = extractPhoneFromAnchors(html);
      if (phone) break;
    }
  }

  if (!phone && wantPhone && socials.whatsapp) {
    const digits = socials.whatsapp.replace(/\D/g, '');
    if (digits.length >= 8) phone = `+${digits}`;
  }

  return {
    phone: wantPhone ? phone : null,
    whatsapp: wantWhatsapp ? socials.whatsapp : null,
    instagram: wantInstagram ? socials.instagram : null,
    tiktok: wantTiktok ? socials.tiktok : null,
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
