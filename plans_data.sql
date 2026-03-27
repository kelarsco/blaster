-- Insert plans data
INSERT INTO plans (id, name, amount, interval, features) VALUES
    ('free', 'Free Plan', 0, 'monthly', '{"emails":"200","users":"1 seat","scans":"200","support":"Email support"}'::jsonb),
    ('trial_weekly', 'Starter Trial', 100, 'weekly', '{"emails":"2000","users":"1 seat","scans":"500 daily","support":"Email support"}'::jsonb),
    ('essentials_monthly', 'Essentials', 3900, 'monthly', '{"emails":"5000","users":"3 seats","support":"24/7 email and chat"}'::jsonb),
    ('essentials_annual', 'Essentials', 39000, 'annually', '{"emails":"5000","users":"3 seats","support":"24/7 email and chat"}'::jsonb),
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
