import { Router } from 'express';
import { getDb, getDbUnavailableMessage, logDbErrorThrottled } from '../db.js';
import {
  getReferralDashboard,
  recordReferralClick,
  findReferrerByCode,
  buildReferralUrl,
  setReferralRefCookie,
} from '../services/referralService.js';
import { resolveFrontendUrl } from '../services/oauthUrls.js';

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

export const referralRoutes = Router();

referralRoutes.get('/me', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ error: getDbUnavailableMessage() });
    }
    const data = await getReferralDashboard(req.user.id, req);
    res.json(data);
  } catch (e) {
    logDbErrorThrottled('referral me', e);
    res.status(500).json({ error: e?.message || 'Failed to load referral data' });
  }
});

referralRoutes.post('/click', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service temporarily unavailable.' });
    const code = (req.body?.code || req.query?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code is required' });
    const valid = await findReferrerByCode(code);
    if (!valid) return res.status(404).json({ error: 'This referral link is invalid.' });
    await recordReferralClick(code);
    setReferralRefCookie(res, code);
    res.json({ ok: true });
  } catch (e) {
    console.error('[referral click]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to record click' });
  }
});

referralRoutes.get('/validate', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ valid: false, reason: 'service_unavailable' });
    }
    const code = (req.query.code || '').trim();
    if (!code) return res.json({ valid: false, reason: 'missing_code' });
    const referrer = await findReferrerByCode(code);
    if (!referrer) return res.json({ valid: false, reason: 'invalid_code' });
    res.json({ valid: true, reason: 'ok' });
  } catch (e) {
    console.error('[referral validate]', e?.message || e);
    res.status(503).json({ valid: false, reason: 'service_unavailable' });
  }
});

/** Public redirect: track click and land on signup with ref param. */
referralRoutes.get('/r/:code', async (req, res) => {
  try {
    const frontend = resolveFrontendUrl(req);
    const db = getDb();
    if (!db) {
      return res.redirect(`${frontend}/signup?ref_error=unavailable`);
    }
    const code = (req.params.code || '').trim().toUpperCase();
    const referrer = await findReferrerByCode(code);
    if (!referrer) {
      return res.redirect(`${frontend}/signup?ref_error=invalid`);
    }
    await recordReferralClick(code);
    setReferralRefCookie(res, code);
    res.redirect(`${frontend}/signup?ref=${encodeURIComponent(code)}`);
  } catch (e) {
    console.error('[referral redirect]', e?.message || e);
    res.redirect(resolveFrontendUrl(req) + '/signup');
  }
});
