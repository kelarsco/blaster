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
import { initDb, getDb } from './db.js';
import { resumePendingCampaignsOnStartup } from './services/campaignResume.js';
import { resumePendingScansOnStartup } from './services/scanResume.js';
import { syncPaystackPlans } from './services/paystackSync.js';
import { scanRoutes } from './routes/scan.js';
import { exportRoutes } from './routes/export.js';
import { automationRoutes } from './routes/automation.js';
import { campaignRoutes } from './routes/campaigns.js';
import { activityRoutes } from './routes/activity.js';
import { notesRoutes } from './routes/notes.js';
import { authRoutes } from './routes/auth.js';
import { inviteRoutes } from './routes/invites.js';
import { billingRoutes, handlePaystackWebhook } from './routes/billing.js';
import { supportRoutes } from './routes/support.js';
import { adminAuthRoutes } from './routes/adminAuth.js';
import { adminRoutes } from './routes/admin.js';
import { emailListRoutes } from './routes/emailLists.js';
import { domainEmailRoutes } from './routes/domainEmail.js';
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
    try {
      const db = getDb();
      if (!db) {
        return res.status(503).json({ 
          ok: false, 
          error: 'Database unavailable - Neon compute quota exceeded',
          suggestion: 'Upgrade Neon plan or wait for quota reset',
          db_url: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
        });
      }
      await db.query('SELECT 1');
      res.json({ 
        ok: true, 
        db: 'connected',
        db_url: process.env.DATABASE_URL?.split('@')[1] || 'HIDDEN'
      });
    } catch (e) {
      console.error('[health]', e?.message || e);
      const errorMsg = e?.message || String(e);
      const isNeonQuota = errorMsg.includes('compute time quota') || errorMsg.includes('exceeded');
      res.status(503).json({ 
        ok: false, 
        error: errorMsg,
        is_neon_quota: isNeonQuota,
        suggestion: isNeonQuota ? 'Upgrade Neon plan or wait for quota reset' : 'Check database configuration',
        db_url: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
      });
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/scan', scanRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/notes', notesRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/email-lists', emailListRoutes);
  app.use('/api/domain-email', domainEmailRoutes);
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
  syncPaystackPlans().catch((e) => console.warn('[Paystack sync]', e?.message || e));
  const basePort = Number(process.env.PORT) || 4000;
  const isDev = process.env.NODE_ENV !== 'production';
  const maxTries = isDev ? 1 : 10;
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
      if (isDev) {
        try {
          fs.writeFileSync(path.join(__dirname, '.dev-server-port'), String(tryPort));
        } catch (_) {}
      }
      break;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        if (isDev) {
          console.error(`\nPort ${tryPort} is already in use. Stop the other server process, then restart:`);
          console.error('  netstat -ano | findstr :4000');
          console.error('  taskkill /PID <number_from_above> /F\n');
          throw err;
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
