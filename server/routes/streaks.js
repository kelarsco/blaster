import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getStreakState, setDailyTarget } from '../services/streakService.js';

export const streakRoutes = Router();

streakRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const state = await getStreakState(req.user.id, {
      userEmail: req.user.email,
      userName: req.user.name,
    });
    return res.json(state);
  } catch (err) {
    console.error('[streaks GET]', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to load streaks' });
  }
});

streakRoutes.put('/target', requireAuth, async (req, res) => {
  try {
    const { dailyTarget } = req.body || {};
    const state = await setDailyTarget(req.user.id, dailyTarget, {
      userEmail: req.user.email,
      userName: req.user.name,
    });
    return res.json(state);
  } catch (err) {
    console.error('[streaks PUT target]', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to set target' });
  }
});
