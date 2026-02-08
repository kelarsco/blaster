import { Router } from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { revokeRefreshTokensForUser } from '../services/tokenAuth.js';

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
    console.error('[admin sidebar-counts]', e?.message || e);
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
      const sub = await db.query(
        'SELECT id FROM subscriptions WHERE user_id = $1 AND status IN (\'active\',\'trialing\') ORDER BY current_period_end DESC LIMIT 1',
        [req.params.id]
      );
      if (planId === 'free' || !planId) {
        if (sub.rows?.[0]) {
          await db.query('UPDATE subscriptions SET status = \'cancelled\', updated_at = NOW() WHERE user_id = $1', [req.params.id]);
        }
      } else {
        const planRow = await db.query('SELECT id FROM plans WHERE id = $1', [planId]);
        if (!planRow.rows?.[0]) return res.status(400).json({ error: 'Invalid plan ID' });
        if (sub.rows?.[0]) {
          await db.query('UPDATE subscriptions SET plan_id = $1, updated_at = NOW() WHERE user_id = $2', [planId, req.params.id]);
        } else {
          const periodStart = new Date();
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await db.query(
            `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end)
             VALUES ($1, $2, $3, 'active', $4, $5)`,
            [uuidv4(), req.params.id, planId, periodStart, periodEnd]
          );
        }
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
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
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
    await db.query('DELETE FROM users WHERE id = ANY($1::text[])', [ids]);
    res.json({ ok: true, deleted: ids.length });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed' });
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

/** GET /api/bl-admin/plans - List plans for dropdown */
adminRoutes.get('/plans', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ plans: [] });
    const r = await db.query('SELECT id, name, amount, interval FROM plans ORDER BY amount ASC');
    res.json({ plans: (r.rows || []).map((p) => ({ id: p.id, name: p.name, amount: p.amount, interval: p.interval })) });
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
