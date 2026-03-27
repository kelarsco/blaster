# Railway Service Troubleshooting

## Current Issue:
- **503 Service Unavailable** from Railway backend
- **Database migration completed** successfully to Neon
- **Railway service itself is down/crashed**

## Immediate Steps to Fix:

### 1. Check Railway Dashboard
1. Go to [Railway Dashboard](https://railway.app)
2. Select `blaster-production` project
3. Check service status - likely shows **RED** or **CRASHED**

### 2. View Service Logs
1. Click on your service
2. Go to **"Logs"** tab
3. Look for error messages like:
   - `Cannot connect to database`
   - `Port binding error`
   - `Out of memory`
   - `Timeout error`

### 3. Common Fixes Based on Logs:

#### If Database Connection Error:
```
Error: Cannot connect to DATABASE_URL
```
**Fix:** Update DATABASE_URL environment variable with:
```
DATABASE_URL=postgresql://neondb_owner:npg_41GxSYyAoTZF@ep-purple-sun-amvcs0kp-pooler.c-5.us-east-1.aws.neon.tech/wiblaster?sslmode=require&channel_binding=require
```

#### If Port Binding Error:
```
Error: listen EADDRINUSE :::3000
```
**Fix:** Ensure server binds to correct port:
```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');
```

#### If Memory Error:
```
Error: JavaScript heap out of memory
```
**Fix:** Increase Railway memory allocation in service settings

### 4. Restart Service
1. Click **"Restart"** button in Railway dashboard
2. Wait for deployment to complete
3. Check logs for "Neon DB connected and schema ready"

### 5. If Still Down:
1. **Redeploy** by pushing a small change:
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push origin main
   ```
2. **Check Railway status page**: status.railway.app

## Expected Success Message:
When working, logs should show:
```
Neon DB connected and schema ready.
Server running on port 3000
```

## Test After Fix:
Try accessing: https://blaster-production.up.railway.app/api/auth/me
Should return user data or 401 (not 503)
