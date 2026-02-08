/**
 * Clear subscription data and set Essentials plan to $20.
 * Run from server dir: node scripts/clear-subscriptions-and-set-essentials-price.js
 */
import 'dotenv/config';
import { getDb, initDb } from '../db.js';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    console.error('DATABASE_URL is not set.');
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
    await client.query('DELETE FROM subscriptions');
    await client.query('UPDATE user_extra_credit SET paid_cents = 0, updated_at = NOW()');
    await client.query("UPDATE plans SET amount = 2000 WHERE id = 'essentials_monthly'");
    await client.query("UPDATE plans SET amount = 20000 WHERE id = 'essentials_annual'");
    console.log('Done: subscriptions cleared, extra credit zeroed, Essentials set to $20 (monthly) / $200 (annual).');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

main();
