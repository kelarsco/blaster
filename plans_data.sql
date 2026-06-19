-- Insert plans data (Basic / Growth / Pro pricing)
INSERT INTO plans (id, name, amount, interval, features) VALUES
    ('free', 'Trial (Free)', 0, 'monthly', '{"scans":"100","stores":"100","campaigns":"1","senders":"1"}'::jsonb),
    ('trial_weekly', 'Starter Trial', 100, 'weekly', '{"emails":"2000","users":"1 seat","scans":"500 daily","support":"Email support"}'::jsonb),
    ('essentials_monthly', 'Basic', 399, 'monthly', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"5"}'::jsonb),
    ('essentials_annual', 'Basic', 3990, 'annually', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"5"}'::jsonb),
    ('standard_monthly', 'Growth', 2990, 'monthly', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"500/month"}'::jsonb),
    ('standard_annual', 'Growth', 29900, 'annually', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"500/month"}'::jsonb),
    ('premium_monthly', 'Pro', 7500, 'monthly', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"unlimited"}'::jsonb),
    ('premium_annual', 'Pro', 75000, 'annually', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"unlimited"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Align names, prices, and feature caps with marketing tiers
UPDATE plans SET name = 'Trial (Free)', features = '{"scans":"100","stores":"100","campaigns":"1","senders":"1"}'::jsonb WHERE id = 'free';
UPDATE plans SET name = 'Basic', amount = 399, paystack_plan_code = NULL WHERE id = 'essentials_monthly';
UPDATE plans SET name = 'Basic', amount = 3990, paystack_plan_code = NULL WHERE id = 'essentials_annual';
UPDATE plans SET name = 'Growth', amount = 2990, paystack_plan_code = NULL WHERE id = 'standard_monthly';
UPDATE plans SET name = 'Growth', amount = 29900, paystack_plan_code = NULL WHERE id = 'standard_annual';
UPDATE plans SET name = 'Pro', amount = 7500, paystack_plan_code = NULL WHERE id = 'premium_monthly';
UPDATE plans SET name = 'Pro', amount = 75000, paystack_plan_code = NULL WHERE id = 'premium_annual';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"5"') WHERE id LIKE 'essentials%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"unlimited"') WHERE id LIKE 'standard%' OR id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"unlimited"') WHERE id NOT IN ('free', 'trial_weekly');
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"500/month"') WHERE id LIKE 'standard%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"unlimited"') WHERE id LIKE 'premium%';
