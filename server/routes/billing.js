import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { syncPaystackPlans } from '../services/paystackSync.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

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
    const planCode = plan?.paystack_plan_code;
    if (plan.amount > 0 && !planCode) return res.status(503).json({ error: 'Paystack plans are still being set up. Please try again in a moment.' });
    const email = req.user.email;
    const reference = `sub_${uuidv4().replace(/-/g, '')}`;
    const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + PAYSTACK_SECRET,
      },
      body: JSON.stringify({
        email,
        plan: planCode,
        reference,
        callback_url: (process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '') + '/app/account/billing?paystack=success',
      }),
    });
    const data = await response.json();
    if (!data.status || !data.data?.authorization_url) {
      return res.status(400).json({ error: data.message || 'Paystack could not create payment link' });
    }
    res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (e) {
    console.error('[billing initialize]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to initialize payment' });
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
    }
    if (event === 'subscription.disable' && data?.subscription_code) {
      await db.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE paystack_subscription_code = $1`,
        [data.subscription_code]
      );
    }
  } catch (e) {
    console.error('[billing webhook]', e?.message || e);
  }
  res.status(200).send('OK');
}

billingRoutes.post('/webhook', async (req, res) => {
  await handlePaystackWebhook(req, res);
});
