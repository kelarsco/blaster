# Email Service Refactor - Deployment Guide

## Overview
Refactored email sending from Railway to use Vercel serverless function to eliminate timeout issues.

## Files Created/Modified

### Vercel API (`vercel-api/`)
- `send-email.js` - Main email sending API
- `vercel.json` - Vercel configuration

### Railway Backend (`server/`)
- `services/vercelEmailService.js` - New service for Vercel API calls
- `services/sendProcessor.js` - Updated to use Vercel instead of direct Nodemailer
- `migrations/add_email_logs.sql` - Database migration for email tracking

## Environment Variables

### Railway Environment Variables
```bash
# Vercel API Configuration
VERCEL_EMAIL_API_URL=https://your-vercel-app.vercel.app/api/send-email
INTERNAL_API_KEY=your-secret-api-key-here

# Keep existing variables
DATABASE_URL=...
JWT_SECRET=...
RESEND_API_KEY=... (if still using for some emails)
```

### Vercel Environment Variables
```bash
# Security
INTERNAL_API_KEY=your-secret-api-key-here

# Optional: Add any other required env vars
```

## Deployment Steps

### 1. Deploy Vercel API
```bash
cd vercel-api
vercel --prod
```

### 2. Update Railway
```bash
# Add environment variables to Railway
# Run database migration
psql $DATABASE_URL < server/migrations/add_email_logs.sql

# Deploy Railway
git add .
git commit -m "Refactor email sending to use Vercel API"
git push origin main
```

## Security Notes

1. **API Key Protection**: Vercel API requires `X-API-Key` header
2. **CORS**: Configured for Railway domain access
3. **Fire-and-Forget**: Railway doesn't wait for email response
4. **Error Handling**: Vercel API returns appropriate HTTP status codes

## Benefits

- ✅ **No more Railway timeouts** - Email sending is external
- ✅ **Better reliability** - Vercel has better networking for SMTP
- ✅ **Multi-user support** - Each user's SMTP credentials handled separately
- ✅ **Minimal changes** - Existing architecture preserved
- ✅ **Production safe** - Non-blocking, with error handling

## Testing

```bash
# Test Vercel API directly
curl -X POST https://your-vercel-app.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{
    "smtpConfig": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    },
    "email": {
      "to": "test@example.com",
      "subject": "Test Email",
      "html": "<h1>Test</h1>"
    }
  }'
```

## Monitoring

- Check Railway logs for API call attempts
- Check Vercel function logs for email sending status
- Monitor `email_logs` table for delivery tracking
