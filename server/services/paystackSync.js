/**
 * Create Paystack plans automatically from DB when PAYSTACK_SECRET_KEY is set.
 * Plan amounts in DB are in USD cents. When PAYSTACK_USD_TO_NGN is set, amounts are
 * converted to NGN kobo for Paystack (1 NGN = 100 kobo; min 100 NGN = 10,000 kobo).
 */
import { getDb } from '../db.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'NGN';
/** USD to NGN rate, e.g. 1600 = $1 = NGN 1,600. When set, DB amounts (USD cents) are converted to NGN kobo. */
const USD_TO_NGN = Number(process.env.PAYSTACK_USD_TO_NGN) || 0;
/** Paystack minimum for NGN is 100 NGN = 10,000 kobo. Amounts below this cause "Invalid Amount Sent". */
const PAYSTACK_MIN_NGN_KOBO = 10000;

function amountForPaystack(amountUsdCents, currency) {
  if (currency === 'NGN') {
    const rate = USD_TO_NGN > 0 ? USD_TO_NGN : 100;
    // DB amount = USD cents. Convert to NGN kobo: cents * rate (e.g. 1500 * 1600 = 2.4M kobo for $15 at 1600 NGN/$)
    const kobo = Math.round(amountUsdCents * rate);
    return Math.max(PAYSTACK_MIN_NGN_KOBO, kobo);
  }
  return Math.max(100, amountUsdCents);
}

/** Returns true if this plan was likely created with amount below Paystack minimum (causes "Invalid Amount Sent"). */
function wasInvalidAmount(amountUsdCents, currency) {
  if (currency !== 'NGN') return false;
  const kobo = USD_TO_NGN > 0 ? Math.round(amountUsdCents * USD_TO_NGN) : amountUsdCents;
  return kobo > 0 && kobo < PAYSTACK_MIN_NGN_KOBO;
}

export async function syncPaystackPlans() {
  if (!PAYSTACK_SECRET) return;
  const db = getDb();
  if (!db) return;

  const r = await db.query(
    `SELECT id, name, amount, interval, paystack_plan_code FROM plans WHERE amount > 0`
  );
  const plans = r.rows || [];

  for (const plan of plans) {
    if (plan.paystack_plan_code && wasInvalidAmount(plan.amount, PAYSTACK_CURRENCY)) {
      await db.query('UPDATE plans SET paystack_plan_code = NULL WHERE id = $1', [plan.id]);
      plan.paystack_plan_code = null;
    }
    if (plan.paystack_plan_code) continue;

    const amount = amountForPaystack(plan.amount, PAYSTACK_CURRENCY);

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
        console.log('[Paystack] Created plan:', plan.id, data.data.plan_code);
      } else {
        console.warn('[Paystack] Plan create failed for', plan.id, data.message || data);
      }
    } catch (e) {
      console.error('[Paystack] Plan create error for', plan.id, e?.message || e);
    }
  }
}
