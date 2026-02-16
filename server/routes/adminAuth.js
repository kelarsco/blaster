import { Router } from 'express';
import speakeasy from 'speakeasy';
import jwt from 'jsonwebtoken';
import { requireAdmin, COOKIE_NAME, ADMIN_JWT_SECRET } from '../middleware/requireAdmin.js';
import { shouldUseSecureCookies, getCookieSameSite, getCookieDomain } from '../services/cookiePolicy.js';

const TOTP_SECRET = String(process.env.BL_ADMIN_TOTP_SECRET || '').replace(/\s+/g, '').toUpperCase(); // base32 secret for Google Authenticator
const secureCookies = shouldUseSecureCookies();
const sameSite = getCookieSameSite();
const cookieDomain = getCookieDomain();

export const adminAuthRoutes = Router();

/** POST /api/bl-admin/auth - Login with 6-digit TOTP code from Google Authenticator */
adminAuthRoutes.post('/auth', (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s/g, '') : '';
    if (!TOTP_SECRET || TOTP_SECRET.length < 10) {
      return res.status(503).json({ error: 'Admin login not configured. Set BL_ADMIN_TOTP_SECRET in server .env' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 6-digit code from your authenticator app' });
    }
    let valid = false;
    try {
      valid = speakeasy.totp.verify({
        secret: TOTP_SECRET,
        encoding: 'base32',
        token: code,
        // Allow small clock drift so valid codes do not fail because of system time skew.
        window: 2,
      });
    } catch (e) {
      console.error('[bl-admin auth] TOTP verify error:', e?.message || e);
      return res.status(500).json({ error: 'Verification failed. Check BL_ADMIN_TOTP_SECRET is valid base32.' });
    }
    if (!valid) {
      return res.status(401).json({ error: 'Invalid code. Try again and ensure your device time is set to automatic.' });
    }
    const token = jwt.sign(
      { role: 'admin', at: Date.now() },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: secureCookies,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[bl-admin auth]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Login failed. Try again.' });
  }
});

/** POST /api/bl-admin/logout */
adminAuthRoutes.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookies,
    sameSite,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  });
  res.json({ ok: true });
});

/** GET /api/bl-admin/me - Check admin session */
adminAuthRoutes.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, role: 'admin' });
});
