import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const supportRoutes = Router();

/** Get or create the current user's single support thread and return messages. */
supportRoutes.get('/thread', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const userId = req.user.id;
  try {
    let row = (await db.query('SELECT id FROM support_threads WHERE user_id = $1', [userId])).rows[0];
    if (!row) {
      const threadId = uuidv4();
      await db.query(
        'INSERT INTO support_threads (id, user_id) VALUES ($1, $2)',
        [threadId, userId]
      );
      row = { id: threadId };
    }
    const messages = (await db.query(
      'SELECT id, sender, body, created_at FROM support_messages WHERE thread_id = $1 ORDER BY created_at ASC',
      [row.id]
    )).rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      createdAt: m.created_at,
    }));
    return res.json({ threadId: row.id, messages });
  } catch (e) {
    console.error('[support thread]', e?.message || e);
    return res.status(500).json({ error: 'Failed to load support thread' });
  }
});

/** Add a user message to the support thread. */
supportRoutes.post('/message', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const userId = req.user.id;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'Message body required' });
  try {
    let row = (await db.query('SELECT id FROM support_threads WHERE user_id = $1', [userId])).rows[0];
    if (!row) {
      const threadId = uuidv4();
      await db.query(
        'INSERT INTO support_threads (id, user_id) VALUES ($1, $2)',
        [threadId, userId]
      );
      row = { id: threadId };
    }
    const id = uuidv4();
    await db.query(
      'INSERT INTO support_messages (id, thread_id, sender, body) VALUES ($1, $2, $3, $4)',
      [id, row.id, 'user', body]
    );
    const created = (await db.query(
      'SELECT id, sender, body, created_at FROM support_messages WHERE id = $1',
      [id]
    )).rows[0];
    return res.status(201).json({
      message: {
        id: created.id,
        sender: created.sender,
        body: created.body,
        createdAt: created.created_at,
      },
    });
  } catch (e) {
    console.error('[support message]', e?.message || e);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});
