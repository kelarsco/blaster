import { Router } from 'express';
import { getDb, memoryStore } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const resourceRoutes = Router();

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    url: row.url,
    createdAt: row.created_at,
  };
}

/** GET /api/resources?type=video|document */
resourceRoutes.get('/', requireAuth, async (req, res) => {
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
        .map(mapRow);
      return res.json({ resources: items });
    }
    const result = await db.query(
      'SELECT id, type, title, url, created_at FROM resources WHERE type = $1 ORDER BY created_at DESC',
      [type]
    );
    res.json({ resources: result.rows.map(mapRow) });
  } catch (e) {
    console.error('[resources list]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load resources' });
  }
});
