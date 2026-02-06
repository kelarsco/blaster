/**
 * Clear all database table data EXCEPT campaign_presets.
 * Run: node scripts/clear-db-except-presets.js (from server dir)
 * Or: npm run clear-db (if added to package.json)
 */
import 'dotenv/config';
import { getDb, initDb } from '../db.js';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    console.error('DATABASE_URL is not set. Cannot connect to database.');
    process.exit(1);
  }

  await initDb();
  const db = getDb();
  if (!db) {
    console.error('Database not initialized.');
    process.exit(1);
  }

  const client = await db.connect();
  try {
    // Delete in order respecting FKs: campaign_sends -> campaigns, scan_results -> scans
    await client.query('DELETE FROM campaign_sends');
    await client.query('DELETE FROM campaigns');
    await client.query('DELETE FROM scan_results');
    await client.query('DELETE FROM scans');
    await client.query('DELETE FROM senders');
    await client.query('DELETE FROM store_notes');
    await client.query('DELETE FROM activity_logs');
    await client.query('DELETE FROM users');

    // Reset sequences for tables with SERIAL ids (next insert will get id 1)
    await client.query("SELECT setval(pg_get_serial_sequence('scan_results', 'id'), 0)");
    await client.query("SELECT setval(pg_get_serial_sequence('campaign_sends', 'id'), 0)");
    await client.query("SELECT setval(pg_get_serial_sequence('activity_logs', 'id'), 0)");

    console.log('Database cleared. campaign_presets table was preserved.');
  } catch (err) {
    console.error('Error clearing database:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

main();
