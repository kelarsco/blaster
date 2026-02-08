/**
 * Gmail OAuth "connect inbox" flow: issue short-lived token for frontend to redirect to /api/auth/gmail-connect.
 * Callback exchanges code for tokens and creates a sender row (provider=gmail_oauth).
 */
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { logActivity } from '../routes/activity.js';

const SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-secret';
const CONNECT_TTL_SEC = 300; // 5 min
const COOKIE_NAME = 'gmail_connect_user';
const COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

function getBackendBase() {
  const cb = process.env.GOOGLE_CALLBACK_URL;
  if (cb) {
    try {
      return new URL(cb).origin;
    } catch (_) {}
  }
  return (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
}

/** Create a short-lived JWT for the "connect Gmail" flow. Payload: { userId, intent: 'connect_gmail' }. */
export function createConnectToken(userId) {
  return jwt.sign(
    { userId, intent: 'connect_gmail' },
    SECRET,
    { expiresIn: CONNECT_TTL_SEC }
  );
}

/** Verify connect token; returns { userId } or null. */
export function verifyConnectToken(token) {
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload?.intent === 'connect_gmail' && payload?.userId) return { userId: payload.userId };
  } catch (_) {}
  return null;
}

/** Cookie value for passing userId to callback (short-lived JWT). */
export function createConnectCookiePayload(userId) {
  return jwt.sign(
    { userId, intent: 'gmail_connect_cookie' },
    SECRET,
    { expiresIn: 300 }
  );
}

export function verifyConnectCookiePayload(value) {
  try {
    const payload = jwt.verify(value, SECRET);
    if (payload?.intent === 'gmail_connect_cookie' && payload?.userId) return payload.userId;
  } catch (_) {}
  return null;
}

export function getGmailConnectCookieName() {
  return COOKIE_NAME;
}

export function getGmailConnectCookieMaxAge() {
  return COOKIE_MAX_AGE_MS;
}

/** Build the URL the frontend should redirect to to start the Gmail connect flow. */
export function getGmailConnectStartUrl(connectToken) {
  const base = getBackendBase();
  return `${base}/api/auth/gmail-connect?connect_token=${encodeURIComponent(connectToken)}`;
}

/** Build the redirect_uri for Google OAuth (our callback). */
export function getGmailConnectCallbackUrl() {
  const base = getBackendBase();
  return `${base}/api/auth/gmail-connect/callback`;
}

/** Create or update a Gmail sender after OAuth callback. Returns { id, email } or throws. */
export async function upsertGmailSender(userId, email, accessToken, refreshToken) {
  const db = getDb();
  if (!db) throw new Error('Database not available');

  const emailNorm = (email || '').trim().toLowerCase();
  if (!emailNorm) throw new Error('No email from Google');

  const existing = await db.query(
    'SELECT id FROM senders WHERE user_id = $1 AND email = $2 AND is_active = 1',
    [userId, emailNorm]
  );
  const row = existing.rows?.[0];

  if (row) {
    await db.query(
      `UPDATE senders SET provider = 'gmail_oauth', oauth_access_token = $1, oauth_refresh_token = $2, oauth_status = 'active', oauth_connected_at = NOW() WHERE id = $3`,
      [accessToken, refreshToken || null, row.id]
    );
    logActivity('sender_gmail_reconnect', { id: row.id, email: emailNorm }, userId);
    return { id: row.id, email: emailNorm };
  }

  const id = uuidv4();
  await db.query(
    `INSERT INTO senders (id, user_id, email, provider, oauth_access_token, oauth_refresh_token, oauth_status, oauth_connected_at, max_per_minute)
     VALUES ($1, $2, $3, 'gmail_oauth', $4, $5, 'active', NOW(), 2)`,
    [id, userId, emailNorm, accessToken, refreshToken || null]
  );
  logActivity('sender_add', { id, email: emailNorm }, userId);
  return { id, email: emailNorm };
}
