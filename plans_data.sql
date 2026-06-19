-- Insert plans data (Basic / Growth / Pro + $1 3-day trial)
INSERT INTO plans (id, name, amount, interval, features) VALUES
    ('free', 'No Plan', 0, 'monthly', '{"scans":"0","stores":"0","campaigns":"0","senders":"0"}'::jsonb),
    ('trial_3day', '3-Day Trial', 100, 'trial', '{"scans":"unlimited","campaigns":"unlimited","senders":"unlimited","filters":"20"}'::jsonb),
    ('trial_weekly', 'Starter Trial', 100, 'weekly', '{"emails":"unlimited","scans":"unlimited","campaigns":"unlimited","filters":"20"}'::jsonb),
    ('essentials_monthly', 'Basic', 2900, 'monthly', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"500/month"}'::jsonb),
    ('essentials_annual', 'Basic', 29000, 'annually', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"500/month"}'::jsonb),
    ('standard_monthly', 'Growth', 7500, 'monthly', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"1500/month"}'::jsonb),
    ('standard_annual', 'Growth', 75000, 'annually', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"1500/month"}'::jsonb),
    ('premium_monthly', 'Pro', 12000, 'monthly', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"unlimited"}'::jsonb),
    ('premium_annual', 'Pro', 120000, 'annually', '{"emails":"unlimited","campaigns":"unlimited","scans":"unlimited","senders":"unlimited","filters":"unlimited"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

UPDATE plans SET name = 'No Plan', features = '{"scans":"0","stores":"0","campaigns":"0","senders":"0"}'::jsonb WHERE id = 'free';
INSERT INTO plans (id, name, amount, interval, features) VALUES
    ('trial_3day', '3-Day Trial', 100, 'trial', '{"scans":"unlimited","campaigns":"unlimited","senders":"unlimited","filters":"20"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, amount = EXCLUDED.amount, interval = EXCLUDED.interval, features = EXCLUDED.features, paystack_plan_code = NULL;

UPDATE plans SET name = 'Basic', amount = 2900, paystack_plan_code = NULL WHERE id = 'essentials_monthly';
UPDATE plans SET name = 'Basic', amount = 29000, paystack_plan_code = NULL WHERE id = 'essentials_annual';
UPDATE plans SET name = 'Growth', amount = 7500, paystack_plan_code = NULL WHERE id = 'standard_monthly';
UPDATE plans SET name = 'Growth', amount = 75000, paystack_plan_code = NULL WHERE id = 'standard_annual';
UPDATE plans SET name = 'Pro', amount = 12000, paystack_plan_code = NULL WHERE id = 'premium_monthly';
UPDATE plans SET name = 'Pro', amount = 120000, paystack_plan_code = NULL WHERE id = 'premium_annual';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{senders}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%' OR id = 'trial_3day';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{emails}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%' OR id = 'trial_3day';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{scans}', '"unlimited"') WHERE id LIKE 'essentials%' OR id LIKE 'standard%' OR id LIKE 'premium%' OR id = 'trial_3day';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{campaigns}', '"unlimited"') WHERE id NOT IN ('free');
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"500/month"') WHERE id LIKE 'essentials%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"1500/month"') WHERE id LIKE 'standard%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"unlimited"') WHERE id LIKE 'premium%';
UPDATE plans SET features = jsonb_set(COALESCE(features, '{}'), '{filters}', '"20"') WHERE id = 'trial_3day';
