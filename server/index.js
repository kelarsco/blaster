import 'dotenv/config';
import express from 'express';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason?.message || reason);
});
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { initDb, getDb, isDbQuotaError, getDbUnavailableMessage } from './db.js';
import { resumePendingCampaignsOnStartup } from './services/campaignResume.js';
import { resumePendingScansOnStartup } from './services/scanResume.js';
import { resumeLeadEngineOnStartup } from './services/leadEngineWorker.js';
import { syncPaystackPlans } from './services/paystackSync.js';
import { scanRoutes } from './routes/scan.js';
import { exportRoutes } from './routes/export.js';
import { automationRoutes } from './routes/automation.js';
import { campaignRoutes } from './routes/campaigns.js';
import { activityRoutes } from './routes/activity.js';
import { streakRoutes } from './routes/streaks.js';
import { notesRoutes } from './routes/notes.js';
import { authRoutes } from './routes/auth.js';
import { inviteRoutes } from './routes/invites.js';
import { billingRoutes, handlePaystackWebhook } from './routes/billing.js';
import { supportRoutes } from './routes/support.js';
import { adminAuthRoutes } from './routes/adminAuth.js';
import { adminRoutes } from './routes/admin.js';
import { resourceRoutes } from './routes/resources.js';
import { emailListRoutes } from './routes/emailLists.js';
import { manualCampaignRoutes } from './routes/manualCampaigns.js';
import { trackRoutes } from './routes/track.js';
import { leadsRoutes } from './routes/leads.js';
import { referralRoutes } from './routes/referral.js';
import { planStatusRoutes } from './routes/planStatus.js';
import { resolveAuth } from './middleware/resolveAuth.js';
import { shouldUseSecureCookies, getCookieSameSite, getCookieDomain } from './services/cookiePolicy.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Trust first proxy (Railway, Heroku, etc.) so secure cookies and X-Forwarded-Proto work
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
// Paystack webhook must receive raw body for signature verification (register before express.json)
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => handlePaystackWebhook(req, res));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
const clientDist = path.join(__dirname, '../client/dist');
const clientIndexPath = path.join(clientDist, 'index.html');
const clientBuilt = fs.existsSync(clientIndexPath);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const msg = err?.message || String(err);
  console.error('[express error]', msg);
  if (err?.stack) console.error(err.stack);
  res.status(500).json({ error: msg });
});

async function start() {
  await initDb();
  const pool = getDb();
  let sessionStore = undefined;
  if (pool) {
    try {
      const PgSession = require('connect-pg-simple')(session);
      sessionStore = new PgSession({ pool, tableName: 'session' });
      console.log('Session store: PostgreSQL (sessions persist across restarts).');
    } catch (e) {
      console.warn('[session] connect-pg-simple not available, using in-memory:', e?.message || e);
    }
  }

  const secureCookies = shouldUseSecureCookies();
  const sameSite = getCookieSameSite();
  const cookieDomain = getCookieDomain();

  app.use(
    session({
      store: sessionStore,
      name: 'wiblaster.sid',
      secret: process.env.SESSION_SECRET || 'blaster-dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: secureCookies,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite,
        ...(cookieDomain && { domain: cookieDomain }),
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => resolveAuth(req, res, next).catch(next));

  app.get('/api/health', async (req, res) => {
    const body = { ok: true, server: 'up' };
    const db = getDb();
    if (!db) {
      body.db = 'unavailable';
      body.db_error = getDbUnavailableMessage();
      return res.json(body);
    }
    try {
      await db.query('SELECT 1');
      body.db = 'connected';
      return res.json(body);
    } catch (e) {
      const errorMsg = e?.message || String(e);
      const isQuota = isDbQuotaError(e);
      body.db = 'error';
      body.db_error = errorMsg;
      body.is_neon_quota = isQuota;
      if (isQuota) {
        body.suggestion = 'Upgrade Neon plan or wait for quota reset';
      }
      if (!isQuota || !app.locals.healthQuotaLoggedAt || Date.now() - app.locals.healthQuotaLoggedAt > 120000) {
        console.error('[health]', errorMsg);
        if (isQuota) app.locals.healthQuotaLoggedAt = Date.now();
      }
      return res.json(body);
    }
  });
  app.use('/api/track', trackRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/scan', scanRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/manual-campaigns', manualCampaignRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/streaks', streakRoutes);
  app.use('/api/notes', notesRoutes);
  app.use('/api/user', planStatusRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/email-lists', emailListRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/referral', referralRoutes);
  app.use('/api/bl-admin', adminAuthRoutes);
  app.use('/api/bl-admin', adminRoutes);

  if (clientBuilt) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) res.sendFile(clientIndexPath);
    });
  } else {
    app.get('*', (req, res) => {
      res.status(503).set('Content-Type', 'text/html').send(
        '<!DOCTYPE html><html><head><title>Client not built</title></head><body><h1>Client not built</h1><p>Run <code>npm run build</code> in the <code>client/</code> folder.</p></body></html>'
      );
    });
  }

  await resumePendingCampaignsOnStartup();
  await resumePendingScansOnStartup();
  await resumeLeadEngineOnStartup();
  syncPaystackPlans().catch((e) => console.warn('[Paystack sync]', e?.message || e));
  const basePort = Number(process.env.PORT) || 4000;
  const isDev = process.env.NODE_ENV !== 'production';
  const maxTries = isDev ? 5 : 10;
  let server = null;
  let boundPort = basePort;
  for (let tryPort = basePort; tryPort < basePort + maxTries; tryPort++) {
    try {
      await new Promise((resolve, reject) => {
        server = app.listen(tryPort, () => resolve());
        server.on('error', (err) => reject(err));
      });
      boundPort = tryPort;
      console.log(`wiblaster server running at http://localhost:${tryPort}`);
      if (!isDev && tryPort !== basePort) {
        console.log(`(Port ${basePort} was in use. If using Vite dev, set VITE_API_PORT=${tryPort} in client .env and restart.)`);
      }
      if (isDev && tryPort !== basePort) {
        console.log(`(Port ${basePort} was in use; using ${tryPort}. Vite reads server/.dev-server-port automatically.)`);
      }
      if (isDev) {
        try {
          fs.writeFileSync(path.join(__dirname, '.dev-server-port'), String(tryPort));
        } catch (_) {}
      }
      break;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        if (isDev) {
          if (tryPort === basePort + maxTries - 1) {
            console.error(`\nCould not bind to ports ${basePort}–${tryPort}. Free a port, then restart:`);
            console.error('  netstat -ano | findstr :4000');
            console.error('  taskkill /PID <number_from_above> /F\n');
            throw err;
          }
          continue;
        }
        if (tryPort === basePort + maxTries - 1) {
          console.error(`\nCould not bind to port ${tryPort}. To free a port, run:`);
          console.error('  netstat -ano | findstr :4000');
          console.error('  taskkill /PID <number_from_above> /F\n');
          throw err;
        }
        continue;
      }
      throw err;
    }
  }
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
