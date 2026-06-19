/**
 * Create Paystack plans automatically from DB when PAYSTACK_SECRET_KEY is set.
 * Plan amounts in DB are in USD cents. For NGN, amounts are converted to kobo using
 * PAYSTACK_USD_TO_NGN (if set) or a live USD→NGN rate from a public API (cached 1h).
 */
import { getDb } from '../db.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'NGN';
const PAYSTACK_SYNC_VERBOSE = process.env.PAYSTACK_SYNC_VERBOSE === '1';
const USD_TO_NGN_ENV = Number(process.env.PAYSTACK_USD_TO_NGN) || 0;
/** Paystack minimum for NGN is 100 NGN = 10,000 kobo. Amounts below this cause "Invalid Amount Sent". */
const PAYSTACK_MIN_NGN_KOBO = 10000;
const RATE_CACHE_MS = 60 * 60 * 1000;
const FALLBACK_USD_TO_NGN = 1500;

let cachedUsdToNgn = 0;
let cachedAt = 0;

/** Get USD→NGN rate: env first, then cached fetch, then live fetch. Fallback 1500. */
export async function getUsdToNgnRate() {
  if (USD_TO_NGN_ENV > 0) return USD_TO_NGN_ENV;
  if (cachedUsdToNgn > 0 && Date.now() - cachedAt < RATE_CACHE_MS) return cachedUsdToNgn;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const rate = data?.rates?.NGN;
    if (typeof rate === 'number' && rate >= 100) {
      cachedUsdToNgn = Math.round(rate);
      cachedAt = Date.now();
      console.log('[Paystack] Using live USD→NGN rate:', cachedUsdToNgn);
      return cachedUsdToNgn;
    }
  } catch (e) {
    console.warn('[Paystack] Could not fetch USD→NGN rate:', e?.message || e);
  }
  if (cachedUsdToNgn > 0) return cachedUsdToNgn;
  cachedUsdToNgn = FALLBACK_USD_TO_NGN;
  cachedAt = Date.now();
  return FALLBACK_USD_TO_NGN;
}

/** Plan amount in DB is USD cents; returns amount in Paystack subunit (kobo for NGN, cents for USD). */
export function amountForPaystack(amountUsdCents, currency, usdToNgnRate) {
  if (currency === 'NGN') {
    const rate = usdToNgnRate || USD_TO_NGN_ENV || FALLBACK_USD_TO_NGN;
    const ngn = (amountUsdCents / 100) * rate;
    const kobo = Math.floor(ngn * 100);
    return Math.max(PAYSTACK_MIN_NGN_KOBO, kobo);
  }
  return Math.max(100, amountUsdCents);
}

/** Returns true if this plan was likely created with amount below Paystack minimum. */
function wasInvalidAmount(amountUsdCents, currency, usdToNgnRate) {
  if (currency !== 'NGN') return false;
  const rate = usdToNgnRate || USD_TO_NGN_ENV || FALLBACK_USD_TO_NGN;
  const ngn = (amountUsdCents / 100) * rate;
  const kobo = Math.floor(ngn * 100);
  return kobo > 0 && kobo < PAYSTACK_MIN_NGN_KOBO;
}

export async function syncPaystackPlans() {
  if (!PAYSTACK_SECRET) return;
  const db = getDb();
  if (!db) return;

  const usdToNgn = PAYSTACK_CURRENCY === 'NGN' ? await getUsdToNgnRate() : 0;

  const r = await db.query(
    `SELECT id, name, amount, interval, paystack_plan_code FROM plans WHERE amount > 0 AND id != 'trial_3day'`
  );
  const plans = r.rows || [];

  for (const plan of plans) {
    if (plan.paystack_plan_code && wasInvalidAmount(plan.amount, PAYSTACK_CURRENCY, usdToNgn)) {
      await db.query('UPDATE plans SET paystack_plan_code = NULL WHERE id = $1', [plan.id]);
      plan.paystack_plan_code = null;
    }
    if (plan.paystack_plan_code) continue;

    const amount = amountForPaystack(plan.amount, PAYSTACK_CURRENCY, usdToNgn);

    const body = {
      name: `${plan.name} (${plan.interval})`,
      amount,
      interval: plan.interval === 'annually' ? 'annually' : 'monthly',
      currency: PAYSTACK_CURRENCY,
    };

    try {
      const res = await fetch(`${PAYSTACK_BASE}/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + PAYSTACK_SECRET,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.status && data.data?.plan_code) {
        await db.query(
          `UPDATE plans SET paystack_plan_code = $1 WHERE id = $2`,
          [data.data.plan_code, plan.id]
        );
        if (PAYSTACK_SYNC_VERBOSE) {
          console.log('[Paystack] Created plan:', plan.id, data.data.plan_code);
        }
      } else {
        console.warn('[Paystack] Plan create failed for', plan.id, data.message || data);
      }
    } catch (e) {
      console.error('[Paystack] Plan create error for', plan.id, e?.message || e);
    }
  }
}
