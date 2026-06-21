/**
 * One-time seed: create admin user (dev only).
 * Run: node seed-admin.js (from server directory, with DATABASE_URL in .env)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initDb, getDb } from './db.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'example@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Admin';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('seed-admin.js must not run in production.');
    process.exit(1);
  }
  if (!ADMIN_PASSWORD) {
    console.error('Set SEED_ADMIN_PASSWORD in server/.env before running seed-admin.js');
    process.exit(1);
  }
  await initDb();
  const db = getDb();
  if (!db) {
    console.error('DATABASE_URL is not set. Add it to server/.env and run again.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const id = uuidv4();
  try {
    await db.query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $4`,
      [id, ADMIN_EMAIL, hash, ADMIN_NAME]
    );
    console.log('Admin user ready for:', ADMIN_EMAIL);
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

seed();
