# wiblaster – Deploy to Vercel (frontend), Railway (server), Neon (DB)

## Overview

| Part        | Host   | Purpose                    |
|------------|--------|----------------------------|
| **Frontend** | Vercel | SPA (React), wiblaster UI  |
| **Backend**  | Railway | Node API (scans, campaigns, auth) |
| **Database** | Neon   | PostgreSQL                 |

---

## 1. Neon (Database)

1. Go to [neon.tech](https://neon.tech) and create a project.
2. Copy the **connection string** (e.g. `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. You’ll use this as `DATABASE_URL` on Railway.

---

## 2. Railway (Server / API)

1. Go to [railway.app](https://railway.app) and create a project.
2. **New → GitHub repo** and select this repo.
3. In project settings:
   - **Root Directory:** `server`
   - **Build:** (default, installs deps)
   - **Start:** uses `npm start` from `server/package.json`
4. **Variables** (Railway dashboard → your service → Variables):

   | Variable           | Value / note |
   |--------------------|--------------|
   | `DATABASE_URL`     | Neon connection string from step 1 |
   | `SESSION_SECRET`   | Long random string (e.g. `openssl rand -hex 32`) |
   | `FRONTEND_URL`     | Your Vercel URL, e.g. `https://your-app.vercel.app` |
   | `GOOGLE_CLIENT_ID` | (optional) From Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | (optional) From Google Cloud Console |
   | `GOOGLE_CALLBACK_URL` | (optional) `https://your-app.vercel.app/api/auth/google/callback` |

5. Deploy. Note the **public URL** (e.g. `https://your-app.railway.app`). You’ll use it as `VITE_API_URL` on Vercel.

---

## 3. Vercel (Frontend / SPA)

1. Go to [vercel.com](https://vercel.com) and import this repo.
2. **Project settings:**
   - **Root Directory:** `client`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
3. **Environment variables:**

   | Name            | Value | Env    |
   |-----------------|-------|--------|
   | `VITE_API_URL`  | Your Railway URL, e.g. `https://your-app.railway.app` | Production (and Preview if you want) |

   Do **not** add a trailing slash. The server allows credentials (cookies) and uses `SameSite=None` when `FRONTEND_URL` is set so login works across Vercel ↔ Railway.

4. Deploy. Vercel will use `client/vercel.json` for:
   - SPA routing: all routes (e.g. `/`, `/login`, `/app/dashboard`) serve `index.html` so React Router works.
   - Static assets from `dist` are served as usual.

---

## 4. Google OAuth (optional)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client (Web).
2. **Authorized redirect URIs:**  
   `https://your-app.vercel.app/api/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (and `SESSION_SECRET`) on Railway as in step 2.
4. Without these, the app still runs with a dev user (no real login).

---

## 5. Checklist

- [ ] Neon: project created, connection string copied.
- [ ] Railway: root = `server`, `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_URL` set; deploy and copy public URL.
- [ ] Vercel: root = `client`, `VITE_API_URL` = Railway URL; deploy.
- [ ] (Optional) Google OAuth: redirect URI = `https://<vercel-app>/api/auth/google/callback`; credentials on Railway.

---

## Local dev (unchanged)

- **Backend:** `cd server && npm run dev`
- **Frontend:** `cd client && npm run dev` (proxies `/api` to backend)
- **Full stack from root:** `npm run dev`

No `VITE_API_URL` in local `.env` – the client uses the Vite proxy and relative `/api`.
