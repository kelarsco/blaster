/**
 * Database: Neon (PostgreSQL) if DATABASE_URL is set; otherwise in-memory (scans work without DB).
 */
import pg from 'pg';

const { Pool } = pg;
let pool = null;

/** In-memory store when DATABASE_URL is not set (scan-only, no persistence). */
export const memoryStore = {
  scans: new Map(),
  results: new Map(),
};

export function getDb() {
  return pool;
}

export async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !connectionString.trim()) {
    console.log('No DATABASE_URL – running with in-memory store (scans work, data not persisted).');
    return null;
  }

  let url = connectionString.trim();
  if (url.includes('sslmode=require') && !url.includes('sslmode=verify-full')) {
    url = url.replace('sslmode=require', 'sslmode=verify-full');
  }

  pool = new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=') ? { rejectUnauthorized: false } : undefined,
    max: 8,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
  });

  pool.on('error', (err) => {
    console.error('[pg pool]', err.message);
  });

  let lastErr;
  const maxAttempts = Number(process.env.DB_INIT_ATTEMPTS) || 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runSchema(pool);
      console.log('Neon DB connected and schema ready.');
      return pool;
    } catch (err) {
      lastErr = err;
      console.error('DB schema error (attempt ' + attempt + '/' + maxAttempts + '):', err.message);
      if (attempt < maxAttempts) {
        const delay = Math.min(2000 * attempt, 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  console.error('DB schema failed after ' + maxAttempts + ' attempts. Server will not exit – set DB_INIT_EXIT=1 to exit on failure.');
  if (process.env.DB_INIT_EXIT === '1') process.exit(1);
  pool = null;
  return null;
}

async function runSchema(p) {
  const client = await p.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        name TEXT,
        auth_provider TEXT,
        verification_code TEXT,
        verification_code_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        total_urls INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0,
        found_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS scan_results (
        id SERIAL PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        store_url TEXT NOT NULL,
        email TEXT,
        source_page TEXT,
        has_email SMALLINT DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);

      CREATE TABLE IF NOT EXISTS senders (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        config TEXT,
        max_per_minute INTEGER DEFAULT 10,
        is_active SMALLINT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sender_groups (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sender_group_members (
        group_id TEXT NOT NULL REFERENCES sender_groups(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, sender_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sender_group_members_group ON sender_group_members(group_id);

      CREATE TABLE IF NOT EXISTS campaign_presets (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        senders TEXT,
        subjects TEXT,
        templates TEXT,
        delay_min INTEGER DEFAULT 2,
        delay_max INTEGER DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        preset_id TEXT,
        sender_group_id TEXT REFERENCES sender_groups(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        total_queued INTEGER DEFAULT 0,
        sent INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS campaign_sends (
        id SERIAL PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id),
        store_url TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL,
        sender_email TEXT,
        error TEXT,
        sent_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);

      CREATE TABLE IF NOT EXISTS campaign_pending_sends (
        id SERIAL PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id),
        store_url TEXT NOT NULL,
        email TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        subject TEXT,
        body TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_campaign_pending_campaign ON campaign_pending_sends(campaign_id);

      CREATE TABLE IF NOT EXISTS store_notes (
        store_url TEXT PRIMARY KEY,
        note TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        payload TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_group_id TEXT REFERENCES sender_groups(id) ON DELETE SET NULL;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delay_min REAL DEFAULT 2;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delay_max REAL DEFAULT 5;

      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        inviter_id TEXT NOT NULL,
        inviter_email TEXT NOT NULL,
        invitee_email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
      CREATE INDEX IF NOT EXISTS idx_invites_invitee ON invites(invitee_email);

      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_email TEXT NOT NULL,
        invited_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(owner_id, member_id)
      );
      CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id);

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        paystack_plan_code TEXT,
        amount INTEGER NOT NULL DEFAULT 0,
        interval TEXT NOT NULL DEFAULT 'monthly',
        features JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL REFERENCES plans(id),
        paystack_subscription_code TEXT,
        paystack_customer_code TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end SMALLINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

      CREATE TABLE IF NOT EXISTS user_extra_credit (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        paid_cents INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO plans (id, name, amount, interval, features) VALUES
        ('free', 'Free', 0, 'monthly', '{"emails":"500","users":"1 seat","support":"Email (limited)"}'::jsonb),
        ('essentials_monthly', 'Essentials', 2000, 'monthly', '{"emails":"10000","users":"3 seats","support":"24/7 email & chat"}'::jsonb),
        ('essentials_annual', 'Essentials', 20000, 'annually', '{"emails":"10000","users":"3 seats","support":"24/7 email & chat"}'::jsonb),
        ('standard_monthly', 'Standard', 5000, 'monthly', '{"emails":"30000","users":"5 seats","support":"24/7","onboarding":"1 session"}'::jsonb),
        ('standard_annual', 'Standard', 50000, 'annually', '{"emails":"30000","users":"5 seats","support":"24/7","onboarding":"1 session"}'::jsonb),
        ('premium_monthly', 'Premium', 19000, 'monthly', '{"emails":"150000","users":"Unlimited","support":"Phone + priority"}'::jsonb),
        ('premium_annual', 'Premium', 190000, 'annually', '{"emails":"150000","users":"Unlimited","support":"Phone + priority"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"1"') WHERE id = 'free';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"5"') WHERE id LIKE 'essentials%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"10"') WHERE id LIKE 'standard%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"unlimited"') WHERE id LIKE 'premium%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"10000"') WHERE id LIKE 'essentials%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"30000"') WHERE id LIKE 'standard%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"150000"') WHERE id LIKE 'premium%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"1000"') WHERE id = 'free';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"15000"') WHERE id LIKE 'essentials%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"40000"') WHERE id LIKE 'standard%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"150000"') WHERE id LIKE 'premium%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"1"') WHERE id = 'free';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"unlimited"') WHERE id NOT IN ('free');
      UPDATE plans SET amount = 2000, paystack_plan_code = NULL WHERE id = 'essentials_monthly';
      UPDATE plans SET amount = 20000, paystack_plan_code = NULL WHERE id = 'essentials_annual';
      UPDATE plans SET amount = 5000, paystack_plan_code = NULL WHERE id = 'standard_monthly';
      UPDATE plans SET amount = 50000, paystack_plan_code = NULL WHERE id = 'standard_annual';
      UPDATE plans SET amount = 19000, paystack_plan_code = NULL WHERE id = 'premium_monthly';
      UPDATE plans SET amount = 190000, paystack_plan_code = NULL WHERE id = 'premium_annual';

      ALTER TABLE scans ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE sender_groups ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE campaign_presets ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE store_notes ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified SMALLINT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS picture_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
      CREATE INDEX IF NOT EXISTS idx_senders_user ON senders(user_id);
      CREATE INDEX IF NOT EXISTS idx_sender_groups_user ON sender_groups(user_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_presets_user ON campaign_presets(user_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_store_notes_user ON store_notes(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_store_notes_user_url ON store_notes(user_id, store_url);

      CREATE TABLE IF NOT EXISTS scan_cache (
        store_url TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        source_page TEXT,
        source_type TEXT,
        platform TEXT,
        cached_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (store_url, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_scan_cache_user_cached ON scan_cache(user_id, cached_at);

      CREATE TABLE IF NOT EXISTS session (
        sid varchar NOT NULL,
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        PRIMARY KEY (sid)
      );
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

      CREATE TABLE IF NOT EXISTS support_threads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_user ON support_threads(user_id);

      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'support')),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages(thread_id);

      UPDATE users SET email_verified = 1, email_verified_at = COALESCE(updated_at, created_at) WHERE auth_provider = 'google' AND (email_verified IS NULL OR email_verified = 0);
      UPDATE users SET email_verified = 1 WHERE password_hash IS NOT NULL AND (email_verified IS NULL OR email_verified = 0);
    `);
    await migrateStoreNotesPK(p);
    await migrateScanResultsCascade(p);
    await migrateCampaignChildCascade(p);
    await migrateSendersGmailOAuth(p);
  } finally {
    client.release();
  }
}

/** Fix scan_results FK so deleting a scan (e.g. via user CASCADE) also deletes results. */
async function migrateScanResultsCascade(pool) {
  try {
    await pool.query(`
      ALTER TABLE scan_results DROP CONSTRAINT IF EXISTS scan_results_scan_id_fkey;
      ALTER TABLE scan_results ADD CONSTRAINT scan_results_scan_id_fkey
        FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    `);
  } catch (e) {
    console.warn('[migrateScanResultsCascade]', e?.message || e);
  }
}

/** Fix campaign_sends / campaign_pending_sends FKs so deleting a campaign cascades. */
async function migrateCampaignChildCascade(pool) {
  try {
    await pool.query(`
      ALTER TABLE campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_campaign_id_fkey;
      ALTER TABLE campaign_sends ADD CONSTRAINT campaign_sends_campaign_id_fkey
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    `);
    await pool.query(`
      ALTER TABLE campaign_pending_sends DROP CONSTRAINT IF EXISTS campaign_pending_sends_campaign_id_fkey;
      ALTER TABLE campaign_pending_sends ADD CONSTRAINT campaign_pending_sends_campaign_id_fkey
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    `);
  } catch (e) {
    console.warn('[migrateCampaignChildCascade]', e?.message || e);
  }
}

/** Add Gmail OAuth columns to senders (provider, tokens, status, daily_sent). */
async function migrateSendersGmailOAuth(pool) {
  try {
    await pool.query(`
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'smtp';
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_access_token TEXT;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_status TEXT;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS daily_sent INTEGER DEFAULT 0;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_connected_at TIMESTAMPTZ;
    `);
  } catch (e) {
    console.warn('[migrateSendersGmailOAuth]', e?.message || e);
  }
}

async function migrateStoreNotesPK(pool) {
  try {
    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'store_notes' AND column_name = 'user_id'
    `);
    if (!check.rows?.length) return;
    const pk = await pool.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'store_notes' AND constraint_type = 'PRIMARY KEY'
    `);
    const pkName = pk.rows?.[0]?.constraint_name;
    if (!pkName) return;
    const firstUser = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = firstUser.rows?.[0]?.id;
    await pool.query('UPDATE store_notes SET user_id = $1 WHERE user_id IS NULL', [userId || null]);
    if (userId) {
      await pool.query('ALTER TABLE store_notes ALTER COLUMN user_id SET NOT NULL');
      await pool.query(`ALTER TABLE store_notes DROP CONSTRAINT ${pkName}`);
      await pool.query('ALTER TABLE store_notes ADD PRIMARY KEY (user_id, store_url)');
    }
  } catch (_) {
  }
}
