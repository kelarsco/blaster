/**
 * Track SerpAPI usage against monthly + daily budgets (default 15/day, 250/mo cap).
 */
import { getDb, memoryStore } from '../db.js';

const DEFAULT_MONTHLY_QUOTA = 250;
const DEFAULT_DAILY_BUDGET = 15;

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getSerpBudgetConfig() {
  const monthlyQuota = Math.max(
    1,
    Number(process.env.SERPAPI_MONTHLY_QUOTA) || DEFAULT_MONTHLY_QUOTA
  );
  const configuredDaily = Number(process.env.SERPAPI_DAILY_BUDGET);
  const dailyBudget =
    Number.isFinite(configuredDaily) && configuredDaily > 0
      ? Math.floor(configuredDaily)
      : DEFAULT_DAILY_BUDGET;
  const mode = (process.env.SERPAPI_MODE || 'daily').trim().toLowerCase();
  return { monthlyQuota, dailyBudget, mode };
}

function emptyQuotaState() {
  const now = new Date();
  return {
    serpMonthKey: monthKey(now),
    serpRequestsMonth: 0,
    serpDayKey: dayKey(now),
    serpRequestsDay: 0,
  };
}

function normalizeQuotaRow(row) {
  const now = new Date();
  const mk = monthKey(now);
  const dk = dayKey(now);
  let monthCount = Number(row?.serp_requests_month) || 0;
  let dayCount = Number(row?.serp_requests_day) || 0;
  if (row?.serp_month_key !== mk) {
    monthCount = 0;
  }
  if (row?.serp_day_key !== dk) {
    dayCount = 0;
  }
  return {
    serpMonthKey: mk,
    serpRequestsMonth: monthCount,
    serpDayKey: dk,
    serpRequestsDay: dayCount,
  };
}

async function readQuotaState() {
  const db = getDb();
  if (!db) {
    const s = memoryStore.leadScrapeSettings || {};
    return normalizeQuotaRow({
      serp_month_key: s.serp_month_key,
      serp_requests_month: s.serp_requests_month,
      serp_day_key: s.serp_day_key,
      serp_requests_day: s.serp_requests_day,
    });
  }
  const res = await db.query(`SELECT * FROM lead_scrape_settings WHERE id = 'default' LIMIT 1`);
  return normalizeQuotaRow(res.rows[0]);
}

async function writeQuotaState(state) {
  const db = getDb();
  if (!db) {
    memoryStore.leadScrapeSettings = {
      ...(memoryStore.leadScrapeSettings || {}),
      serp_month_key: state.serpMonthKey,
      serp_requests_month: state.serpRequestsMonth,
      serp_day_key: state.serpDayKey,
      serp_requests_day: state.serpRequestsDay,
    };
    return;
  }
  await db.query(
    `UPDATE lead_scrape_settings SET
       serp_month_key = $1,
       serp_requests_month = $2,
       serp_day_key = $3,
       serp_requests_day = $4,
       updated_at = NOW()
     WHERE id = 'default'`,
    [state.serpMonthKey, state.serpRequestsMonth, state.serpDayKey, state.serpRequestsDay]
  );
}

export async function getSerpQuotaStatus() {
  const { monthlyQuota, dailyBudget, mode } = getSerpBudgetConfig();
  const state = await readQuotaState();
  return {
    mode,
    monthlyQuota,
    dailyBudget,
    usedToday: state.serpRequestsDay,
    usedMonth: state.serpRequestsMonth,
    remainingToday: Math.max(0, dailyBudget - state.serpRequestsDay),
    remainingMonth: Math.max(0, monthlyQuota - state.serpRequestsMonth),
    dayKey: state.serpDayKey,
    monthKey: state.serpMonthKey,
  };
}

/** Reserve up to `count` requests; returns how many were actually reserved (0 if blocked). */
export async function reserveSerpRequests(count = 1) {
  const { monthlyQuota, dailyBudget } = getSerpBudgetConfig();
  const state = await readQuotaState();
  const remainingDay = dailyBudget - state.serpRequestsDay;
  const remainingMonth = monthlyQuota - state.serpRequestsMonth;
  const allowed = Math.min(count, Math.max(0, remainingDay), Math.max(0, remainingMonth));
  if (allowed <= 0) return { reserved: 0, state: await getSerpQuotaStatus() };

  const next = {
    serpMonthKey: state.serpMonthKey,
    serpRequestsMonth: state.serpRequestsMonth + allowed,
    serpDayKey: state.serpDayKey,
    serpRequestsDay: state.serpRequestsDay + allowed,
  };
  await writeQuotaState(next);
  return { reserved: allowed, state: await getSerpQuotaStatus() };
}

/** Reset today's SerpAPI usage counter (admin manual retry after key fix or failed run). */
export async function resetSerpDailyQuota() {
  const state = await readQuotaState();
  const next = {
    serpMonthKey: monthKey(),
    serpRequestsMonth: state.serpRequestsMonth,
    serpDayKey: dayKey(),
    serpRequestsDay: 0,
  };
  await writeQuotaState(next);
  return getSerpQuotaStatus();
}
