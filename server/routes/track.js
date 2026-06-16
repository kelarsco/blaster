import { Router } from 'express';
import { getDb } from '../db.js';

export const trackRoutes = Router();

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

trackRoutes.get('/open/:token', async (req, res) => {
  const token = String(req.params.token || '').replace(/\.gif$/i, '');
  const db = getDb();
  if (db && token) {
    try {
      await db.query(
        `UPDATE manual_send_events SET opened_at = COALESCE(opened_at, NOW()) WHERE tracking_token = $1`,
        [token]
      );
    } catch (e) {
      console.warn('[track/open]', e?.message || e);
    }
  }
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.send(PIXEL);
});
