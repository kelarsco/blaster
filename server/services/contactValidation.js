/** Contact validation used during extraction and before persisting scan results. */

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

const IGNORE_IG_HANDLES = new Set([
  'p', 'reel', 'reels', 'stories', 'explore', 'about', 'accounts', 'direct', 'login',
  'tv', 'legal', 'privacy', 'terms', 'developer', 'directory', 'intent', 'sharer',
  'share', 'media', 'embed', 'static', 'cdn', 'plugin', 'fontawesome', 'get', 'home',
  'help', 'support', 'contact', 'shop', 'store', 'www', 'http', 'https', 'instagram',
  'tiktok', 'facebook', 'twitter', 'youtube', 'pinterest', 'linkedin',
]);

const IGNORE_TT_HANDLES = new Set([
  'video', 'discover', 'tag', 'music', 'live', 'login', 'signup', 'share', 'embed',
]);

function isRetinaAssetHandle(handle) {
  return /^\d+x$/i.test(handle) || /\.(png|jpe?g|gif|webp|svg|ico|js|css|woff2?)$/i.test(handle);
}

export function validateInstagramHandle(handle) {
  if (!handle || typeof handle !== 'string') return null;
  const u = handle.replace(/^@/, '').split('/')[0].split('?')[0].toLowerCase();
  if (!u || u.length < 2 || u.length > 30) return null;
  if (IGNORE_IG_HANDLES.has(u)) return null;
  if (!/^[a-z0-9._]+$/.test(u)) return null;
  if (isRetinaAssetHandle(u)) return null;
  return `https://instagram.com/${u}`;
}

export function validateInstagramUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = decodeHtmlEntities(raw).trim();
  if (!trimmed || /\/(p|reel|reels|stories|explore|tv)\//i.test(trimmed)) return null;
  const m = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) return validateInstagramHandle(m[1]);
  return validateInstagramHandle(trimmed);
}

export function validateTiktokUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /\/video\//i.test(trimmed)) return null;
  const m = trimmed.match(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
  const handle = m ? m[1] : trimmed.replace(/^@/, '').split('/')[0].split('?')[0];
  const u = handle.toLowerCase();
  if (!u || u.length < 2 || u.length > 24) return null;
  if (IGNORE_TT_HANDLES.has(u)) return null;
  if (!/^[a-z0-9._]+$/.test(u)) return null;
  if (isRetinaAssetHandle(u)) return null;
  return `https://tiktok.com/@${u}`;
}

export function validatePhoneNumber(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  const telMatch = s.match(/^tel:([+\d\s().-]+)$/i);
  if (telMatch) s = telMatch[1];
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits === '1234567890' || digits === '0123456789') return null;
  return `+${digits}`;
}

export function validateWhatsAppUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const waMe = raw.match(/wa\.me\/(\d{8,15})/i);
  if (waMe) return `https://wa.me/${waMe[1]}`;
  const api = raw.match(/phone=(\d{8,15})/i);
  if (api) return `https://wa.me/${api[1]}`;
  return null;
}

export function sanitizeExtractedContacts(contacts = {}) {
  const whatsapp = validateWhatsAppUrl(contacts.whatsapp);
  let phone = validatePhoneNumber(contacts.phone);
  if (!phone && whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length >= 8) phone = `+${digits}`;
  }
  return {
    phone,
    whatsapp,
    instagram: validateInstagramUrl(contacts.instagram),
    tiktok: validateTiktokUrl(contacts.tiktok),
  };
}
