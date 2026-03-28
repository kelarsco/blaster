# Railway - Switch to Supabase Database

## New Supabase Connection String for Railway

Replace your Railway DATABASE_URL with:

```
postgresql://postgres:cM3ZJf!yiUuuHid@db.oaijpdhtfoaknpujljsi.supabase.co:5432/postgres
```

## Steps to Update Railway:

1. Go to Railway Dashboard
2. Select blaster-production project  
3. Go to Variables tab
4. Replace DATABASE_URL with the Supabase connection string above
5. Click "Deploy" to restart service
6. Monitor logs for "Neon DB connected and schema ready" (will now say Supabase)

## Migration Status: ✅ COMPLETED

✅ All tables created in Supabase
✅ Plans data inserted successfully  
✅ Database ready for connection

## Benefits of Supabase over Neon:

✅ No compute quota limits
✅ 500MB free database storage  
✅ Better reliability and uptime
✅ Built-in authentication (optional)
✅ Easy dashboard management
✅ Better performance for your use case

## Expected Result:

After updating Railway:
- No more "compute time quota exceeded" errors
- Stable database connection
- All functionality working normally
- Better overall performance
