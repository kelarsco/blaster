/**
 * Google OAuth flow to add a Gmail address to a sender group.
 */
import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { verifyAccessToken } from '../services/tokenAuth.js';
import { resolveFrontendUrl } from '../services/oauthUrls.js';
import { getSenderLimitForUser } from '../services/planLimits.js';
import { logActivity } from './activity.js';

const MAX_SENDERS_PER_GROUP = 10;

const hasGoogleConfig =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.SESSION_SECRET;

function senderGoogleCallbackURL(req) {
  const host = req?.get?.('host');
  const proto = (req?.get?.('x-forwarded-proto') || req?.protocol || 'https').split(',')[0].trim();
  if (host && !host.includes('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}/api/automation/senders/google/callback`;
  }
  const base = process.env.BACKEND_URL || process.env.GOOGLE_CALLBACK_BASE_URL || 'http://localhost:4000';
  return `${String(base).replace(/\/$/, '')}/api/automation/senders/google/callback`;
}

if (hasGoogleConfig) {
  passport.use(
    'google-sender',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.SENDER_GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/automation/senders/google/callback',
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          const pending = req.session?.senderGoogleConnect;
          if (!pending?.userId || !pending?.groupId) {
            return done(null, false, { message: 'Session expired. Try again from Senders page.' });
          }
          const email = (profile.emails?.[0]?.value || '').trim().toLowerCase();
          if (!email) return done(null, false, { message: 'No email from Google account.' });

          const db = getDb();
          if (!db) return done(null, false, { message: 'Database unavailable.' });

          const { userId, groupId } = pending;
          const groupOwn = await db.query('SELECT 1 FROM sender_groups WHERE id = $1 AND user_id = $2', [groupId, userId]);
          if (!groupOwn.rows?.length) return done(null, false, { message: 'Sender group not found.' });

          const countInGroup = await db.query(
            'SELECT COUNT(*) AS c FROM sender_group_members WHERE group_id = $1',
            [groupId]
          );
          if (parseInt(countInGroup.rows[0]?.c, 10) >= MAX_SENDERS_PER_GROUP) {
            return done(null, false, { message: `Group limit is ${MAX_SENDERS_PER_GROUP} emails.` });
          }

          let senderId;
          const existing = await db.query(
            'SELECT id FROM senders WHERE user_id = $1 AND LOWER(email) = $2 AND is_active = 1',
            [userId, email]
          );
          if (existing.rows[0]) {
            senderId = existing.rows[0].id;
            await db.query(
              `UPDATE senders SET provider = 'google', verification_status = 'verified', oauth_connected_at = NOW() WHERE id = $1`,
              [senderId]
            );
          } else {
            const countResult = await db.query('SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1', [userId]);
            const count = parseInt(countResult.rows[0]?.c, 10) || 0;
            const { limit } = await getSenderLimitForUser(userId);
            if (count >= limit) {
              return done(null, false, { message: 'Sender limit reached for your plan.' });
            }
            senderId = uuidv4();
            await db.query(
              `INSERT INTO senders (id, user_id, email, config, max_per_minute, provider, verification_status, oauth_connected_at)
               VALUES ($1, $2, $3, '{}', 10, 'google', 'verified', NOW())`,
              [senderId, userId, email]
            );
            logActivity('sender_add', { id: senderId, email, provider: 'google' }, userId);
          }

          await db.query(
            'INSERT INTO sender_group_members (group_id, sender_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [groupId, senderId]
          );

          return done(null, { email, groupId });
        } catch (e) {
          return done(e);
        }
      }
    )
  );
}

export const senderGoogleRoutes = Router();

senderGoogleRoutes.get('/connect', (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.redirect(`${resolveFrontendUrl()}/app/senders?error=google_not_configured`);
  }
  const token = String(req.query.token || '').trim();
  const groupId = String(req.query.groupId || '').trim();
  if (!token || !groupId) {
    return res.redirect(`${resolveFrontendUrl()}/app/senders?error=missing_params`);
  }
  try {
    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return res.redirect(`${resolveFrontendUrl()}/app/senders?error=auth_expired`);
    }
    req.session.senderGoogleConnect = { userId: payload.sub, groupId };
    const callbackURL = senderGoogleCallbackURL(req);
    passport.authenticate('google-sender', {
      scope: ['profile', 'email'],
      prompt: 'select_account consent',
      callbackURL,
    })(req, res, next);
  } catch {
    return res.redirect(`${resolveFrontendUrl()}/app/senders?error=auth_expired`);
  }
});

senderGoogleRoutes.get('/callback', (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.redirect(`${resolveFrontendUrl()}/app/senders?error=google_not_configured`);
  }
  const callbackURL = senderGoogleCallbackURL(req);
  const groupId = req.session?.senderGoogleConnect?.groupId;
  passport.authenticate('google-sender', { callbackURL }, (err, result, info) => {
    delete req.session?.senderGoogleConnect;
    const front = resolveFrontendUrl();
    if (err || !result) {
      const msg = encodeURIComponent(info?.message || err?.message || 'Google connect failed');
      return res.redirect(`${front}/app/senders?error=${msg}${groupId ? `&group=${groupId}` : ''}`);
    }
    res.redirect(`${front}/app/senders?google_added=1&group=${result.groupId}&email=${encodeURIComponent(result.email)}`);
  })(req, res, next);
});
