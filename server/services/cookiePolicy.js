import { isRailwayDeploy } from './oauthUrls.js';

function normalizeUrl(value) {
  return String(value || '').trim().toLowerCase();
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
  // Railway serves API + frontend on one host — lax keeps OAuth session state through redirects
  if (secure && isRailwayDeploy()) return 'lax';
  return secure ? 'none' : 'lax';
}

export function getCookieDomain() {
  const domain = String(process.env.COOKIE_DOMAIN || '').trim();
  return domain || undefined;
}

