/**
 * Resolve OAuth / frontend URLs for local dev vs Railway production.
 * Ignores localhost env vars when deployed on Railway.
 */

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
  return forwarded || req.get('host') || '';
}

function getPublicProto(req) {
  if (!req) return 'https';
  return (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
}

export function getRailwayHost() {
  const raw = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || '';
  return String(raw).trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function isRailwayDeploy() {
  return Boolean(
    getRailwayHost() ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_NAME
  );
}

/** Public site URL (where users land after OAuth). */
export function resolveFrontendUrl(req) {
  if (req) {
    const host = getPublicHost(req);
    const proto = getPublicProto(req);
    if (host && !isLocalHost(host)) {
      return normalizeUrl(`${proto}://${host}`);
    }
  }

  const explicit = (process.env.FRONTEND_URL || process.env.BASE_URL || '').trim();
  const railwayHost = getRailwayHost();
  if (railwayHost && (!explicit || isLocalUrl(explicit))) {
    return normalizeUrl(`https://${railwayHost}`);
  }
  return normalizeUrl(explicit || 'http://localhost:3000');
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
  const railwayHost = getRailwayHost();
  if (railwayHost && (!explicit || isLocalUrl(explicit))) {
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
    googleConsoleHint:
      'In Google Cloud Console → Credentials → your OAuth client, add this Authorized redirect URI exactly:',
  };
}
