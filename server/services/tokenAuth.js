/**
 * Token-based auth: short-lived access JWT + long-lived refresh token (DB, HttpOnly cookie).
 * Access token in response body; refresh token in cookie only.
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-refresh-secret';
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC) || 15 * 60; // 15 min
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS) || 7;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'wiblaster_rt';

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create access JWT for user. Payload: { sub: userId, email, type: 'access' }.
 */
export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: 'access',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_SEC }
  );
}

/**
 * Create refresh token: random string, store hash in DB, return plain token for cookie.
 */
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

/**
 * Verify access JWT; returns payload or throws.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Find refresh token by plain token (hash and lookup), ensure not revoked/expired.
 * Returns { id, user_id } or null.
 */
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

/**
 * Revoke a refresh token by its DB id.
 */
export async function revokeRefreshTokenById(tokenId) {
  const db = getDb();
  if (!db) return;
  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [tokenId]);
}

/**
 * Revoke all refresh tokens for a user (e.g. logout all devices, password reset).
 */
export async function revokeRefreshTokensForUser(userId) {
  const db = getDb();
  if (!db) return;
  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`, [userId]);
}

/**
 * Set refresh token in response cookie (HttpOnly, Secure in prod, SameSite).
 */
export function setRefreshTokenCookie(res, token, expiresAt) {
  const isProd = process.env.NODE_ENV === 'production';
  // In production deployments, frontend/backend are often on different origins.
  // Default to SameSite=None to keep refresh cookie usable across origins.
  const sameSite = isProd ? 'none' : 'lax';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    expires: expiresAt,
    path: '/',
  });
}

/**
 * Clear refresh token cookie.
 */
export function clearRefreshTokenCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE_NAME;
}

export function getAccessTTLSeconds() {
  return ACCESS_TTL_SEC;
}
