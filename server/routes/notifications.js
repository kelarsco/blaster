import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getNotificationStateForUser, markNavSeen } from '../services/navNotifications.js';

export const notificationRoutes = Router();

notificationRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const state = await getNotificationStateForUser(req.user.id);
    res.json(state);
  } catch (e) {
    console.error('[notifications GET]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load notifications' });
  }
});

notificationRoutes.post('/seen', requireAuth, async (req, res) => {
  try {
    const key = String(req.body?.key || '').trim();
    const allowed = ['referral', 'resources', 'scanner'];
    if (!allowed.includes(key)) {
      return res.status(400).json({ error: 'key must be referral, resources, or scanner' });
    }
    const db = getDb();
    if (db) await markNavSeen(db, req.user.id, key);
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications seen]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to update' });
  }
});

notificationRoutes.post('/dismiss-priority', requireAuth, async (req, res) => {
  try {
    const resourceId = String(req.body?.resourceId || '').trim();
    if (!resourceId) return res.status(400).json({ error: 'resourceId is required' });
    const db = getDb();
    if (db) {
      await markNavSeen(db, req.user.id, 'priority_video', { resourceId });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[notifications dismiss-priority]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to dismiss' });
  }
});
