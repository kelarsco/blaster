# Fly.io multi-machine architecture

Wiblaster splits into three process groups on Fly (same app `wiblaster`, same Docker image):

| Process | Machine | Role |
|---------|---------|------|
| `api` | 1× always-on | HTTP, auth, billing, admin API — **no scans, no lead engine** |
| `scan` | 1+ (scale out) | Store scan jobs from Postgres queue |
| `lead` | 1× | Lead engine pipeline, scrape scheduler, campaign email sends |

All machines share one **managed Postgres** (`DATABASE_URL` — Neon, Supabase, or Fly Postgres).

```
                    ┌─────────────────┐
  Browser ────────► │  api (Fly :443) │
                    │  auth + REST    │
                    └────────┬────────┘
                             │ enqueue jobs
                             ▼
                    ┌─────────────────┐
                    │  Postgres       │
                    │  worker_jobs    │
                    │  lead_stores    │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        scan worker    scan worker     lead worker
        (machine 2)    (optional +1)   (machine 3)
```

---

## One-time setup

### 1. Database (Neon recommended)

You already use Neon. Keep using the **pooler** URL in `DATABASE_URL`.

```bash
# From repo root — set secrets on the Fly app (if not already done)
fly secrets set DATABASE_URL="postgresql://..." -a wiblaster
fly secrets set JWT_ACCESS_SECRET="..." SESSION_SECRET="..." BL_ADMIN_JWT_SECRET="..." -a wiblaster
# … all other existing secrets (Paystack, Google, SMTP, etc.)
```

Optional auth/scan tuning (already in `fly.toml` `[env]`):

```bash
fly secrets set ENABLE_LEAD_ENGINE=1 -a wiblaster
```

### 2. Deploy with process groups

```bash
# From repo root
fly deploy -a wiblaster
```

### 3. Scale each process group

After the first multi-process deploy:

```bash
fly scale count api=1 scan=1 lead=1 -a wiblaster
```

Verify machines:

```bash
fly status -a wiblaster
fly machines list -a wiblaster
```

You should see machines tagged `api`, `scan`, and `lead`.

### 4. Confirm health

```bash
curl https://wiblaster.fly.dev/api/health
# → { "ok": true, "server": "up", "role": "api", "db": "connected" }
```

### 5. Test a scan

1. Log in on production.
2. Start a store scan.
3. API inserts a row into `worker_jobs` — it does **not** crawl locally.
4. Check scan worker logs:

```bash
fly logs -a wiblaster --process scan
```

---

## Horizontal scaling

Add more scan capacity:

```bash
fly scale count scan=2 -a wiblaster
# or scan=3, etc.
```

Workers claim jobs with `FOR UPDATE SKIP LOCKED` — no duplicate processing.

---

## Local development

Single process (unchanged):

```bash
cd server
npm run dev
# PROCESS_ROLE=all (default) — in-memory queue, everything in one process
```

Test worker entrypoints locally:

```bash
# Terminal 1 — API
PROCESS_ROLE=api node index.js

# Terminal 2 — scan worker (needs DATABASE_URL)
node scan-worker.js

# Terminal 3 — lead worker
ENABLE_LEAD_ENGINE=1 node lead-worker.js
```

---

## Environment variables by role

| Variable | api | scan | lead |
|----------|-----|------|------|
| `PROCESS_ROLE` | `api` (set in fly.toml) | `scan` | `lead` |
| `DATABASE_URL` | ✓ | ✓ | ✓ |
| `ENABLE_LEAD_ENGINE` | ignored | ignored | `1` |
| `SCAN_CONCURRENCY` | ignored | `1` | ignored |
| `CRAWL_MAX_IN_FLIGHT` | ignored | `3` | `3` |
| `DB_POOL_MAX` | `6` | `4` | `4` |
| `DB_AUTH_POOL_MAX` | `2` | `1` | `1` |

Per-process env overrides on Fly (optional):

```bash
fly secrets set SCAN_CONCURRENCY=1 -a wiblaster
```

---

## Optional: fully separate Fly apps

Instead of process groups, you can run three apps with the same image:

| App name | Command | HTTP |
|----------|---------|------|
| `wiblaster` | `node index.js` | Yes (public) |
| `wiblaster-scan` | `node scan-worker.js` | No |
| `wiblaster-lead` | `node lead-worker.js` | No |

Copy `fly.toml` → `fly.scan.toml` / `fly.lead.toml`, change `app =`, remove `[http_service]`, deploy:

```bash
fly deploy -c fly.scan.toml -a wiblaster-scan
fly deploy -c fly.lead.toml -a wiblaster-lead
```

Same `DATABASE_URL` secret on all three apps.

---

## Database read replicas (future)

For heavy Stores page traffic:

1. Add a Neon **read replica** (or Supabase read pool).
2. Set `DATABASE_READ_URL` (not implemented yet) for read-only routes like `/api/leads/stores`.

Primary `DATABASE_URL` stays on api + workers for writes and job queue.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Scans stuck on `pending` | `fly scale count scan=1` and `fly logs --process scan` |
| Login slow again | Confirm `api=1` and scan/lead are separate machines (`fly status`) |
| Lead engine idle | `ENABLE_LEAD_ENGINE=1`, check `fly logs --process lead` |
| Jobs never picked up | Confirm `worker_jobs` table exists (deploy api once to run migrations) |

Release stale stuck jobs (SQL):

```sql
UPDATE worker_jobs
SET status = 'pending', claimed_by = NULL, claimed_at = NULL
WHERE status = 'processing' AND claimed_at < NOW() - INTERVAL '1 hour';
```

---

## Rollback to single machine

```bash
fly scale count api=1 scan=0 lead=0 -a wiblaster
```

Set in `fly.toml` temporarily: remove `[processes]` scan/lead sections and redeploy — or keep workers at 0 and only run `api`.
