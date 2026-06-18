import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listQualifiedStoresForClient } from '../services/leadStoreRepository.js';

export const leadsRoutes = Router();

/** GET /api/leads/stores — qualified stores only (for Store Leads page) */
leadsRoutes.get('/stores', requireAuth, async (req, res) => {
  try {
    const stores = await listQualifiedStoresForClient();
    res.json({ stores });
  } catch (e) {
    console.error('[leads stores]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load stores' });
  }
});
