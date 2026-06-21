import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPlanStatusForUser } from '../services/planAccess.js';
import {
  parseQualifiedStoreFilters,
  queryQualifiedStoresForClient,
} from '../services/leadStoreRepository.js';

export const leadsRoutes = Router();

leadsRoutes.get('/stores', requireAuth, async (req, res) => {
  try {
    const status = await getPlanStatusForUser(req.user.id);
    if (status.trialExpired) {
      return res.status(403).json({ error: 'Active subscription required', upgradeRequired: true });
    }

    const filters = parseQualifiedStoreFilters(req.query);
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;

    const result = await queryQualifiedStoresForClient({ filters, page, limit });
    res.json(result);
  } catch (e) {
    console.error('[leads stores]', e?.message || e);
    res.status(500).json({ error: 'Failed to load stores' });
  }
});
