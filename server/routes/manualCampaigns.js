import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { shuffleArray, pickNextSender } from '../services/senderShuffle.js';
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

async function loadGroupEmails(db, groupId, userId) {
  const result = await db.query(
    `SELECT s.email FROM senders s
     JOIN sender_group_members sgm ON sgm.sender_id = s.id
     JOIN sender_groups sg ON sg.id = sgm.group_id
     WHERE sg.id = $1 AND sg.user_id = $2 AND s.is_active = 1
       AND COALESCE(s.verification_status, 'verified') = 'verified'
     ORDER BY s.created_at`,
    [groupId, userId]
  );
  return (result.rows || []).map((r) => r.email).filter(Boolean);
}

function rowToRun(row) {
  return {
    id: row.id,
    emailListId: row.email_list_id,
    senderGroupId: row.sender_group_id,
    templateIds: parseJson(row.template_ids, []),
    recipientQueue: parseJson(row.recipient_queue, []),
    currentIndex: row.current_index || 0,
    senderOrder: parseJson(row.sender_order, []),
    lastSenderEmail: row.last_sender_email || null,
    senderCycleIndex: row.sender_cycle_index || 0,
    status: row.status,
    totalSent: row.total_sent || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getRunTrackingStats(db, runId, row) {
  const queue = parseJson(row.recipient_queue, []);
  return {
    totalSent: row.total_sent || 0,
    totalQueued: queue.length,
  };
}

async function advanceRunAfterSkip(db, userId, row) {
  const queue = parseJson(row.recipient_queue, []);
  const idx = row.current_index || 0;
  if (idx >= queue.length) {
    return { error: 'No more recipients', status: 400 };
  }

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
    next = await buildCardAtIndex(db, userId, updatedRow, nextIndex);
    if (nextIndex + 1 < queue.length) {
      prefetch = await buildCardAtIndex(db, userId, updatedRow, nextIndex + 1);
    }
  }

  const tracking = await getRunTrackingStats(db, row.id, updatedRow);

  return {
    ok: true,
    skipped: true,
    completed,
    ...tracking,
    next,
    prefetch,
  };
}

async function buildCardAtIndex(db, userId, row, idx) {
  const queue = parseJson(row.recipient_queue, []);
  if (idx >= queue.length) return null;

  const recipient = queue[idx];
  let senderOrder = parseJson(row.sender_order, []);
  const pick = pickNextSender(senderOrder, row.sender_cycle_index || 0, row.last_sender_email);
  senderOrder = pick.order;

  const { subjects, templates } = await loadPresets(db, userId, parseJson(row.template_ids, []));
  const tmpl = randomTemplate(templates.length ? templates : subjects.map((s) => ({ subject: s, body: '' })));
  const subjectRaw = subjects.length
    ? subjects[Math.floor(Math.random() * subjects.length)]
    : (typeof tmpl.subject === 'string' ? tmpl.subject : '{{store_url}}');
  const bodyRaw = tmpl.body || `Hi,\n\nI noticed your store: {{store_url}}\n\nBest regards`;

  const subject = fillTemplate(subjectRaw, recipient);
  const body = fillTemplate(bodyRaw, recipient);
  const senderEmail = pick.email || senderOrder[0];

  return {
    currentIndex: idx,
    totalQueued: queue.length,
    totalSent: row.total_sent || 0,
    recipient,
    senderEmail,
    subject,
    body,
    senderOrder,
    senderPickIndex: pick.index,
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

// POST /start before /:runId
manualCampaignRoutes.post('/start', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const userId = req.user.id;
    const { emailListId, senderGroupId, templateIds = [], recipients = [] } = req.body || {};

    if (!emailListId || !senderGroupId || !recipients?.length) {
      return res.status(400).json({ error: 'emailListId, senderGroupId, and recipients required' });
    }
    if (!templateIds?.length) {
      return res.status(400).json({ error: 'Select at least one template' });
    }

    const groupEmails = await loadGroupEmails(db, senderGroupId, userId);
    if (!groupEmails.length) {
      return res.status(400).json({ error: 'Sender group has no verified emails' });
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
      const run = rowToRun(existing.rows[0]);
      return res.json({ run: { ...run, status: 'in_progress' }, resumed: true });
    }

    const id = uuidv4();
    const senderOrder = shuffleArray(groupEmails);
    await db.query(
      `INSERT INTO manual_campaign_runs
        (id, user_id, email_list_id, sender_group_id, template_ids, recipient_queue, current_index, sender_order, status, total_sent)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'in_progress', 0)`,
      [
        id, userId, emailListId, senderGroupId,
        JSON.stringify(templateIds),
        JSON.stringify(recipients),
        JSON.stringify(senderOrder),
      ]
    );
    logActivity('manual_campaign_start', { runId: id, emailListId, total: recipients.length }, userId);
    const row = (await db.query('SELECT * FROM manual_campaign_runs WHERE id = $1', [id])).rows[0];
    res.json({ run: rowToRun(row), resumed: false });
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
      'SELECT recipient_email, sender_email, sent_at, opened_at FROM manual_send_events WHERE run_id = $1 ORDER BY sent_at',
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
    res.json(await getRunTrackingStats(db, row.id, row));
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
      const tracking = await getRunTrackingStats(db, row.id, row);
      return res.json({ completed: true, ...tracking });
    }

    const queue = parseJson(row.recipient_queue, []);
    const idx = row.current_index || 0;
    if (idx >= queue.length) {
      await db.query(
        "UPDATE manual_campaign_runs SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [row.id]
      );
      const tracking = await getRunTrackingStats(db, row.id, row);
      return res.json({ completed: true, ...tracking });
    }

    const card = await buildCardAtIndex(db, req.user.id, row, idx);
    if (!card) {
      const tracking = await getRunTrackingStats(db, row.id, row);
      return res.json({ completed: true, ...tracking });
    }

    let next = null;
    if (idx + 1 < queue.length) {
      next = await buildCardAtIndex(db, req.user.id, row, idx + 1);
    }

    const tracking = await getRunTrackingStats(db, row.id, row);

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
    const { senderEmail, subject, body, senderOrder, senderPickIndex, skip } = req.body || {};

    const result = await db.query(
      'SELECT * FROM manual_campaign_runs WHERE id = $1 AND user_id = $2',
      [req.params.runId, userId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Run not found' });
    if (row.status === 'completed') return res.status(400).json({ error: 'Campaign already completed' });

    if (skip) {
      const payload = await advanceRunAfterSkip(db, userId, row);
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

    await db.query(
      `INSERT INTO manual_send_events
        (id, run_id, recipient_email, recipient_store_url, sender_email, subject, tracking_token)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [
        eventId, row.id, recipient.email,
        recipient.storeUrl || recipient.store_url || null,
        senderEmail, subject,
      ]
    );

    const nextIndex = idx + 1;
    const completed = nextIndex >= queue.length;
    const order = senderOrder || parseJson(row.sender_order, []);
    const nextCycleIndex = (senderPickIndex != null ? senderPickIndex + 1 : (row.sender_cycle_index || 0) + 1);
    await db.query(
      `UPDATE manual_campaign_runs SET
        current_index = $2,
        last_sender_email = $3,
        sender_order = $4,
        sender_cycle_index = $5,
        total_sent = total_sent + 1,
        status = $6,
        updated_at = NOW()
       WHERE id = $1`,
      [
        row.id,
        nextIndex,
        senderEmail,
        JSON.stringify(order),
        nextCycleIndex,
        completed ? 'completed' : row.status,
      ]
    );

    await recordEmailSent(userId, 1);

    const totalSent = (row.total_sent || 0) + 1;
    const updatedRow = {
      ...row,
      current_index: nextIndex,
      last_sender_email: senderEmail,
      sender_order: JSON.stringify(order),
      sender_cycle_index: nextCycleIndex,
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

    const tracking = await getRunTrackingStats(db, row.id, updatedRow);

    res.json({
      ok: true,
      completed,
      ...tracking,
      next,
      prefetch,
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
