# Railway Backend Setup Guide

## 🚀 Quick Setup Steps

### 1. Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository: `kelarsco/blaster`
3. Deploy the backend service

### 2. Configure Environment Variables
In your Railway project settings, add these environment variables:

#### Database Connection
```
DATABASE_URL=postgresql://neondb_owner:npg_1KQ8GVACqpnL@ep-icy-silence-ahqtq6i7-pooler.c-3.us-east-1.aws.neon.tech/blaster?sslmode=require&channel_binding=require
```

#### Frontend URL
```
FRONTEND_URL=http://localhost:3000
# For production: https://wiblaster.com
```

#### JWT Secret
```
JWT_SECRET=your-super-secret-jwt-key-here
```

#### Google OAuth (required for “Sign in with Google”)
```
GOOGLE_CLIENT_ID=108521960351-e4nbs81qqa7pp88lac8rma7vqu2sobk1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret-from-google-console
GOOGLE_CALLBACK_URL=https://blaster-production.up.railway.app/api/auth/google/callback
FRONTEND_URL=https://blaster-production.up.railway.app
SESSION_SECRET=long-random-string
JWT_ACCESS_SECRET=long-random-string
JWT_REFRESH_SECRET=long-random-string
```

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth client:

- **Authorized JavaScript origins:** `https://blaster-production.up.railway.app`
- **Authorized redirect URIs:** `https://blaster-production.up.railway.app/api/auth/google/callback`

Keep localhost URIs for local dev. After changing Railway variables, **redeploy** the service.

Check config: `GET https://blaster-production.up.railway.app/api/auth/google/setup`

#### Resend Email (Optional)
```
RESEND_API_KEY=re_your_resend_api_key
```

### 3. Update Frontend Environment
Create/update `client/.env.local`:

```
VITE_API_URL=https://your-railway-app-url.railway.app
```

### 4. Test the Setup
1. Your Railway backend URL will be shown in Railway dashboard
2. Update `VITE_API_URL` with that URL
3. Restart your frontend development server
4. Test login/signup functionality

## 🔧 Common Issues

### "Backend not configured" Error
- **Cause:** `VITE_API_URL` is not set or Railway backend is not deployed
- **Fix:** Deploy to Railway and set the environment variable

### Google OAuth Not Working
- **Cause:** Google OAuth credentials not configured in Railway
- **Fix:** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Railway env vars

### Database Connection Issues
- **Cause:** `DATABASE_URL` is incorrect or Neon database is not accessible
- **Fix:** Verify your Neon database connection string

## 📱 Testing

Once configured:
1. ✅ Login/Signup should work
2. ✅ Google OAuth should work (if configured)
3. ✅ Email verification should work (if Resend configured)
4. ✅ Scanning functionality should work

## 🚨 Important Notes

- Never commit `.env.local` files to Git
- Always use HTTPS URLs in production
- Test with Railway's provided URL first
- Google OAuth requires HTTPS redirect URLs
