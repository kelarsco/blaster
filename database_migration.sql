-- Store Scouter Database Schema for Neon PostgreSQL
-- Run this in your new Neon database to set up the complete structure

-- Users table
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

-- Scans table
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

-- Scan results table
CREATE TABLE IF NOT EXISTS scan_results (
    id SERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id),
    store_url TEXT NOT NULL,
    email TEXT,
    source_page TEXT,
    has_email SMALLINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);

-- Senders table
CREATE TABLE IF NOT EXISTS senders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    config TEXT,
    max_per_minute INTEGER DEFAULT 10,
    is_active SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sender groups table
CREATE TABLE IF NOT EXISTS sender_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sender group members table
CREATE TABLE IF NOT EXISTS sender_group_members (
    group_id TEXT NOT NULL REFERENCES sender_groups(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, sender_id)
);
CREATE INDEX IF NOT EXISTS idx_sender_group_members_group ON sender_group_members(group_id);

-- Campaign presets table
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

-- Campaigns table
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
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_group_id TEXT REFERENCES sender_groups(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delay_min REAL DEFAULT 2;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delay_max REAL DEFAULT 5;

-- Campaign sends table
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

-- Campaign pending sends table
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

-- Store notes table
CREATE TABLE IF NOT EXISTS store_notes (
    store_url TEXT PRIMARY KEY,
    note TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites table
CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    admin_upgraded SMALLINT DEFAULT 0,
    paystack_subscription_code TEXT,
    paystack_customer_code TEXT,
    paystack_email_token TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- User extra credit table
CREATE TABLE IF NOT EXISTS user_extra_credit (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans table with pricing data
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

-- Update plan features
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"5"') WHERE id LIKE 'essentials%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"10"') WHERE id LIKE 'standard%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"unlimited"') WHERE id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{domains}', '"2"') WHERE id LIKE 'essentials%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{domains}', '"3"') WHERE id LIKE 'standard%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{domains}', '"5"') WHERE id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"5000"') WHERE id LIKE 'essentials%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"50000"') WHERE id LIKE 'standard%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"50000"') WHERE id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"2000"') WHERE id = 'trial_weekly';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"500 daily"') WHERE id = 'trial_weekly';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"20000"') WHERE id LIKE 'essentials%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"100000"') WHERE id LIKE 'standard%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"150000"') WHERE id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"1"') WHERE id = 'trial_weekly';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"unlimited"') WHERE id NOT IN ('trial_weekly');

-- Clear plan codes for fresh setup
UPDATE plans SET amount = 3900, paystack_plan_code = NULL WHERE id = 'essentials_monthly';
UPDATE plans SET amount = 39000, paystack_plan_code = NULL WHERE id = 'essentials_annual';
UPDATE plans SET amount = 7900, paystack_plan_code = NULL WHERE id = 'standard_monthly';
UPDATE plans SET amount = 79000, paystack_plan_code = NULL WHERE id = 'standard_annual';
UPDATE plans SET amount = 29500, paystack_plan_code = NULL WHERE id = 'premium_monthly';
UPDATE plans SET amount = 295000, paystack_plan_code = NULL WHERE id = 'premium_annual';

COMMIT;
