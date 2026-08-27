import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { recordEmailSent } from '../services/streakService.js';
import { logActivity } from './activity.js';

export const manualCampaignRoutes = Router();

function parseJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function fillTemplate(text, recipient) {
  const storeUrl = recipient.storeUrl || recipient.store_url || '';
  const domain = storeUrl.replace(/^https?:\/\//, '').split('/')[0] || '';
  return String(text || '')
    .replace(/\{\{store_url\}\}/gi, storeUrl)
    .replace(/\{\{store_domain\}\}/gi, domain)
    .replace(/\{\{email\}\}/gi, recipient.email || '');
}

function randomTemplate(templates) {
  if (!templates?.length) {
    return { subject: '{{store_url}}', body: 'Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards' };
  }
  const t = templates[Math.floor(Math.random() * templates.length)];
  const subject = typeof t === 'string' ? t : (t.subject || t.value || '{{store_url}}');
  const body = typeof t === 'string' ? t : (t.body || t.text || '');
  return { subject, body };
}

async function loadPresets(db, userId, templateIds) {
  if (!templateIds?.length) return { subjects: [], templates: [] };
  const placeholders = templateIds.map((_, i) => `$${i + 2}`).join(',');
  const result = await db.query(
    `SELECT subjects, templates FROM campaign_presets WHERE user_id = $1 AND id IN (${placeholders})`,
    [userId, ...templateIds]
  );
  const subjects = [];
  const templates = [];
  for (const row of result.rows || []) {
    const subs = parseJson(row.subjects, []);
    const tmps = parseJson(row.templates, []);
    for (const s of subs) {
      const v = typeof s === 'string' ? s : s?.value;
      if (v) subjects.push(v);
    }
    for (const t of tmps) {
      const b = typeof t === 'string' ? t : (t?.body || t?.text);
      if (b) templates.push({ body: b });
    }
  }
  return { subjects, templates };
}

function rowToRun(row) {
  return {
    id: row.id,
    emailListId: row.email_list_id,
    templateIds: parseJson(row.template_ids, []),
    recipientQueue: parseJson(row.recipient_queue, []),
    currentIndex: row.current_index || 0,
    status: row.status,
    totalSent: row.total_sent || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRunTrackingStats(db, row) {
  const queue = parseJson(row.recipient_queue, []);
  return {
    totalSent: row.total_sent || 0,
    totalQueued: queue.length,
  };
}

function buildCardContent(recipient, subjects, templates, meta) {
  const tmpl = randomTemplate(templates.length ? templates : subjects.map((s) => ({ subject: s, body: '' })));
  const subjectRaw = subjects.length
    ? subjects[Math.floor(Math.random() * subjects.length)]
    : (typeof tmpl.subject === 'string' ? tmpl.subject : '{{store_url}}');
  const bodyRaw = tmpl.body || `Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards`;

  return {
    currentIndex: meta.idx,
    totalQueued: meta.totalQueued,
    totalSent: meta.totalSent,
    recipient,
    subject: fillTemplate(subjectRaw, recipient),
    body: fillTemplate(bodyRaw, recipient),
  };
}

async function buildDeckForRun(db, userId, row, fromIndex = 0) {
  const queue = parseJson(row.recipient_queue, []);
  const { subjects, templates } = await loadPresets(db, userId, parseJson(row.template_ids, []));
  const start = Math.max(fromIndex, row.current_index || 0);
  const deck = [];

  for (let idx = start; idx < queue.length; idx++) {
    deck.push(
      buildCardContent(queue[idx], subjects, templates, {
        idx,
        totalQueued: queue.length,
        totalSent: row.total_sent || 0,
      })
    );
  }

  return deck;
}

async function buildCardAtIndex(db, userId, row, idx) {
  const queue = parseJson(row.recipient_queue, []);
  if (idx >= queue.length) return null;
  const { subjects, templates } = await loadPresets(db, userId, parseJson(row.template_ids, []));
  return buildCardContent(queue[idx], subjects, templates, {
    idx,
    totalQueued: queue.length,
    totalSent: row.total_sent || 0,
  });
}

async function advanceRunAfterSkip(db, row) {
  const queue = parseJson(row.recipient_queue, []);
  const idx = row.current_index || 0;
  if (idx >= queue.length) {
    return { error: 'No more recipients', status: 400 };
  }

  const recipient = queue[idx];
  const eventId = uuidv4();
  const trackingToken = uuidv4().replace(/-/g, '');

  await db.query(
    `INSERT INTO manual_send_events
      (id, run_id, recipient_email, recipient_store_url, subject, tracking_token)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      eventId, row.id, recipient.email,
      recipient.storeUrl || recipient.store_url || null,
      'Skipped',
      trackingToken,
    ]
  );

  const nextIndex = idx + 1;
  const completed = nextIndex >= queue.length;
  await db.query(
    `UPDATE manual_campaign_runs SET
      current_index = $2,
      status = $3,
      updated_at = NOW()
     WHERE id = $1`,
    [row.id, nextIndex, completed ? 'completed' : row.status]
  );

  const updatedRow = {
    ...row,
    current_index: nextIndex,
    status: completed ? 'completed' : row.status,
  };

  let next = null;
  let prefetch = null;
  if (!completed) {
    next = await buildCardAtIndex(db, row.user_id, updatedRow, nextIndex);
    if (nextIndex + 1 < queue.length) {
      prefetch = await buildCardAtIndex(db, row.user_id, updatedRow, nextIndex + 1);
    }
  }

  const tracking = await getRunTrackingStats(db, updatedRow);

  return {
    ok: true,
    skipped: true,
    completed,
    ...tracking,
    next,
    prefetch,
    trackingToken,
  };
}

manualCampaignRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ run: null });
    const { emailListId } = req.query;
    if (!emailListId) return res.json({ run: null });
    const result = await db.query(
      `SELECT * FROM manual_campaign_runs
       WHERE user_id = $1 AND email_list_id = $2 AND status IN ('in_progress', 'paused')
       ORDER BY updated_at DESC LIMIT 1`,
      [req.user.id, emailListId]
    );
    const row = result.rows[0];
    res.json({ run: row ? rowToRun(row) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.post('/start', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const userId = req.user.id;
    const { emailListId, templateIds = [], recipients = [] } = req.body || {};

    if (!emailListId || !recipients?.length) {
      return res.status(400).json({ error: 'emailListId and recipients required' });
    }
    if (!templateIds?.length) {
      return res.status(400).json({ error: 'Select at least one template' });
    }

    const existing = await db.query(
      `SELECT * FROM manual_campaign_runs
       WHERE user_id = $1 AND email_list_id = $2 AND status IN ('in_progress', 'paused')
       ORDER BY updated_at DESC LIMIT 1`,
      [userId, emailListId]
    );

    if (existing.rows[0]) {
      await db.query(
        "UPDATE manual_campaign_runs SET status = 'in_progress', updated_at = NOW() WHERE id = $1",
        [existing.rows[0].id]
      );
      const row = existing.rows[0];
      const run = rowToRun({ ...row, status: 'in_progress' });
      const deck = await buildDeckForRun(db, userId, row, row.current_index || 0);
      return res.json({ run, deck, resumed: true });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO manual_campaign_runs
        (id, user_id, email_list_id, template_ids, recipient_queue, current_index, status, total_sent)
       VALUES ($1, $2, $3, $4, $5, 0, 'in_progress', 0)`,
      [id, userId, emailListId, JSON.stringify(templateIds), JSON.stringify(recipients)]
    );
    logActivity('manual_campaign_start', { runId: id, emailListId, total: recipients.length }, userId);
    const row = (await db.query('SELECT * FROM manual_campaign_runs WHERE id = $1', [id])).rows[0];
    const deck = await buildDeckForRun(db, userId, row, 0);
    res.json({ run: rowToRun(row), deck, resumed: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.get('/:runId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const result = await db.query(
      'SELECT * FROM manual_campaign_runs WHERE id = $1 AND user_id = $2',
      [req.params.runId, req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Run not found' });
    const events = await db.query(
      'SELECT recipient_email, subject, sent_at, opened_at FROM manual_send_events WHERE run_id = $1 ORDER BY sent_at',
      [row.id]
    );
    res.json({ run: rowToRun(row), sendLog: events.rows || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.get('/:runId/stats', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const result = await db.query(
      'SELECT * FROM manual_campaign_runs WHERE id = $1 AND user_id = $2',
      [req.params.runId, req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Run not found' });
    res.json(await getRunTrackingStats(db, row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.get('/:runId/deck', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const result = await db.query(
      'SELECT * FROM manual_campaign_runs WHERE id = $1 AND user_id = $2',
      [req.params.runId, req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Run not found' });
    if (row.status === 'completed') {
      const tracking = await getRunTrackingStats(db, row);
      return res.json({ completed: true, deck: [], ...tracking });
    }
    const deck = await buildDeckForRun(db, req.user.id, row, row.current_index || 0);
    const tracking = await getRunTrackingStats(db, row);
    res.json({ completed: false, deck, ...tracking });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.get('/:runId/current', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const result = await db.query(
      'SELECT * FROM manual_campaign_runs WHERE id = $1 AND user_id = $2',
      [req.params.runId, req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Run not found' });
    if (row.status === 'paused') {
      await db.query(
        "UPDATE manual_campaign_runs SET status = 'in_progress', updated_at = NOW() WHERE id = $1",
        [row.id]
      );
    }
    if (row.status === 'completed') {
      const tracking = await getRunTrackingStats(db, row);
      return res.json({ completed: true, ...tracking });
    }

    const queue = parseJson(row.recipient_queue, []);
    const idx = row.current_index || 0;
    if (idx >= queue.length) {
      await db.query(
        "UPDATE manual_campaign_runs SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [row.id]
      );
      const tracking = await getRunTrackingStats(db, row);
      return res.json({ completed: true, ...tracking });
    }

    const card = await buildCardAtIndex(db, req.user.id, row, idx);
    if (!card) {
      const tracking = await getRunTrackingStats(db, row);
      return res.json({ completed: true, ...tracking });
    }

    let next = null;
    if (idx + 1 < queue.length) {
      next = await buildCardAtIndex(db, req.user.id, row, idx + 1);
    }

    const tracking = await getRunTrackingStats(db, row);

    res.json({
      completed: false,
      ...card,
      ...tracking,
      next,
      recipientQueue: queue,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.post('/:runId/send', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const userId = req.user.id;
    const { subject, body, skip } = req.body || {};

    const result = await db.query(
      'SELECT * FROM manual_campaign_runs WHERE id = $1 AND user_id = $2',
      [req.params.runId, userId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Run not found' });
    if (row.status === 'completed') return res.status(400).json({ error: 'Campaign already completed' });

    if (skip) {
      const payload = await advanceRunAfterSkip(db, row);
      if (payload.error) return res.status(payload.status || 400).json({ error: payload.error });
      return res.json(payload);
    }

    const queue = parseJson(row.recipient_queue, []);
    const idx = row.current_index || 0;
    if (idx >= queue.length) {
      return res.status(400).json({ error: 'No more recipients' });
    }

    const recipient = queue[idx];
    const eventId = uuidv4();
    const trackingToken = uuidv4().replace(/-/g, '');

    await db.query(
      `INSERT INTO manual_send_events
        (id, run_id, recipient_email, recipient_store_url, subject, tracking_token)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        eventId, row.id, recipient.email,
        recipient.storeUrl || recipient.store_url || null,
        subject,
        trackingToken,
      ]
    );

    const nextIndex = idx + 1;
    const completed = nextIndex >= queue.length;
    await db.query(
      `UPDATE manual_campaign_runs SET
        current_index = $2,
        total_sent = total_sent + 1,
        status = $3,
        updated_at = NOW()
       WHERE id = $1`,
      [row.id, nextIndex, completed ? 'completed' : row.status]
    );

    await recordEmailSent(userId, 1);

    const totalSent = (row.total_sent || 0) + 1;
    const updatedRow = {
      ...row,
      current_index: nextIndex,
      total_sent: totalSent,
      status: completed ? 'completed' : row.status,
    };

    let next = null;
    let prefetch = null;
    if (!completed) {
      next = await buildCardAtIndex(db, userId, updatedRow, nextIndex);
      if (nextIndex + 1 < queue.length) {
        prefetch = await buildCardAtIndex(db, userId, updatedRow, nextIndex + 1);
      }
    }

    const tracking = await getRunTrackingStats(db, updatedRow);

    res.json({
      ok: true,
      completed,
      ...tracking,
      next,
      prefetch,
      trackingToken,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

manualCampaignRoutes.post('/:runId/pause', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    await db.query(
      "UPDATE manual_campaign_runs SET status = 'paused', updated_at = NOW() WHERE id = $1 AND user_id = $2",
      [req.params.runId, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
