import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { syncPaystackPlans, getUsdToNgnRate, amountForPaystack } from '../services/paystackSync.js';
import { sendSubscriptionConfirmation } from '../services/transactionalEmail.js';
import { handleReferralUpgrade } from '../services/referralService.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'NGN';

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

async function getPlanIdByPaystackCode(paystackPlanCode) {
  const db = getDb();
  if (!db) return null;
  const r = await db.query('SELECT id FROM plans WHERE paystack_plan_code = $1', [paystackPlanCode]);
  return r.rows?.[0]?.id || null;
}

export const billingRoutes = Router();
const FREE_TRIAL_HOURS = 24;

/** List all plans (from DB; Paystack plan codes are created automatically when PAYSTACK_SECRET_KEY is set). */
billingRoutes.get('/plans', async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ plans: [] });
    const r = await db.query(
      `SELECT id, name, amount, interval, features, paystack_plan_code FROM plans ORDER BY amount ASC`
    );
    const plans = (r.rows || []).map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      interval: row.interval,
      features: row.features,
      paystackPlanCode: row.paystack_plan_code,
    }));
    res.json({ plans });
  } catch (e) {
    console.error('[billing plans]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load plans' });
  }
});

/** Billing overview: subscription (or null), current plan with features, and usage counts for the overview card. */
billingRoutes.get('/overview', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ subscription: null, plan: null, usage: null });
    const userId = req.user.id;

    const subRow = await db.query(
      `SELECT s.id, s.plan_id, s.status, s.current_period_start, s.current_period_end, p.name AS plan_name, p.amount, p.interval, p.features
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
       ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1`,
      [userId]
    );
    const row = subRow.rows?.[0];
    let subscription = null;
    let plan = null;
    if (row) {
      subscription = {
        id: row.id,
        planId: row.plan_id,
        planName: row.plan_name,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        amount: row.amount,
        interval: row.interval,
      };
      const features = row.features || {};
      plan = {
        name: row.plan_name,
        amount: row.amount,
        interval: row.interval,
        features,
      };
    } else {
      const freeRow = await db.query(`SELECT id, name, amount, interval, features FROM plans WHERE id = 'free' LIMIT 1`);
      const free = freeRow.rows?.[0];
      const userCreated = await db.query('SELECT created_at FROM users WHERE id = $1 LIMIT 1', [userId]);
      const createdAt = userCreated.rows?.[0]?.created_at ? new Date(userCreated.rows[0].created_at) : new Date();
      const trialEndsAt = new Date(createdAt.getTime() + FREE_TRIAL_HOURS * 60 * 60 * 1000);
      const trialActive = trialEndsAt.getTime() > Date.now();
      plan = free
        ? {
            name: trialActive ? 'Free trial' : free.name,
            amount: free.amount,
            interval: free.interval,
            features: {
              ...(free.features || {}),
              emails: trialActive ? '100' : '0',
              scans: trialActive ? '100' : '0',
            },
          }
        : { name: trialActive ? 'Free trial' : 'Free', amount: 0, interval: 'monthly', features: { emails: trialActive ? '100' : '0', users: '1 seat', senders: '1', scans: trialActive ? '100' : '0' } };
    }

    const periodStart = row?.current_period_start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd = row?.current_period_end ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);
    const start = new Date(periodStart).toISOString();
    const end = new Date(periodEnd).toISOString();

    const scansResult = await db.query(
      `SELECT COALESCE(SUM(total_urls), 0) AS total FROM scans WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [userId, start, end]
    );
    const scansUsed = parseInt(scansResult.rows?.[0]?.total ?? '0', 10);
    const sendersCount = await db.query('SELECT COUNT(*) AS c FROM senders WHERE user_id = $1 AND is_active = 1', [userId]);
    const sendersUsed = parseInt(sendersCount.rows?.[0]?.c ?? '0', 10);
    const emailsResult = await db.query(
      `SELECT COUNT(*) AS total FROM campaign_sends cs JOIN campaigns c ON c.id = cs.campaign_id AND c.user_id = $1 WHERE cs.status = 'sent' AND cs.sent_at >= $2 AND cs.sent_at <= $3`,
      [userId, start, end]
    );
    const emailsUsed = parseInt(emailsResult.rows?.[0]?.total ?? '0', 10);

    const scansLimit = (() => {
      const s = plan?.features?.scans;
      if (s == null) return 200;
      const str = String(s).toLowerCase();
      if (str === 'unlimited' || str === '∞') return 999999;
      const n = parseInt(s, 10);
      return Number.isNaN(n) || n < 0 ? 200 : n;
    })();
    const sendersLimit = (() => {
      const s = plan?.features?.senders;
      if (s == null) return 1;
      const str = String(s).toLowerCase();
      if (str === 'unlimited' || str === '∞') return 999;
      const n = parseInt(s, 10);
      return Number.isNaN(n) || n < 0 ? 1 : Math.min(n, 999);
    })();
    const emailsLimit = (() => {
      const e = plan?.features?.emails;
      if (e == null) return 200;
      const str = String(e).toLowerCase();
      if (str === 'unlimited' || str === '∞') return 999999;
      const n = parseInt(e, 10);
      return Number.isNaN(n) || n < 0 ? 200 : n;
    })();

    const overageScans = Math.max(0, scansUsed - scansLimit);
    const overageEmails = Math.max(0, emailsUsed - emailsLimit);
    const extraCreditOwed = Math.floor(overageScans / 500) + Math.floor(overageEmails / 300);
    const extraCreditRows = await db.query('SELECT paid_cents FROM user_extra_credit WHERE user_id = $1', [userId]);
    const paidCents = extraCreditRows.rows?.[0]?.paid_cents ?? 0;
    const paidDollars = paidCents / 100;
    const EXTRA_THRESHOLDS = [10, 30, 50, 100];
    const nextThreshold = EXTRA_THRESHOLDS.find((t) => t > paidDollars) ?? 100;
    const extraCreditBlocked = extraCreditOwed >= nextThreshold;

    res.json({
      subscription,
      plan,
      usage: { scansUsed, scansLimit, sendersUsed, sendersLimit, emailsUsed, emailsLimit },
      extraCredit: {
        owed: extraCreditOwed,
        paidCents,
        nextThreshold,
        blocked: extraCreditBlocked,
      },
    });
  } catch (e) {
    console.error('[billing overview]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load billing overview' });
  }
});

/** Current user's subscription. */
billingRoutes.get('/subscription', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ subscription: null });
    const r = await db.query(
      `SELECT s.id, s.plan_id, s.status, s.current_period_start, s.current_period_end, s.paystack_subscription_code, p.name AS plan_name, p.amount, p.interval
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
       ORDER BY s.current_period_end DESC NULLS LAST
       LIMIT 1`,
      [req.user.id]
    );
    const row = r.rows?.[0];
    if (!row) return res.json({ subscription: null });
    res.json({
      subscription: {
        id: row.id,
        planId: row.plan_id,
        planName: row.plan_name,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        amount: row.amount,
        interval: row.interval,
      },
    });
  } catch (e) {
    console.error('[billing subscription]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load subscription' });
  }
});

/** Billing history: past and current subscriptions (plan payments) and extra credit paid. */
billingRoutes.get('/history', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ subscriptions: [], extraCreditPaidCents: 0 });
    const userId = req.user.id;

    const subRows = await db.query(
      `SELECT s.id, s.plan_id, s.status, s.current_period_start, s.current_period_end, s.created_at, s.updated_at,
              p.name AS plan_name, p.amount, p.interval
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [userId]
    );

    const extraRow = await db.query(
      'SELECT paid_cents FROM user_extra_credit WHERE user_id = $1',
      [userId]
    );
    const extraCreditPaidCents = extraRow.rows?.[0]?.paid_cents ?? 0;

    const subscriptions = (subRows.rows || []).map((row) => ({
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name,
      amount: row.amount,
      interval: row.interval,
      status: row.status,
      periodStart: row.current_period_start,
      periodEnd: row.current_period_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ subscriptions, extraCreditPaidCents });
  } catch (e) {
    console.error('[billing history]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load billing history' });
  }
});

/** Initialize Paystack subscription (redirect user to Paystack to pay). */
billingRoutes.post('/initialize', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Billing is not available' });
    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Paystack is not configured. Set PAYSTACK_SECRET_KEY in server .env' });
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'planId is required' });
    let planRow = await db.query('SELECT id, name, amount, paystack_plan_code FROM plans WHERE id = $1', [planId]);
    let plan = planRow.rows?.[0];
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.amount > 0 && !plan.paystack_plan_code) {
      await syncPaystackPlans();
      planRow = await db.query('SELECT id, name, amount, paystack_plan_code FROM plans WHERE id = $1', [planId]);
      plan = planRow.rows?.[0];
    }
    let planCode = plan?.paystack_plan_code;
    if (plan.amount > 0 && !planCode) return res.status(503).json({ error: 'Paystack plans are still being set up. Please try again in a moment.' });

    const email = req.user.email;
    const callbackUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '') + '/app/account/billing?paystack=success';

    // Paystack requires amount in the body (plan overrides it for the charge). Omitting it can cause "Invalid Amount Sent".
    const usdToNgn = PAYSTACK_CURRENCY === 'NGN' ? await getUsdToNgnRate() : 0;
    const amountSubunit = amountForPaystack(plan.amount, PAYSTACK_CURRENCY, usdToNgn);

    const doInitialize = async (code) => {
      const reference = `sub_${uuidv4().replace(/-/g, '')}`;
      const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + PAYSTACK_SECRET,
        },
        body: JSON.stringify({
          email,
          amount: amountSubunit,
          currency: PAYSTACK_CURRENCY,
          plan: code,
          reference,
          callback_url: callbackUrl,
        }),
      });
      return response.json();
    };

    let data = await doInitialize(planCode);
    if (!data.status || !data.data?.authorization_url) {
      const msg = data.message || 'Paystack could not create payment link';
      if (/invalid amount|Invalid Amount/i.test(msg)) {
        await db.query('UPDATE plans SET paystack_plan_code = NULL WHERE id = $1', [planId]);
        await syncPaystackPlans();
        const planRow2 = await db.query('SELECT paystack_plan_code FROM plans WHERE id = $1', [planId]);
        const newCode = planRow2.rows?.[0]?.paystack_plan_code;
        if (newCode) {
          data = await doInitialize(newCode);
          if (data.status && data.data?.authorization_url) {
            return res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
          }
        }
        console.warn('[billing] Invalid Amount after retry. Paystack:', msg);
        return res.status(503).json({
          error: 'Payment setup is updating. Please try again in a moment or contact support.',
        });
      }
      return res.status(400).json({ error: msg });
    }
    res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (e) {
    console.error('[billing initialize]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to initialize payment' });
  }
});

/** Pause (disable) subscription: stops billing via Paystack. User can resubscribe from Pricing later. */
billingRoutes.post('/subscription/pause', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable' });
    const userId = req.user.id;
    const sub = await db.query(
      `SELECT s.id, s.paystack_subscription_code, s.plan_id, p.amount FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status IN ('active', 'trialing') AND p.amount > 0
       ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1`,
      [userId]
    );
    const row = sub.rows?.[0];
    if (!row) return res.status(400).json({ error: 'No active paid subscription to pause. Free plans cannot be paused.' });
    const code = row.paystack_subscription_code;
    if (PAYSTACK_SECRET && code) {
      const response = await fetch(`${PAYSTACK_BASE}/subscription/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PAYSTACK_SECRET },
        body: JSON.stringify({ code, token: code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!data.status && data.message) {
        console.warn('[billing pause] Paystack:', data.message);
      }
    }
    await db.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
    res.json({ ok: true, message: 'Your plan has been paused. Billing has stopped. You can resubscribe anytime from Pricing plans.' });
  } catch (e) {
    console.error('[billing subscription/pause]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to pause subscription' });
  }
});

/** Get user's payment methods (masked card from active Paystack subscription). Never exposes full PAN or authorization codes. */
billingRoutes.get('/payment-methods', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ cards: [] });
    if (!PAYSTACK_SECRET) return res.json({ cards: [] });
    const sub = await db.query(
      `SELECT paystack_subscription_code FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trialing') AND paystack_subscription_code IS NOT NULL
       ORDER BY current_period_end DESC NULLS LAST LIMIT 1`,
      [req.user.id]
    );
    const code = sub.rows?.[0]?.paystack_subscription_code;
    if (!code) return res.json({ cards: [] });
    const response = await fetch(`${PAYSTACK_BASE}/subscription/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET },
    });
    const data = await response.json();
    const auth = data?.data?.authorization;
    if (!auth || !auth.last4) return res.json({ cards: [] });
    const cards = [{
      last4: String(auth.last4),
      brand: (auth.brand || auth.card_type || 'card').toString().toLowerCase().replace(/\s+/g, ' ').trim() || 'card',
      expMonth: auth.exp_month ? String(auth.exp_month).padStart(2, '0') : null,
      expYear: auth.exp_year ? String(auth.exp_year) : null,
    }];
    res.json({ cards });
  } catch (e) {
    console.error('[billing payment-methods]', e?.message || e);
    res.json({ cards: [] });
  }
});

/** Get Paystack hosted link for user to update card on their subscription. Secure: card entry happens on Paystack only. */
billingRoutes.get('/payment-methods/update-link', requireAuth, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payment method update is not configured.' });
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Service unavailable.' });
    const sub = await db.query(
      `SELECT paystack_subscription_code FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trialing') AND paystack_subscription_code IS NOT NULL
       ORDER BY current_period_end DESC NULLS LAST LIMIT 1`,
      [req.user.id]
    );
    const code = sub.rows?.[0]?.paystack_subscription_code;
    if (!code) return res.status(400).json({ error: 'No active subscription. Subscribe to a plan first.' });
    const response = await fetch(`${PAYSTACK_BASE}/subscription/${encodeURIComponent(code)}/manage/link`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET },
    });
    const data = await response.json();
    const link = data?.data?.link;
    if (!link) return res.status(400).json({ error: data?.message || 'Could not generate update link.' });
    res.json({ link });
  } catch (e) {
    console.error('[billing update-link]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to get update link' });
  }
});

/** Initialize one-time Paystack payment for extra credit. amountCents = 1000 ($10), 3000 ($30), 5000 ($50), or 10000 ($100). */
billingRoutes.post('/extra-credit/initialize', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Billing is not available' });
    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Paystack is not configured' });
    const allowed = [1000, 3000, 5000, 10000];
    const amountCents = Number(req.body?.amountCents);
    if (!allowed.includes(amountCents)) {
      return res.status(400).json({ error: 'amountCents must be 1000 ($10), 3000 ($30), 5000 ($50), or 10000 ($100)' });
    }
    const email = req.user.email;
    const callbackUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '') + '/app/account/billing?paystack=success&extra=1';
    const reference = `extra_${uuidv4().replace(/-/g, '')}`;
    const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'NGN';
    const { getUsdToNgnRate, amountForPaystack } = await import('../services/paystackSync.js');
    const usdToNgn = PAYSTACK_CURRENCY === 'NGN' ? await getUsdToNgnRate() : 0;
    const amountSubunit = amountForPaystack(amountCents, PAYSTACK_CURRENCY, usdToNgn);
    const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PAYSTACK_SECRET },
      body: JSON.stringify({
        email,
        amount: amountSubunit,
        currency: PAYSTACK_CURRENCY,
        reference,
        callback_url: callbackUrl,
      }),
    });
    const data = await response.json();
    if (!data.status || !data.data?.authorization_url) {
      return res.status(400).json({ error: data.message || 'Could not create payment link' });
    }
    res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference, amountCents });
  } catch (e) {
    console.error('[billing extra-credit initialize]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to initialize payment' });
  }
});

/** Verify extra-credit payment and add to user balance. Body: { reference, amountCents }. */
billingRoutes.post('/extra-credit/verify', requireAuth, async (req, res) => {
  try {
    const { reference, amountCents } = req.body || {};
    if (!reference || typeof reference !== 'string') return res.status(400).json({ error: 'reference is required' });
    const cents = Math.max(0, Math.floor(Number(amountCents) || 0));
    if (cents === 0) return res.status(400).json({ error: 'amountCents is required' });
    if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Paystack is not configured' });
    const resPayload = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference.trim())}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET },
    });
    const data = await resPayload.json();
    if (!data.status || !data.data || data.data.status !== 'success') {
      return res.status(400).json({ error: data.message || 'Transaction not found or invalid' });
    }
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const userId = req.user.id;
    await db.query(
      `INSERT INTO user_extra_credit (user_id, paid_cents, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET paid_cents = user_extra_credit.paid_cents + $2, updated_at = NOW()`,
      [userId, cents]
    );
    res.json({ ok: true, paidCents: cents });
  } catch (e) {
    console.error('[billing extra-credit verify]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Verification failed' });
  }
});

/** Verify payment by reference (e.g. after redirect from Paystack). Creates subscription so test and live both work even if webhook is delayed. */
billingRoutes.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const { reference } = req.body || {};
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'reference is required' });
    }
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ error: 'Paystack is not configured' });
    }
    const resPayload = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference.trim())}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET },
    });
    const data = await resPayload.json();
    if (!data.status || !data.data) {
      return res.status(400).json({ error: data.message || 'Transaction not found or invalid' });
    }
    const tx = data.data;
    if (tx.status !== 'success') {
      return res.status(400).json({ error: 'Transaction was not successful' });
    }
    const planRef = tx.plan;
    const planCode = typeof planRef === 'string' ? planRef : (planRef?.plan_code ?? null);
    if (!planCode) {
      return res.status(400).json({ error: 'Not a subscription payment' });
    }
    const planId = await getPlanIdByPaystackCode(planCode);
    if (!planId) {
      return res.status(400).json({ error: 'Plan not recognized' });
    }
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const userId = req.user.id;
    const existing = await db.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND plan_id = $2 AND status = 'active' ORDER BY current_period_end DESC LIMIT 1`,
      [userId, planId]
    );
    if (existing.rows.length > 0) {
      return res.json({ ok: true, planId });
    }
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO subscriptions (id, user_id, plan_id, paystack_subscription_code, paystack_customer_code, status, current_period_start, current_period_end, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, NOW())`,
      [uuidv4(), userId, planId, tx.authorization?.subscription_code ?? null, tx.authorization?.customer_code ?? null, now, periodEnd]
    );
    const planRow = await db.query('SELECT name, amount, interval FROM plans WHERE id = $1', [planId]);
    const plan = planRow.rows?.[0];
    const toEmail = req.user?.email;
    if (toEmail && plan) {
      const amountFormatted = plan.amount != null ? `$${(plan.amount / 100).toFixed(2)}` : '';
      sendSubscriptionConfirmation(toEmail, plan.name || planId, amountFormatted, plan.interval || 'monthly').catch((e) => console.warn('[transactional subscription email]', e?.message || e));
    }
    handleReferralUpgrade(userId, planId).catch((e) => console.warn('[referral upgrade]', e?.message || e));
    return res.json({ ok: true, planId });
  } catch (e) {
    console.error('[billing verify-payment]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Verification failed' });
  }
});

/** Paystack webhook: verify signature and update subscription. Call this route with express.raw({ type: 'application/json' }) so req.body is the raw string/Buffer. */
export async function handlePaystackWebhook(req, res) {
  const signature = req.headers['x-paystack-signature'];
  if (!PAYSTACK_SECRET || !signature) {
    return res.status(400).send('Missing signature');
  }
  const crypto = await import('crypto');
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
  if (hash !== signature) {
    return res.status(400).send('Invalid signature');
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).send('Invalid JSON');
  }
  const event = payload?.event;
  const data = payload?.data;
  const db = getDb();
  if (!db) return res.status(200).send('OK');

  try {
    if (event === 'charge.success') {
      const customerCode = data?.authorization?.customer_code || data?.customer_code;
      const subscriptionCode = data?.subscription_code || data?.authorization?.subscription_code;
      const email = data?.customer?.email || data?.customer_email;
      if (!email) return res.status(200).send('OK');
      const userRow = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      const userId = userRow.rows?.[0]?.id;
      if (!userId) return res.status(200).send('OK');
      const paystackPlanCode = data?.plan || data?.authorization?.plan;
      const planId = paystackPlanCode ? await getPlanIdByPaystackCode(paystackPlanCode) : null;
      if (!planId) return res.status(200).send('OK');
      const sub = data?.authorization?.subscription || data?.subscription || {};
      const periodStart = sub.start ? new Date(sub.start * 1000) : new Date();
      const periodEnd = sub.end ? new Date(sub.end * 1000) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await db.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, paystack_subscription_code, paystack_customer_code, status, current_period_start, current_period_end, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, NOW())`,
        [uuidv4(), userId, planId, subscriptionCode || null, customerCode || null, periodStart, periodEnd]
      );
      const planRow = await db.query('SELECT name, amount, interval FROM plans WHERE id = $1', [planId]);
      const plan = planRow.rows?.[0];
      if (email && plan) {
        const amountFormatted = plan.amount != null ? `$${(plan.amount / 100).toFixed(2)}` : '';
        sendSubscriptionConfirmation(email, plan.name || planId, amountFormatted, plan.interval || 'monthly').catch((e) => console.warn('[transactional subscription email webhook]', e?.message || e));
      }
      handleReferralUpgrade(userId, planId).catch((e) => console.warn('[referral upgrade webhook]', e?.message || e));
    }
    if (event === 'subscription.disable' && data?.subscription_code) {
      await db.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE paystack_subscription_code = $1`,
        [data.subscription_code]
      );
      const subRow = await db.query('SELECT user_id FROM subscriptions WHERE paystack_subscription_code = $1 LIMIT 1', [data.subscription_code]);
      const uid = subRow.rows?.[0]?.user_id;
      if (uid) {
        const { activateQueuedReferralPremium } = await import('../services/referralService.js');
        activateQueuedReferralPremium(uid).catch((e) => console.warn('[referral premium activate]', e?.message || e));
      }
    }
  } catch (e) {
    console.error('[billing webhook]', e?.message || e);
  }
  res.status(200).send('OK');
}

billingRoutes.post('/webhook', async (req, res) => {
  await handlePaystackWebhook(req, res);
});
