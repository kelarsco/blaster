# Signup & Login setup (wiblaster)

Signup and login are **already implemented** with email/password and a 6-digit verification code sent via **Resend**. Here’s what you need to make it work.

---

## 1. Database (required)

Auth stores users and verification codes in PostgreSQL.

- Create a database (e.g. [Neon](https://neon.tech)).
- In **server/.env** set:
  ```env
  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
  ```
- Restart the server. You should see the DB connect and schema ready.

---

## 2. Resend (verification emails)

Verification codes are sent with [Resend](https://resend.com).

1. Sign up at [resend.com](https://resend.com) and get an **API key** (Dashboard → API Keys).
2. In **server/.env** set:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```
3. **Testing only:** Resend’s default `onboarding@resend.dev` can only send to the email address of your Resend account. To test signup, use that same email as the signup email, or add your address in Resend.
4. **Production:** In Resend, add and verify your domain, then in **server/.env** set:
   ```env
   VERIFICATION_EMAIL_FROM=noreply@yourdomain.com
   ```
   (Optional: `VERIFICATION_EMAIL_FROM_NAME=wiblaster`.)

If `RESEND_API_KEY` is missing, the server returns *"Email verification is not configured"* and signup is disabled.

---

## 3. Token auth (recommended for production)

Login and verify-email issue a JWT access token and a refresh token (cookie). Set in **server/.env**:

```env
JWT_ACCESS_SECRET=your-long-random-access-secret
JWT_REFRESH_SECRET=your-long-random-refresh-secret
```

If these are not set, the server falls back to `SESSION_SECRET` (or a dev default). In production, always set the JWT secrets.

---

## 4. Flow

1. **Sign up** – User enters username, email, password → POST `/api/auth/register` → user is created (unverified), 6-digit code is sent via Resend → redirect to **Verify email**.
2. **Verify email** – User enters the code from the email → POST `/api/auth/verify-email` → user is marked verified and gets access + refresh tokens → redirect to app.
3. **Login** – User enters email + password → POST `/api/auth/login` → if not verified, they’re told to verify first; otherwise they get tokens and are signed in.
4. **Resend code** – On the verify-email page, “Resend code” calls POST `/api/auth/resend-verification` and sends a new code.

---

## 5. Optional: Google sign-in

To enable “Sign in with Google”:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create OAuth 2.0 credentials (Web application).
2. Set **Authorized redirect URI** to your **backend** callback URL:
   - Dev (Vite proxy): `http://localhost:3000/api/auth/google/callback`
   - Render backend: `https://your-backend.onrender.com/api/auth/google/callback`
3. In **server/.env** set:
   ```env
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxx
   # The URL Google redirects back to (must match Authorized redirect URI exactly)
   GOOGLE_CALLBACK_URL=https://your-backend.onrender.com/api/auth/google/callback
   # Where your app UI lives (used after backend finishes auth)
   FRONTEND_URL=https://your-frontend-domain.com
   ```

---

## 6. Checklist

| Step | What to do |
|------|------------|
| DB | Set `DATABASE_URL` in **server/.env** and restart server. |
| Resend | Set `RESEND_API_KEY` in **server/.env**. |
| Production email | Verify a domain in Resend and set `VERIFICATION_EMAIL_FROM`. |
| Production auth | Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. |
| (Optional) Google | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`. |

After that, signup and login (including verification) work with Resend.
