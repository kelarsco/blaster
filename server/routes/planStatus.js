import { Router } from 'express';
import {
  getPlanStatusForUser,
  recordFilterOrExportUse,
  activatePaygFilters,
} from '../services/planAccess.js';

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

export const planStatusRoutes = Router();

planStatusRoutes.get('/plan-status', requireAuth, async (req, res) => {
  try {
    const status = await getPlanStatusForUser(req.user.id);
    res.json(status);
  } catch (e) {
    console.error('[plan-status]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load plan status' });
  }
});

planStatusRoutes.post('/plan-status/filter-use', requireAuth, async (req, res) => {
  try {
    const result = await recordFilterOrExportUse(req.user.id);
    if (!result.ok) {
      return res.status(403).json({
        error: result.reason,
        status: result.status,
      });
    }
    res.json({ ok: true, status: result.status });
  } catch (e) {
    console.error('[plan-status filter-use]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to record usage' });
  }
});

planStatusRoutes.post('/plan-status/activate-payg', requireAuth, async (req, res) => {
  try {
    const result = await activatePaygFilters(req.user.id);
    if (!result.ok) {
      return res.status(400).json({ error: result.reason, status: result.status });
    }
    res.json({ ok: true, status: result.status });
  } catch (e) {
    console.error('[plan-status activate-payg]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to activate PAYG' });
  }
});
