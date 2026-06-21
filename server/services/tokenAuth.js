/**
 * Token-based auth: short-lived access JWT + long-lived refresh token (DB, HttpOnly cookie).
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { shouldUseSecureCookies, getCookieSameSite, getCookieDomain } from './cookiePolicy.js';

function resolveAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET is required in production');
  }
  return secret || process.env.SESSION_SECRET || 'dev-access-secret';
}

const ACCESS_SECRET = resolveAccessSecret();
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC) || 15 * 60;
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS) || 7;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'wiblaster_rt';

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name || user.email?.split('@')[0] || 'User',
      type: 'access',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_SEC, algorithm: 'HS256' }
  );
}

export async function createRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashRefreshToken(token);
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  const db = getDb();
  if (!db) throw new Error('DB not available');
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [id, userId, tokenHash, expiresAt]
  );
  return { token, expiresAt };
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] });
  if (payload?.type !== 'access' || !payload?.sub) {
    throw new Error('Invalid access token');
  }
  return payload;
}

export async function findRefreshTokenByToken(plainToken) {
  const db = getDb();
  if (!db) return null;
  const tokenHash = hashRefreshToken(plainToken);
  const r = await db.query(
    `SELECT id, user_id FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  const row = r?.rows?.[0];
  return row ? { id: row.id, user_id: row.user_id } : null;
}

export async function revokeRefreshTokenById(tokenId) {
  const db = getDb();
  if (!db) return;
  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [tokenId]);
}

export async function revokeRefreshTokensForUser(userId) {
  const db = getDb();
  if (!db) return;
  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`, [userId]);
}

export function setRefreshTokenCookie(res, token, expiresAt) {
  const secure = shouldUseSecureCookies();
  const sameSite = getCookieSameSite();
  const domain = getCookieDomain();
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    expires: expiresAt,
    path: '/',
    ...(domain && { domain }),
  });
}

export function clearRefreshTokenCookie(res) {
  const secure = shouldUseSecureCookies();
  const sameSite = getCookieSameSite();
  const domain = getCookieDomain();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite,
    ...(domain && { domain }),
  });
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE_NAME;
}

export function getAccessTTLSeconds() {
  return ACCESS_TTL_SEC;
}
