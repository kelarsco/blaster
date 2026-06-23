/** Shared contact validation for export and display. */

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

const PLACEHOLDER_EMAILS = new Set([
  'you@example.com',
  'email@example.com',
  'test@example.com',
  'name@example.com',
  'your@email.com',
  'your.email@example.com',
  'info@yourwebsite.com',
  'info@yourdomain.com',
  'support@yourdomain.com',
  'help@mystore.com',
  'hello@mystore.com',
  'contact@mystore.com',
  'admin@example.com',
  'user@example.com',
  'mail@example.com',
  'example@example.com',
  'tu@correo.com',
]);

const EMAIL_RE =
  /^[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]{0,63}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,10}$/i;

function handleFromUrl(value, pattern) {
  const m = String(value).match(pattern);
  return m ? m[1] : null;
}

function isRetinaAssetHandle(handle) {
  return /^\d+x$/i.test(handle) || /\.(png|jpe?g|gif|webp|svg|ico|js|css|woff2?)$/i.test(handle);
}

export function validateInstagram(value) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || /\/(p|reel|reels|stories|explore|tv)\//i.test(raw)) return null;

  let handle = handleFromUrl(raw, /instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!handle) handle = raw.replace(/^@/, '').split('/')[0].split('?')[0];
  handle = handle.toLowerCase();

  if (!handle || handle.length < 2 || handle.length > 30) return null;
  if (IGNORE_IG_HANDLES.has(handle)) return null;
  if (!/^[a-z0-9._]+$/.test(handle)) return null;
  if (isRetinaAssetHandle(handle)) return null;

  return `https://instagram.com/${handle}`;
}

export function validateTiktok(value) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || /\/video\//i.test(raw)) return null;

  let handle = handleFromUrl(raw, /tiktok\.com\/@?([A-Za-z0-9._]+)/i);
  if (!handle) handle = raw.replace(/^@/, '').split('/')[0].split('?')[0];
  handle = handle.toLowerCase();

  if (!handle || handle.length < 2 || handle.length > 24) return null;
  if (IGNORE_TT_HANDLES.has(handle)) return null;
  if (!/^[a-z0-9._]+$/.test(handle)) return null;
  if (isRetinaAssetHandle(handle)) return null;

  return `https://tiktok.com/@${handle}`;
}

export function validatePhone(value) {
  if (!value || typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits === '1234567890' || digits === '0123456789') return null;
  return `+${digits}`;
}

export function validateWhatsApp(value) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  const waMe = raw.match(/wa\.me\/(\d{8,15})/i);
  if (waMe) return `https://wa.me/${waMe[1]}`;
  const api = raw.match(/phone=(\d{8,15})/i);
  if (api) return `https://wa.me/${api[1]}`;
  return null;
}

export function validateExportEmail(value) {
  if (!value || typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return null;
  if (PLACEHOLDER_EMAILS.has(email)) return null;
  if (/\.(png|jpe?g|gif|webp|svg|js|css)$/i.test(email.split('@')[1] || '')) return null;
  return email;
}

export function sanitizeStoreRecord(store) {
  if (!store) return null;
  const seen = new Set();
  const emails = [];
  for (const entry of store.emails || []) {
    const email = validateExportEmail(entry?.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push({ ...entry, email });
  }

  return {
    ...store,
    storeUrl: store.storeUrl || store.store_url || '',
    emails,
    phone: validatePhone(store.phone),
    whatsapp: validateWhatsApp(store.whatsapp),
    instagram: validateInstagram(store.instagram),
    tiktok: validateTiktok(store.tiktok),
  };
}

export function storeHasValidExtractedData(store, extractOptions) {
  if (!store || !extractOptions) return false;
  if (extractOptions.email && store.emails?.length) return true;
  if (extractOptions.phone && store.phone) return true;
  if (extractOptions.whatsapp && store.whatsapp) return true;
  if (extractOptions.instagram && store.instagram) return true;
  if (extractOptions.tiktok && store.tiktok) return true;
  return false;
}
