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
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    await runSchema(pool);
    console.log('Neon DB connected and schema ready.');
  } catch (err) {
    console.error('DB schema error:', err.message);
    process.exit(1);
  }

  return pool;
}

async function runSchema(p) {
  const client = await p.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
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
        email TEXT NOT NULL,
        config TEXT,
        max_per_minute INTEGER DEFAULT 10,
        is_active SMALLINT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaign_presets (
        id TEXT PRIMARY KEY,
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
        preset_id TEXT,
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

      CREATE TABLE IF NOT EXISTS store_notes (
        store_url TEXT PRIMARY KEY,
        note TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
