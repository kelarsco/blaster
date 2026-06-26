/**
 * Client IP + session metadata for refresh tokens.
 */
export function getClientIp(req) {
  if (!req) return 'unknown';
  const fly = req.headers?.['fly-client-ip'];
  if (fly) return String(fly).split(',')[0].trim();
  const xff = req.headers?.['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  if (req.ip) return String(req.ip);
  return req.socket?.remoteAddress || 'unknown';
}

export function getSessionMeta(req) {
  const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 512);
  return {
    ip: getClientIp(req),
    userAgent,
  };
}
