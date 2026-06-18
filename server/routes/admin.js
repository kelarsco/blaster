import { Router } from 'express';
import { getDb, memoryStore, logDbErrorThrottled } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { revokeRefreshTokensForUser } from '../services/tokenAuth.js';
import { getYoutubeVideoId } from '../utils/youtube.js';
import {
  getLeadStoreStats,
  listLeadStores,
  enqueueLeadStores,
  requeueRejectedLeadStores,
  createScrapeJob,
  completeScrapeJob,
  getLatestScrapeJob,
  countQualifiedStoresNeedingTagRefresh,
  clearTagClassificationForAllQualified,
} from '../services/leadStoreRepository.js';
import { runScrapeDiscoveryJob } from '../services/leadScraper.js';
import { kickLeadEngineWorker } from '../services/leadEngineWorker.js';
import { kickTagBackfillWorker, isTagBackfillRunning } from '../services/leadTagBackfillWorker.js';
import { isBackfillEnabled } from '../services/backfillGate.js';
import { getAdminReferralOverview } from '../services/referralService.js';
import {
  applyAdminUserPlanChange,
  listAdminAssignablePlans,
} from '../services/adminPlanChange.js';

export const adminRoutes = Router();
adminRoutes.use(requireAdmin);

/** GET /api/bl-admin/overview - Stats for admin dashboard. Optional query: start, end (YYYY-MM-DD) to filter by period */
adminRoutes.get('/overview', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ totalUsers: 0, totalSubscribers: 0, totalRevenueCents: 0, activeSubscriptions: 0 });
    const start = (req.query.start || '').trim() || null;
    const end = (req.query.end || '').trim() || null;
    const hasRange = start && end;

    let usersRes;
    let subRes;
    let revenueRes;
    if (hasRange) {
      const subWhere = `s.status IN ('active','trialing') AND s.current_period_end::date >= $1 AND s.current_period_start::date <= $2`;
      [usersRes, subRes, revenueRes] = await Promise.all([
        db.query(
          "SELECT COUNT(*) AS c FROM users WHERE created_at::date >= $1 AND created_at::date <= $2",
          [start, end]
        ),
        db.query(
          `SELECT COUNT(DISTINCT s.user_id) AS c FROM subscriptions s WHERE ${subWhere}`,
          [start, end]
        ),
        db.query(
          `SELECT COALESCE(SUM(p.amount), 0) AS total FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE ${subWhere} AND p.amount > 0`,
          [start, end]
        ),
      ]);
    } else {
      [usersRes, subRes, revenueRes] = await Promise.all([
        db.query('SELECT COUNT(*) AS c FROM users'),
        db.query("SELECT COUNT(DISTINCT user_id) AS c FROM subscriptions WHERE status IN ('active','trialing')"),
        db.query(`
          SELECT COALESCE(SUM(p.amount), 0) AS total
          FROM subscriptions s JOIN plans p ON p.id = s.plan_id
          WHERE s.status IN ('active', 'trialing') AND p.amount > 0
        `),
      ]);
    }
    const totalUsers = parseInt(usersRes.rows?.[0]?.c ?? '0', 10);
    const totalSubscribers = parseInt(subRes.rows?.[0]?.c ?? '0', 10);
    const totalRevenue = parseInt(revenueRes.rows?.[0]?.total ?? '0', 10);
    res.json({
      totalUsers,
      totalSubscribers,
      totalRevenueCents: totalRevenue,
      activeSubscriptions: totalSubscribers,
    });
  } catch (e) {
    console.error('[admin overview]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load overview' });
  }
});

/** GET /api/bl-admin/sidebar-counts - Counts for sidebar update indicators */
adminRoutes.get('/sidebar-counts', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ users: 0, subscriptions: 0, messages: 0 });
    const [usersRes, subRes, threadsRes] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM users'),
      db.query('SELECT COUNT(*) AS c FROM subscriptions'),
      db.query('SELECT COUNT(*) AS c FROM support_threads'),
    ]);
    res.json({
      users: parseInt(usersRes.rows?.[0]?.c ?? '0', 10),
      subscriptions: parseInt(subRes.rows?.[0]?.c ?? '0', 10),
      messages: parseInt(threadsRes.rows?.[0]?.c ?? '0', 10),
    });
  } catch (e) {
    logDbErrorThrottled('admin sidebar-counts', e);
    res.status(500).json({ users: 0, subscriptions: 0, messages: 0 });
  }
});

/** GET /api/bl-admin/users - List users with search */
adminRoutes.get('/users', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ users: [], total: 0 });
    const q = (req.query.q || '').trim().replace(/%/g, '\\%');
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const searchVal = q.length >= 1 ? '%' + q + '%' : null;
    const whereList = searchVal ? " AND (u.email ILIKE $3 OR u.name ILIKE $3)" : '';
    const whereCount = searchVal ? " AND (u.email ILIKE $1 OR u.name ILIKE $1)" : '';
    const params = [limit, offset];
    if (searchVal) params.push(searchVal);
    const countRes = await db.query(
      `SELECT COUNT(*) AS c FROM users u WHERE 1=1 ${whereCount}`,
      searchVal ? [searchVal] : []
    );
    const total = parseInt(countRes.rows?.[0]?.c ?? '0', 10);
    const r = await db.query(
      `SELECT u.id, u.email, u.name, u.created_at, u.updated_at, u.deactivated_at, u.suspended_at,
        (SELECT s.plan_id FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('active','trialing') ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1) AS plan_id,
        (SELECT p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = u.id AND s.status IN ('active','trialing') ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1) AS plan_name
       FROM users u
       WHERE 1=1 ${whereList}
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    const users = (r.rows || []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deactivatedAt: row.deactivated_at,
      suspendedAt: row.suspended_at,
      planId: row.plan_id,
      planName: row.plan_name || 'Free',
    }));
    res.json({ users, total });
  } catch (e) {
    console.error('[admin users]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load users' });
  }
});

/** GET /api/bl-admin/users/:id - Full user detail (for double-click) */
adminRoutes.get('/users/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const r = await db.query(
      `SELECT u.id, u.email, u.name, u.auth_provider, u.created_at, u.updated_at, u.deactivated_at, u.suspended_at, u.picture_url,
        (SELECT s.plan_id FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('active','trialing') ORDER BY s.current_period_end DESC LIMIT 1) AS plan_id,
        (SELECT p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = u.id AND s.status IN ('active','trialing') ORDER BY s.current_period_end DESC LIMIT 1) AS plan_name
       FROM users u WHERE u.id = $1`,
      [req.params.id]
    );
    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ error: 'User not found' });
    const tokens = await db.query(
      'SELECT id, created_at, expires_at FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.params.id]
    );
    res.json({
      id: row.id,
      email: row.email,
      name: row.name,
      authProvider: row.auth_provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deactivatedAt: row.deactivated_at,
      suspendedAt: row.suspended_at,
      pictureUrl: row.picture_url,
      planId: row.plan_id,
      planName: row.plan_name || 'Free',
      sessions: (tokens.rows || []).map((t) => ({ id: t.id, createdAt: t.created_at, expiresAt: t.expires_at })),
    });
  } catch (e) {
    console.error('[admin user detail]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load user' });
  }
});

/** PATCH /api/bl-admin/users/:id - Update user (name, email, plan) */
adminRoutes.patch('/users/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const { name, email, planId } = req.body || {};
    const updates = [];
    const values = [];
    let i = 1;
    if (typeof name === 'string') {
      updates.push(`name = $${i++}`);
      values.push(name.trim());
    }
    if (typeof email === 'string' && email.includes('@')) {
      updates.push(`email = $${i++}`);
      values.push(email.trim());
    }
    values.push(req.params.id);
    if (updates.length === 0 && planId === undefined) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    if (updates.length > 0) {
      await db.query(`UPDATE users SET updated_at = NOW(), ${updates.join(', ')} WHERE id = $${i}`, values);
    }
    if (planId !== undefined) {
      const result = await applyAdminUserPlanChange(db, req.params.id, planId === '' ? 'free' : planId);
      if (!result.ok) {
        return res.status(400).json({ error: result.error || 'Failed to update plan' });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin user update]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to update user' });
  }
});

/** POST /api/bl-admin/users/:id/disable */
adminRoutes.post('/users/:id/disable', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    await db.query('UPDATE users SET deactivated_at = NOW(), updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** POST /api/bl-admin/users/:id/suspend - Sets suspended_at and revokes all refresh tokens (logs user out everywhere) */
adminRoutes.post('/users/:id/suspend', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    await db.query('UPDATE users SET suspended_at = COALESCE(suspended_at, NOW()), updated_at = NOW() WHERE id = $1', [req.params.id]);
    await revokeRefreshTokensForUser(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** POST /api/bl-admin/users/:id/reactivate - Clear suspended_at so user can sign in again */
adminRoutes.post('/users/:id/reactivate', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    await db.query('UPDATE users SET suspended_at = NULL, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** DELETE /api/bl-admin/users/:id */
adminRoutes.delete('/users/:id', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const id = req.params.id;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Tables that reference campaigns/scans but have no CASCADE – delete before user cascade
      await client.query('DELETE FROM campaign_pending_sends WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = $1)', [id]);
      await client.query('DELETE FROM campaign_sends WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = $1)', [id]);
      await client.query('DELETE FROM scan_results WHERE scan_id IN (SELECT id FROM scans WHERE user_id = $1)', [id]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[admin delete user]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** POST /api/bl-admin/users/bulk-delete */
adminRoutes.post('/users/bulk-delete', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'No user IDs provided' });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Tables that reference campaigns/scans but have no CASCADE – delete before user cascade
      await client.query('DELETE FROM campaign_pending_sends WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = ANY($1::text[]))', [ids]);
      await client.query('DELETE FROM campaign_sends WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = ANY($1::text[]))', [ids]);
      await client.query('DELETE FROM scan_results WHERE scan_id IN (SELECT id FROM scans WHERE user_id = ANY($1::text[]))', [ids]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1::text[])', [ids]);
      await client.query('DELETE FROM users WHERE id = ANY($1::text[])', [ids]);
      await client.query('COMMIT');
      res.json({ ok: true, deleted: ids.length });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[admin bulk-delete]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Bulk delete failed' });
  }
});

/** GET /api/bl-admin/subscriptions - List all subscribers (all statuses); revenue/count use date range and active only */
adminRoutes.get('/subscriptions', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ subscriptions: [], totalRevenueCents: 0, totalCount: 0 });
    const planFilter = (req.query.plan || '').trim() || null;
    const start = (req.query.start || '').trim() || null;
    const end = (req.query.end || '').trim() || null;

    const listWhereClause = planFilter
      ? "s.status IN ('active','trialing','cancelled') AND s.plan_id = $1"
      : "s.status IN ('active','trialing','cancelled')";
    const listParams = planFilter ? [planFilter] : [];

    const statsParts = ["s.status IN ('active','trialing')"];
    const statsParams = [];
    let pi = 1;
    if (planFilter) {
      statsParts.push(`s.plan_id = $${pi++}`);
      statsParams.push(planFilter);
    }
    if (start && end) {
      statsParts.push(`(s.current_period_start::date <= $${pi++} AND (s.current_period_end IS NULL OR s.current_period_end::date >= $${pi++}))`);
      statsParams.push(end, start);
    }
    const statsWhere = statsParts.join(' AND ');

    const [listRes, statsRes] = await Promise.all([
      db.query(
        `SELECT s.id, s.user_id, s.plan_id, s.status, s.cancel_at_period_end, s.current_period_start, s.current_period_end, p.name AS plan_name, p.amount, p.interval, u.email, u.name
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         JOIN users u ON u.id = s.user_id
         WHERE ${listWhereClause}
         ORDER BY s.updated_at DESC, s.current_period_end DESC NULLS LAST
         LIMIT 200`,
        listParams
      ),
      db.query(
        `SELECT COALESCE(SUM(p.amount), 0) AS revenue, COUNT(*) AS c
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE ${statsWhere}`,
        statsParams
      ),
    ]);
    const subscriptions = (listRes.rows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      planId: r.plan_id,
      planName: r.plan_name,
      amount: r.amount,
      interval: r.interval,
      status: r.status,
      cancelAtPeriodEnd: !!(r.cancel_at_period_end),
      currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end,
      userEmail: r.email,
      userName: r.name,
    }));
    const totalRevenueCents = parseInt(statsRes.rows?.[0]?.revenue ?? '0', 10);
    const totalCount = parseInt(statsRes.rows?.[0]?.c ?? '0', 10);
    res.json({ subscriptions, totalRevenueCents, totalCount });
  } catch (e) {
    console.error('[admin subscriptions]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** GET /api/bl-admin/plans - List assignable plans for admin dropdown */
adminRoutes.get('/plans', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ plans: [] });
    const rows = await listAdminAssignablePlans(db);
    res.json({ plans: rows.map((p) => ({ id: p.id, name: p.name, amount: p.amount, interval: p.interval })) });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** GET /api/bl-admin/messages/threads - List support threads (users who have sent a message) */
adminRoutes.get('/messages/threads', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ threads: [] });
    const r = await db.query(
      `SELECT st.id AS thread_id, st.user_id, st.updated_at,
        u.email, u.name,
        (SELECT body FROM support_messages WHERE thread_id = st.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT sender FROM support_messages WHERE thread_id = st.id ORDER BY created_at DESC LIMIT 1) AS last_sender,
        (SELECT created_at FROM support_messages WHERE thread_id = st.id ORDER BY created_at DESC LIMIT 1) AS last_at
       FROM support_threads st
       JOIN users u ON u.id = st.user_id
       ORDER BY st.updated_at DESC NULLS LAST`
    );
    const threads = (r.rows || []).map((row) => ({
      threadId: row.thread_id,
      userId: row.user_id,
      userEmail: row.email,
      userName: row.name,
      lastMessage: row.last_message,
      lastSender: row.last_sender,
      lastAt: row.last_at,
      updatedAt: row.updated_at,
    }));
    res.json({ threads });
  } catch (e) {
    console.error('[admin threads]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** GET /api/bl-admin/messages/threads/:threadId - Get messages in thread */
adminRoutes.get('/messages/threads/:threadId', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const r = await db.query(
      'SELECT id, sender, body, created_at FROM support_messages WHERE thread_id = $1 ORDER BY created_at ASC',
      [req.params.threadId]
    );
    const messages = (r.rows || []).map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      createdAt: m.created_at,
    }));
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

/** POST /api/bl-admin/messages/threads/:threadId - Send message as support */
adminRoutes.post('/messages/threads/:threadId', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ error: 'Message body required' });
    const threadId = req.params.threadId;
    const exists = await db.query('SELECT id FROM support_threads WHERE id = $1', [threadId]);
    if (!exists.rows?.[0]) return res.status(404).json({ error: 'Thread not found' });
    const id = uuidv4();
    await db.query(
      'INSERT INTO support_messages (id, thread_id, sender, body) VALUES ($1, $2, $3, $4)',
      [id, threadId, 'support', body]
    );
    await db.query('UPDATE support_threads SET updated_at = NOW() WHERE id = $1', [threadId]);
    const created = await db.query('SELECT id, sender, body, created_at FROM support_messages WHERE id = $1', [id]);
    const row = created.rows?.[0];
    res.status(201).json({
      message: { id: row.id, sender: row.sender, body: row.body, createdAt: row.created_at },
    });
  } catch (e) {
    console.error('[admin support message]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});

function mapResourceRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    url: row.url,
    createdAt: row.created_at,
  };
}

/** GET /api/bl-admin/resources?type=video|document */
adminRoutes.get('/resources', async (req, res) => {
  const type = (req.query.type || '').trim();
  if (type !== 'video' && type !== 'document') {
    return res.status(400).json({ error: 'type must be video or document' });
  }
  try {
    const db = getDb();
    if (!db) {
      const items = (memoryStore.resources || [])
        .filter((r) => r.type === type)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(mapResourceRow);
      return res.json({ resources: items });
    }
    const result = await db.query(
      'SELECT id, type, title, url, created_at FROM resources WHERE type = $1 ORDER BY created_at DESC',
      [type]
    );
    res.json({ resources: result.rows.map(mapResourceRow) });
  } catch (e) {
    console.error('[admin resources list]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load resources' });
  }
});

/** POST /api/bl-admin/resources */
adminRoutes.post('/resources', async (req, res) => {
  const type = (req.body?.type || '').trim();
  const title = (req.body?.title || '').trim();
  const url = (req.body?.url || '').trim();
  if (type !== 'video' && type !== 'document') {
    return res.status(400).json({ error: 'type must be video or document' });
  }
  if (!title || !url) {
    return res.status(400).json({ error: 'title and url are required' });
  }
  if (type === 'video' && !getYoutubeVideoId(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }
  if (type === 'document') {
    try {
      new URL(url);
    } catch (_) {
      return res.status(400).json({ error: 'Invalid PDF URL' });
    }
  }
  try {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    if (!db) {
      const row = { id, type, title, url, created_at: now };
      memoryStore.resources = [...(memoryStore.resources || []), row];
      return res.status(201).json({ resource: mapResourceRow(row) });
    }
    const result = await db.query(
      'INSERT INTO resources (id, type, title, url) VALUES ($1, $2, $3, $4) RETURNING id, type, title, url, created_at',
      [id, type, title, url]
    );
    res.status(201).json({ resource: mapResourceRow(result.rows[0]) });
  } catch (e) {
    console.error('[admin resources create]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to add resource' });
  }
});

/** DELETE /api/bl-admin/resources/:id */
adminRoutes.delete('/resources/:id', async (req, res) => {
  const id = (req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const db = getDb();
    if (!db) {
      memoryStore.resources = (memoryStore.resources || []).filter((r) => r.id !== id);
      return res.json({ ok: true });
    }
    await db.query('DELETE FROM resources WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin resources delete]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to delete resource' });
  }
});

/** Lead Engine — store qualification pipeline */
adminRoutes.get('/lead-engine/stats', async (req, res) => {
  try {
    const stats = await getLeadStoreStats();
    const scrapeJob = await getLatestScrapeJob();
    res.json({ stats, scrapeJob });
  } catch (e) {
    logDbErrorThrottled('lead-engine stats', e);
    res.status(500).json({ error: e?.message || 'Failed to load stats' });
  }
});

adminRoutes.get('/lead-engine/stores', async (req, res) => {
  try {
    const stores = await listLeadStores({ limit: 500 });
    res.json({ stores });
  } catch (e) {
    logDbErrorThrottled('lead-engine stores', e);
    res.status(500).json({ error: e?.message || 'Failed to load stores' });
  }
});

adminRoutes.post('/lead-engine/stores/manual', async (req, res) => {
  try {
    const raw = req.body?.urls;
    const urls = Array.isArray(raw)
      ? raw
      : String(raw || '')
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    if (!urls.length) return res.status(400).json({ error: 'No URLs provided' });
    const { added, skipped } = await enqueueLeadStores(urls, 'manual');
    kickLeadEngineWorker();
    res.json({ added: added.length, skipped: skipped.length, urls: added });
  } catch (e) {
    console.error('[lead-engine manual]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to add stores' });
  }
});

adminRoutes.post('/lead-engine/stores/requeue-rejected', async (req, res) => {
  try {
    const { requeued } = await requeueRejectedLeadStores();
    if (requeued > 0) kickLeadEngineWorker();
    res.json({ requeued });
  } catch (e) {
    console.error('[lead-engine requeue-rejected]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to requeue rejected stores' });
  }
});

/** Re-run tag classifier on all qualified stores (for Store Leads filter tags). */
adminRoutes.post('/lead-engine/stores/reclassify-tags', async (req, res) => {
  try {
    const force = req.body?.force === true;
    const pending = await countQualifiedStoresNeedingTagRefresh();
    if (force || pending > 0) {
      if (!isBackfillEnabled()) {
        return res.status(503).json({
          error: 'Backfill workers disabled. Set ENABLE_BACKFILL_WORKERS=1 in server .env and restart.',
        });
      }
      if (force) await clearTagClassificationForAllQualified();
      kickTagBackfillWorker();
    }
    res.json({
      ok: true,
      pending: force ? await countQualifiedStoresNeedingTagRefresh() : pending,
      running: isTagBackfillRunning(),
      message: force
        ? 'Reclassifying tags for all qualified stores in the background.'
        : pending > 0
          ? `Refreshing tags for ${pending} store(s) in the background.`
          : 'All qualified stores already have up-to-date tags.',
    });
  } catch (e) {
    console.error('[lead-engine reclassify-tags]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to start tag refresh' });
  }
});

adminRoutes.get('/lead-engine/stores/tag-refresh-status', async (req, res) => {
  try {
    const pending = await countQualifiedStoresNeedingTagRefresh();
    res.json({ pending, running: isTagBackfillRunning() });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load tag refresh status' });
  }
});

adminRoutes.get('/referrals', async (req, res) => {
  try {
    const data = await getAdminReferralOverview();
    res.json(data || { stats: {}, topReferrers: [], recentReferrals: [] });
  } catch (e) {
    console.error('[admin referrals]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load referrals' });
  }
});

adminRoutes.post('/lead-engine/scrape/start', async (req, res) => {
  try {
    const jobId = await createScrapeJob();
    runScrapeDiscoveryJob()
      .then(async ({ urlsFound, storesAdded }) => {
        await completeScrapeJob(jobId, { urlsFound, storesAdded });
        kickLeadEngineWorker();
      })
      .catch(async (e) => {
        await completeScrapeJob(jobId, {
          urlsFound: 0,
          storesAdded: 0,
          errorMessage: e?.message || 'Scrape failed',
          status: 'failed',
        });
      });
    res.json({ ok: true, jobId, message: 'Scrape job started' });
  } catch (e) {
    console.error('[lead-engine scrape]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to start scrape' });
  }
});

adminRoutes.get('/lead-engine/scrape/status', async (req, res) => {
  try {
    const scrapeJob = await getLatestScrapeJob();
    res.json({ scrapeJob });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to load scrape status' });
  }
});
