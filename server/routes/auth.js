/**
 * Auth: Google OAuth + Email/Password with required email verification.
 * Token-based: access JWT (short-lived) + refresh token (HttpOnly cookie, DB).
 */
import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { sendVerificationCode, isVerificationEmailConfigured } from '../services/verificationEmail.js';
import { sendPasswordResetEmail, isPasswordResetEmailConfigured } from '../services/passwordResetEmail.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  createAccessToken,
  createRefreshToken,
  findRefreshTokenByToken,
  revokeRefreshTokenById,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshCookieName,
  getAccessTTLSeconds,
} from '../services/tokenAuth.js';

const hasGoogleConfig =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.SESSION_SECRET;

const FRONTEND_URL = () => (process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Session serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (hasGoogleConfig) {
  const baseUrl = FRONTEND_URL();
  const callbackPath = '/api/auth/google/callback';
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || baseUrl + callbackPath;
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        const db = getDb();
        const email = (profile.emails?.[0]?.value || '').trim().toLowerCase() || null;
        const name = profile.displayName || profile.emails?.[0]?.value || 'User';
        const picture = (profile.photos?.[0]?.value || '').trim() || null;
        if (!db) {
          return done(null, null, { code: 'NO_DB', message: 'Sign-in is temporarily unavailable. Please try again later.' });
        }
        if (!email) {
          return done(null, null, { code: 'NO_EMAIL', message: 'We could not get your email from Google. Please use an account with email access.' });
        }
        try {
          const existing = await db.query(
            'SELECT id, email, name, auth_provider FROM users WHERE email = $1',
            [email]
          );
          const row = existing.rows?.[0];
          if (row) {
            if (row.auth_provider !== 'google') {
              return done(null, null, { code: 'WRONG_METHOD', message: 'This account uses email and password. Sign in with your password.' });
            }
            if (picture) {
              await db.query('UPDATE users SET picture_url = $1, updated_at = NOW() WHERE id = $2', [picture, row.id]);
            }
            return done(null, { id: String(row.id), email: row.email, name: row.name || name, picture: picture || row.picture_url });
          }
          const id = uuidv4();
          await db.query(
            `INSERT INTO users (id, email, name, auth_provider, email_verified, email_verified_at, picture_url, updated_at)
             VALUES ($1, $2, $3, 'google', 1, NOW(), $4, NOW())`,
            [id, email, name, picture]
          );
          return done(null, { id, email, name, picture });
        } catch (e) {
          return done(e);
        }
      }
    )
  );
}

export const authRoutes = Router();

/** Issue access + refresh tokens and send JSON (for login, verify-email, reset-password). */
async function issueTokensAndRespond(res, user) {
  const accessToken = createAccessToken(user);
  const { token: refreshToken, expiresAt } = await createRefreshToken(user.id);
  setRefreshTokenCookie(res, refreshToken, expiresAt);
  res.json({
    user: { id: user.id, email: user.email, name: user.name, picture: user.picture || null },
    accessToken,
    expiresIn: getAccessTTLSeconds(),
  });
}

authRoutes.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  let picture = req.user.picture || null;
  let auth_provider = req.user.auth_provider || 'credentials';
  if (req.user.id && getDb()) {
    try {
      const r = await getDb().query('SELECT picture_url, auth_provider FROM users WHERE id = $1', [req.user.id]);
      const row = r?.rows?.[0];
      if (row) {
        if (row.picture_url) picture = row.picture_url;
        if (row.auth_provider) auth_provider = row.auth_provider;
      }
    } catch (_) { /* ignore */ }
  }
  return res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    picture: picture || null,
    auth_provider,
  });
});

authRoutes.get('/code-config', (_req, res) => {
  res.json({ emailConfigured: isVerificationEmailConfigured() });
});

/** Sign up with email + password. Creates unverified user and sends OTP. No duplicate signups. */
authRoutes.post('/register', authRateLimit, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Signup is not available. Please try again later.' });
    if (!isVerificationEmailConfigured()) {
      return res.status(503).json({ error: 'Email verification is not configured. Contact support.' });
    }
    const { email, password, name } = req.body || {};
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!emailNorm) return res.status(400).json({ error: 'Email is required' });
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await db.query('SELECT id, auth_provider FROM users WHERE email = $1', [emailNorm]);
    if (existing.rows?.[0]) {
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const id = uuidv4();
    const hash = await bcrypt.hash(password, 12);
    const displayName = (name && String(name).trim()) || emailNorm.split('@')[0] || 'User';

    await db.query(
      `INSERT INTO users (id, email, password_hash, name, auth_provider, email_verified, verification_code, verification_code_expires_at, updated_at)
       VALUES ($1, $2, $3, $4, 'credentials', 0, $5, $6, NOW())`,
      [id, emailNorm, hash, displayName, code, expiresAt]
    );
    await sendVerificationCode(emailNorm, code);

    res.status(201).json({
      needsVerification: true,
      email: emailNorm,
      message: 'Verification code sent. Check your email.',
    });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    console.error('[auth register]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Signup failed' });
  }
});

/** Resend verification code (e.g. after signup, before verify). */
authRoutes.post('/resend-verification', authRateLimit, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable.' });
    if (!isVerificationEmailConfigured()) return res.status(503).json({ error: 'Email is not configured.' });
    const { email } = req.body || {};
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!emailNorm) return res.status(400).json({ error: 'Email is required' });

    const r = await db.query(
      'SELECT id, auth_provider, email_verified FROM users WHERE email = $1',
      [emailNorm]
    );
    const row = r?.rows?.[0];
    if (!row) return res.status(404).json({ error: 'No account found with this email.' });
    if (row.auth_provider !== 'credentials') return res.status(400).json({ error: 'This account uses Google. Sign in with Google.' });
    if (row.email_verified) return res.status(400).json({ error: 'Email is already verified. Sign in with your password.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.query(
      `UPDATE users SET verification_code = $1, verification_code_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [code, expiresAt, row.id]
    );
    await sendVerificationCode(emailNorm, code);
    res.json({ ok: true, message: 'Verification code sent. Check your email.' });
  } catch (e) {
    console.error('[auth resend-verification]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to send code' });
  }
});

/** Verify email OTP after signup. Activates account and logs user in. One-time use (code cleared). */
authRoutes.post('/verify-email', authRateLimit, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable.' });
    const { email, code } = req.body || {};
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const codeStr = typeof code === 'string' ? code.trim() : '';
    if (!emailNorm || !codeStr) return res.status(400).json({ error: 'Email and code are required' });

    const r = await db.query(
      `SELECT id, email, name, auth_provider, verification_code, verification_code_expires_at FROM users WHERE email = $1`,
      [emailNorm]
    );
    const row = r?.rows?.[0];
    if (!row) return res.status(401).json({ error: 'Invalid or expired code' });
    if (row.auth_provider !== 'credentials') return res.status(400).json({ error: 'This account uses Google. Sign in with Google.' });
    if (row.verification_code !== codeStr) return res.status(401).json({ error: 'Invalid code' });
    if (!row.verification_code_expires_at || new Date(row.verification_code_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Code has expired. Request a new one.' });
    }

    await db.query(
      `UPDATE users SET verification_code = NULL, verification_code_expires_at = NULL, email_verified = 1, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
    const user = { id: row.id, email: row.email, name: row.name || row.email.split('@')[0] || 'User', picture: null };
    await issueTokensAndRespond(res, user);
  } catch (e) {
    console.error('[auth verify-email]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Verification failed' });
  }
});

/** Login with email + password. Only for credentials users; must be verified. */
authRoutes.post('/login', authRateLimit, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Login is not available. Please try again later.' });
    const { email, password } = req.body || {};
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!emailNorm || !password) return res.status(400).json({ error: 'Email and password are required' });

    const r = await db.query(
      'SELECT id, email, password_hash, name, auth_provider, email_verified FROM users WHERE email = $1',
      [emailNorm]
    );
    const row = r?.rows?.[0];
    if (!row) return res.status(401).json({ error: 'Invalid email or password' });
    if (row.auth_provider !== 'credentials') {
      return res.status(400).json({ error: 'This account uses Google. Sign in with Google instead.' });
    }
    if (!row.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email first. Check your inbox for the verification code.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (!row.password_hash) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    let picture = null;
    try {
      const pr = await getDb().query('SELECT picture_url FROM users WHERE id = $1', [row.id]);
      if (pr.rows?.[0]?.picture_url) picture = pr.rows[0].picture_url;
    } catch (_) { /* ignore */ }
    const user = { id: row.id, email: row.email, name: row.name || row.email.split('@')[0] || 'User', picture };
    await issueTokensAndRespond(res, user);
  } catch (e) {
    console.error('[auth login]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Login failed' });
  }
});

/** Forgot password: send reset link (credentials users only). */
authRoutes.post('/forgot-password', authRateLimit, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable.' });
    if (!isPasswordResetEmailConfigured()) {
      return res.status(503).json({ error: 'Password reset is not configured. Contact support.' });
    }
    const { email } = req.body || {};
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!emailNorm) return res.status(400).json({ error: 'Email is required' });

    const r = await db.query('SELECT id, auth_provider FROM users WHERE email = $1', [emailNorm]);
    const row = r?.rows?.[0];
    if (!row) {
      return res.status(200).json({ message: 'If an account exists with this email, you will receive a reset link.' });
    }
    if (row.auth_provider !== 'credentials') {
      return res.status(400).json({
        error: 'This account uses Google. You don\'t have a password to reset. Sign in with Google.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.query(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
      [tokenId, row.id, token, expiresAt]
    );
    const resetLink = `${FRONTEND_URL()}/reset-password?token=${token}`;
    await sendPasswordResetEmail(emailNorm, resetLink);

    res.status(200).json({ message: 'If an account exists with this email, you will receive a reset link.' });
  } catch (e) {
    console.error('[auth forgot-password]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to send reset email' });
  }
});

/** Reset password with token from email. */
authRoutes.post('/reset-password', authRateLimit, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable.' });
    const { token, password } = req.body || {};
    const tokenStr = typeof token === 'string' ? token.trim() : '';
    if (!tokenStr) return res.status(400).json({ error: 'Reset token is required' });
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const r = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email, u.name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1`,
      [tokenStr]
    );
    const row = r?.rows?.[0];
    if (!row) return res.status(401).json({ error: 'Invalid or expired reset link' });
    if (row.used_at) return res.status(401).json({ error: 'This reset link has already been used' });
    if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'This reset link has expired. Request a new one.' });

    const hash = await bcrypt.hash(password, 12);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, row.user_id]
    );
    await db.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id]
    );

    const user = { id: row.user_id, email: row.email, name: row.name || row.email.split('@')[0] || 'User', picture: null };
    await issueTokensAndRespond(res, user);
  } catch (e) {
    console.error('[auth reset-password]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Reset failed' });
  }
});

/** Change password (credentials users only). Requires current password. */
authRoutes.post('/change-password', authRateLimit, requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable.' });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not signed in' });

    const r = await db.query('SELECT auth_provider, password_hash FROM users WHERE id = $1', [userId]);
    const row = r?.rows?.[0];
    if (!row) return res.status(401).json({ error: 'User not found' });
    if (row.auth_provider !== 'credentials') {
      return res.status(400).json({ error: 'This account uses Google. Change your password in your Google account.' });
    }
    if (!row.password_hash) return res.status(400).json({ error: 'No password set. Use forgot password to set one.' });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ error: 'Current password is required' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
    res.status(200).json({ message: 'Password updated' });
  } catch (e) {
    console.error('[auth change-password]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to change password' });
  }
});

/** Refresh access token using refresh token from HttpOnly cookie. Returns 200 with no user when no/invalid cookie (avoids 401 noise for unauthenticated visitors). */
authRoutes.post('/refresh', authRateLimit, async (req, res) => {
  try {
    const token = req.cookies?.[getRefreshCookieName()];
    if (!token) return res.status(200).json({});
    const found = await findRefreshTokenByToken(token);
    if (!found) return res.status(200).json({});
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable' });
    const r = await db.query('SELECT id, email, name, picture_url, auth_provider FROM users WHERE id = $1', [found.user_id]);
    const row = r?.rows?.[0];
    if (!row) return res.status(401).json({ error: 'User not found' });
    const user = { id: row.id, email: row.email, name: row.name || row.email?.split('@')[0] || 'User', picture: row.picture_url || null, auth_provider: row.auth_provider || 'credentials' };
    const accessToken = createAccessToken(user);
    res.json({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture, auth_provider: user.auth_provider }, accessToken, expiresIn: getAccessTTLSeconds() });
  } catch (e) {
    console.error('[auth refresh]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Refresh failed' });
  }
});

authRoutes.get('/google', (req, res, next) => {
  if (!hasGoogleConfig) return res.redirect(302, '/login');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

authRoutes.get('/google/callback', (req, res, next) => {
  if (!hasGoogleConfig) return res.redirect(302, '/login');
  passport.authenticate('google', async (err, user, info) => {
    if (err) return res.redirect(302, '/login?error=1');
    if (info?.code === 'WRONG_METHOD') {
      return res.redirect(302, `/login?error=wrong_method&message=${encodeURIComponent(info.message || '')}`);
    }
    if (info?.code === 'NO_DB' || info?.code === 'NO_EMAIL') {
      return res.redirect(302, `/login?error=${info.code}&message=${encodeURIComponent(info.message || '')}`);
    }
    if (!user) return res.redirect(302, '/login?error=1');
    try {
      const userForToken = { id: user.id, email: user.email, name: user.name, picture: user.picture || null };
      const accessToken = createAccessToken(userForToken);
      const { token: refreshToken, expiresAt } = await createRefreshToken(user.id);
      setRefreshTokenCookie(res, refreshToken, expiresAt);
      const base = FRONTEND_URL();
      res.redirect(302, base + '/auth/callback?token=' + encodeURIComponent(accessToken));
    } catch (e) {
      console.error('[auth google/callback]', e?.message || e);
      res.redirect(302, '/login?error=1');
    }
  })(req, res, next);
});

authRoutes.post('/logout', async (req, res) => {
  const sendOk = () => res.json({ ok: true });
  try {
    const token = req.cookies?.[getRefreshCookieName()];
    if (token) {
      const found = await findRefreshTokenByToken(token);
      if (found) await revokeRefreshTokenById(found.id);
    }
    clearRefreshTokenCookie(res);
    if (typeof req.logout === 'function') {
      req.logout((err) => {
        if (err) console.error('[auth logout]', err?.message || err);
        if (req.session?.destroy) req.session.destroy(sendOk);
        else sendOk();
      });
    } else {
      if (req.session?.destroy) req.session.destroy(sendOk);
      else sendOk();
    }
  } catch (e) {
    console.error('[auth logout]', e?.message || e);
    clearRefreshTokenCookie(res);
    sendOk();
  }
});
