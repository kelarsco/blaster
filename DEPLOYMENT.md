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

The backend (Railway) handles the Google redirect. The callback URL must be your **Railway** URL, not your frontend domain.

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client (Web application).
2. **Authorized JavaScript origins** (add both if you use them):
   - `https://www.yourdomain.com`
   - `https://yourdomain.com` (if you use the non-www version)
3. **Authorized redirect URIs** (add both; use your real Railway public URL, no trailing slash):
   - `https://your-railway-app.railway.app/api/auth/google/callback`
   - `https://your-railway-app.railway.app/api/auth/gmail-connect/callback` (for “Connect Gmail inbox” on Senders page)
4. **Railway variables:** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and:
   - `GOOGLE_CALLBACK_URL` = `https://your-railway-app.railway.app/api/auth/google/callback`
   - `FRONTEND_URL` = `https://www.yourdomain.com` (so the backend redirects users back to your site after login)
5. Without these, the app still runs with email/password only (no Google sign-in).

---

## 5. Checklist

- [ ] Neon: project created, connection string copied.
- [ ] Railway: root = `server`, `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_URL` set; deploy and copy public URL.
- [ ] Vercel: root = `client`, `VITE_API_URL` = Railway URL; deploy.
- [ ] (Optional) Google OAuth: redirect URI = `https://<railway-url>/api/auth/google/callback` in Google Console; `GOOGLE_CALLBACK_URL` and `FRONTEND_URL` on Railway.

---

## Local dev (unchanged)

- **Backend:** `cd server && npm run dev`
- **Frontend:** `cd client && npm run dev` (proxies `/api` to backend)
- **Full stack from root:** `npm run dev`

No `VITE_API_URL` in local `.env` – the client uses the Vite proxy and relative `/api`.

---

## 6. Custom domain

- **Frontend (Vercel):** Add your domain in Vercel → Project → Settings → Domains. Then set **`VITE_API_URL`** in Vercel’s env to your **Railway backend URL** (not your custom domain). Redeploy after changing env.
- **Railway:** In Variables, set **`FRONTEND_URL`** to your **actual frontend origin**, e.g. `https://yourdomain.com` (no trailing slash). This is required for auth cookies to work cross-origin.

---

## 7. Troubleshooting: “Signup failed” / 405 on `/api/auth/register` or `/api/auth/refresh`

**Symptom:** Browser shows “Signup failed” and console shows `405 (Method Not Allowed)` for `/api/auth/register` or `/api/auth/refresh`.

**Cause:** The app is calling the API on the **frontend origin** (your domain or Vercel URL) instead of the **Railway backend**. That happens when the frontend was built **without** `VITE_API_URL` set, so it uses relative `/api/...` and the static host returns 405 for POST.

**Fix:**

1. **Where the frontend is built** (Vercel, Netlify, etc.): add or correct the env var **`VITE_API_URL`** = your **Railway backend URL** (e.g. `https://your-app.railway.app`). No trailing slash.
2. **Redeploy the frontend** so a new build picks up `VITE_API_URL`. Changing the variable alone is not enough; you must trigger a new build.
3. On **Railway**, set **`FRONTEND_URL`** to your **frontend origin** (e.g. `https://yourdomain.com` or your Vercel URL) so refresh-token cookies are allowed for your site.

---

## 8. Troubleshooting: Campaign “Connection timeout” / emails failing

**Symptom:** Campaigns show “Last error: Connection timeout” and emails are marked failed.

**Cause:** Campaign emails are sent from your **Railway server** to your **sender’s SMTP server** (e.g. Gmail, Outlook). The connection from Railway to that SMTP host (e.g. `smtp.gmail.com:587`) is timing out. Common reasons:

1. **Outbound SMTP restricted** – Many cloud hosts (including some Railway regions/networks) block or throttle outbound SMTP (ports 25, 587, 465) to reduce spam. So the TCP connection never completes → “Connection timeout”.
2. **Slow or flaky network** – TLS handshake or routing can be slow; we increased timeouts to 25s to help.

**What we did in code:** Connection/greeting timeouts were increased, and on connection-type errors the SMTP transporter cache is cleared so the next send tries a fresh connection.

**What you can do:**

- **Confirm outbound SMTP from Railway** – Check Railway docs or support for “outbound SMTP” or “ports 587, 465”. If they’re blocked, campaigns that use “your own Gmail/Outlook” from the app will keep failing from that host.
- **Use an SMTP relay that works from the cloud** – Some providers offer SMTP over ports that aren’t blocked, or an HTTP API. If you have Resend, you can use [Resend’s SMTP](https://resend.com/docs/send-with-smtp) and add a sender in the app with Resend’s SMTP host/port and API key as password; that may work if Railway allows the connection to Resend’s SMTP.
- **Run the backend elsewhere** – If you need to send via Gmail/Outlook from the app, run the API on a VPS or host that allows outbound SMTP (e.g. a small VPS that doesn’t block port 587).
