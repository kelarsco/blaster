/**
 * API base URL.
 * - Dev: relative /api → Vite proxy → local server
 * - Vercel (wiblaster.com): always www — apex /api 307-redirects break credentialed scan polling
 * - Fly monolith (wiblaster.fly.dev): relative /api on same host
 * - Override anytime with VITE_API_URL (no trailing slash)
 */
function normalizeApiBase(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/*/, '')}`;
}

function resolveApiBase() {
  const fromEnv = normalizeApiBase(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : ''
  );
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined' && import.meta.env?.PROD) {
    const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'wiblaster.com') {
      return 'https://www.wiblaster.com';
    }
  }

  return '';
}

export const API_BASE = resolveApiBase();
export const API = `${API_BASE}/api`;

/** Same-origin production deploy (Fly/Railway monolith) uses relative /api — treat as configured. */
export const usesDevApiProxy = Boolean(import.meta.env?.DEV) && !API_BASE;
export const hasConfiguredBackend =
  Boolean(API_BASE) || usesDevApiProxy || Boolean(import.meta.env?.PROD);
