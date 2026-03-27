-- Verify all tables and data
SELECT 'Plans table verification:' as info;
SELECT id, name, amount FROM plans ORDER BY amount;

SELECT 'Table count verification:' as info;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

SELECT 'Key tables verification:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'campaigns', 'scans', 'plans', 'subscriptions') ORDER BY table_name;
