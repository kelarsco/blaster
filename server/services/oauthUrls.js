/**
 * Resolve OAuth / frontend URLs for local dev vs production (Fly, Railway, custom domain).
 * Public site URLs (referrals, post-login redirects) prefer FRONTEND_URL / wiblaster.com
 * over fly.dev — the API may be reached via wiblaster.fly.dev while the app lives on wiblaster.com.
 */

const CANONICAL_SITE_URL = 'https://wiblaster.com';

function isFlyDevHost(host) {
  return String(host || '').toLowerCase().endsWith('.fly.dev');
}

function normalizeUrl(value, fallback = '') {
  const raw = (value || fallback || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, '');
}

function isLocalUrl(url) {
  const u = normalizeUrl(url).toLowerCase();
  return (
    u.startsWith('http://localhost') ||
    u.startsWith('https://localhost') ||
    u.includes('://127.0.0.1')
  );
}

function isLocalHost(host) {
  if (!host) return true;
  const h = String(host).toLowerCase();
  return h.includes('localhost') || h.startsWith('127.0.0.1');
}

function getPublicHost(req) {
  if (!req) return '';
  const forwarded = (req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = (forwarded || req.get('host') || '').split(',')[0].trim();
  return host;
}

function getPublicProto(req) {
  if (!req) return 'https';
  return (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
}

export function getRailwayHost() {
  const raw = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || '';
  return String(raw).trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** Fly.io public hostname (custom domain or app.fly.dev). */
export function getFlyPublicHost() {
  const explicit = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.BASE_URL || '').trim();
  if (explicit && !isLocalUrl(explicit)) {
    return normalizeUrl(explicit).replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }
  const flyHostname = (process.env.FLY_PUBLIC_HOSTNAME || '').trim();
  if (flyHostname) return flyHostname.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const app = (process.env.FLY_APP_NAME || '').trim();
  if (app) return `${app}.fly.dev`;
  return '';
}

export function isFlyDeploy() {
  return Boolean(process.env.FLY_APP_NAME || process.env.FLY_REGION);
}

export function isRailwayDeploy() {
  return Boolean(
    getRailwayHost() ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_NAME
  );
}

function pickFirstEnvUrl(value) {
  return String(value || '').split(',')[0].trim();
}

/** Normalize wiblaster.com / www.wiblaster.com to one canonical origin. */
export function normalizeToCanonicalSiteUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return normalized;
  try {
    const { hostname, protocol } = new URL(normalized);
    const host = hostname.toLowerCase();
    if (host === 'wiblaster.com' || host === 'www.wiblaster.com') {
      return CANONICAL_SITE_URL;
    }
    return `${protocol}//${host}`;
  } catch {
    return normalized;
  }
}

/** Single public site origin for referral links, emails, and redirects. */
export function getCanonicalPublicSiteUrl(req) {
  const explicit = pickFirstEnvUrl(
    process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.CANONICAL_FRONTEND_URL
  );
  if (explicit && !isLocalUrl(explicit)) {
    return normalizeToCanonicalSiteUrl(explicit);
  }

  if (isFlyDeploy() || isRailwayDeploy() || process.env.NODE_ENV === 'production') {
    return CANONICAL_SITE_URL;
  }

  const flyHost = getFlyPublicHost();
  if (flyHost && !isFlyDevHost(flyHost) && !isLocalHost(flyHost)) {
    return normalizeToCanonicalSiteUrl(`https://${flyHost.split(',')[0].trim()}`);
  }

  const railwayHost = getRailwayHost();
  if (railwayHost) {
    return normalizeToCanonicalSiteUrl(`https://${railwayHost.split(',')[0].trim()}`);
  }

  if (req) {
    const host = getPublicHost(req);
    const proto = getPublicProto(req);
    if (host && !isLocalHost(host) && !isFlyDevHost(host)) {
      return normalizeToCanonicalSiteUrl(`${proto}://${host}`);
    }
  }

  return normalizeUrl(explicit || 'http://localhost:3000');
}

/** Public site URL (referrals, post-OAuth redirects, invite links). */
export function resolveFrontendUrl(req) {
  return getCanonicalPublicSiteUrl(req);
}

/** After OAuth, stay on the same host that handled the callback (fixes fly.dev vs custom domain cookies). */
export function resolvePostAuthRedirectBase(req) {
  if (req) {
    const host = getPublicHost(req);
    const proto = getPublicProto(req);
    if (host && !isLocalHost(host)) {
      return normalizeUrl(`${proto}://${host}`);
    }
  }
  return getCanonicalPublicSiteUrl(req);
}

/** Google OAuth redirect URI — must match Google Cloud Console exactly. */
export function resolveGoogleCallbackURL(req) {
  if (req) {
    const host = getPublicHost(req);
    const proto = getPublicProto(req);
    if (host && !isLocalHost(host)) {
      return normalizeUrl(`${proto}://${host}/api/auth/google/callback`);
    }
  }

  const explicit = (process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (explicit && !isLocalUrl(explicit)) {
    return normalizeUrl(explicit);
  }

  const flyHost = getFlyPublicHost();
  if (flyHost) {
    return normalizeUrl(`https://${flyHost}/api/auth/google/callback`);
  }

  const railwayHost = getRailwayHost();
  if (railwayHost) {
    return normalizeUrl(`https://${railwayHost}/api/auth/google/callback`);
  }
  if (explicit) return normalizeUrl(explicit);

  const base =
    process.env.GOOGLE_CALLBACK_BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    resolveFrontendUrl();
  return normalizeUrl(`${base}/api/auth/google/callback`);
}

export function getOAuthSetupInfo(req) {
  const callbackUrl = resolveGoogleCallbackURL(req);
  const frontendUrl = resolveFrontendUrl(req);
  return {
    configured: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.SESSION_SECRET
    ),
    callbackUrl,
    frontendUrl,
    railway: isRailwayDeploy(),
    fly: isFlyDeploy(),
    publicHost: getFlyPublicHost() || getRailwayHost() || null,
    googleConsoleHint:
      'In Google Cloud Console → Credentials → your OAuth client, add this Authorized redirect URI exactly:',
  };
}
