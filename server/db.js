/**
 * Database: Neon (PostgreSQL) if DATABASE_URL is set; otherwise in-memory (scans work without DB).
 */
import pg from 'pg';

const { Pool } = pg;
let pool = null;
let dbUnavailableReason = null;

/** In-memory store when DATABASE_URL is not set (scan-only, no persistence). */
export const memoryStore = {
  scans: new Map(),
  results: new Map(),
  resources: [],
  leadStores: [],
  leadScrapeJobs: [],
  leadScrapeSettings: {
    enabled: false,
    interval_minutes: 0,
    last_run_at: null,
    next_run_at: null,
    serp_month_key: null,
    serp_requests_month: 0,
    serp_day_key: null,
    serp_requests_day: 0,
  },
};

export function getDb() {
  return pool;
}

/** User-facing message when auth/signup needs DB but pool is null. */
export function getDbUnavailableMessage() {
  if (pool) return null;
  if (dbUnavailableReason && isDbQuotaError({ message: dbUnavailableReason })) {
    return 'Sign-in is unavailable because your Neon database quota is exceeded. Upgrade your Neon plan or wait for the quota to reset, then restart the server.';
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return 'Sign-in is unavailable — DATABASE_URL is not configured on the server.';
  }
  return 'Sign-in is temporarily unavailable. Please try again later.';
}

/** Neon / hosted Postgres quota errors — stop hammering the DB when hit. */
export function isDbQuotaError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('data transfer quota') ||
    msg.includes('compute time quota') ||
    msg.includes('exceeded the data transfer') ||
    msg.includes('quota exceeded')
  );
}

const quotaLogLast = new Map();

/** Log DB errors once per label every 2 minutes when Neon quota is exceeded. */
export function logDbErrorThrottled(label, err) {
  const msg = err?.message || String(err);
  if (isDbQuotaError(err)) {
    const now = Date.now();
    const last = quotaLogLast.get(label) || 0;
    if (now - last < 120000) return;
    quotaLogLast.set(label, now);
  }
  console.error(`[${label}]`, msg);
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
    max: Number(process.env.DB_POOL_MAX) || 8,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 30000,
    keepAlive: true,
  });

  pool.on('error', (err) => {
    console.error('[pg pool]', err.message);
  });

  let lastErr;
  const maxAttempts = Number(process.env.DB_INIT_ATTEMPTS) || 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await warmupPool(pool);
      const skipBase = shouldSkipBaseSchema() && (await isSchemaReady(pool));
      if (skipBase) {
        console.log('[db] Tables exist — skipping base DDL (running migrations only).');
      }
      await runSchema(pool, { skipBase });
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
  console.error('DB schema failed after ' + maxAttempts + ' attempts. Server will continue in read-only mode - upgrade Neon plan or wait for quota reset.');
  // Don't exit - continue in read-only mode for basic functionality
  if (process.env.DB_INIT_EXIT === '1') process.exit(1);
  dbUnavailableReason = lastErr?.message || 'connection failed';
  pool = null;
  return null;
}

/** Wake Neon compute before heavy DDL (cold starts can exceed 10s). */
async function warmupPool(p) {
  const attempts = Number(process.env.DB_WARMUP_ATTEMPTS) || 3;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let client;
    try {
      client = await p.connect();
      await client.query('SELECT 1');
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        const delay = Math.min(3000 * attempt, 12000);
        console.warn(`[db] warmup ${attempt}/${attempts} failed: ${err.message} — retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    } finally {
      client?.release();
    }
  }
  throw lastErr;
}

function shouldSkipBaseSchema() {
  if (process.env.DB_FORCE_SCHEMA === '1') return false;
  if (process.env.DB_SKIP_SCHEMA_IF_READY === '1') return true;
  if (process.env.DB_SKIP_SCHEMA_IF_READY === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

async function isSchemaReady(p) {
  const client = await p.connect();
  try {
    const { rows } = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
      LIMIT 1
    `);
    return rows.length > 0;
  } finally {
    client.release();
  }
}

async function runSchema(p, { skipBase = false } = {}) {
  const client = await p.connect();
  try {
    if (!skipBase) {
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
        ('free', 'Free Plan', 0, 'monthly', '{"emails":"200","users":"1 seat","scans":"200","support":"Email support"}'::jsonb),
        ('trial_weekly', 'Starter Trial', 100, 'weekly', '{"emails":"2000","users":"1 seat","scans":"500 daily","support":"Email support"}'::jsonb),
        ('essentials_monthly', 'Essentials', 3900, 'monthly', '{"emails":"5000","users":"3 seats","support":"24/7 email & chat"}'::jsonb),
        ('essentials_annual', 'Essentials', 39000, 'annually', '{"emails":"5000","users":"3 seats","support":"24/7 email & chat"}'::jsonb),
        ('standard_monthly', 'Standard', 7900, 'monthly', '{"emails":"50000","users":"5 seats","support":"24/7","onboarding":"1 session"}'::jsonb),
        ('standard_annual', 'Standard', 79000, 'annually', '{"emails":"50000","users":"5 seats","support":"24/7","onboarding":"1 session"}'::jsonb),
        ('premium_monthly', 'Premium', 29500, 'monthly', '{"emails":"50000","users":"Unlimited","support":"Phone + priority"}'::jsonb),
        ('premium_annual', 'Premium', 295000, 'annually', '{"emails":"50000","users":"Unlimited","support":"Phone + priority"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;

      UPDATE plans SET name = 'No Plan', features = '{"scans":"0","stores":"0","campaigns":"0","senders":"0"}'::jsonb WHERE id = 'free';
      INSERT INTO plans (id, name, amount, interval, features) VALUES
        ('trial_7day', '7-Day Trial', 100, 'trial', '{"scans":"unlimited","campaigns":"unlimited","filters":"unlimited"}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, amount = EXCLUDED.amount, interval = EXCLUDED.interval, features = EXCLUDED.features, paystack_plan_code = NULL;
      UPDATE plans SET name = 'Basic', amount = 1900, paystack_plan_code = NULL WHERE id = 'essentials_monthly';
      UPDATE plans SET name = 'Basic', amount = 19000, paystack_plan_code = NULL WHERE id = 'essentials_annual';
      UPDATE plans SET name = 'Growth', amount = 4900, paystack_plan_code = NULL WHERE id = 'standard_monthly';
      UPDATE plans SET name = 'Growth', amount = 49000, paystack_plan_code = NULL WHERE id = 'standard_annual';
      UPDATE plans SET name = 'Pro', amount = 9900, paystack_plan_code = NULL WHERE id = 'premium_monthly';
      UPDATE plans SET name = 'Pro', amount = 99000, paystack_plan_code = NULL WHERE id = 'premium_annual';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%' OR id = 'trial_7day';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%' OR id = 'trial_7day';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"1000/month"') WHERE id LIKE 'essentials%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"3000/month"') WHERE id LIKE 'standard%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"unlimited"') WHERE id LIKE 'premium%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"unlimited"') WHERE id = 'trial_7day';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"unlimited"') WHERE id NOT IN ('free');

      ALTER TABLE scans ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE scans ADD COLUMN IF NOT EXISTS raw_input TEXT;
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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id TEXT REFERENCES users(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_link_clicks INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_referral_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_referral_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_1_claimed SMALLINT NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_1_claimed_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_2_claimed SMALLINT NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_2_claimed_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_3_claimed SMALLINT NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_3_claimed_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_source TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;

      CREATE TABLE IF NOT EXISTS user_referrals (
        id TEXT PRIMARY KEY,
        referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        signed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        upgraded_at TIMESTAMPTZ,
        plan_upgraded_to TEXT,
        counts_toward_reward SMALLINT NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON user_referrals(referrer_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_referrals_signed_up ON user_referrals(signed_up_at DESC);

      CREATE TABLE IF NOT EXISTS user_plan_usage (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        filter_uses INTEGER NOT NULL DEFAULT 0,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        payg_filters_active SMALLINT NOT NULL DEFAULT 0,
        payg_filter_charges_cents INTEGER NOT NULL DEFAULT 0,
        payg_pending_invoice_cents INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS inbound_webhook_provider_id TEXT;
      ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS inbound_webhook_status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS inbound_webhook_error TEXT;
      ALTER TABLE sending_domains ADD COLUMN IF NOT EXISTS inbound_webhook_synced_at TIMESTAMPTZ;
      ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
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

      CREATE TABLE IF NOT EXISTS email_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        recipients_json TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_lists_user_created ON email_lists(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS sending_domains (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_domain_id TEXT,
        provider_api_key TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        verification_error TEXT,
        inbound_webhook_url TEXT,
        inbound_webhook_provider_id TEXT,
        inbound_webhook_status TEXT NOT NULL DEFAULT 'pending',
        inbound_webhook_error TEXT,
        inbound_webhook_synced_at TIMESTAMPTZ,
        dns_records_json TEXT,
        last_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sending_domains_user_domain ON sending_domains(user_id, domain);
      CREATE INDEX IF NOT EXISTS idx_sending_domains_user_status ON sending_domains(user_id, status);

      CREATE TABLE IF NOT EXISTS domain_sender_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain_id TEXT NOT NULL REFERENCES sending_domains(id) ON DELETE CASCADE,
        from_name TEXT,
        from_email TEXT NOT NULL,
        provider_identity_id TEXT,
        is_active SMALLINT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_sender_domain_email ON domain_sender_identities(domain_id, from_email);
      CREATE INDEX IF NOT EXISTS idx_domain_sender_user ON domain_sender_identities(user_id);

      CREATE TABLE IF NOT EXISTS domain_campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain_id TEXT NOT NULL REFERENCES sending_domains(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES domain_sender_identities(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        total_queued INTEGER DEFAULT 0,
        sent INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        subject TEXT,
        body TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_domain_campaigns_user_created ON domain_campaigns(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS domain_inbox_threads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain_id TEXT NOT NULL REFERENCES sending_domains(id) ON DELETE CASCADE,
        sender_email TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        campaign_id TEXT REFERENCES domain_campaigns(id) ON DELETE SET NULL,
        subject TEXT,
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_inbox_thread_unique
        ON domain_inbox_threads(user_id, domain_id, sender_email, contact_email);
      CREATE INDEX IF NOT EXISTS idx_domain_inbox_thread_user ON domain_inbox_threads(user_id, last_message_at DESC);

      CREATE TABLE IF NOT EXISTS domain_inbox_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES domain_inbox_threads(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT REFERENCES domain_campaigns(id) ON DELETE SET NULL,
        direction TEXT NOT NULL,
        from_email TEXT NOT NULL,
        to_email TEXT NOT NULL,
        subject TEXT,
        body_text TEXT,
        provider_message_id TEXT,
        in_reply_to TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_domain_inbox_messages_thread_created
        ON domain_inbox_messages(thread_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_domain_inbox_messages_user_created
        ON domain_inbox_messages(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_domain_inbox_messages_provider_id
        ON domain_inbox_messages(provider_message_id);

      CREATE TABLE IF NOT EXISTS domain_campaign_sends (
        id SERIAL PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES domain_campaigns(id) ON DELETE CASCADE,
        to_email TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        error TEXT,
        thread_id TEXT REFERENCES domain_inbox_threads(id) ON DELETE SET NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_domain_campaign_sends_campaign ON domain_campaign_sends(campaign_id);

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

      CREATE TABLE IF NOT EXISTS user_streaks (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        daily_target INTEGER,
        current_streak_days INTEGER DEFAULT 0,
        highest_streak_badge_earned INTEGER DEFAULT 0,
        total_emails_sent INTEGER DEFAULT 0,
        last_qualifying_date DATE,
        emails_sent_today INTEGER DEFAULT 0,
        emails_today_date DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_streaks_updated ON user_streaks(updated_at);

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

      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('video', 'document')),
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
      CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at DESC);

      CREATE TABLE IF NOT EXISTS lead_stores (
        id TEXT PRIMARY KEY,
        store_url TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'pending',
        current_phase INTEGER DEFAULT 0,
        platform TEXT,
        country_code TEXT,
        currency TEXT,
        product_count INTEGER,
        product_count_range TEXT,
        shopify_plus BOOLEAN DEFAULT false,
        shopify_plus_confidence INTEGER,
        facebook_ads BOOLEAN DEFAULT false,
        google_ads BOOLEAN DEFAULT false,
        tiktok_ads BOOLEAN DEFAULT false,
        pinterest_ads BOOLEAN DEFAULT false,
        dropshipping_score INTEGER,
        pod_score INTEGER,
        active_score INTEGER,
        active_tier TEXT,
        email_provider TEXT,
        sms_provider TEXT,
        review_app TEXT,
        chat_provider TEXT,
        phase_data JSONB DEFAULT '{}',
        error_message TEXT,
        qualified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_scraped_at TIMESTAMPTZ,
        qualified_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_lead_stores_status ON lead_stores(status);
      CREATE INDEX IF NOT EXISTS idx_lead_stores_qualified ON lead_stores(qualified);
      CREATE INDEX IF NOT EXISTS idx_lead_stores_qualified_updated ON lead_stores(updated_at DESC) WHERE qualified = true;

      CREATE TABLE IF NOT EXISTS lead_scrape_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'running',
        urls_found INTEGER DEFAULT 0,
        stores_added INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      UPDATE users SET email_verified = 1, email_verified_at = COALESCE(updated_at, created_at) WHERE auth_provider = 'google' AND (email_verified IS NULL OR email_verified = 0);
      UPDATE users SET email_verified = 1 WHERE password_hash IS NOT NULL AND (email_verified IS NULL OR email_verified = 0);
    `);
    }
    await migrateStoreNotesPK(p);
    await migrateScanResultsCascade(p);
    await migrateScanResultsContactColumns(p);
    await migrateCampaignChildCascade(p);
    await migrateManualCampaigns(p);
    await migrateRemoveLegacySenders(p);
    await migrateReferralCodes(p);
    await migrateProcessedPayments(p);
    await migrateLeadScrapeJobSession(p);
    await migrateLeadScrapeSettings(p);
    await migratePricingPlans2026(p);
    await migrateNavNotifications(p);
    await migrateAdminCampaigns(p);
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

async function migrateScanResultsContactColumns(pool) {
  try {
    await pool.query(`
      ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS whatsapp TEXT;
      ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS instagram TEXT;
      ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS tiktok TEXT;
    `);
  } catch (e) {
    console.warn('[migrateScanResultsContactColumns]', e?.message || e);
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

async function migrateRemoveLegacySenders(pool) {
  try {
    await pool.query(`
      ALTER TABLE manual_campaign_runs DROP COLUMN IF EXISTS sender_group_id;
      ALTER TABLE manual_campaign_runs DROP COLUMN IF EXISTS sender_order;
      ALTER TABLE manual_campaign_runs DROP COLUMN IF EXISTS last_sender_email;
      ALTER TABLE manual_campaign_runs DROP COLUMN IF EXISTS sender_cycle_index;
      ALTER TABLE campaigns DROP COLUMN IF EXISTS sender_group_id;
      ALTER TABLE campaign_pending_sends DROP COLUMN IF EXISTS sender_id;
      ALTER TABLE manual_send_events DROP COLUMN IF EXISTS sender_email;
      ALTER TABLE campaign_presets DROP COLUMN IF EXISTS senders;
      DROP TABLE IF EXISTS sender_group_members;
      DROP TABLE IF EXISTS sender_groups;
      DROP TABLE IF EXISTS senders;
    `);
  } catch (e) {
    console.warn('[migrateRemoveLegacySenders]', e?.message || e);
  }
}

/** @deprecated Legacy sender OAuth columns — table removed by migrateRemoveLegacySenders */
async function migrateSendersGmailOAuth(pool) {
  try {
    await pool.query(`
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'smtp';
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_access_token TEXT;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_status TEXT;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS daily_sent INTEGER DEFAULT 0;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS oauth_connected_at TIMESTAMPTZ;
      ALTER TABLE senders ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
    `);
  } catch (e) {
    console.warn('[migrateSendersGmailOAuth]', e?.message || e);
  }
}

async function migrateManualCampaigns(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manual_campaign_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_list_id TEXT REFERENCES email_lists(id) ON DELETE SET NULL,
        sender_group_id TEXT REFERENCES sender_groups(id) ON DELETE SET NULL,
        template_ids TEXT,
        recipient_queue TEXT,
        current_index INTEGER DEFAULT 0,
        sender_order TEXT,
        last_sender_email TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress',
        total_sent INTEGER DEFAULT 0,
        sender_cycle_index INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_manual_runs_user ON manual_campaign_runs(user_id);
      CREATE INDEX IF NOT EXISTS idx_manual_runs_list ON manual_campaign_runs(email_list_id);

      CREATE TABLE IF NOT EXISTS manual_send_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES manual_campaign_runs(id) ON DELETE CASCADE,
        recipient_email TEXT NOT NULL,
        recipient_store_url TEXT,
        sender_email TEXT,
        subject TEXT,
        tracking_token TEXT UNIQUE,
        opened_at TIMESTAMPTZ,
        marked_sent SMALLINT DEFAULT 1,
        sent_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_manual_send_run ON manual_send_events(run_id);
      CREATE INDEX IF NOT EXISTS idx_manual_send_token ON manual_send_events(tracking_token);
      CREATE INDEX IF NOT EXISTS idx_manual_send_email ON manual_send_events(recipient_email);
      ALTER TABLE manual_campaign_runs ADD COLUMN IF NOT EXISTS sender_cycle_index INTEGER DEFAULT 0;
    `);
  } catch (e) {
    console.warn('[migrateManualCampaigns]', e?.message || e);
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

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomReferralCode() {
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  }
  return s;
}

/** Backfill referral_code for existing users. */
async function migrateReferralCodes(pool) {
  try {
    const missing = await pool.query(
      `SELECT id FROM users WHERE referral_code IS NULL OR referral_code = '' LIMIT 500`
    );
    for (const row of missing.rows || []) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomReferralCode();
        try {
          await pool.query('UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2', [code, row.id]);
          break;
        } catch (e) {
          if (e?.code !== '23505') throw e;
        }
      }
    }
  } catch (e) {
    console.warn('[migrateReferralCodes]', e?.message || e);
  }
}

async function migrateProcessedPayments(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_payments (
        reference TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'extra_credit',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('[migrateProcessedPayments]', e?.message || e);
  }
}

async function migrateLeadScrapeJobSession(pool) {
  try {
    await pool.query(`
      ALTER TABLE lead_scrape_jobs ADD COLUMN IF NOT EXISTS session_json TEXT;
    `);
  } catch (e) {
    console.warn('[migrateLeadScrapeJobSession]', e?.message || e);
  }
}

async function migrateLeadScrapeSettings(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_scrape_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        interval_minutes INTEGER NOT NULL DEFAULT 0,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO lead_scrape_settings (id, enabled, interval_minutes)
      VALUES ('default', FALSE, 0)
      ON CONFLICT (id) DO NOTHING;
      ALTER TABLE lead_scrape_settings ADD COLUMN IF NOT EXISTS serp_month_key TEXT;
      ALTER TABLE lead_scrape_settings ADD COLUMN IF NOT EXISTS serp_requests_month INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE lead_scrape_settings ADD COLUMN IF NOT EXISTS serp_day_key TEXT;
      ALTER TABLE lead_scrape_settings ADD COLUMN IF NOT EXISTS serp_requests_day INTEGER NOT NULL DEFAULT 0;
    `);
  } catch (e) {
    console.warn('[migrateLeadScrapeSettings]', e?.message || e);
  }
}

/** 7-day $1 trial, updated plan prices, and store-search quotas. */
async function migratePricingPlans2026(pool) {
  try {
    await pool.query(`
      INSERT INTO plans (id, name, amount, interval, features) VALUES
        ('trial_7day', '7-Day Trial', 100, 'trial', '{"scans":"unlimited","campaigns":"unlimited","filters":"unlimited"}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        amount = EXCLUDED.amount,
        interval = EXCLUDED.interval,
        features = EXCLUDED.features,
        paystack_plan_code = NULL;

      UPDATE plans SET name = 'Basic', amount = 1900, paystack_plan_code = NULL WHERE id = 'essentials_monthly';
      UPDATE plans SET name = 'Basic', amount = 19000, paystack_plan_code = NULL WHERE id = 'essentials_annual';
      UPDATE plans SET name = 'Growth', amount = 4900, paystack_plan_code = NULL WHERE id = 'standard_monthly';
      UPDATE plans SET name = 'Growth', amount = 49000, paystack_plan_code = NULL WHERE id = 'standard_annual';
      UPDATE plans SET name = 'Pro', amount = 9900, paystack_plan_code = NULL WHERE id = 'premium_monthly';
      UPDATE plans SET name = 'Pro', amount = 99000, paystack_plan_code = NULL WHERE id = 'premium_annual';

      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"1000/month"') WHERE id LIKE 'essentials%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"3000/month"') WHERE id LIKE 'standard%';
      UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"unlimited"') WHERE id LIKE 'premium%' OR id = 'trial_7day';

      UPDATE subscriptions SET plan_id = 'trial_7day' WHERE plan_id IN ('trial_3day', 'trial_weekly');
    `);
  } catch (e) {
    console.warn('[migratePricingPlans2026]', e?.message || e);
  }
}

async function migrateNavNotifications(pool) {
  try {
    await pool.query(`
      ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_priority SMALLINT NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS user_nav_seen (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nav_key TEXT NOT NULL,
        seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        meta TEXT,
        PRIMARY KEY (user_id, nav_key)
      );
      CREATE INDEX IF NOT EXISTS idx_user_nav_seen_key ON user_nav_seen(nav_key);
    `);
  } catch (e) {
    console.warn('[migrateNavNotifications]', e?.message || e);
  }
}

async function migrateAdminCampaigns(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_segments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        filter_json JSONB NOT NULL DEFAULT '{}',
        is_system SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_email_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        html_body TEXT NOT NULL DEFAULT '',
        segment_id TEXT REFERENCES admin_segments(id) ON DELETE SET NULL,
        manual_user_ids JSONB DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        total_recipients INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        send_delay_ms INTEGER NOT NULL DEFAULT 600,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_campaigns_status ON admin_email_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_admin_campaigns_created ON admin_email_campaigns(created_at DESC);

      CREATE TABLE IF NOT EXISTS admin_email_sends (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES admin_email_campaigns(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        resend_id TEXT,
        error TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_email_sends_campaign ON admin_email_sends(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_admin_email_sends_status ON admin_email_sends(campaign_id, status);
    `);
    const { seedDefaultSegments } = await import('./services/adminSegments.js');
    await seedDefaultSegments(pool);
  } catch (e) {
    console.warn('[migrateAdminCampaigns]', e?.message || e);
  }
}
