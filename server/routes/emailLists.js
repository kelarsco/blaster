import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const emailListRoutes = Router();

const memoryEmailListsByUser = new Map();

function normalizeRecipients(recipients) {
  if (!Array.isArray(recipients)) return [];
  const out = [];
  const seen = new Set();
  for (const row of recipients) {
    const email = String(row?.email || '').trim().toLowerCase();
    const storeUrl = String(row?.storeUrl || row?.store_url || '').trim();
    const whatsapp = row?.whatsapp ? String(row.whatsapp).trim() : null;
    const instagram = row?.instagram ? String(row.instagram).trim() : null;
    const tiktok = row?.tiktok ? String(row.tiktok).trim() : null;
    const hasEmail = email && email.includes('@');
    const hasSocial = whatsapp || instagram || tiktok;
    if (!hasEmail && !hasSocial) continue;
    const dedupeKey = hasEmail ? email : `${storeUrl}|${whatsapp || ''}|${instagram || ''}|${tiktok || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      email: hasEmail ? email : '',
      storeUrl,
      ...(whatsapp ? { whatsapp } : {}),
      ...(instagram ? { instagram } : {}),
      ...(tiktok ? { tiktok } : {}),
    });
  }
  return out;
}

function visibleLists(lists) {
  return (lists || []).filter((item) => !item.archivedAt);
}

emailListRoutes.get('/', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const db = getDb();
  if (!userId) return res.status(401).json({ error: 'Not signed in' });
  if (!db) {
    return res.json({ lists: visibleLists(memoryEmailListsByUser.get(userId)) });
  }
  try {
    const result = await db.query(
      `SELECT id, name, recipients_json, created_at
       FROM email_lists
       WHERE user_id = $1 AND archived_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    const lists = (result.rows || []).map((row) => {
      let recipients = [];
      try {
        recipients = normalizeRecipients(JSON.parse(row.recipients_json || '[]'));
      } catch (_) {}
      return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        recipients,
      };
    });
    return res.json({ lists });
  } catch (e) {
    console.error('[email-lists get]', e?.message || e);
    return res.status(500).json({ error: 'Failed to load saved email lists' });
  }
});

emailListRoutes.post('/', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const db = getDb();
  const name = String(req.body?.name || '').trim();
  const recipients = normalizeRecipients(req.body?.recipients);
  if (!userId) return res.status(401).json({ error: 'Not signed in' });
  if (!name) return res.status(400).json({ error: 'List name is required' });
  if (recipients.length === 0) return res.status(400).json({ error: 'List must contain at least one contact' });
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const payload = { id, name, createdAt, recipients };
  if (!db) {
    const prev = memoryEmailListsByUser.get(userId) || [];
    memoryEmailListsByUser.set(userId, [payload, ...prev]);
    return res.status(201).json({ list: payload });
  }
  try {
    await db.query(
      `INSERT INTO email_lists (id, user_id, name, recipients_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [id, userId, name, JSON.stringify(recipients)]
    );
    return res.status(201).json({ list: payload });
  } catch (e) {
    console.error('[email-lists create]', e?.message || e);
    return res.status(500).json({ error: 'Failed to save email list' });
  }
});

emailListRoutes.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  const db = getDb();
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Not signed in' });
  if (!id) return res.status(400).json({ error: 'Invalid list id' });
  if (!db) {
    const prev = memoryEmailListsByUser.get(userId) || [];
    memoryEmailListsByUser.set(
      userId,
      prev.map((item) => (item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item))
    );
    return res.json({ ok: true });
  }
  try {
    await db.query(
      'UPDATE email_lists SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [id, userId]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('[email-lists delete]', e?.message || e);
    return res.status(500).json({ error: 'Failed to delete email list' });
  }
});
