# StoreReach

**Automated Store Email Extraction & Cold Outreach Tool**

StoreReach helps you extract publicly available business emails from eCommerce store websites, organize them by source store, and send automated cold emails at scale with smart sender rotation and timing controls.

## Tech Stack

- **Frontend:** React (Vite), Tailwind CSS, glass-style UI, dark/light theme.
- **Backend:** Node.js (Express).
- **Database:** PostgreSQL via [Neon](https://neon.tech) only (`pg` driver). Tables are created automatically on first run.
- **Crawling:** Cheerio + Node `https`/`http` (no Redis or external queue).

## Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) account (free tier is fine)

## Quick Start

1. **Clone and install**
   ```bash
   cd "store scouter"
   npm install
   ```

2. **Neon**
   - Create a project at [neon.tech](https://neon.tech).
   - Copy the **connection string** (pooled or direct).

3. **Server env**
   - In `server/`, create `.env` with:
   ```env
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   - Install and run the server:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   - You should see: `Neon DB connected and schema ready.` then `StoreReach server running at http://localhost:4000` (or 4001 if 4000 is in use).

4. **Client**
   - In another terminal:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   - If the server runs on **4001**, create `client/.env` with:
   ```env
   VITE_API_PORT=4001
   ```
   - Open http://localhost:3000.

5. **Use the app**
   - Paste store URLs (one per line or comma-separated), click **Start Scan**. Results and automation (senders, templates, campaigns) use Neon for storage.

## Scripts

| Command        | Where   | Description              |
|----------------|---------|--------------------------|
| `npm run dev`  | server  | Start API (Neon required)|
| `npm run dev`  | client  | Start React dev server   |
| `npm run start`| server  | Production run           |

## Environment

| Variable       | Required | Description |
|----------------|----------|-------------|
| `DATABASE_URL` | Yes      | Neon PostgreSQL connection string |
| `PORT`         | No       | Server port (default `4000`)       |

## Deploy (e.g. Vercel)

1. Set `DATABASE_URL` in your hosting env to your Neon connection string.
2. Build client: `cd client && npm run build`.
3. Deploy the server (serves `client/dist` as static). Schema runs on first request via `initDb()`.

## Compliance

Use responsibly. You are responsible for complying with outreach regulations (e.g. CAN-SPAM, GDPR). The app includes a confirmation checkbox before starting automation.

## License

MIT.
