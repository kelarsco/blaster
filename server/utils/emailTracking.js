/**
 * Open-tracking pixel helpers for HTML campaign emails.
 */

function normalizeOrigin(value, fallback = '') {
  const raw = String(value || fallback || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, '');
}

function isLocalUrl(url) {
  const u = normalizeOrigin(url).toLowerCase();
  return u.startsWith('http://localhost') || u.startsWith('https://localhost') || u.includes('://127.0.0.1');
}

/** Public origin where /api/track is reachable (same host as API in prod). */
export function resolvePublicApiOrigin() {
  const explicit = (
    process.env.API_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    process.env.GOOGLE_CALLBACK_BASE_URL ||
    ''
  ).trim();
  if (explicit && !isLocalUrl(explicit)) return normalizeOrigin(explicit);

  const frontend = (process.env.FRONTEND_URL || process.env.BASE_URL || process.env.PUBLIC_APP_URL || '').trim();
  if (frontend && !isLocalUrl(frontend)) return normalizeOrigin(frontend);

  if (process.env.NODE_ENV === 'production') return 'https://wiblaster.com';
  return normalizeOrigin(process.env.API_URL || 'http://localhost:4000');
}

export function buildOpenTrackUrl(trackingToken) {
  if (!trackingToken) return '';
  const base = resolvePublicApiOrigin();
  const token = encodeURIComponent(String(trackingToken));
  return `${base}/api/track/open/${token}.gif`;
}

export function buildInvisibleTrackingPixel(trackUrl) {
  if (!trackUrl) return '';
  const src = String(trackUrl).replace(/"/g, '&quot;');
  return `<img src="${src}" width="1" height="1" alt="" border="0" style="width:1px!important;height:1px!important;max-width:1px!important;max-height:1px!important;opacity:0!important;visibility:hidden!important;display:block!important;border:0!important;line-height:0!important;font-size:0!important;mso-hide:all;" />`;
}

/** Append a 1×1 open-tracking pixel to HTML email bodies (admin templates). */
export function injectTrackingPixel(html, trackUrl) {
  const pixel = buildInvisibleTrackingPixel(trackUrl);
  if (!pixel) return html;
  const body = String(html || '');
  if (!body.trim()) return pixel;

  if (/<\/body>/i.test(body)) {
    return body.replace(/<\/body>/i, `${pixel}</body>`);
  }
  if (/<\/html>/i.test(body)) {
    return body.replace(/<\/html>/i, `${pixel}</html>`);
  }
  return `${body}${pixel}`;
}
