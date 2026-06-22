import { isRailwayDeploy, isFlyDeploy } from './oauthUrls.js';

function normalizeUrl(value) {
  return String(value || '').trim().toLowerCase();
}

function hostnameFromEnvUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function stripWww(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '');
}

/** Frontend (Vercel/custom domain) and API (fly.dev/Railway) on different hosts — cookies need SameSite=None. */
export function isCrossOriginAuthDeploy() {
  const forced = String(process.env.CROSS_ORIGIN_AUTH || '').trim().toLowerCase();
  if (forced === 'true') return true;
  if (forced === 'false') return false;

  const frontend = stripWww(hostnameFromEnvUrl(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL));
  if (!frontend) return false;

  const flyApp = String(process.env.FLY_APP_NAME || '').trim();
  const backend =
    stripWww(hostnameFromEnvUrl(process.env.API_PUBLIC_URL)) ||
    (flyApp ? `${flyApp}.fly.dev` : '') ||
    stripWww(String(process.env.RAILWAY_PUBLIC_DOMAIN || '').replace(/^https?:\/\//i, '').split('/')[0]);

  if (!backend) return false;
  return frontend !== backend;
}

function isLocalUrl(url) {
  return (
    url.startsWith('http://localhost') ||
    url.startsWith('https://localhost') ||
    url.includes('://127.0.0.1') ||
    url.includes('.localhost')
  );
}

export function shouldUseSecureCookies() {
  const forced = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();
  if (forced === 'true') return true;
  if (forced === 'false') return false;

  const frontendUrl = normalizeUrl(process.env.FRONTEND_URL || process.env.BASE_URL || '');
  if (frontendUrl && isLocalUrl(frontendUrl)) return false;

  return process.env.NODE_ENV === 'production';
}

export function getCookieSameSite() {
  const secure = shouldUseSecureCookies();
  const configured = String(process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (configured === 'strict') return 'strict';
  if (configured === 'lax') return 'lax';
  if (configured === 'none') return secure ? 'none' : 'lax';
  // Split deploy (e.g. Vercel frontend + Fly API): credentialed cross-site fetches need SameSite=None.
  if (secure && isCrossOriginAuthDeploy()) return 'none';
  // Monolith deploys (Railway/Fly) serve API + SPA on one host — lax keeps refresh cookies working.
  if (secure && (isRailwayDeploy() || isFlyDeploy())) return 'lax';
  return secure ? 'none' : 'lax';
}

export function getCookieDomain() {
  const domain = String(process.env.COOKIE_DOMAIN || '').trim();
  return domain || undefined;
}

